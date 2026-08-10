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

  describe("tip templates", () => {
    let backgroundTipsView, keymapDisposable;

    const addTip = (source) => {
      backgroundTipsView.addPackageTips({
        name: "spec-tips",
        metadata: { backgroundTips: [source] },
      });
      return backgroundTipsView.tips[backgroundTipsView.tips.length - 1];
    };

    const render = (source) => backgroundTipsView.renderTip(addTip(source));

    const boundKeystroke = () =>
      `<span class="keystroke">${humanizeKeystroke("ctrl-alt-y")}</span>`;

    beforeEach(async () => {
      backgroundTipsView = await activatePackage();
      keymapDisposable = lumine.keymaps.add("spec-tips", {
        "lumine-workspace": { "ctrl-alt-y": "spec-tips:bound" },
      });
    });

    afterEach(() => keymapDisposable.dispose());

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
