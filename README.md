# Field Shift: Soil Health Check

The Walker Innovators · NASA Space Apps Challenge 2026 · Challenge: **Field Shift: Adapting Farms with NASA Data**

**Is your field's soil wearing out?** A decision-support web page for farmers, focused on one problem: soil degradation, and how the crop cycle you grow can cause it or fix it.

Pick a field and tell it what you grow now. It reads 21 years of NASA data for that field and checks **four soil warning signs**: soil washing away (bare ground in heavy-rain months), soil losing organic matter (winters with no living roots), nitrogen running down (no legume), and thirsty crops in drying months. Then it compares three crop rotations side by side: your current one and the two that best fit your field and priorities, each showing which warning signs it fixes. Each option shows **why it was suggested, the evidence, the benefits, what we don't know, and what to check locally**.

**This tool supports your decision. It does not replace your judgment or your local extension agent.**

## Run it

The page loads its data with `fetch`, so it needs a small local web server. Opening `index.html` by double-clicking it will not work.

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

To publish it, turn on GitHub Pages for the `main` branch (Settings → Pages). It is a plain static site, so there is no build step.

## What it does

1. **Check your soil**: pick your field on a map or from a list (Henry County, VA, and a second region near Fallon, NV) and what you grow now. The four warning signs light up for your current rotation, with the NASA or USDA number behind each one.
2. **See the cycle**: a month-by-month strip of your current rotation (bare months, heavy-rain months, crops at risk) next to the MODIS greenness chart that shows when satellites saw the field bare.
3. **Compare fixes**: five priority sliders and three rotation cards. Each card leads with how many warning signs it fixes (and any new one it adds), then the fit score, sub-scores and the five explanation boxes.
4. **Why we believe this**: the soil health principle behind each warning sign, plus the full NASA POWER weather cards, soil survey, glossary, scoring rules and sources.

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
