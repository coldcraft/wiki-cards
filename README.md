# Wiki Cards

**Genius lyric cards, but for Wikipedia.**

Highlight a passage on any Wikipedia article, right-click, and pick **Make Wiki card**. A share-ready card lands on your clipboard. Paste it into any chat.

<p align="center">
  <img src="docs/card-blackjoke.png" width="32%" alt="Dense-paragraph card: HMS Black Joke over a painting of the ship">
  <img src="docs/card-molasses.png" width="32%" alt="Short-selection card: Great Molasses Flood over a photo of the aftermath">
  <img src="docs/card-wojtek.png" width="32%" alt="Card: Wojtek the soldier bear over a photo of the bear with a Polish soldier">
</p>

## What it does

- **The Genius aesthetic**: your selection renders as white highlight chips over imagery from the article, with a `"TITLE"` / `W I K I P E D I A` attribution bar.
- **Built for density**: lyric cards carry one line, but Wikipedia selections carry paragraphs. The font auto-scales from 56px down to 25px. The canvas then grows from 1080×1080 to 1080×2000 before anything truncates.
- **Headings become labels**: select across a section title and it renders as a small uppercase label chip. It does not collide with the paragraph text.
- **Reads like prose, not like Wikipedia**: the extension strips citation markers (`[17]`), IPA pronunciations, respellings, and "listen" widgets. It handles both the legacy-parser and Parsoid markup variants, and removes the parentheses they leave behind. `"Chicago (/ʃɪˈkɑːɡoʊ/ shih-KAH-goh) is..."` becomes `"Chicago is..."`.
- **Smart image pool**: images inside your selection come first, and the main article image fills in. Low-res thumbs upscale to 1000px variants. Duplicates dedupe by Commons filename. The first image becomes the background, and the rest form a thumbnail strip. No images? Clean dark card.
- **Zero dependencies**: four hand-written files, no build step, pure canvas. Everything runs locally. The only network traffic fetches Wikipedia image files. Data collection: none, and the manifest says so.

## Install

**Signed build (recommended):** download the `.xpi` from the [latest release](https://github.com/coldcraft/wiki-cards/releases/latest). Then open `about:addons`, click the gear icon, and pick **Install Add-on From File...**. You can also click the `.xpi` link in Firefox and approve the prompt. Note: releases do not auto-update. Check back for new versions.

**From source (for hacking):** open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on...**, and pick `manifest.json`. It unloads on restart. For a permanent build of your own, zip the four extension files. Submit the zip to [addons.mozilla.org](https://addons.mozilla.org/developers/) as self-distributed/unlisted. Automated validation signs an installable `.xpi` in minutes. Change the `gecko.id` in the manifest first, because each add-on ID can only get a signature from one AMO account.

## How it works

| File | Role |
| --- | --- |
| `content.js` | Walks the selection DOM into heading/body segments, strips wiki metadata, collects image URLs and the `og:image` |
| `card.js` | Pure canvas renderer: layout, chip wrapping, adaptive sizing. No extension APIs |
| `background.js` | Context menu, image fetch, render, `browser.clipboard.setImageData` |
| `test/harness.html` | Feeds the renderer live Wikipedia REST API data for visual iteration. Serve the repo folder over HTTP and open `/test/harness.html` |

MIT.
