describe("Background tip display duration", () => {
  let view;

  beforeEach(async () => {
    jasmine.attachToDOM(lumine.views.getView(lumine.workspace));
    lumine.packages.loadPackage("background-tips");
    lumine.config.set("background-tips.displayDuration", 3);
    view = (await lumine.packages.activatePackage("background-tips")).mainModule.backgroundTipsView;
    advanceClock(view.startDelay);
    advanceClock(view.fadeDuration);
  });

  afterEach(() => lumine.config.unset("background-tips.displayDuration"));

  it("uses the configured duration from its first visible rotation", () => {
    const rotate = spyOn(view, "showNextTip").and.callThrough();
    expect(view.displayDuration).toBe(3000);
    advanceClock(view.displayDuration - view.fadeDuration - 1);
    expect(rotate).not.toHaveBeenCalled();
    advanceClock(1);
    expect(rotate).toHaveBeenCalledTimes(1);
  });

  it("reschedules the current rotation without changing the visible tip or retaining the old timer", () => {
    const rotate = spyOn(view, "showNextTip").and.callThrough();
    const visibleText = view.message.textContent;
    lumine.config.set("background-tips.displayDuration", 2);
    expect(view.message.textContent).toBe(visibleText);
    advanceClock(1999);
    expect(rotate).not.toHaveBeenCalled();
    advanceClock(1);
    expect(rotate).toHaveBeenCalledTimes(1);
    advanceClock(2000);
    expect(rotate).toHaveBeenCalledTimes(2);
    advanceClock(2000);
    expect(rotate).toHaveBeenCalledTimes(3);
  });

  it("retires the old timer and observes the setting only in the current package generation", async () => {
    const oldView = view;
    const oldRotate = spyOn(oldView, "showNextTip").and.callThrough();
    await lumine.packages.deactivatePackage("background-tips");
    lumine.config.set("background-tips.displayDuration", 1);
    advanceClock(6000);
    expect(oldView.interval).toBeNull();
    expect(oldRotate).not.toHaveBeenCalled();

    view = (await lumine.packages.activatePackage("background-tips")).mainModule.backgroundTipsView;
    expect(view).not.toBe(oldView);
    expect(view.displayDuration).toBe(1000);
    advanceClock(view.startDelay);
    advanceClock(view.fadeDuration);
    const rotate = spyOn(view, "showNextTip").and.callThrough();
    advanceClock(1000);
    expect(rotate).toHaveBeenCalledTimes(1);
    expect(oldRotate).not.toHaveBeenCalled();
  });
});
