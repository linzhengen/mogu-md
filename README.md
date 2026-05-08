# mogu-md — Copy as Markdown for AI

選択範囲のHTML（テーブル、テキスト）を AI Agent が理解しやすい Markdown 形式に変換し、クリップボードにコピーする Chrome 拡張機能です。

Convert any selected HTML (tables, text, mixed content) into clean, AI-optimized Markdown and copy it to your clipboard with one click.

## Features

- **Right-click to convert** — 範囲選択 → 右クリック → `Copy as Markdown for AI` で即座にMarkdown化
- **Open in Gemini** — `Copy as Markdown & Open in Gemini` で Gemini を自動起動し、変換結果を入力欄に貼り付け
- **Table-aware** — `rowspan` / `colspan` の結合セルを自動展開し、GFMテーブルとして整形
- **Noise removal** — `<script>`, `<style>`, 非表示要素, ボタンなどのインタラクティブ要素を自動除去
- **Absolute URLs** — 相対パスを絶対URLに変換。AIが参照先を辿れるように
- **Metadata header** — 取得元URL・ページタイトル・取得日時をMarkdown先頭に自動付与
- **Zero config** — インストールするだけですぐ使える

## Installation

### Chrome Web Store

> [Chrome Web Store リンク]

### Developer Mode (手動インストール)

1. このリポジトリを clone またはダウンロード
2. Chrome で `chrome://extensions` を開く
3. 右上の「デベロッパーモード」を ON
4. 「パッケージ化されていない拡張機能を読み込む」→ プロジェクトディレクトリを選択
5. 任意のページでテキスト/テーブルを選択 → 右クリック → **Copy as Markdown for AI**

## Usage

1. 任意の Web ページで変換したい範囲を選択（テーブル含む推奨）
2. 右クリック → **Copy as Markdown for AI**（クリップボードにコピーのみ）または **Copy as Markdown & Open in Gemini**（コピー + Gemini 自動起動）
3. クリップボードに Markdown がコピーされる（右下にトースト通知）
4. ChatGPT / Claude / Gemini / その他エディタに貼り付け

### 出力例

```markdown
> **Source:** [Example Domain](https://example.com)
> **Selected at:** 2026-05-08 15:30

---

| Name  | Value | Description |
|-------|-------|-------------|
| Alpha | 1     | First       |
| Beta  | 2     | Second      |

## Section Title

Lorem ipsum dolor sit amet...
```

## Architecture

```
右クリック (selection context) → background.js (service worker)
  → scripting.executeScript() で以下を注入:
    1. lib/turndown.js (HTML→Markdown変換)
    2. lib/turndown-plugin-gfm.js (GFMテーブルサポート)
    3. content.js (選択範囲抽出・ノイズ除去・テーブル正規化・出力)
  → クリップボードにコピー + トースト通知

[Gemini 連携時]
  → content.js → chrome.runtime.sendMessage → background.js
  → Gemini タブを開く → ページ読み込み完了 → 入力欄に自動貼り付け
```

| File | Role |
|------|------|
| `manifest.json` | MV3 設定、権限 |
| `background.js` | コンテキストメニュー作成、スクリプト注入、Gemini 連携制御 |
| `content.js` | 選択範囲の取得、前処理、Markdown変換、クリップボードコピー、メッセージ送信 |
| `lib/turndown.js` | Turndown ライブラリ (unpkg CDN ビルド) |
| `lib/turndown-plugin-gfm.js` | GFM プラグイン (テーブル・打ち消し線・タスクリスト) |

## Tech Stack

- [Manifest V3](https://developer.chrome.com/docs/extensions/mv3/)
- [Turndown](https://github.com/mixmark-io/turndown) — HTML → Markdown
- [turndown-plugin-gfm](https://github.com/mixmark-io/turndown-plugin-gfm) — GFM table support

## Privacy

この拡張機能は一切のデータを外部に送信しません。すべての処理はローカル（ブラウザ内）で完結します。詳細は [PRIVACY.md](PRIVACY.md) を参照ください。

## Development

### リリース手順

```bash
# 現在のバージョンで ZIP 作成
./scripts/release.sh

# パッチバージョンアップ + ZIP + git tag
./scripts/release.sh --bump patch --tag

# 動作確認（実際の変更なし）
./scripts/release.sh --bump patch --tag --dry-run
```

`manifest.json` の `version` を自動更新し、ストア提出用の ZIP を作成します。オプションで git commit + tag も可能です。

## License

MIT
