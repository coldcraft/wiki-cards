"use strict";
/* Pulls real article data from the Wikipedia REST API and runs it through
 * the same WLC.renderCard the extension background page uses. */

async function summary(page) {
  const r = await fetch("https://en.wikipedia.org/api/rest_v1/page/summary/" + page);
  if (!r.ok) throw new Error("summary " + page + ": HTTP " + r.status);
  return r.json();
}

async function bitmap(url) {
  const blob = await (await fetch(url)).blob();
  return createImageBitmap(blob);
}

function show(label, data) {
  const canvas = document.createElement("canvas");
  WLC.renderCard(canvas, data);
  const fig = document.createElement("figure");
  const cap = document.createElement("figcaption");
  cap.textContent = label + " — " + canvas.width + "×" + canvas.height;
  fig.append(cap, canvas);
  document.getElementById("out").append(fig);
}

(async () => {
  const [tesla, chicago, jazz] = await Promise.all(
    ["Nikola_Tesla", "Chicago", "Jazz"].map(summary));

  const [teslaImg, chiImg, jazzImg] = await Promise.all([tesla, chicago, jazz].map(
    s => s.originalimage ? bitmap(s.originalimage.source).catch(() => null) : null));

  show("dense paragraph + portrait bg + extras", {
    title: tesla.title,
    text: tesla.extract,
    bgImage: teslaImg,
    extraImages: [chiImg, jazzImg].filter(Boolean)
  });

  show("short sentence + landscape bg", {
    title: chicago.title,
    text: chicago.extract.split(". ").slice(0, 1).join(". ") + ".",
    bgImage: chiImg,
    extraImages: []
  });

  show("no image", {
    title: jazz.title,
    text: jazz.extract.slice(0, 300),
    bgImage: null,
    extraImages: []
  });

  // Regression: section heading selected along with a paragraph that starts
  // with the same phrase — heading must render as a distinct label chip.
  show("heading + body collision", {
    title: "Date and time notation in Japan",
    segments: [
      { kind: "heading", text: "Times past midnight" },
      { kind: "body", text: "Times past midnight can also be counted past the 24 hour mark, usually when the associated activity spans across midnight. For example, bars or clubs may advertise as being open until \"30時\" (i.e. 6 am). This is partly to avoid any ambiguity (6 am versus 6 pm), partly because the closing time is considered part of the previous business day. Television stations will also frequently use this notation in their late-night scheduling. This 30-hour clock form is rarely used in conversation." }
    ],
    bgImage: null,
    extraImages: []
  });
})().catch(e => {
  document.body.insertAdjacentText("beforeend", "ERROR: " + e.message);
  console.error(e);
});
