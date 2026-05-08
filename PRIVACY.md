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
3. If you choose the "Open in Gemini" option, the converted Markdown text is passed within the extension (via `chrome.runtime.sendMessage`) to the service worker, which opens a Gemini tab and auto-fills the input area.
4. No data leaves your browser at any point.

## Single Purpose Description

This extension has a single, narrowly-scoped purpose:

**Convert user-selected HTML content on a web page into Markdown format and copy it to the clipboard, with an optional convenience feature to open Google Gemini and auto-fill the converted text.**

All functionality serves this single purpose. There are no unrelated features, no analytics, no advertising, and no background data collection.

## Host Permission Justification

| Host | Reason |
|------|--------|
| `https://gemini.google.com/*` | Required solely to inject a script into the Gemini app page that auto-fills the converted Markdown into the chat input field. This permission is used only when the user explicitly selects the "Copy as Markdown & Open in Gemini" context menu item. No data is read from or sent to Gemini — the extension only writes the locally-converted Markdown text into the page's input element. |

## Remote Code

**This extension does NOT use remote code.** All code is bundled within the extension package:

- All JavaScript (including third-party libraries Turndown and turndown-plugin-gfm) is shipped as static files inside the extension package.
- No code is fetched, loaded, or executed from remote servers at runtime.
- The extension does not use `eval()`, `new Function()`, or any mechanism that dynamically executes code from external sources.
- No `<script>` tags with remote `src` attributes are injected into any page.

The Turndown and turndown-plugin-gfm libraries were downloaded from [unpkg CDN](https://unpkg.com) as static build artifacts and are included as local files in the `lib/` directory. They are never fetched from the network at runtime.

## Permissions Justification

| Permission | Purpose |
|------------|---------|
| `contextMenus` | To add the "Copy as Markdown for AI" right-click menu item |
| `scripting` | To inject the conversion script into the active tab when you use the menu |
| `activeTab` | To access the current tab's selection only when you invoke the extension |
| `clipboardWrite` | To copy the converted Markdown to your clipboard |
| `host_permissions` (`https://gemini.google.com/*`) | To auto-fill the converted Markdown into Gemini's input field — only when the user explicitly selects "Copy as Markdown & Open in Gemini" |

## Third-Party Libraries

This extension bundles:
- [Turndown](https://github.com/mixmark-io/turndown) — HTML to Markdown converter (MIT License)
- [turndown-plugin-gfm](https://github.com/mixmark-io/turndown-plugin-gfm) — GitHub Flavored Markdown plugin (MIT License)

These libraries run locally and do not make any network requests.

## Contact

For questions or concerns about this privacy policy, please open an issue on the [GitHub repository](https://github.com/sei40/mogu-md).

## Changes

If this privacy policy changes, the updated version will be posted here and the "Last updated" date will be revised.
