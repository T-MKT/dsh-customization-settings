<h1 align="center"> DSH-Customization-Settings </h1>

[简体中文](./README.md) | [English](./README.en.md)

Generic UI customization settings for DeepSeek Harness.

## Features

### 👚 Appearance
Adds an "Appearance" category to the left navigation of the Settings panel (with the same gear icon as "General"), providing full theme management:
- **Preset theme library**: 5 presets (Dusk / Forest / Warm / Graphite / Violet) + a "Follow system" entry, applied on click;
- **Wallpaper**: image (upload / URL / built-in), placement (fullscreen / conversation), mask color and opacity;
- **Theme colors**: 13 color tokens (brand / background / text / border / state / sidebar), edited separately for light and dark;
- **Scheme management**: "My Themes" list — create / duplicate / rename / delete / set as current, switch anytime;
- **Export / Import**: export a scheme as JSON and re-import to restore (including wallpaper references); invalid files are safely rejected;
- **Restore defaults**: per-dimension (wallpaper / single color), whole-scheme reset, one-click back to shell defaults.

> See [TODO.md](./TODO.md) for planned features.

## Installation

### 1. From `npm`
> Not published yet (development in progress).

### 2. From source (local development)

```sh
# 1 Install into the web profile (forwards to pnpm, into $DSH_HOME/profiles/web/node_modules)
dsh plugin --profile web add <repo-path>

# 2 Enable it: append "dsh-customization-settings" to the profile's bundle list
#     edit $DSH_HOME/profiles/web/package.json:
#      "dsh": { "profile": { "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "dsh-customization-settings"] } }

# 3 Restart
dsh web
```

> Equivalent alternative: instead of registering this package as a bundle,
> merge the `insert` block from this repo's `cordis.patch.yml` into
> `$DSH_HOME/profiles/web/cordis.patch.yml`.

## Development

```sh
pnpm install   # install dependencies
pnpm build     # tsc + tsdown, emits lib/index.js and lib/client.js
pnpm typecheck # type-check only
```

## License
[MIT](./LICENSE)

## Contributing
The author is a high-school student and may not check issues and PRs often; please reach out by email if you want to become a primary maintainer.
