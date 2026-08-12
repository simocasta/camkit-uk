/* ============================================================
   CamKIT — usage counts.

   What is counted:
     · page views on / and /calculator/  — automatic, by GoatCounter's own script
     · clicks on any element carrying data-count — handled below

   What is NOT counted, ever:
     This file reads two attributes and nothing else: data-count and
     data-count-title. It never reads the CamKIT form, its inputs, the score,
     the band, or anything a clinician types. There is no code path from a
     form value to a network request. scripts/check-analytics.sh enforces this.

   GoatCounter sets no cookies and writes nothing to browser storage, so no consent
   banner is required under PECR. It de-duplicates visits with a rotating hash of
   IP + User-Agent, which is disclosed in the footer of both pages.

   To disable analytics: delete this file and the two <script> tags in
   index.html and calculator/index.html. Nothing else depends on it.
   ============================================================ */

(function () {
  'use strict';

  /* GoatCounter's script is async and may be blocked (ad blockers, hospital
     proxies, offline use). Every call is guarded so a missing script is a
     no-op rather than a console error. */
  function countEvent(path, title) {
    var gc = window.goatcounter;
    if (!gc || typeof gc.count !== 'function') return;
    gc.count({ path: path, title: title, event: true });
  }

  /* One delegated listener covers every tracked link, so adding a new one is a
     data-count attribute in the HTML and no change here. Clicks land on inner
     elements (the → span, for instance), hence closest(). */
  document.addEventListener('click', function (ev) {
    var target = ev.target;
    if (!target || typeof target.closest !== 'function') return;

    var el = target.closest('[data-count]');
    if (!el) return;

    var name = el.getAttribute('data-count');
    if (!name) return;

    countEvent(name, el.getAttribute('data-count-title') || name);
  });
})();
