describe("Background tips provider display lifetime", () => {
  let view, provider;

  beforeEach(async () => {
    jasmine.attachToDOM(lumine.views.getView(lumine.workspace));
    view = (await lumine.packages.activatePackage("background-tips")).mainModule.backgroundTipsView;
    provider = lumine.packages.serviceHub.provide("background-tips.provider", "1.0.0", {
      packageName: "pending-display-provider",
      tips: ["A withdrawn provider must not appear."],
    });
    advanceClock(view.startDelay + view.fadeDuration);
  });

  afterEach(() => provider.dispose());

  it("retires a provider's pending fade before its HTML reaches the live pane", () => {
    const tip = view.tips.find((item) => item.packageName === "pending-display-provider");
    view.index = view.tips.indexOf(tip) - 1;
    view.showNextTip();

    provider.dispose();
    advanceClock(view.fadeDuration);

    expect(view.element.isConnected).toBe(true);
    expect(view.message.textContent).not.toContain("A withdrawn provider");
    expect(view.message.textContent).toBeTruthy();
  });

  it("replaces an already visible withdrawn contribution without waiting for rotation", () => {
    const tip = view.tips.find((item) => item.packageName === "pending-display-provider");
    view.index = view.tips.indexOf(tip) - 1;
    view.showNextTip();
    advanceClock(view.fadeDuration);
    expect(view.message.textContent).toContain("A withdrawn provider");

    provider.dispose();
    advanceClock(view.fadeDuration);

    expect(view.message.textContent).not.toContain("A withdrawn provider");
    expect(view.message.textContent).toBeTruthy();
  });

  it("does not revive a retired pane view through a retained provider callback", async () => {
    const oldMain = lumine.packages.getActivePackage("background-tips").mainModule;
    await lumine.packages.deactivatePackage("background-tips");
    const lease = oldMain.consumeBackgroundTips({
      packageName: "late-provider",
      tips: ["A retired view must stay retired."],
    });
    advanceClock(view.displayDuration + view.fadeDuration);

    expect(view.element.isConnected).toBe(false);
    expect(view.interval).toBeNull();
    lease.dispose();
    const current = await lumine.packages.activatePackage("background-tips");
    advanceClock(current.mainModule.backgroundTipsView.startDelay);
    expect(current.mainModule.backgroundTipsView.element.isConnected).toBe(true);
  });
});
