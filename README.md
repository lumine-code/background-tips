# background-tips

Displays tips about Lumine in the background when no editors are open.

Fork of [pulsar-edit/pulsar](https://github.com/pulsar-edit/pulsar) (`packages/background-tips`).

## Features

- **Idle tips**: shows helpful tips whenever the workspace has no open editors.
- **Liquid templates**: every tip is a Liquid template, so it can branch on what the keymap actually binds.
- **Live keystrokes**: a keystroke is resolved when the tip is shown, so it follows the platform and any keymap the user has changed.
- **Package contributions**: collects tips from every active `background-tips.provider` service.
- **Ignored packages**: lets you suppress tips from selected package names.

## Installation

To install `background-tips` search for it in the Install pane of the Lumine settings, or run the command `lumine --install lumine-code/background-tips`.

## Usage

Packages contribute tips by providing `background-tips.provider@1.0.0`. The service value names its package and carries an array of [Liquid](https://liquidjs.com) templates, rendered every time a tip comes up. A string with no template tags in it is shown as-is.

Add package names to `background-tips.ignoredPackages` to keep their tips out of the rotation without disabling those packages.

```json
"providedServices": {
  "background-tips.provider": {
    "versions": {
      "1.0.0": "provideBackgroundTips"
    }
  }
}
```

```js
provideBackgroundTips() {
  return {
    packageName: "fuzzy-files",
    tips: ["You can open any file quickly using {{ 'fuzzy-files:toggle' | keystroke }}"],
  };
}
```

There are two ways to reach a keystroke, and the difference is what happens when the command is unbound:

- `{{ "command" | keystroke }}` states that the tip needs that keystroke. It renders the current one, and the whole tip is skipped when nothing is bound to the command.
- `keys["command"]` only looks the keystroke up. It yields nothing when the command is unbound, which makes it the one to test in a condition when the tip should still be shown:

```js
const tips = [
  "{% if keys['minimap:toggle'] %}You can hide the minimap with {{ 'minimap:toggle' | keystroke }}{% else %}The minimap draws git changes and lint messages over a bird's-eye view of the file.{% endif %}",
];
```

The `keystroke` filter takes an optional selector for a command bound in more than one scope. It is matched exactly against the selector the keymap declares:

```
{{ 'tree-view:copy' | keystroke: '.tree-view' }}
```

Without one, the binding whose selector names the current platform wins, and otherwise the first one declared.

`packageName` holds the exact package name from the provider contribution:

```
{{ packageName }} provides this tip.
```

`platform` holds the current `process.platform`, for a tip that only applies to one operating system:

```
{% if platform == 'win32' %}...{% endif %}
```

A tip that renders to nothing is skipped, as is one whose template does not parse.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
