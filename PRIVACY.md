# Privacy Policy for "Copy as Markdown for AI"

**Last updated:** 2026-05-08

## Data Collection

This extension does **not** collect, store, or transmit any personal information or browsing data.

- **No data is sent to external servers.** All HTML-to-Markdown conversion is performed entirely within your browser.
- **No analytics, no tracking, no cookies.**
- **No user accounts or authentication.**

## How It Works

1. When you select text on a page and use the context menu, the extension injects a content script into the current tab.
2. The content script reads your text selection, converts it to Markdown locally using the bundled Turndown library, and writes the result to your system clipboard.
3. No data leaves your browser at any point.

## Permissions Justification

| Permission | Purpose |
|------------|---------|
| `contextMenus` | To add the "Copy as Markdown for AI" right-click menu item |
| `scripting` | To inject the conversion script into the active tab when you use the menu |
| `activeTab` | To access the current tab's selection only when you invoke the extension |
| `clipboardWrite` | To copy the converted Markdown to your clipboard |

## Third-Party Libraries

This extension bundles:
- [Turndown](https://github.com/mixmark-io/turndown) — HTML to Markdown converter (MIT License)
- [turndown-plugin-gfm](https://github.com/mixmark-io/turndown-plugin-gfm) — GitHub Flavored Markdown plugin (MIT License)

These libraries run locally and do not make any network requests.

## Contact

For questions or concerns about this privacy policy, please open an issue on the [GitHub repository](https://github.com/sei40/mogu-md).

## Changes

If this privacy policy changes, the updated version will be posted here and the "Last updated" date will be revised.
