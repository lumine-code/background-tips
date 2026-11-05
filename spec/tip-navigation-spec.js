describe("Background tip navigation", () => {
  let view, providers, workspaceElement;

  const contribute = (packageName, tips) => {
    const provider = view.addTips({ packageName, tips });
    providers.push(provider);
    return provider;
  };

  const show = (source) => {
    const tip = view.tips.find((candidate) => candidate.source === source);
    view.index = view.tips.indexOf(tip) - 1;
    view.showNextTip();
    advanceClock(view.fadeDuration);
  };

  const pressArrow = (key, target = view.element.parentNode) => {
    const event = new KeyboardEvent("keydown", {
      key,
      code: key,
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, "target", { value: target });
    lumine.keymaps.handleKeyboardEvent(event);
  };

  beforeEach(async () => {
    workspaceElement = lumine.views.getView(lumine.workspace);
    jasmine.attachToDOM(workspaceElement);
    view = (await lumine.packages.activatePackage("background-tips")).mainModule.backgroundTipsView;
    providers = [];
    lumine.config.set("background-tips.ignoredPackages", ["background-tips"]);
    contribute("navigation-tips", ["First tip.", "Second tip.", "Third tip."]);
    advanceClock(view.startDelay + view.fadeDuration);
  });

  afterEach(() => {
    for (const provider of providers) provider.dispose();
    lumine.config.unset("background-tips.ignoredPackages");
  });

  it("moves in both directions and wraps at either end through the pane keymap", () => {
    show("First tip.");
    const navigate = spyOn(view, "navigateTips").and.callThrough();
    const pane = view.element.parentNode;
    expect(lumine.commands.canDispatch(pane, "background-tips:next-tip")).toBe(true);
    expect(lumine.commands.canDispatch(pane, "background-tips:previous-tip")).toBe(true);

    for (const [key, expected] of [
      ["ArrowLeft", "Third tip."],
      ["ArrowRight", "First tip."],
      ["ArrowRight", "Second tip."],
      ["ArrowLeft", "First tip."],
    ]) {
      pressArrow(key);
      advanceClock(view.fadeDuration);
      expect(view.message.textContent).toBe(expected);
    }
    expect(navigate.calls.allArgs()).toEqual([[-1], [1], [1], [-1]]);
  });

  it("skips ignored, empty and unbound tips in either direction", () => {
    contribute("ignored-navigation-tips", ["Do not show this tip."]);
    contribute("unavailable-navigation-tips", [
      "{% if platform == 'not-a-platform' %}Never visible.{% endif %}",
      "{{ 'navigation-tips:unbound' | keystroke }}",
    ]);
    lumine.config.set("background-tips.ignoredPackages", [
      "background-tips",
      "ignored-navigation-tips",
    ]);
    show("Third tip.");

    pressArrow("ArrowRight");
    advanceClock(view.fadeDuration);
    expect(view.message.textContent).toBe("First tip.");

    pressArrow("ArrowLeft");
    advanceClock(view.fadeDuration);
    expect(view.message.textContent).toBe("Third tip.");
  });

  it("gives a manually selected tip a full rotation period and retires the old timer", () => {
    const rotate = spyOn(view, "showNextTip").and.callThrough();
    advanceClock(view.displayDuration - view.fadeDuration - 1);

    pressArrow("ArrowRight");
    advanceClock(1);
    expect(rotate).not.toHaveBeenCalled();
    advanceClock(view.displayDuration - 2);
    expect(rotate).not.toHaveBeenCalled();
    advanceClock(1);
    expect(rotate).toHaveBeenCalledTimes(1);
    advanceClock(view.displayDuration);
    expect(rotate).toHaveBeenCalledTimes(2);
  });

  it("cancels an earlier pending fade when the direction changes quickly", () => {
    show("First tip.");
    pressArrow("ArrowRight");
    expect(view.currentTip.source).toBe("Second tip.");
    advanceClock(view.fadeDuration / 2);

    pressArrow("ArrowLeft");
    expect(view.currentTip.source).toBe("First tip.");
    advanceClock(view.fadeDuration / 2);
    expect(view.message.textContent).toBe("First tip.");
    advanceClock(view.fadeDuration / 2);
    expect(view.message.textContent).toBe("First tip.");
  });

  it("keeps navigation relative to the current tip when an earlier provider disappears", () => {
    const earlier = contribute("earlier-navigation-tips", ["Withdrawn tip."]);
    contribute("later-navigation-tips", ["Later first.", "Later second.", "Later third."]);
    show("Later second.");

    earlier.dispose();
    expect(view.tips[view.index]).toBe(view.currentTip);
    pressArrow("ArrowLeft");
    advanceClock(view.fadeDuration);
    expect(view.message.textContent).toBe("Later first.");
    pressArrow("ArrowRight");
    advanceClock(view.fadeDuration);
    expect(view.message.textContent).toBe("Later second.");
  });

  it("shows the next surviving tip when the current provider disappears", () => {
    const withdrawn = contribute("withdrawn-navigation-tips", [
      "Withdrawn first.",
      "Withdrawn second.",
    ]);
    contribute("successor-navigation-tips", ["The next available tip."]);
    show("Withdrawn second.");

    withdrawn.dispose();
    expect(view.currentTip.source).toBe("The next available tip.");
    advanceClock(view.fadeDuration);
    expect(view.message.textContent).toBe("The next available tip.");
  });

  it("keeps rotation stopped when every tip is ignored and restarts when tips are restored", () => {
    lumine.config.set("background-tips.ignoredPackages", ["background-tips", "navigation-tips"]);
    view.start();
    expect(view.element.parentNode).toBeNull();
    expect(view.interval).toBeNull();
    const rotate = spyOn(view, "showNextTip").and.callThrough();
    advanceClock(view.displayDuration + view.fadeDuration);
    expect(rotate).not.toHaveBeenCalled();

    lumine.config.set("background-tips.ignoredPackages", ["background-tips"]);
    expect(view.element.parentNode).toBeTruthy();
    expect(view.interval).not.toBeNull();
    advanceClock(view.fadeDuration);
    expect(["First tip.", "Second tip.", "Third tip."]).toContain(view.message.textContent);
  });

  it("leaves arrows outside the empty pane to their focused surfaces", async () => {
    const navigate = spyOn(view, "navigateTips").and.callThrough();
    const tree = document.createElement("div");
    tree.classList.add("tree-view");
    const terminal = document.createElement("terminal-view");
    const mini = lumine.workspace.buildTextEditor({ mini: true });
    const miniElement = lumine.views.getView(mini);
    const surfaces = [tree, terminal, miniElement];
    try {
      for (const surface of surfaces) {
        workspaceElement.appendChild(surface);
        expect(lumine.commands.canDispatch(surface, "background-tips:next-tip")).toBe(false);
        pressArrow("ArrowRight", surface);
        pressArrow("ArrowLeft", surface);
      }
      const editor = await lumine.workspace.open();
      const editorElement = lumine.views.getView(editor);
      expect(view.element.parentNode).toBeNull();
      expect(lumine.commands.canDispatch(editorElement, "background-tips:previous-tip")).toBe(
        false,
      );
      pressArrow("ArrowRight", editorElement);
      pressArrow("ArrowLeft", editorElement);
      expect(navigate).not.toHaveBeenCalled();
    } finally {
      for (const surface of surfaces) surface.remove();
      mini.destroy();
    }
  });

  it("disposes navigation commands and timers before a new package generation activates", async () => {
    const oldView = view;
    const pane = view.element.parentNode;
    const oldNavigate = spyOn(oldView, "navigateTips").and.callThrough();
    const oldRotate = spyOn(oldView, "showNextTip").and.callThrough();
    pressArrow("ArrowRight");
    oldNavigate.calls.reset();
    await lumine.packages.deactivatePackage("background-tips");

    const marker = document.createElement("background-tips");
    pane.appendChild(marker);
    try {
      expect(lumine.commands.canDispatch(pane, "background-tips:next-tip")).toBe(false);
      expect(lumine.commands.canDispatch(pane, "background-tips:previous-tip")).toBe(false);
      pressArrow("ArrowRight", pane);
      advanceClock(oldView.displayDuration + oldView.fadeDuration);
      expect(oldNavigate).not.toHaveBeenCalled();
      expect(oldRotate).not.toHaveBeenCalled();
      expect(oldView.element.parentNode).toBeNull();
      expect(oldView.interval).toBeNull();
    } finally {
      marker.remove();
    }

    lumine.config.set("background-tips.ignoredPackages", []);
    view = (await lumine.packages.activatePackage("background-tips")).mainModule.backgroundTipsView;
    expect(view).not.toBe(oldView);
    advanceClock(view.startDelay + view.fadeDuration);
    const navigate = spyOn(view, "navigateTips").and.callThrough();
    pressArrow("ArrowLeft");
    expect(navigate).toHaveBeenCalledOnceWith(-1);
    expect(oldNavigate).not.toHaveBeenCalled();
  });
});
