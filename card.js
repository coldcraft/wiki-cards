"use strict";
/*
 * Shared card renderer. Loaded by the extension background page (before
 * background.js) and by test/harness.html. Pure canvas drawing — no
 * extension APIs, no DOM beyond the canvas it is given.
 */
var WLC = (() => {
  const W = 1080;          // card width; height adapts to content
  const MARGIN = 72;
  const CHIP_PAD_X = 24;   // horizontal padding inside each text chip
  const CHIP_GAP = 8;      // vertical gap between chips
  const SEG_GAP = 26;      // vertical gap between segments (heading → body)
  const ATTR_BAR = 150;    // space reserved at the bottom for attribution
  const MIN_H = 1080;
  const MAX_H = 2000;
  const THUMB = 208;       // extra-image thumbnail size (square)
  const STRIP_GAP = 44;    // gap between text block and thumbnail strip
  const FONT = '"Helvetica Neue", Arial, sans-serif';

  function pickFontSize(len) {
    if (len <= 120) return 56;
    if (len <= 240) return 48;
    if (len <= 400) return 40;
    if (len <= 650) return 34;
    if (len <= 950) return 29;
    return 25;
  }

  function wrap(ctx, text, maxWidth) {
    const words = text.split(" ");
    const lines = [];
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (ctx.measureText(test).width <= maxWidth || !line) line = test;
      else { lines.push(line); line = w; }
    }
    if (line) lines.push(line);
    return lines;
  }

  function coverDraw(ctx, img, w, h) {
    const s = Math.max(w / img.width, h / img.height);
    const dw = img.width * s;
    const dh = img.height * s;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }

  function setChipFont(ctx, it) {
    ctx.font = "bold " + it.fs + "px " + FONT;
    // letterSpacing is ignored by engines that don't support it on canvas
    ctx.letterSpacing = it.heading ? "3px" : "0px";
  }

  /*
   * data: { title, segments?, text?, bgImage, extraImages }
   *   segments: [{ kind: "heading"|"body", text }] — heading chips render
   *     smaller/uppercase so a section title reads as a label, not as the
   *     first words of the paragraph. Plain `text` = one body segment.
   *   bgImage: ImageBitmap/HTMLImageElement or null
   *   extraImages: array of same (may be empty)
   * Draws into `canvas` (resizing it) and returns { width, height }.
   */
  function renderCard(canvas, data) {
    const ctx = canvas.getContext("2d");
    const segments = (data.segments && data.segments.length
      ? data.segments
      : [{ kind: "body", text: data.text || "" }])
      .map(s => ({ kind: s.kind, text: s.kind === "heading" ? s.text.toUpperCase() : s.text }));
    const extras = (data.extraImages || []).slice(0, 3);
    const maxW = W - 2 * MARGIN - 2 * CHIP_PAD_X;
    const totalLen = segments.reduce((n, s) => n + s.text.length, 0);
    const stripH = extras.length ? THUMB + STRIP_GAP : 0;

    // ---- layout: one chip item per wrapped line, headings at 72% size ----
    const build = baseFs => {
      const items = [];
      segments.forEach((seg, si) => {
        const heading = seg.kind === "heading";
        const fs = heading ? Math.max(20, Math.round(baseFs * 0.72)) : baseFs;
        const it = { fs, heading, chipH: Math.round(fs * 1.6) };
        setChipFont(ctx, it);
        const lines = wrap(ctx, seg.text, maxW);
        lines.forEach((line, li) => {
          const lastOfSeg = li === lines.length - 1;
          items.push(Object.assign({}, it, {
            line,
            gapAfter: lastOfSeg && si < segments.length - 1 ? SEG_GAP : CHIP_GAP
          }));
        });
      });
      ctx.letterSpacing = "0px";
      if (items.length) items[items.length - 1].gapAfter = 0;
      const blockH = items.reduce((n, it) => n + it.chipH + it.gapAfter, 0);
      return { items, blockH };
    };

    let baseFs = pickFontSize(totalLen);
    let built = build(baseFs);
    while (MARGIN + built.blockH + stripH + ATTR_BAR > MAX_H && baseFs > 22) {
      baseFs -= 2;
      built = build(baseFs);
    }
    let { items, blockH } = built;

    // Still too tall at minimum font: drop trailing lines, ellipsize the last.
    if (items.length && MARGIN + blockH + stripH + ATTR_BAR > MAX_H) {
      while (items.length > 1 && MARGIN + blockH + stripH + ATTR_BAR > MAX_H) {
        const it = items.pop();
        blockH -= it.chipH + it.gapAfter;
        items[items.length - 1].gapAfter = 0;
      }
      const last = items[items.length - 1];
      setChipFont(ctx, last);
      let t = last.line.replace(/[ ,;.]+$/, "");
      while (ctx.measureText(t + " …").width > maxW && t.includes(" "))
        t = t.slice(0, t.lastIndexOf(" "));
      last.line = t + " …";
      ctx.letterSpacing = "0px";
    }

    const contentH = blockH + stripH;
    const H = Math.max(MIN_H, Math.min(MAX_H, contentH + ATTR_BAR + MARGIN * 2));

    // ---- draw (resizing the canvas resets ctx state — re-set fonts below) ----
    canvas.width = W;
    canvas.height = H;

    if (data.bgImage) {
      coverDraw(ctx, data.bgImage, W, H);
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.fillStyle = "#141414";
      ctx.fillRect(0, 0, W, H);
    }

    const grad = ctx.createLinearGradient(0, H - 280, 0, H);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.78)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, H - 280, W, 280);

    // ---- text chips: biased toward the lower third (Genius-style) so the
    // photo — usually a face, usually upper-center — stays visible ----
    let y = Math.max(MARGIN, (H - ATTR_BAR - contentH) * 0.62);
    ctx.textBaseline = "middle";
    for (const it of items) {
      setChipFont(ctx, it);
      const tw = ctx.measureText(it.line).width;
      ctx.fillStyle = "#fff";
      ctx.fillRect(MARGIN, y, tw + CHIP_PAD_X * 2, it.chipH);
      ctx.fillStyle = "#000";
      ctx.fillText(it.line, MARGIN + CHIP_PAD_X, y + it.chipH / 2 + it.fs * 0.05);
      y += it.chipH + it.gapAfter;
    }
    ctx.letterSpacing = "0px";

    // ---- thumbnail strip for extra images ----
    if (extras.length) {
      let tx = MARGIN;
      const ty = y + STRIP_GAP;
      for (const im of extras) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(tx - 5, ty - 5, THUMB + 10, THUMB + 10);
        const s = Math.min(im.width, im.height);
        ctx.drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, tx, ty, THUMB, THUMB);
        tx += THUMB + 18;
      }
    }

    // ---- attribution bar ----
    const ay = H - 62;
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#fff";

    const brand = "W I K I P E D I A";
    ctx.font = "bold 26px " + FONT;
    const bw = ctx.measureText(brand).width;
    ctx.globalAlpha = 0.92;
    ctx.fillText(brand, W - MARGIN - bw, ay);
    ctx.globalAlpha = 1;

    ctx.font = "bold 30px " + FONT;
    let t = "“" + data.title.toUpperCase() + "”";
    const maxTW = W - 2 * MARGIN - bw - 48;
    while (ctx.measureText(t).width > maxTW && t.length > 8)
      t = t.slice(0, -2) + "…”";
    ctx.fillText(t, MARGIN, ay);

    return { width: W, height: H };
  }

  return { renderCard };
})();
