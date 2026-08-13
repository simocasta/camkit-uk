# CamKIT — Cambridge Knee Injury Tool

The public website for **CamKIT**, a 12-point clinical prediction tool for triaging acute
soft-tissue knee injuries: a landing page (background, evidence, publications, paper
download) and an interactive calculator.

> **For research use only.** CamKIT is a research prototype of a clinical decision-support
> aid. It is an aid to, not a substitute for, clinical judgement, and it is not a registered
> medical device.

All scoring runs client-side. **Nothing entered in the calculator is stored or transmitted.**

## Files

**Everything published lives in `public/`, and nothing else is.** That is deliberate: the
deployed asset directory is an allow-list, so a file is only ever public if it was put there
on purpose. Repo metadata, maintainer docs and logo originals sit outside it and cannot leak.

```
.
├── public/                    # ← the entire published site; nothing outside this is served
│   ├── index.html             # landing page — background, evidence, publications, PDF
│   ├── calculator/
│   │   └── index.html         # the calculator, intended use, evidence, feedback card
│   ├── _headers               # CSP and security headers (read from the assets dir root)
│   ├── _redirects             # belt-and-braces: 302s /docs/* if it ever ships
│   └── assets/
│       ├── tokens.css         # design tokens + @font-face — load first
│       ├── landing.css        # landing-page styles
│       ├── styles.css         # calculator styles; traffic-light colours reserved for results
│       ├── camkit.js          # the 12 items, scoring, gauge + band logic
│       ├── analytics.js       # click counting — reads data-count attributes and nothing else
│       ├── fonts/             # self-hosted IBM Plex woff2
│       │   └── OFL.txt        #   IBM Plex is SIL OFL 1.1 — must ship with the fonts
│       ├── logos/
│       │   ├── cambridge-university.png    # University of Cambridge lock-up (strip, left)
│       │   ├── cambridge-surgery.png       # Division of Trauma & Orthopaedic Surgery
│       │   └── mcdonnell-lab.png           # McDonnell Lab, Cambridge
│       └── papers/
│           └── molloy-2025-camkit-bmj-osem.pdf   # open-access paper (CC BY-NC 4.0)
├── scripts/
│   └── check-analytics.sh     # pre-deploy guardrail — run before every deploy
├── wrangler.jsonc             # Cloudflare Workers config; points at public/
├── LICENSE                    # MIT, with carve-outs — see Licence below
└── README.md
```

## Running it yourself

No build step and no dependencies. Serve `public/` rather than opening the files directly —
the calculator lives at `/calculator/` and relies on relative paths:

```bash
cd /path/to/camkit-uk/public   # NOT the repo root — that would 404
python3 -m http.server 8000
# open http://localhost:8000
```

`http.server` ignores `_headers` and `_redirects`. To preview the site exactly as deployed,
including the security headers and the `/docs/*` redirect, use the real runtime from the repo
root instead:

```bash
npx wrangler dev
```

Deployment is `npx wrangler deploy` (Cloudflare Workers static assets). Any static host will
serve `public/`, but see the Deploying note below about which ones honour `_headers`.

> **Deploying?** Run `./scripts/check-analytics.sh` first and treat a failure as blocking.
> Then read the comment block at the top of `public/_headers`: the Content-Security-Policy is
> **enforcing**, so anything that adds a script, a style or a call to a new host has to go back
> through Report-Only on the live site before it ships.
> Note that `public/_headers` and `public/_redirects` are read by Cloudflare Pages and Netlify but
> **ignored by GitHub Pages**, which would silently drop every security header.
>
> Fuller maintainer notes — analytics, the survey, releases — are kept outside this repo.

## Analytics and privacy

