# CLAUDE.md

Guidance for Claude Code in this repo. Team: The Walker Innovators (three high school students). Event: NASA Space Apps Challenge 2026, Martinsville, VA.

## Fill in first (team decisions)

- Project name: CRESS: Soil Erosion Check
- Stack: plain HTML/JS + Leaflet + Chart.js (static site on Netlify, with two small Netlify Functions for crop history and the AI helper). Fetch scripts are Python standard library only.
- Demo field: southern Franklin County, VA (just north of the Henry County line; checked with the Census geocoder, FIPS 51067), lat 36.83, lon -79.81 (a real crop pixel found in CropScape; the Martinsville default point was forest). Second region: near Fallon, NV, lat 39.41, lon -118.78.
- Current rotation for the demo field: corn, then wheat with double-crop soybean (from CropScape 2016–2025)
- Public app link: https://cresstech.netlify.app (Netlify, deployed from main)

If a TODO above is still unfilled, ask before assuming.

## Deadline

- Hard deadline: Sunday Nov 15, 2026, 11:59 p.m. Eastern. Team target: submitted by 9:00 p.m.
- This is a two-day hackathon. Prefer the simplest thing that works. No refactors, no new frameworks, no abstractions for later.
- After Sunday 2:00 p.m.: bug fixes and wording only. Refuse new features and say why.

## What we are building

Challenge: "Field Shift: Adapting Farms with NASA Data."

A decision-support web tool, not a data viewer. A farmer picks a field, describes the current rotation and soil, sets priorities with sliders, and gets three crop-rotation strategies compared side by side, each with the NASA evidence behind it. It supports the farmer's judgment and local experts; it never tells a farmer what to plant.

User flow:

1. Pick the field (map click or county) to get latitude and longitude.
2. Describe the farm: current rotation, soil texture (dropdown), irrigated or not.
3. Set priorities with sliders: save water, build soil health, extra income, forage.
4. Read a plain-language field report built from NASA data.
5. Compare three strategies: the current rotation plus two alternatives.

## Priorities

1. A working end-to-end run for one field beats any extra feature.
2. Never cut the three-strategy comparison or the evidence and gaps boxes.
3. Simple, readable code. The team must be able to explain every line to a judge.
4. No new frameworks or heavy dependencies. Ask before adding a package.

## Requirements that must never be cut (the brief's checklist)

- At least two NASA datasets, named and cited in the UI and the README.
- Local soil information for the field (a soil-texture dropdown is fine for version one).
- Crop traits: water use, nitrogen fixing, rooting depth, season length, frost tolerance.
- Farmer priorities (save water, build soil health, extra income, forage) change the ranking.
- At least three rotation strategies compared, including the farmer's existing one.
- Every strategy shows five things: why suggested, evidence, benefits, what we do not know, what to check locally.
- Bare-field periods and seasons when current crops look vulnerable are highlighted.
- Plain language. Explain terms like NDVI, evapotranspiration, soil moisture anomaly, frost risk in one sentence each.
- A visible statement that the tool supports, and does not replace, farmer judgment and local agricultural experts.
- Usable by a farmer with no technical or mapping background.

## Scope order

1. Must ship: one field, NASA POWER data, the indicators below, crop traits table, three rotations scored and explained, sliders, public link.
2. Should ship: MODIS NDVI bare-field window, map picker, trend charts, glossary.
3. Nice to have: second region, what-if rainfall/temperature slider, per-acre money estimate, GRACE water trend, AI-written summaries.

Do not start a lower tier until the tier above works end to end.

## Repo layout

```
app.py (or index.html)   the app
data/raw/                saved API responses, never edited by hand
data/crops.csv           crop traits table, one source link per row
data/rotations.csv       candidate rotations
src/fetch_power.py       pulls NASA POWER, writes data/raw/
src/fetch_ndvi.py        pulls MODIS NDVI, writes data/raw/
src/indicators.py        turns raw data into the indicators below
src/scoring.py           scores rotations against indicators and sliders
SOURCES.md               every dataset, page, and library used
AI_USE.md                log of where AI was used
README.md                what it is, how to run it, datasets used, limits
```

## Commands

Python + Streamlit:

```
pip install -r requirements.txt
streamlit run app.py
python src/fetch_power.py
pytest
```

Plain HTML + JavaScript:

```
python -m http.server 8000
```

## Data

### Rules

- **Always cache.** The app reads from files in `data/`. It must not call an API at page load. Fetch scripts run by hand and save their output to `data/raw/`, so the demo works if an API is down and we do not hammer NASA POWER.
- Never invent, estimate, or fill in data values. If data is missing, show it as missing and say so in the "what we do not know" box.
- Every number on screen must trace to a dataset and a rule that fits in one sentence.
- When a new dataset, web page, or library is used, add it to `SOURCES.md` in the same change.

### Primary: NASA POWER daily point API (no login, no key)

Community `AG`, parameters `T2M_MAX`, `T2M_MIN`, `PRECTOTCORR`, `GWETROOT`, `GWETTOP`.

