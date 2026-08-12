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

# --- 4. the research-use-only framing must be on both pages ------------------
echo "4. the research-use-only statement is present on both pages"

for page in "$SITE/index.html" "$SITE/calculator/index.html"; do
  grep -qi 'for research use only' "$page" \
    || report "$page has no 'for research use only' statement"
done

echo
if [ "$fail" -ne 0 ]; then
  echo "check-analytics: FAILED — do not deploy"
  exit 1
fi
echo "check-analytics: all checks passed"
