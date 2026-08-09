const { CompositeDisposable } = require("lumine");
const BackgroundTipsView = require("./background-tips-view");

module.exports = {
  activate() {
    this.backgroundTipsView = new BackgroundTipsView();
    this.disposables = new CompositeDisposable();
    for (let pkg of lumine.packages.getLoadedPackages()) {
      this.backgroundTipsView.addPackageTips(pkg);
    }
    this.disposables.add(
      lumine.packages.onDidLoadPackage((pkg) => {
        this.backgroundTipsView.addPackageTips(pkg);
      }),
      lumine.packages.onDidUnloadPackage((pkg) => {
        this.backgroundTipsView.removePackageTips(pkg);
      }),
    );
  },

  deactivate() {
    this.disposables.dispose();
    this.backgroundTipsView.destroy();
  },
};
