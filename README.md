# Field Shift Rotation Explorer

The Walker Innovators · NASA Space Apps Challenge 2026 · Challenge: **Field Shift: Adapting Farms with NASA Data**

A decision-support web page for farmers. Pick a field, tell it what you grow now, and set what matters to you. It reads 21 years of NASA data for that field and compares three crop rotations side by side: your current one and the two that best fit your field and priorities. Each option shows **why it was suggested, the evidence, the benefits, what we don't know, and what to check locally**.

> Compare rotations, reveal trade-offs, understand risk, make uncertainty visible.

**This tool supports your decision. It does not replace your judgment or your local extension agent.**

## Run it

The page loads its data with `fetch`, so it needs a small local web server. Opening `index.html` by double-clicking it will not work.

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

To publish it, turn on GitHub Pages for the `main` branch (Settings → Pages). It is a plain static site, so there is no build step.

## What it does

1. **Pick your field** on a map or from a list (Henry County, VA, and a second region near Fallon, NV).
2. **Tell us about your farm**: current rotation, soil texture (pre-filled from the USDA soil survey), irrigated or not, and whether you have hay equipment. The crop history CropScape recorded for the field is shown.
3. **Your field today**: weather and water cards built from NASA POWER (frost-free season, frost dates, hot days, growing-season rain, dry spells, extreme rain, soil-moisture anomaly), a soil card, year-by-year trend charts, a MODIS greenness chart showing when the field is bare, and a month-by-month strip flagging when your current crops look vulnerable.
4. **What matters to you**: five sliders (save water, build soil health, extra income, forage, reduce erosion).
5. **Three options side by side**: fit score, five sub-scores, a bare-vs-covered month strip, and the five explanation boxes.

It also has a glossary of plain-language terms and a "How scoring works" section.

## NASA data used

| Dataset | How the tool uses it |
| --- | --- |
| **NASA POWER** daily point data (`T2M_MAX`, `T2M_MIN`, `PRECTOTCORR`, `GWETROOT`, `GWETTOP`), 2005–2025 | All weather cards, frost dates, trend charts, soil-wetness anomaly, the heat, dry-soil and heavy-rain flags, and the water, income and erosion scores |
| **MODIS MOD13Q1 NDVI** (250 m, 16-day), 2021–2025, via the ORNL DAAC subset service | Greenness chart, bare-field window, and the "bare (satellite)" flag |

Other data: USDA NRCS SSURGO soil survey (Soil Data Access), USDA NASS Cropland Data Layer (CropScape), and crop traits from Virginia Cooperative Extension and SARE. Full list with links and licenses: [SOURCES.md](SOURCES.md).

## How it works

```
fetch scripts (run by hand) → data/raw/*.json → js/indicators.js → js/scoring.js → js/app.js → page
```

- `src/fetch_power.py`, `src/fetch_ndvi.py`, `src/fetch_soil.py`, `src/fetch_cropscape.py` download data and save it to `data/raw/`. They use only the Python standard library. **The website never calls an API**, so the demo works even if a NASA server is down.
- `js/indicators.js` turns the daily data into indicators. All thresholds are named at the top of the file.
- `js/scoring.js` scores each rotation with simple written rules. There is no machine learning and no AI in the scoring, and every score carries the reasons behind it.
- `js/app.js` draws the page.

Full details: [docs/API.md](docs/API.md).

## Tests

```bash
node --test tests/run.test.js
```

## Limits (what we know we don't know)

- Crop trait ratings in `data/crops.csv` are our reading of the linked extension sources. Rows marked `verified=no` still need a team member to check them.
- No prices or market data yet, so income is counted in harvests, not dollars.
- NASA POWER is a grid about 50 km wide, not the exact field. A MODIS pixel is 250 m wide and can include land next to the field.
- NDVI covers only 2021–2025 because the subset service is slow. For Henry County, the 15 images after April 23, 2025 are missing because the server kept failing; run `python3 src/fetch_ndvi.py henry_va` to fill them in (it resumes). Widen `FIRST_YEAR` in `src/fetch_ndvi.py` when there is time.
- Planting months follow a Virginia calendar, so they may not fit Nevada. The Nevada rotations are built from crops CropScape records near the field, not from a Nevada extension guide.
- Water-need and heat ratings for most crops are our judgment; see [docs/CROP_CHECK.md](docs/CROP_CHECK.md) for which traits each source supports.
- The demo fields are real crop pixels chosen from CropScape. We don't know who farms them, and no personal information is used.
- Yields are not modeled.

## Libraries

Leaflet 1.9.4 (BSD-2-Clause), Chart.js 4.4.1 (MIT) and OpenStreetMap tiles (© OpenStreetMap contributors, ODbL), loaded from public CDNs.

## AI use

See [AI_USE.md](AI_USE.md).