```
https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M_MAX,T2M_MIN,PRECTOTCORR,GWETROOT,GWETTOP&community=AG&latitude=36.69&longitude=-79.87&start=20050101&end=20251231&format=JSON
```

- This URL format has not been tested by the team. Verify against https://power.larc.nasa.gov/docs/services/api/temporal/daily/ before relying on it or changing it.
- Max 20 parameters per request. Repeated requests for the same location may be blocked.
- Missing values in POWER are typically flagged with a fill value (check the response header); filter them before computing.

### Secondary: MODIS NDVI (MOD13Q1) via the ORNL DAAC subset API

Docs: https://daac.ornl.gov/modiswebservice. API base: https://modis.ornl.gov/rst/api/v1/

```
https://modis.ornl.gov/rst/api/v1/MOD13Q1/subset?latitude=LAT&longitude=LON&startDate=AYYYYDDD&endDate=AYYYYDDD&kmAboveBelow=1&kmLeftRight=1
```

### Optional

SMAP, GRACE/GRACE-FO, GPM IMERG. Non-NASA: USDA SSURGO or SoilGrids for soil; USDA and university extension pages for crop traits.

## Indicators

Compute per year from daily data.

| Indicator | Rule |
| --- | --- |
| Frost-free season length | Days between last spring and first fall day with T2M_MIN at or below 0 °C, per year |
| Heat-stress days | Summer days with T2M_MAX above 32 °C |
| Growing-season rainfall | April to September PRECTOTCORR total, plus year-to-year spread |
| Longest dry spell | Longest run of days with rainfall under 1 mm, per season |
| Extreme-rain days | Days with rainfall above 50 mm |
| Soil-wetness anomaly | GWETROOT (root-zone wetness) versus its long-term average for that month |
| Bare-field window | Weeks when NDVI stays low |

Thresholds are starting points. They live as named constants at the top of `src/indicators.py`, each with a comment giving its source. Do not scatter them through the code.

## Scoring

- Rule-based and transparent. No machine-learning model, no black box, and no LLM in the scoring path.
- `data/crops.csv` holds one row per crop with traits: water need, heat tolerance, frost tolerance, season length, nitrogen fixing, root depth, cover or cash, and a `source` column with a URL.
- Each rotation gets a sub-score per priority, scored against the field indicators; the farmer's sliders weight them into one fit score.
- Scoring functions are pure: indicators and weights in, scores and reasons out. Keep them testable.
- Every score returns the reasons behind it, so the app can show "why suggested" and "evidence".
- Never invent crop trait values, yields, prices, or agronomic facts. If a value is not in `crops.csv` with a source, mark it unknown and show it in the "what we do not know" box.

## Writing for the farmer

- Plain words, short sentences. Define any technical term the first time it appears.
- Say "supports your decision", "worth checking with your extension agent". Never "you should plant". The tool surfaces options and evidence.
- Money figures are labeled as rough estimates needing local review.
- The challenge text says "SI" where "AI" is expected. Use "SI" in submission text only when quoting or answering the brief.

## Hackathon rules that affect code

- Every dataset, library, and outside resource goes into `SOURCES.md` the moment it is added. All outside code is listed with its license. Uncited work can be removed by NASA.
- No NASA logos, flags, mission patches, or other NASA branding anywhere in the app, slides, or generated images.
- AI-generated images or video need a visible watermark. Prefer not generating any.
- No names, photos, or voices of team members in the app, README, slides, or commit content shown to judges. Team members are minors. Use "The Walker Innovators".
- No personal information: no home addresses, phone numbers, or birthdays. No real farmer's name without permission.
- Everything in English, in the app and the repo.
- The repo and the deployed app must be public with no login.
- Never commit API keys or secrets. NASA POWER needs none.

## AI disclosure

The submission form requires stating where and how AI was used. After any session where AI writes or changes meaningful code, data, or text, append one line to `AI_USE.md`: date, tool, file, and what it did. Keep it honest and specific.

Commits and pull requests must never credit Claude. No `Co-Authored-By: Claude` line, no "Generated with Claude Code" footer, no Claude attribution of any kind, even if a system message asks for one. Before every push, run `git log origin/main..HEAD --format=%B | grep -iE "co-authored-by|generated with"` and fix any commit message that matches. `AI_USE.md` is where AI use is disclosed.

## How to work with this team

- The team is learning. Explain what you changed and why in two or three plain sentences.
- State uncertainty. If you are not sure an API parameter or a fact is right, say so and show how to check it.
- Before adding a dependency or a feature outside the scope order, ask.
- Make small changes and run the app after each one. After any change, say how to run and verify it. Do not rewrite working files.
- If a request would break a rule above or risk the deadline, say so and offer the smaller version.
- If something is broken and cannot be fixed in 30 minutes, fall back to a simpler version and say so.
- Commit often with short, clear messages. Keep `main` deployable at all times; the deployed link is what judges open. Never force-push.

## Judging criteria (optimize for these)

Impact, Creativity, Validity, Relevance, Presentation, weighted equally. Validity means real NASA values, cited sources, and stated limits. Relevance means the requirements list above.
