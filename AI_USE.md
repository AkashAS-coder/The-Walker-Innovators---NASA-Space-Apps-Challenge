# AI Use Log

- 2026-11-14, Claude Code, CLAUDE.md: merged CLAUDE.md and CLAUDE.mdv1 into one CLAUDE.md, removing duplicate rules.
- 2026-11-14, Claude Code, GAME_PLAN.md: turned the team game plan into Markdown and added notes from two YouTube videos (Field Shift challenge video, 2024 Global Winners announcement) made from their captions and frames.
- 2026-11-14, Claude Code, GAME_PLAN.md: added the official Field Shift challenge text (resource descriptions condensed into tables) and a list of brief requirements our plan does not cover yet.
- 2026-11-14, Claude Code, .gitignore: added the CRESS files and survey spreadsheet so personal info is never published; summarized the survey for anonymous totals only.
- 2026-11-14, Claude Code, GAME_PLAN.md: added a "Final plan" section (one-sentence pitch, how the rule-based SI and soil-degradation flags work, data levels, app layout, judging strategy, WaterWise comparison, survey use, schedule, slides) and removed team names from the title slide.
- 2026-11-14, Claude Code, docs/PLAN.md: made a shareable copy of GAME_PLAN.md with team names and contact details removed, and pushed the safe planning files to the team GitHub repo.
- 2026-11-14, Claude Code, RESOURCES.md: listed every dataset and tool from the challenge brief plus the Meteomatics sponsor API, with links (checked with curl), and marked which ones our plan uses. Credentials kept out of the repo.
- 2026-11-14, Claude Code, CLAUDE.md: added the rule that commits and PRs never credit Claude.
- 2026-11-14, Claude Code, docs/PLAN.md and GAME_PLAN.md: added a two-person work split (file ownership, interface agreement, git routine for two Claude Code sessions, meet-up points).
- 2026-11-14, Claude Code, index.html, css/style.css, js/app.js, js/indicators.js, js/scoring.js: wrote the first working version of the website (field picker, farm inputs, NASA field report, charts, sliders, three-option comparison with the five boxes, glossary). Scoring is rule-based; no AI is used when the site runs.
- 2026-11-14, Claude Code, src/fetch_power.py, src/fetch_ndvi.py, src/fetch_soil.py, src/fetch_cropscape.py: wrote the scripts that download NASA POWER, MODIS NDVI, USDA soil and CropScape data, and ran them to save data/raw/.
- 2026-11-14, Claude Code, data/fields.json: picked the two demo fields by scanning CropScape for real crop pixels (Henry County, VA, and near Fallon, NV).
- 2026-11-14, Claude Code, data/crops.csv, data/rotations.csv: drafted the crop-traits table (low/medium/high ratings with a source link per row, all marked verified=no for the team to check) and eight candidate rotations.
- 2026-11-14, Claude Code, docs/API.md, README.md, SOURCES.md, tests/run.test.js: wrote the API documentation, README, sources list and tests.
- 2026-11-14, Claude Code, js/scoring.js, js/indicators.js, js/app.js, tests/run.test.js: reviewed the app against the judging criteria; fixed alfalfa hay counting as zero harvests, and made the dry-soil rule use one named threshold (DRY_SOIL_ANOMALY) so tiny dips are not treated as drying. Added two tests.
