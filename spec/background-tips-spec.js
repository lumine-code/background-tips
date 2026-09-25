const { humanizeKeystroke } = require("@lumine-code/underscore-plus");

describe("BackgroundTips", () => {
  let workspaceElement;

  const activatePackage = async () => {
    const { mainModule } = await lumine.packages.activatePackage("background-tips");
    return mainModule.backgroundTipsView;
  };

  beforeEach(() => {
    workspaceElement = lumine.views.getView(lumine.workspace);
    jasmine.attachToDOM(workspaceElement);
  });

  describe("when the package is activated when there is only one pane", () => {
    beforeEach(() => {
      expect(lumine.workspace.getCenter().getPanes().length).toBe(1);
    });

    describe("when the pane is empty", () => {
      it("attaches the view after a delay", async () => {
        expect(lumine.workspace.getActivePane().getItems().length).toBe(0);

        const backgroundTipsView = await activatePackage();
        expect(backgroundTipsView.element.parentNode).toBeFalsy();
        advanceClock(backgroundTipsView.startDelay + 1);
        expect(backgroundTipsView.element.parentNode).toBeTruthy();
      });
    });

    describe("when the pane is not empty", () => {
      it("does not attach the view", async () => {
        await lumine.workspace.open();

        const backgroundTipsView = await activatePackage();
        advanceClock(backgroundTipsView.startDelay + 1);
        expect(backgroundTipsView.element.parentNode).toBeFalsy();
      });
    });

    describe("when a second pane is created", () => {
      it("detaches the view", async () => {
        const backgroundTipsView = await activatePackage();
        advanceClock(backgroundTipsView.startDelay + 1);
        expect(backgroundTipsView.element.parentNode).toBeTruthy();

        lumine.workspace.getActivePane().splitRight();
        expect(backgroundTipsView.element.parentNode).toBeFalsy();
      });
    });
  });

  describe("when the package is activated when there are multiple panes", () => {
    beforeEach(() => {
      lumine.workspace.getActivePane().splitRight();
      expect(lumine.workspace.getCenter().getPanes().length).toBe(2);
    });

    it("does not attach the view", async () => {
      const backgroundTipsView = await activatePackage();
      advanceClock(backgroundTipsView.startDelay + 1);
      expect(backgroundTipsView.element.parentNode).toBeFalsy();
    });

    describe("when all but the last pane is destroyed", () => {
      it("attaches the view", async () => {
        const backgroundTipsView = await activatePackage();
        lumine.workspace.getActivePane().destroy();
        advanceClock(backgroundTipsView.startDelay + 1);
        expect(backgroundTipsView.element.parentNode).toBeTruthy();

        lumine.workspace.getActivePane().splitRight();
        expect(backgroundTipsView.element.parentNode).toBeFalsy();

        lumine.workspace.getActivePane().destroy();
        expect(backgroundTipsView.element.parentNode).toBeTruthy();
      });
    });
  });

  describe("when the view is attached", () => {
    let backgroundTipsView;

    beforeEach(async () => {
      expect(lumine.workspace.getCenter().getPanes().length).toBe(1);

      backgroundTipsView = await activatePackage();
      advanceClock(backgroundTipsView.startDelay);
      advanceClock(backgroundTipsView.fadeDuration);
    });

    it("has text in the message", () => {
      expect(backgroundTipsView.element.parentNode).toBeTruthy();
      expect(backgroundTipsView.message.textContent).toBeTruthy();
    });

    it("changes text in the message", async () => {
      const oldText = backgroundTipsView.message.textContent;
      advanceClock(backgroundTipsView.displayDuration);
      advanceClock(backgroundTipsView.fadeDuration);
      expect(backgroundTipsView.message.textContent).not.toEqual(oldText);
    });
  });

  describe("provider service", () => {
    let providerDisposables;

    const provide = (packageName, tips) => {
      const disposable = lumine.packages.serviceHub.provide("background-tips.provider", "1.0.0", {
        packageName,
        tips,
      });
      providerDisposables.push(disposable);
      return disposable;
    };

    const tipsFrom = (view, packageName) =>
      view.tips.filter((tip) => tip.packageName === packageName);

    beforeEach(() => {
      providerDisposables = [];
    });

    afterEach(() => {
      for (const disposable of providerDisposables) disposable.dispose();
    });

    it("collects a provider published before the package is activated", async () => {
      provide("early-tips", ["Published first."]);

      const backgroundTipsView = await activatePackage();

      expect(tipsFrom(backgroundTipsView, "early-tips").map((tip) => tip.source)).toEqual([
        "Published first.",
      ]);
    });

    it("collects a provider published after the package is activated", async () => {
      const backgroundTipsView = await activatePackage();

      provide("late-tips", ["Published later."]);

      expect(tipsFrom(backgroundTipsView, "late-tips").map((tip) => tip.source)).toEqual([
        "Published later.",
      ]);
    });

    it("removes exactly that provider's tips when the service is disposed", async () => {
      const backgroundTipsView = await activatePackage();
      const first = provide("first-tips", ["First."]);
      provide("second-tips", ["Second."]);

      first.dispose();

      expect(tipsFrom(backgroundTipsView, "first-tips")).toEqual([]);
      expect(tipsFrom(backgroundTipsView, "second-tips").map((tip) => tip.source)).toEqual([
        "Second.",
      ]);
    });

    it("does not accumulate tips when a provider is published again", async () => {
      const backgroundTipsView = await activatePackage();
      const first = provide("returning-tips", ["Only once."]);
      first.dispose();

      provide("returning-tips", ["Only once."]);

      expect(tipsFrom(backgroundTipsView, "returning-tips")).toHaveLength(1);
    });

    it("warns and ignores an invalid provider contribution", async () => {
      const backgroundTipsView = await activatePackage();
      spyOn(console, "warn");

      provide("broken-tips", [""]);

      expect(tipsFrom(backgroundTipsView, "broken-tips")).toEqual([]);
      expect(console.warn).toHaveBeenCalledWith(
        "background-tips: ignored an invalid provider contribution",
      );
    });
  });

  describe("ignored packages", () => {
    let backgroundTipsView, providerDisposable;

    beforeEach(async () => {
      backgroundTipsView = await activatePackage();
      providerDisposable = lumine.packages.serviceHub.provide("background-tips.provider", "1.0.0", {
        packageName: "ignored-tips",
        tips: ["Never show this tip."],
      });
    });

    afterEach(() => {
      providerDisposable.dispose();
      lumine.config.unset("background-tips.ignoredPackages");
    });

    it("declares an empty list by default", () => {
      const setting = require("../package.json").configSchema.ignoredPackages;
      expect(setting.type).toBe("array");
      expect(setting.items).toEqual({ type: "string" });
      expect(setting.default).toEqual([]);
    });

    it("updates the rotation when package names are ignored or restored", () => {
      advanceClock(backgroundTipsView.startDelay);
      advanceClock(backgroundTipsView.fadeDuration);
      const hiddenTip = backgroundTipsView.tips.find((tip) => tip.packageName === "ignored-tips");
      const hiddenIndex = backgroundTipsView.tips.indexOf(hiddenTip);

      lumine.config.set("background-tips.ignoredPackages", ["ignored-tips"]);
      spyOn(backgroundTipsView, "renderTip").and.callThrough();
      backgroundTipsView.index = hiddenIndex - 1;
      backgroundTipsView.showNextTip();
      expect(backgroundTipsView.renderTip).not.toHaveBeenCalledWith(hiddenTip);

      backgroundTipsView.renderTip.calls.reset();
      lumine.config.set("background-tips.ignoredPackages", []);
      backgroundTipsView.index = hiddenIndex - 1;
      backgroundTipsView.showNextTip();
      expect(backgroundTipsView.renderTip).toHaveBeenCalledWith(hiddenTip);
    });
  });

  describe("tip templates", () => {
    let backgroundTipsView, keymapDisposable, tipDisposables;

    const addTip = (source) => {
      tipDisposables.push(
        backgroundTipsView.addTips({
          packageName: "spec-tips",
          tips: [source],
        }),
      );
      return backgroundTipsView.tips[backgroundTipsView.tips.length - 1];
    };

    const render = (source) => backgroundTipsView.renderTip(addTip(source));

    const boundKeystroke = () =>
      `<span class="keystroke">${humanizeKeystroke("ctrl-alt-y")}</span>`;

    beforeEach(async () => {
      backgroundTipsView = await activatePackage();
      tipDisposables = [];
      keymapDisposable = lumine.keymaps.add("spec-tips", {
        "lumine-workspace": { "ctrl-alt-y": "spec-tips:bound" },
      });
    });

    afterEach(() => {
      keymapDisposable.dispose();
      for (const disposable of tipDisposables) disposable.dispose();
    });

    it("shows a tip with no template tags as it is", () => {
      expect(render("A plain tip.")).toBe("A plain tip.");
    });

    it("renders the keystroke the command is bound to", () => {
      expect(render("Do it with {{ 'spec-tips:bound' | keystroke }}")).toBe(
        `Do it with ${boundKeystroke()}`,
      );
    });

    it("resolves a keystroke through the selector the filter is given", () => {
      expect(render("Do it with {{ 'spec-tips:bound' | keystroke: 'lumine-workspace' }}")).toBe(
        `Do it with ${boundKeystroke()}`,
      );
      expect(render("Do it with {{ 'spec-tips:bound' | keystroke: '.no-such-scope' }}")).toBeNull();
    });

    it("skips a tip whose required keystroke is unbound", () => {
      expect(render("Do it with {{ 'spec-tips:unbound' | keystroke }}")).toBeNull();
    });

    it("takes the guarded branch matching what the keymap binds", () => {
      const tip = (command) =>
        `{% if keys['${command}'] %}bound with {{ '${command}' | keystroke }}` +
        `{% else %}no keybinding{% endif %}`;
      expect(render(tip("spec-tips:bound"))).toBe(`bound with ${boundKeystroke()}`);
      expect(render(tip("spec-tips:unbound"))).toBe("no keybinding");
    });

    it("exposes the platform the editor runs on", () => {
      expect(render(`{% if platform == '${process.platform}' %}here{% endif %}`)).toBe("here");
    });

    it("skips a tip that renders to nothing", () => {
      expect(render("{% if platform == 'not-a-platform' %}never{% endif %}")).toBeNull();
    });

    it("drops a tip that does not parse", () => {
      spyOn(console, "warn");
      const tip = addTip("{% nosuchtag %}");
      expect(backgroundTipsView.renderTip(tip)).toBeNull();
      expect(console.warn).toHaveBeenCalled();
    });
  });
});
