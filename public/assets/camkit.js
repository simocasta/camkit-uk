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

   `note` is the "?" explanation. Table 1 gives item wording but no
   definitions; those come from the participant questionnaire in
   Table 3 of Molloy T, Gompels BD, Castagno S, Dowsett M, McCaskie A,
   McDonnell S. Cureus 2025;17(8):e89509 — the operational definitions
   the tool was actually scored against. Only findings whose label
   alone leaves a reader unsure how to answer carry one; instability
   and "popping" are defined by their own quoted synonyms and do not.
   ============================================================ */

(function () {
  "use strict";

  /** @typedef {{ id: string, label: string, note?: string }} Item */

  /** @type {{ title: string, items: Item[] }[]} */
  const GROUPS = [
    {
      title: "History & mechanism",
      items: [
        {
          id: "h_injury",
          label: "Previous soft tissue injury to the same knee",
          note: "Any earlier injury to the ligaments, meniscus or cartilage of the knee that is injured now. An injury to the other knee does not count.",
        },
        {
          id: "activity",
          label: "Injured during a high-risk sport or activity",
          note: "High-risk activities involve cutting, pivoting on a planted foot, landing from a jump, sudden deceleration or sharp changes of direction — for example rugby, football, skiing or basketball. Lower-risk activities load the knee more predictably — for example jogging, cycling, golf or weight training. If the activity is not listed, use the closest match.",
        },
        {
          id: "noncontact",
          label: "Non-contact mechanism of injury",
          note: "Yes when there was no direct blow to the knee and the injury came from the patient’s own movement — twisting, landing, stopping suddenly. No if something or someone struck the inside or outside of the knee.",
        },
        {
          id: "twisting",
          label: "Twisting or pivoting of the knee during the injury",
          note: "Pivoting means the foot stayed planted while the body turned over it, so the rotation went through the knee. As reported at the moment of injury.",
        },
        {
          id: "hyperext",
          label: "Hyperextension of the knee during the injury",
          note: "The knee was forced straight beyond its normal limit — bending backwards rather than forwards.",
        },
      ],
    },
    {
      title: "Signs & symptoms",
      items: [
        {
          id: "swelling",
          label: "Global swelling of the injured knee",
          note: "The whole knee swelled, so it looks generally larger and loses its normal contours. Swelling over one spot only does not count.",
        },
        {
          id: "rapid",
          label: "Rapid swelling of the knee",
          note: "Swelling that appeared within hours of the injury. Swelling that came on over the following days is delayed — score No.",
        },
        {
          id: "weightbear",
          label: "Inability to weight bear",
          note: "In the hours after the injury the patient could neither carry on with the activity nor take four steps unsupported, two on each leg. Managing four steps counts as able to weight bear even if limping — score No.",
        },
        {
          id: "reduced_rom",
          label: "Significant reduction in range of movement",
          note: "Since the injury the knee will not straighten or bend as far as it did before.",
        },
        { id: "instability",  label: "Instability, ‘giving way’ or ‘shifting’ of the knee" },
        { id: "popping",      label: "‘Popping’, ‘cracking’ or ‘tearing’ felt or heard during the injury" },
        {
          id: "locking",
          label: "‘Locking’, ‘catching’ or ‘clicking’ in the injured knee",
          note: "Since the injury the knee has caught or jammed mid-movement — a block, as though something is in the way — rather than being generally stiff or painful to move.",
        },
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
    legend.append(text(item.label));
    fs.append(legend);

    // The "?" goes NEXT TO the legend, never inside it: a legend's text is the
    // fieldset's accessible name, so a "?" in there would be read as part of
    // the finding. The panel it opens is a plain hidden element rather than a
    // hover tooltip, so it works on touch and cannot be clipped by the card.
    let note = null;
    if (item.note) {
      note = el("p", "item__note");
      note.id = "note-" + item.id;
      note.hidden = true;
      note.append(text(item.note));
      fs.append(buildHelp(item, note));
    }

    const seg = el("div", "seg");
    seg.append(buildOption(item.id, "no", "No", true));
    seg.append(buildOption(item.id, "yes", "Yes", false));
    fs.append(seg);

    if (note) fs.append(note);

    // Print-only value: legible "Yes"/"No" shown in the PDF in place of the toggle.
    fs.append(spanText("item__print-value", "No"));

    return fs;
  }

  function buildHelp(item, note) {
    const btn = el("button", "item__help");
    btn.type = "button";                       // never submits the form
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-controls", note.id);
    // Ten buttons all called "?" are useless in a screen reader's element
    // list, so each one names the finding it explains.
    btn.setAttribute("aria-label", "What counts as: " + item.label);
    btn.append(text("?"));

    btn.addEventListener("click", function () {
      const open = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!open));
      note.hidden = open;
    });

    return btn;
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
