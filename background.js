"use strict";
/* Background page: context menu, image fetching, render, clipboard. */

browser.contextMenus.create({
  id: "wlc-make-card",
  title: "Make Wiki card",
  contexts: ["selection"],
  documentUrlPatterns: ["*://*.wikipedia.org/*"]
});

// Same Commons file can appear under many thumb URLs — key on the base filename.
function fileKey(url) {
  try {
    const last = decodeURIComponent(new URL(url).pathname.split("/").pop() || "");
    return last.replace(/^\d+px-/, "").toLowerCase();
  } catch (e) {
    return url;
  }
}

async function fetchBitmap(url) {
  const res = await fetch(url, { credentials: "omit" });
  if (!res.ok) throw new Error("HTTP " + res.status + " for " + url);
  return createImageBitmap(await res.blob());
}

async function makeCard(tab) {
  const data = await browser.tabs.sendMessage(tab.id, { type: "wlc-collect" });
  if (!data || !data.text) throw new Error("no text selected");

  // Pool: selection images first (most contextual), then the article's main
  // image. First loadable one becomes the background, the rest the strip.
  const urls = [];
  const seen = new Set();
  for (const u of (data.images || []).concat(data.mainImage ? [data.mainImage] : [])) {
    const k = fileKey(u);
    if (!seen.has(k)) { seen.add(k); urls.push(u); }
  }
  const bitmaps = [];
  for (const u of urls.slice(0, 4)) {
    try { bitmaps.push(await fetchBitmap(u)); } catch (e) { console.warn("wiki-cards: skipped image", e); }
  }

  const canvas = document.createElement("canvas");
  WLC.renderCard(canvas, {
    title: data.title,
    text: data.text,
    segments: data.segments,
    bgImage: bitmaps[0] || null,
    extraImages: bitmaps.slice(1)
  });

  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
  await browser.clipboard.setImageData(await blob.arrayBuffer(), "png");
}

browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "wlc-make-card" || !tab) return;
  makeCard(tab).then(
    () => browser.tabs.sendMessage(tab.id, { type: "wlc-toast", ok: true, msg: "Card copied to clipboard" }),
    err => {
      console.error("wiki-cards:", err);
      browser.tabs.sendMessage(tab.id, { type: "wlc-toast", ok: false, msg: "Card failed: " + err.message })
        .catch(() => {});
    }
  );
});
