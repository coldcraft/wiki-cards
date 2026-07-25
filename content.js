"use strict";
/* Content script: collects title / selection text / image URLs, shows toasts. */

// Wiki metadata that shouldn't appear on a card: citation refs, IPA
// pronunciations + respellings, audio/"listen" widgets, edit links, and
// anything MediaWiki itself marks as noprint/noexcerpt.
var WLC_SKIP = "sup.reference, .mw-ref, .mw-editsection, .mw-cite-backlink, " +
  ".IPA, .respell, .ext-phonos, .haudio, .rt-commentedText, " +
  "a[href*='Pronunciation_respelling'], a[title*='Pronunciation respelling'], " +
  "a[href*='Help:IPA'], .noprint, .noexcerpt, script, style";

function wlcUpscale(src) {
  // Wikipedia serves thumbs like .../thumb/a/ab/Foo.jpg/220px-Foo.jpg —
  // bump the width so the card background isn't a blurry 220px thumb.
  try {
    const u = new URL(src, location.href);
    if (u.hostname.endsWith("wikimedia.org") && u.pathname.includes("/thumb/")) {
      return u.href.replace(/\/(\d+)px-([^/]+)$/, (m, px, name) =>
        "/" + Math.max(parseInt(px, 10), 1000) + "px-" + name);
    }
    return u.href;
  } catch (e) {
    return src;
  }
}

function wlcFinal(s) {
  return s
    .replace(/\[\s*(?:\d+|[a-z]|note\s*\d+|citation needed|edit)\s*\]/gi, "")
    .replace(/\s+/g, " ")
    .replace(/\(\s*[;,:]*\s*\)/g, "")     // parens emptied by IPA/respell removal
    .replace(/\s+([,.;:!?)\]])/g, "$1")   // no space before closing punctuation
    .replace(/([([])\s+/g, "$1")          // no space after opening bracket
    .replace(/\s+/g, " ")
    .trim();
}

// Split the selection into heading/body segments so a section title doesn't
// run straight into a paragraph that starts with the same phrase. Body text
// nodes are concatenated raw (the document's own whitespace is kept) —
// injecting separators between nodes puts spaces before commas.
function wlcSegments(sel) {
  const segs = [];
  const BLOCK = /^(P|DIV|LI|UL|OL|TABLE|TR|TD|TH|BLOCKQUOTE|DL|DD|DT|FIGCAPTION|SECTION)$/;
  const appendBody = raw => {
    if (!raw) return;
    const last = segs[segs.length - 1];
    if (last && last.kind === "body") last.raw += raw;
    else segs.push({ kind: "body", raw });
  };
  const walk = node => {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        if (child.matches(WLC_SKIP)) continue;
        if (/^H[1-6]$/.test(child.tagName) || child.classList.contains("mw-heading")) {
          const h = child.cloneNode(true);
          h.querySelectorAll(WLC_SKIP).forEach(e => e.remove());
          if (h.textContent.trim()) segs.push({ kind: "heading", raw: h.textContent });
        } else {
          const block = BLOCK.test(child.tagName);
          if (block) appendBody(" ");
          walk(child);
          if (block) appendBody(" ");
        }
      } else if (child.nodeType === Node.TEXT_NODE) {
        appendBody(child.nodeValue);
      }
    }
  };
  for (let i = 0; i < sel.rangeCount; i++) walk(sel.getRangeAt(i).cloneContents());
  return segs
    .map(s => ({ kind: s.kind, text: wlcFinal(s.raw) }))
    .filter(s => s.text);
}

function wlcCollect() {
  const sel = window.getSelection();
  const segments = sel && !sel.isCollapsed ? wlcSegments(sel) : [];
  const text = segments.map(s => s.text).join(" ");

  const images = [];
  if (sel && sel.rangeCount && !sel.isCollapsed) {
    for (const img of document.querySelectorAll("#mw-content-text img")) {
      if (images.length >= 4) break;
      if (!sel.containsNode(img, true)) continue;
      // skip inline icons, flags, formula renders
      if ((img.width || 0) < 100 || (img.height || 0) < 80) continue;
      const src = img.currentSrc || img.src;
      if (src) images.push(wlcUpscale(src));
    }
  }

  const og = document.querySelector('meta[property="og:image"]');
  let mainImage = og ? og.getAttribute("content") : null;
  if (!mainImage) {
    const inf = document.querySelector(".infobox img, figure.mw-default-size img, .thumbinner img");
    if (inf) mainImage = wlcUpscale(inf.currentSrc || inf.src);
  }

  const h1 = document.getElementById("firstHeading");
  const title = (h1 ? h1.textContent : document.title.replace(/ [-–—] Wikipedia.*$/, "")).trim();

  return { title, text, segments, images, mainImage };
}

function wlcToast(msg, ok) {
  const t = document.createElement("div");
  t.textContent = msg;
  t.style.cssText =
    "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);" +
    "background:" + (ok ? "#1a1a1a" : "#8b1a1a") + ";color:#fff;" +
    "padding:12px 20px;border-radius:6px;font:600 14px/1.2 sans-serif;" +
    "z-index:2147483647;box-shadow:0 4px 16px rgba(0,0,0,.4);" +
    "opacity:0;transition:opacity .2s";
  document.body.appendChild(t);
  requestAnimationFrame(() => { t.style.opacity = "1"; });
  setTimeout(() => {
    t.style.opacity = "0";
    setTimeout(() => t.remove(), 300);
  }, 2600);
}

// Guarded so the file can also be evaluated in a plain page for testing.
if (typeof browser !== "undefined" && browser.runtime) {
  browser.runtime.onMessage.addListener(msg => {
    if (msg.type === "wlc-collect") return Promise.resolve(wlcCollect());
    if (msg.type === "wlc-toast") wlcToast(msg.msg, msg.ok);
  });
}
