// Authentic package usage. Run with lumine/script/demo.js; fixtures stay in demo/.
module.exports = {
  version: 1,
  dependencies: ["language-javascript", "tree-view", "bookmarks"],
  viewport: { width: 1200, height: 760 },
  async before() {},
  async prepare(context) {
    const { lumine, state, fixture, open } = context;
    state.editor = await open("Signal Lab/src/signal.js");
    await lumine.project.setPaths([fixture("Signal Lab")]);
  },
  scenes: [
    {
      id: "scene-1",
      file: "demo.png",
      caption: "Discover package shortcuts in the empty workspace.",
      timeout: 60000,
      async run(context) {
        const { lumine, state } = context;
        {
          await lumine.workspace.paneForItem(state.editor).destroyItem(state.editor, true);
        }
      },
      ready() {
        return Boolean(document.querySelector("background-tips .message")?.innerText.length > 10);
      },
    },
  ],
  async cleanup() {},
};
