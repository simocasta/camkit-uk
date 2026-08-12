/* ============================================================
   CamKIT calculator — scoring logic
   All computation runs in the browser. Nothing is stored or sent.

   Items, wording and scoring direction are taken verbatim (in
   clinician-facing phrasing) from Table 1 of:
   Molloy T, Gompels B, Castagno S, McCaskie A, McDonnell S.
   The Cambridge Knee Injury Tool (CamKIT). BMJ Open Sport Exerc
   Med 2025;11(1):e002357.

   Every item is phrased so that "Yes" = 1 point. Two items are
   reframed from the source encoding to keep that rule consistent:
   weight-bearing is asked as "Inability to weight bear", and
   mechanism is asked as "Non-contact mechanism of injury".
   ============================================================ */

(function () {
  "use strict";

  /** @typedef {{ id: string, label: string, quotes?: string }} Item */

  /** @type {{ title: string, items: Item[] }[]} */
  const GROUPS = [
    {
      title: "History & mechanism",
      items: [
        { id: "h_injury",     label: "Previous soft tissue injury to the same knee" },
        { id: "activity",     label: "Injured during a high-risk sport or activity" },
        { id: "noncontact",   label: "Non-contact mechanism of injury" },
        { id: "twisting",     label: "Twisting or pivoting of the knee during the injury" },
        { id: "hyperext",     label: "Hyperextension of the knee during the injury" },
      ],
    },
    {
      title: "Signs & symptoms",
      items: [
        { id: "swelling",     label: "Global swelling of the injured knee" },
        { id: "rapid",        label: "Rapid swelling of the knee" },
        { id: "weightbear",   label: "Inability to weight bear" },
        { id: "reduced_rom",  label: "Significant reduction in range of movement" },
        { id: "instability",  label: "Instability, ", quotes: "‘giving way’ or ‘shifting’ of the knee" },
        { id: "popping",      label: "", quotes: "‘Popping’, ‘cracking’ or ‘tearing’ felt or heard during the injury" },
        { id: "locking",      label: "", quotes: "‘Locking’, ‘catching’ or ‘clicking’ in the injured knee" },
      ],
    },
  ];

  const BANDS = [
    { key: "low",  max: 3,        label: "Low risk",          action: "Discharge with safety-netting advice." },
    { key: "med",  max: 6,        label: "Intermediate risk", action: "Conservative management with planned reassessment." },
    { key: "high", max: Infinity, label: "High risk",         action: "Refer for MRI / specialist review." },
  ];

  const TOTAL = GROUPS.reduce((n, g) => n + g.items.length, 0); // 12

  // ---- Build the form -------------------------------------------------
  const form = document.getElementById("camkit-form");

  GROUPS.forEach((group) => {
    const fs = el("fieldset", "group");

    const legend = el("legend", "group__legend");
    legend.append(text(group.title));
    legend.append(spanText("group__count", `${group.items.length} items`));
    fs.append(legend);

    group.items.forEach((item) => {
      fs.append(buildItem(item));
    });

    form.append(fs);
  });

  // ---- Score on any change -------------------------------------------
  form.addEventListener("change", update);
  document.getElementById("reset-btn").addEventListener("click", reset);

  // ---- Download as PDF (browser print-to-PDF) ------------------------
  document.getElementById("download-btn").addEventListener("click", function () {
    stampPrintDate();
    window.print();
  });
  // Also keep the date current if the user prints via Ctrl/Cmd-P.
  window.addEventListener("beforeprint", stampPrintDate);

  update(); // initialise at 0

  // ---- Functions ------------------------------------------------------
  function buildItem(item) {
    const fs = el("fieldset", "item");

    const legend = el("legend", "item__legend");
    if (item.label) legend.append(text(item.label));
    if (item.quotes) legend.append(spanText("item__quotes", item.quotes));
    fs.append(legend);

    const seg = el("div", "seg");
    seg.append(buildOption(item.id, "no", "No", true));
    seg.append(buildOption(item.id, "yes", "Yes", false));
    fs.append(seg);

    // Print-only value: legible "Yes"/"No" shown in the PDF in place of the toggle.
    fs.append(spanText("item__print-value", "No"));

    return fs;
  }

  function buildOption(name, value, labelText, checked) {
    const wrap = el("label", "seg__opt");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = name;
    input.value = value;
    if (checked) input.checked = true;
    if (value === "yes") input.classList.add("is-yes");

    const span = document.createElement("span");
    span.append(text(labelText));

    wrap.append(input, span);
    return wrap;
  }

  function update() {
    const score = countYes();
    const band = bandFor(score);

    document.getElementById("score-value").textContent = String(score);

    const needle = document.getElementById("gauge-needle");
    needle.style.left = ((score / TOTAL) * 100).toFixed(2) + "%";

    const bandEl = document.getElementById("band");
    bandEl.dataset.band = band.key;
    document.getElementById("band-label").textContent = band.label;
    document.getElementById("band-action").textContent = band.action;

    document.getElementById("live-status").textContent =
      `Score ${score} of ${TOTAL}. ${band.label}. ${band.action}`;

    // Mirror state into the print-only document (header summary + per-item values)
    setItemPrintValues();
    document.getElementById("print-score").textContent = String(score);
    document.getElementById("print-band").textContent = band.label;
    document.getElementById("print-action").textContent = band.action;
    document.querySelector(".print-head").dataset.band = band.key;
  }

  function setItemPrintValues() {
    form.querySelectorAll(".item").forEach(function (item) {
      const checked = item.querySelector('input[type="radio"]:checked');
      const span = item.querySelector(".item__print-value");
      if (span) span.textContent = checked && checked.value === "yes" ? "Yes" : "No";
    });
  }

  function stampPrintDate() {
    document.getElementById("print-date").textContent = new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function reset() {
    form.querySelectorAll('input[type="radio"][value="no"]').forEach((r) => {
      r.checked = true;
    });
    update();
  }

  function countYes() {
    let n = 0;
    form.querySelectorAll('input[type="radio"]:checked').forEach((r) => {
      if (r.value === "yes") n += 1;
    });
    return n;
  }

  function bandFor(score) {
    return BANDS.find((b) => score <= b.max);
  }

  // ---- tiny DOM helpers ----
  function el(tag, className) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }
  function text(value) { return document.createTextNode(value); }
  function spanText(className, value) {
    const s = el("span", className);
    s.append(text(value));
    return s;
  }
})();
