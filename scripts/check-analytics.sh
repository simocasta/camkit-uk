#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Guardrail for the CamKIT site.
#
# The site's central promise is that nothing a clinician enters ever leaves the
# browser. Adding analytics is the one change that could quietly break that, so
# this script asserts the promise still holds. Run it before every deploy:
#
#     ./scripts/check-analytics.sh
#
# Exits non-zero if any check fails.
# ---------------------------------------------------------------------------

set -uo pipefail
cd "$(dirname "$0")/.."

# The published site lives in public/ — everything Cloudflare serves, and
# nothing else. Paths below are relative to it, so this script keeps working
# if that directory is ever renamed.
SITE=public

fail=0
report() { printf '  FAIL  %s\n' "$1"; fail=1; }
pass()   { printf '  ok    %s\n' "$1"; }

# Fail loudly rather than silently passing checks against files that moved.
for required in "$SITE/index.html" "$SITE/calculator/index.html" "$SITE/assets/analytics.js"; do
  [ -f "$required" ] || { printf '  FAIL  missing %s — has the site layout changed?\n' "$required"; exit 1; }
done

# --- 1. analytics.js must have no route to a clinician's input ---------------
# Any of these would give it one: reading form values, reaching into the DOM by
# selector, persisting to browser storage, or opening its own network request.
# analytics.js is expected to use only closest() and getAttribute().
echo "1. analytics.js cannot read the form or open its own connection"

FORBIDDEN='\.value|FormData|querySelector|getElementById|input\[|camkit-form|localStorage|sessionStorage|document\.cookie|fetch\(|XMLHttpRequest|sendBeacon'

if grep -nE "$FORBIDDEN" $SITE/assets/analytics.js; then
  report "analytics.js uses a forbidden API (shown above)"
else
  pass "analytics.js reads only data-count attributes"
fi

# --- 2. both pages must actually wire up the counter -------------------------
echo "2. both pages load the counter and the analytics module"

before=$fail
for page in "$SITE/index.html" "$SITE/calculator/index.html"; do
  grep -q 'goatcounter\.com/count' "$page" \
    || report "$page is missing the GoatCounter script tag"
  grep -q 'analytics\.js' "$page" \
    || report "$page does not load analytics.js"
done
[ "$fail" -eq "$before" ] && pass "index.html and calculator/index.html both wired up"

# --- 3. the survey link must be one a respondent can actually open -----------
# Qualtrics hands out two URLs for the same survey and they are easy to confuse:
#   /jfe/form/<ID>            the anonymous link — what respondents need
#   /survey-builder/<ID>/edit the editor — a login wall for everyone but the owner
# Shipping the editor link looks fine in review and collects zero responses.
echo "3. the feedback link is a respondent link, not the Qualtrics editor"

survey_href=$(grep -o 'href="[^"]*qualtrics[^"]*"' "$SITE/calculator/index.html" | head -1)

if grep -q 'REPLACE_WITH_QUALTRICS_URL' "$SITE/calculator/index.html"; then
  grep -q 'note--feedback" hidden' "$SITE/calculator/index.html" \
    && pass "placeholder URL still in place, card correctly hidden" \
    || report "feedback card is visible but still points at REPLACE_WITH_QUALTRICS_URL"
elif [ -z "$survey_href" ]; then
  report "no Qualtrics link found on the calculator page"
elif printf '%s' "$survey_href" | grep -qE 'survey-builder|/edit'; then
  report "feedback link is the Qualtrics EDITOR link, not the anonymous link: $survey_href"
elif printf '%s' "$survey_href" | grep -q '/jfe/form/'; then
  grep -q 'note--feedback" hidden' "$SITE/calculator/index.html" \
    && report "survey URL is filled in but the card is still hidden — remove the hidden attribute" \
    || pass "anonymous survey link in place and card visible"
else
  report "unrecognised Qualtrics URL shape — expected /jfe/form/<ID>: $survey_href"
fi

# --- 4. the regulatory disclaimer must be on both pages and in the PDF ------
# Three independent claims: CamKIT is a research tool, it has no regulatory
# approval as a diagnostic device, and its score is never used in isolation.
# All three must survive any copy edit — including in the print-only block,
# which is the only disclaimer a downloaded assessment carries.
echo "4. the regulatory disclaimer is present on both pages and in the PDF"

# The disclaimer is wrapped across source lines and broken up by <strong> tags,
# so every check below runs against a flattened, tag-stripped copy of the page.
flatten() { sed -e 's/<[^>]*>/ /g' "$1" | tr -s '[:space:]' ' '; }

disclaimer_fail=0
require_phrase() {  # <flattened text> <phrase> <what it means>
  printf '%s' "$1" | grep -qi -- "$2" || { report "$3"; disclaimer_fail=1; }
}

for page in "$SITE/index.html" "$SITE/calculator/index.html"; do
  flat=$(flatten "$page")
  require_phrase "$flat" 'research tool' \
    "$page no longer says CamKIT is a research tool"
  require_phrase "$flat" 'not been approved by any regulatory authority' \
    "$page no longer states the lack of regulatory approval"
  require_phrase "$flat" 'not be used in isolation' \
    "$page no longer says the score must not be used in isolation"
done

# The printed/downloaded assessment carries the same disclaimer. It lives in the
# print-only footer, which is the ONLY disclaimer text that survives @media print
# (the page footer and the notes grid are both display:none there).
foot=$(sed -n '/print-only print-foot/,/<\/div>/p' "$SITE/calculator/index.html" \
       | sed -e 's/<[^>]*>/ /g' | tr -s '[:space:]' ' ')
require_phrase "$foot" 'not been approved by any regulatory authority' \
  "the print-only footer has lost the disclaimer — it would be missing from the PDF"
require_phrase "$foot" 'not be used in isolation' \
  "the print-only footer no longer says the score must not be used in isolation"

[ "$disclaimer_fail" -eq 0 ] \
  && pass "disclaimer intact on both pages and in the printed assessment"

echo
if [ "$fail" -ne 0 ]; then
  echo "check-analytics: FAILED — do not deploy"
  exit 1
fi
echo "check-analytics: all checks passed"