Two numbers are collected, via [GoatCounter](https://www.goatcounter.com/):

| Metric | How |
| --- | --- |
| Landing-page and calculator page views | automatic, by GoatCounter's script |
| Clicks on "Open the calculator" | `cta-open-calculator` event |
| Clicks on the feedback survey link | `feedback-survey` event |

Page views on `/calculator/` tell you how many people opened the calculator; the
`cta-open-calculator` event separates click-through from direct or bookmarked arrivals.

**Privacy position.** No cookies, nothing written to browser storage, no cross-site
tracking, no personal data collected — so no consent banner is required under PECR.
GoatCounter de-duplicates visits with a rotating hash of IP + User-Agent; this is disclosed
in the footer of both pages rather than glossed as "collects nothing".

**The invariant:** `analytics.js` reads two HTML attributes — `data-count` and
`data-count-title` — and nothing else. It never touches the form, its inputs, the score or
the band. There is no code path from anything you enter to a network request, and
`scripts/check-analytics.sh` fails if that ever stops being true.

## Feedback

There is a short, anonymous feedback survey linked from the calculator page — four questions,
about two minutes. It is hosted on Cambridge Qualtrics, collects no name, email, IP address or
location, and is linked as an anonymous distribution link. The survey specification and the
ethics position are maintainer notes and are kept outside this repo.

## Notes

- **Download as PDF (calculator):** uses the browser's own print-to-PDF — no library, works
  offline. Prints the current state with score, band, recommended action, date, disclaimer
  and citation. A print stylesheet (`@media print` in `styles.css`) handles the layout.
- **Logos:** `public/assets/logos/` holds derivatives, not the originals — each mark is cropped to
  its alpha bounding box (the Division lock-up ships with 67px of padding on top and 7px on
  the bottom, so untrimmed it sits visibly high), resized to 3× its CSS display height, and
  palette-quantised. That took the McDonnell badge from 1.5 MB to 7 KB with a mean error of
  1.7/255 against the original. Full-resolution originals are kept outside the repo. To
  rebuild from a fresh copy of the marks, with Pillow:

  ```python
  im = Image.open(src).convert('RGBA')
  im = im.crop(im.getchannel('A').getbbox())            # trim uneven padding
  im = im.resize((round(w * H/h), H), Image.LANCZOS)     # H = 3x display height
  im.quantize(colors=128, method=Image.FASTOCTREE).save(dst, optimize=True)
  ```

  **128 colours is the default, not a rule.** The University lock-up needs 256: its shield is
  heraldic red and gold with fine detail, and 128 leaves a worst-case error of 52/255 against
  the resized original where 256 gives 27/255 — for 0.5 KB. Measure rather than assume, with
  `ImageChops.difference` against the pre-quantise image.

  The strip appears on **three** pages — `index.html`, `calculator/index.html` and `404.html`
  (which must use root-relative paths). Display heights are set in the `.orgbar` block of
  `landing.css` **and** `styles.css`, which are kept identical; keep the `width`/`height`
  attributes on all three pages equal to the real pixel dimensions or the strip will shift on
  load. `_headers` caches `/assets/logos/*` as `immutable` for a year, so a changed mark must
  ship under a new filename — editing one in place will not reach anyone who has visited.
- **Offline use:** IBM Plex Sans and IBM Plex Mono are self-hosted under `public/assets/fonts/`, so
  the pages render identically with no external network access — no third-party font host to
  be blocked by a hospital proxy, and no visitor IP handed to one. The regeneration recipe is
  in the comment at the top of `public/assets/tokens.css`; IBM Plex is SIL OFL 1.1 and
  `public/assets/fonts/OFL.txt` must ship alongside the font files.
- **Source of truth:** item wording and scoring directions follow Table 1 of Molloy et al.,
  *BMJ Open Sport Exerc Med* 2025;11(1):e002357. Bands and recommended actions follow the
  CamKIT traffic-light pathway.

## Licence

The site's own source — HTML, CSS, JavaScript and the maintainer docs — is
[MIT](LICENSE). Four things in this repo are licensed by someone else and are **not** covered:

| | Licence |
| --- | --- |
| `logos/`, `public/assets/logos/` | University of Cambridge and McDonnell Lab marks. **All rights reserved** — not licensed for reuse. Remove them from any fork; reusing them implies an endorsement that does not exist. |
| `public/assets/papers/*.pdf` | © Author(s) 2025, CC BY-NC 4.0 — the publisher's licence, unaffected by ours. |
| `public/assets/fonts/` | IBM Plex, © 2017 IBM Corp., SIL OFL 1.1. `public/assets/fonts/OFL.txt` must travel with the font files. |
| The clinical content | The 12 findings, scoring and bands follow Table 1 of Molloy et al. 2025. Cite the paper — an MIT licence on this website is not a licence over the published tool. |

MIT was chosen for its warranty disclaimer as much as its permissiveness: CamKIT is a
research prototype and not a registered medical device, and a fork that changes the scoring
or the band thresholds is the forker's responsibility, not CamKIT's.

## Citation

Molloy T, Gompels B, Castagno S, McCaskie A, McDonnell S. The Cambridge Knee Injury Tool
(CamKIT): a clinical prediction tool for acute soft tissue knee injuries.
*BMJ Open Sport & Exercise Medicine* 2025;11(1):e002357.
[doi:10.1136/bmjsem-2024-002357](https://doi.org/10.1136/bmjsem-2024-002357)
