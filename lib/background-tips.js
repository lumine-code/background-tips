const BackgroundTipsView = require("./background-tips-view");

const DEFAULT_TIPS = [
  "You can split your editor into multiple panes with {{ 'pane:split-right-and-copy-active-item' | keystroke }}",
  "You can move a line of text up with {{ 'editor:move-line-up' | keystroke }}",
  "You can move a line of text down with {{ 'editor:move-line-down' | keystroke }}",
  "You can toggle line comments with {{ 'editor:toggle-line-comments' | keystroke }}",
];

module.exports = {
  activate() {
    this.backgroundTipsView = new BackgroundTipsView();
    this.backgroundTipsView.addTips({
      packageName: "background-tips",
      tips: DEFAULT_TIPS,
    });
  },

  consumeBackgroundTips(contribution) {
    return this.backgroundTipsView.addTips(contribution);
  },

  deactivate() {
    this.backgroundTipsView.destroy();
  },
};
