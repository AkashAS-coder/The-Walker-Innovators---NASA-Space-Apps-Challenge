# Walker Innovators — Space Apps 2026 Game Plan

As of November 13, 2026 · Challenge: Field Shift: Adapting Farms with NASA Data · Local event: Martinsville, VA

> Shared copy of the team plan. Team member names and contact details are removed because this repo will be public for judging.

## Final plan (updated Saturday Nov 14)

This section is the current plan. Where it disagrees with older sections below, this one wins.

### The one sentence

**Farmers need our app to see how their field's weather and soil are changing, and to compare three crop rotations side by side, including the one they grow now. Each option shows what it would do for their water, soil and income, with the NASA evidence behind it and what still needs checking with their extension agent.**

**Pitch:** *"Our SI reads 20 years of NASA data on your field, finds the warning signs of drought, heat and soil loss, and shows which rotations fix them. It always shows its reasons and what it doesn't know."*

**Slide 3 line:** *"Other tools tell you when to water. Ours shows you what to grow next, and what we don't know."*

**The hook:** the farmer doesn't have to type anything technical. We look up the field's real crop history (CropScape) and soil (SSURGO) ourselves.

### How the SI works

The challenge says "SI" where you'd expect "AI". Ours is explainable: it finds patterns in 20+ years of data using clear rules, not a black box.

1. **Read the field's patterns.** Turn daily NASA data into simple signals: is the frost-free season getting longer, are hot days increasing, are dry spells getting longer, how many weeks a year the field sits bare.
2. **Match crops to those patterns.** Each crop in our table has traits: water need, heat and frost tolerance, root depth, season length, nitrogen fixing. Each rotation is scored against the field. A long dry spell lowers the score of thirsty crops; a long bare winter raises the score of cover crops.
3. **Weight by what the farmer cares about.** Sliders (save water, build soil, income, forage, reduce erosion) decide which scores count most. Every score comes with its reason, which fills the "why suggested" box.

### How it spots soil degradation

We can't measure soil damage from space directly. We flag the conditions that cause it, then show which rotations reduce them.

| Soil problem | Warning signs we combine | What the right rotation does |
| --- | --- | --- |
| Erosion | Many extreme-rain days (POWER) while the field is bare (NDVI), on a sloped soil (SSURGO) | Cover crops keep the ground covered in the risky weeks |
| Organic matter loss | Long bare periods every year (NDVI) and the same row crops year after year (CropScape) | Deep-rooting crops and cover crops add roots and residue back |
| Nutrient depletion | A rotation with no nitrogen-fixing crop (crop table) | A legume such as clover or soybean puts nitrogen back |
| Drying soil | Root-zone wetness below its usual level for that month (POWER) | Drought-tolerant crops, and cover that helps rain soak in |

### The data, in three levels

Use every dataset on our list, but at different levels of effort. Judges reward datasets that clearly do a job on screen, not a long list.

**Level 1: builds the tool (needed by Saturday night)**

| Dataset | What it does on screen | How to get it |
| --- | --- | --- |
| NASA POWER | All five weather indicators plus the soil-wetness anomaly | One URL, no login. Save to `data/raw/` |
| MODIS NDVI | The "bare-field window" chart: weeks each year the field sits brown; crop-stress years | ORNL subset API, no login |
| SSURGO / Web Soil Survey | Soil card: texture, drainage, water-holding capacity. The soil name also gives slope (e.g. "2 to 7 percent slopes"), so erosion risk comes free | Look up the demo field once and save it. Not live |
| Our crop-traits table | Feeds the scoring. 8–10 crops, a source for every row | Virginia Cooperative Extension and USDA pages (USDA Ag Data Commons counts) |

**Level 2: makes it believable (Sunday morning)**

| Dataset | Job | Why judges care |
| --- | --- | --- |
| CropScape (USDA Cropland Data Layer) | The field's real crop history ("2019 corn, 2020 soybean…"); fills in "current rotation" automatically | Creativity and Relevance: real history, not a guess |
| USDA NASS QuickStats | Drought back-test: find the driest year in our own POWER data, then check whether county yields fell that year | Validity: our indicators match reality |
| PRISM | Cross-check our POWER frost dates and rainfall against PRISM for the same spot | Validity; answers the brief's "satellite vs ground" question |

Download QuickStats as a CSV from the website. Its API needs a key, and keys can't go in the repo.

**Level 3: mention only, on the "what's next" slide**

- SMAP, GPM IMERG and SRTM need an Earthdata login or extra processing. SSURGO already gives slope and POWER already gives rainfall.
- If the core is done by Sunday 10:00, add one: SMAP ("the satellite agrees with POWER about soil wetness").

### What the farmer sees (four parts on one page)

1. **Pick your field:** type a county or click the map. Henry County is filled in for the demo.
2. **Your field today:** soil card (SSURGO), "what you've grown" strip (CropScape), five weather cards (POWER), each with a one-line plain meaning, e.g. "Your frost-free season is X days longer than in 2005." The number must be computed, never typed in. Give frost risk its own visible card.
3. **What matters to you:** five sliders (save water, build soil, extra income, forage, reduce erosion) plus a limits checkbox such as "no hay equipment".
4. **Three options side by side:** current rotation plus two alternatives. Each card: fit score, water use compared with now, bare-field chart (NDVI), and the five boxes (why suggested, evidence, benefits, what we don't know, check locally).

Footer on every page: *"This supports your decision. It does not replace your judgment or your extension agent."*

### How each criterion is won

| Criterion | Our winning move |
| --- | --- |
| Impact | Slide 2: a real problem with our own survey numbers, then the tool working in a second region (Nevada) |
| Creativity | We look up the field's real crop history (CropScape) and line it up with satellite bare weeks (NDVI). That is the brief's "data fusion" idea, done simply. Design choices come from what surveyed growers told us |
| Validity | Two checks: POWER against PRISM, and indicators against county yields in the drought year. Cited crop table, stated limits |
| Relevance | Every line of the brief's checklist, in their words: "compare rotations, reveal trade-offs, understand risk, make uncertainty visible" |
| Presentation | Seven slides, real screenshots, one headline number from our own data. Story lead owns it from now |

### How we beat the 2024 farm winner (WaterWise)

WaterWise (Best Use of Data, 2024) gave irrigated, mostly western farms a watering schedule from evapotranspiration data. It won on one clear decision, one key NASA variable, tests in several places, and one memorable number.

- **Match it:** one headline number computed from our own data; tests in more than one place (drought back-test, PRISM check, Nevada); results personalized by sliders.
- **Beat it:** three options with trade-offs instead of one answer; a "what we don't know" box (WaterWise's pitch never mentioned uncertainty); a stated validation method; rules you can read; it works for rain-fed farms, which is most of Southside Virginia.
- **Small borrow:** a "water use compared with now" line on each card, from the crop table's water need.
- **Don't:** reuse their "60 percent" figure, or build an irrigation schedule.

### Using the CRESS grower survey

**The rule:** the survey shows why growers need better information about heat, drought and trust. It does not show that farmers want a rotation tool, because nobody was asked about rotation. Use it as evidence of the problem, never as proof of demand.

**Always describe it as:** "16 Virginia growers we surveyed in November 2026, mostly small growers and gardeners." Totals only. Never names, emails, or phone numbers. The spreadsheet stays out of the repo (it is in `.gitignore`).

1. **Slide 2 headline (Impact):** "13 of 16 Virginia growers we surveyed lost crops in the last two years. The top causes were drought (10) and heat (10)."
2. **It shows we chose the right indicators (Relevance, Validity).** Slide 4: "We measure the problems growers told us about."

   | What growers lost crops to | Our NASA indicator |
   | --- | --- |
   | Drought or underwatering (10) | Longest dry spell, soil-wetness anomaly (POWER) |
   | Heat stress (10) | Heat-stress days (POWER) |
   | Frost (3) | Frost-free season and frost risk (POWER) |

3. **It explains our design (Creativity, Presentation):**

   | What growers said | How our app answers it |
   | --- | --- |
   | 5 of 16 don't trust farm tech readings | Every number shows its source, plus a "what we don't know" box |
   | 9 of 16 want to tell weather problems from soil problems | Field report split into weather cards and soil cards |
   | 5 of 16 learn about tools from the extension office | "Take this to your extension agent" on every result |
   | Only 1 of 16 uses a soil sensor; 13 judge soil by look and feel | Plain words, big text, no technical setup |

4. **Testers ready (Impact):** 13 of 16 said they would test something and 9 want results. Slide 7: "Next: test the tool with the growers who answered our survey."
5. **Honest limits (Validity):** slide 6: "Our survey is small and mostly gardeners. It shows the weather problems are real. It does not prove demand for rotation planning; that is our next test."

**Submission page, "Other data":** "CRESS grower survey (team's own, 16 anonymous responses, Nov 2026)."

**Don't:** call respondents "farmers in Henry County" (most are near Richmond); use other CRESS claims such as the "95.4% white" figure or CropX prices (weak or no source); use the survey to pick crops, the demo rotation, or sliders (use CropScape and NASS for Henry County instead).

### Time left

| When | Data lead | Build lead | Story lead |
| --- | --- | --- | --- |
| Sat now → 4:00 | POWER pulled and saved, five indicators computed | App shell with sliders and three cards, deployed at a public link | Crop table (8–10 crops, sources), SSURGO lookup for the demo field |
| Sat evening | NDVI bare-field window | Scoring connected to indicators and sliders. End-to-end run, screenshot it | Draft the summary and the five boxes for each rotation |
| Sun 10:00 | Feature freeze call. SMAP in or out | | |
| Sun morning | CropScape history, then the PRISM check | Second region (Nevada), map | Slides 1–4 |
| Sun 2:00 | Drought back-test with NASS | Bug fixes only | Slides 5–7 |
| Sun 6:00 | Test every link logged out | Fix anything broken | Finish the submission page |
| Sun 9:00 | Submit and confirm the banner | | |

**If we fall behind, cut in this order:** Level 3, then the second region, then CropScape (type the rotation in by hand instead). **Never cut** the three-card comparison, the five boxes, or POWER and NDVI.

### Work split (two people, each with Claude Code)

Right now two of us are building, each in our own Claude Code session. Each person owns separate files so the two sessions never edit the same file.

**Person A: Data + Story**

| Order | Task | Files A owns |
| --- | --- | --- |
| 1 | Pull NASA POWER for the demo field and save it | `src/fetch_power.py`, `data/raw/` |
| 2 | Compute the five indicators | `src/indicators.py` |
| 3 | Crop traits table, 8–10 crops, one source link per row | `data/crops.csv` |
| 4 | List every dataset and library used | `SOURCES.md` |
| 5 | Saturday evening: MODIS NDVI bare-field window | `src/fetch_ndvi.py` |
| 6 | Sunday: slides, submission text, link testing | slides, `README.md` |

**Person B: App + Scoring**

| Order | Task | Files B owns |
| --- | --- | --- |
| 1 | Empty app live at a public link | `app.py` (or `index.html`) |
| 2 | Layout: field picker, soil dropdown, five sliders, three rotation cards | `app.py` |
| 3 | Candidate rotations, including the current one | `data/rotations.csv` |
| 4 | Scoring: indicators and sliders in, scores and reasons out | `src/scoring.py`, `tests/` |
| 5 | Connect A's real indicators, then run it end to end | `app.py` |
| 6 | Saturday evening: map and charts. Sunday: bug fixes and deploy | `app.py` |

**Shared files:** `CLAUDE.md`, `AI_USE.md`, `RESOURCES.md`. Change these only in small commits, and pull right before you edit them.

**Agree first (5 minutes):** what `indicators.py` hands to `scoring.py`. Write the agreed keys at the top of `src/indicators.py`, for example:

```python
{
  "frost_free_days":      {"value": ..., "trend": ..., "source": "NASA POWER T2M_MIN"},
  "heat_stress_days":     {"value": ..., "trend": ..., "source": "NASA POWER T2M_MAX"},
  "season_rain_mm":       {...},
  "longest_dry_spell":    {...},
  "soil_wetness_anomaly": {...},
}
```

B may test scoring with made-up numbers inside `tests/` only. The app itself shows only A's real data.

**How to work with two Claude Code sessions**

1. Each person works in their own clone, on their own laptop.
2. Start every session with: "Read CLAUDE.md and HANDOFF.md. I am Person A (data). Only edit my files." Use "Person B (app)" for the other one.
3. Before every push: `git pull --rebase origin main`, then `git push origin main`.
4. Make small commits and push at least every hour, so `main` always works.
5. If you get a merge conflict, stop and fix it together. Don't let Claude guess.
6. No commit credits Claude (see CLAUDE.md).

**Meet-up points:** Sat 12:00 (A has indicators, B has layout) · Sat 1:30 (connect them: scoring on real indicators) · Sat 3:00 (end-to-end run, screenshot it) · Sun 10:00 (feature freeze) · Sun 2:00 (bug fixes only) · Sun 9:00 (submit).

### Slides (seven, no more)

1. Title: project name, "The Walker Innovators", challenge name. No team member names and no NASA logo
2. One local problem with the survey headline, side by side with our indicators
3. Screenshot of the three-card comparison
4. How it works: field → CropScape + SSURGO + POWER + NDVI → indicators → scored rotations. "We measure the problems growers told us about"
5. NASA data: what each dataset does on screen
6. Proof: PRISM check, drought back-test, our limits (including the survey's limits)
7. Impact and next steps: SMAP, GPM, SRTM, more regions, testing with the surveyed growers

## Read this first

We win by building one small, working, explainable tool that hits every line of the Field Shift brief, and by presenting it better than anyone else. Most teams lose on scope and on the submission page, not on code.

The plan in five lines:

- **Build:** a web tool where a farmer picks a field, sets priorities, and gets three crop-rotation strategies compared, each with the NASA evidence behind it.
- **Demo field:** a real farm area in Southside Virginia, near Martinsville. That is our local story and our edge.
- **Data:** start with NASA POWER (no login, works in minutes). Add MODIS vegetation and one more dataset only after the core works.
- **Demo:** a seven-slide deck, not a video. Anyone under 18 cannot appear or speak in a video without a voice modifier.
- **Submit early:** target Sunday 9:00 p.m. ET. The hard deadline is 11:59 p.m. ET and it is final.

## What the two videos taught us

We watched the official Field Shift challenge video and the 2024 Global Winners announcement. Full notes are at the end of this file. The lessons:

1. **Use the brief's four phrases word for word.** The challenge video's mission line is: *"Compare rotations, reveal trade-offs, understand risk, make uncertainty visible."* Put it in the summary and on slide 4. Our "what we do not know" box is the "make uncertainty visible" part. Say so.
2. **Farm tools have won globally before.** In 2024, two of the ten Global Winners were farmer tools: WaterWise (Best Use of Data) and To Plant or Not To Plant (Galactic Impact). Judges reward this topic.
3. **Open with one real farmer and one real decision.** To Plant or Not To Plant began with a team member's dad, a farmer, asking which fields were too wet to plant. That is our slide 2.
4. **One memorable number, tested in more than one place.** WaterWise won on "up to 60 percent of water is wasted" plus tests on farms in several locations. Ours: the drought-year back-test, the Nevada second region, and one headline number from our NASA data.
5. **Start local, then show it scales.** The 2024 Local Impact winner (GROW, wildfires) said: "By starting small we believe these localized solutions can be scaled to other regions." That is our Southside Virginia story plus Nevada.
6. **"Simple and actionable" wins.** Two winners stressed making complex data simple for non-experts. Plain language and a glossary are scoring features, not polish.
7. **The watermark rule in practice.** NASA's own challenge video puts a "GENERATED CONTENT" badge on every AI-made shot. If we use any AI image, do the same. Better, use none.
8. **Know the judges.** The Field Shift subject-matter experts are a remote-sensing scientist, a data architect, and a machine-learning scientist at Johnson Space Center. Expect questions on data handling and how the "SI" handles uncertainty. Rule-based and explainable is a strength with them.
9. **Optional impact line:** tie the tool to UN Sustainable Development Goals 2 (Zero Hunger) and 13 (Climate Action), the way the Most Inspirational winner used SDG 11.

## What the official brief adds (gaps in our plan)

The full challenge text is copied at the end of this file. Compared with it, our plan is missing these. Each is small; fix them in this order.

1. **"Reduce erosion" slider.** The brief lists erosion reduction as a farmer priority, and our checklist names it, but the app plan has only four sliders. Add a fifth, or fold erosion into "build soil health" and say so.
2. **Pest-cycle disruption** as a rotation benefit. Add a yes/no "breaks pest cycle of current crop" note per alternative, sourced from extension pages.
3. **Market suitability.** The brief names it as a farmer priority and lists USDA AMS Market News and NASS QuickStats. Cheapest version: a "grown in this county?" line from NASS QuickStats acreage, or put "local market not checked" in the gaps box.
4. **Farmer constraints**, not just priorities: water availability (irrigated or not, already planned), equipment limits, market preferences. Even a checkbox ("no hay equipment") that removes forage crops counts.
5. **Why each crop type helps soil.** One plain sentence each for nitrogen-fixing, cover, deep-rooting, and drought-tolerant crops. Put them in the glossary.
6. **Satellite vs ground data.** The brief asks teams to explain how satellite observations differ from ground measurements. One glossary card: "Satellites see the whole field from above, often at coarse resolution; a rain gauge is exact but only for one spot."
7. **"Water-balance indicators"** is a term the brief wants explained. Rainfall minus crop water use is enough.
8. **Ways to validate (Validity score).** The brief lists PRISM (frost/freeze dates, climate normals) and CoCoRaHS (volunteer rain gauges). Comparing our POWER frost dates or rainfall to one of these for the demo field is a strong back-test that takes little effort.

Datasets the brief lists that we are deliberately skipping for version one: ECOSTRESS, GEDI, NAIP, NLCD, LANDFIRE, NLDAS/GLDAS, GAEZ, OpenET (western US only, so not Virginia), NWIS, Sentinel-2, ERA5. Say in the write-up that these are next steps.

## Tonight (planning only)

The local lead's email says work cannot begin until Saturday. Reading, planning, and account setup are fine. Do not write project code or slides tonight.

- [ ] Everyone reads this doc and the full challenge page, including the Resources tab
- [ ] Confirm all three of us show on the team's Members tab and are registered to the Martinsville event
- [ ] Agree on roles (see Team roles)
- [ ] Create free accounts: GitHub, NASA Earthdata Login
- [ ] Charge laptops, pack chargers, download the parking map from Mr. Sumner's email
- [ ] Sort out the ride and the adult who is coming with us (see Logistics)
- [ ] Sleep. Saturday is a long day.

## Logistics

Saturday is in person in Martinsville until 4:00 p.m.; Sunday is remote only. All times are Eastern.

| When | What | Notes |
| --- | --- | --- |
| Sat Nov 14, 9:00 a.m. | Check in, front lobby | WPHEC Baldwin Building, 191 Fayette St, Martinsville, VA 24112 |
| Sat 9:00 a.m. | Project submission page opens | The Project tab on our team page becomes editable |
| Sat 9:30 a.m. | Welcome, orientation, team formation | Also livestreamed at youtube.com/@wphighered |
| Sat 10:00 a.m. to 4:00 p.m. | Team build time on site | Building closes to us at 4:00 p.m. |
| Sat evening | Keep working remotely | Our own call; nobody hosts it |
| Sun Nov 15, all day | Remote only | No in-person session |
| Sun 9:00 p.m. | Our internal submit time | Leaves three hours of buffer |
| Sun 11:59 p.m. | Hard deadline | No edits or exceptions after this |
| Nov 16 to 22 | Local judging | Local judges pick who advances to Global Judging |

- **Getting in:** the Fayette Street doors are locked. Enter from the big parking lot on the other side of the building. The parking map is attached to Mr. Sumner's email.
- **The drive:** Martinsville is roughly three hours from Richmond. Check the route tonight and plan to leave around 5:30 a.m. to make 9:00 check-in.
- **Bring:** laptop, charger, a power strip, phone hotspot as Wi-Fi backup, headphones, water and food, a notebook. WPHEC provides Wi-Fi, workspace, and outlets.

**If any of us is under 18:**

- A parent or legal guardian must have registered us on the Space Apps site.
- A parent or guardian must stay with us for the whole in-person event, unless written consent for an approved chaperone was given in advance. Sort this out tonight, not at the door.
- We cannot appear in a submission video, and voices need a modifier. This is why we use slides.

**Contact:** the WPHEC Executive Director (phone and email are in the event email, kept off GitHub).

## How judging works

We have to win locally first: local judges nominate teams to Global Judging, and only Global Nominees can become Finalists or Winners. Projects are scored on five criteria, and Presentation counts as much as the other four.

**The path:** local judging (Nov 16 to 22) → Global Nominee → Global Judging by NASA and partner-agency experts → Global Finalist or Honorable Mention → Executive Judging → 10 Global Winners. The number of nominees depends on how many projects our local event submits. A small event like Martinsville may send only one or two, so aim for first, not top three. For scale: in 2024, 10 winners came out of 9,900+ projects.

| Criterion | What judges ask | How we score on it |
| --- | --- | --- |
| Impact | How big is the problem? How many people could this help? | Open with one farmer and one real decision. Show it works for a second region so it scales past Virginia. |
| Creativity | Is the approach new, or a small tweak on what exists? | Farmer priorities drive the ranking, and every suggestion shows its evidence and its gaps. Most tools show maps; ours shows a decision. |
| Validity | Is the science sound? Would it work in the real world? | Use real NASA values, cite every dataset, back-test against a known drought year, and state the limits out loud. |
| Relevance | Does it answer this challenge? Is it complete and usable? | Hit every item in the must-hit checklist below. Use the challenge's own words in the write-up. |
| Presentation | Is the problem, solution, and why-it-matters clear? | One person owns the story from hour one. Clean seven-slide deck, screenshots of the working tool, no jargon. |

**Global awards worth aiming at:** Local Impact (greatest potential to make a difference in the local community), Best Use of Data (makes space data more accessible or applies it in a unique way), and Galactic Impact. Our Southside Virginia farm story fits Local Impact best. In 2024, Best Use of Data and Galactic Impact both went to farm tools.

The official Judging & Awards Guide and Project Submission Guide were updated for 2026 today. Parts of what I could read still carried last year's dates, so the Story lead should re-read both on Saturday morning and correct anything here that changed.

## The challenge decoded

Field Shift asks for a decision-support tool, not a data viewer: it must help a farmer compare crop rotations using NASA Earth observations plus soil information, crop traits, and the farmer's own priorities. It is rated Intermediate/Advanced under Earth Science, Software, and Arts & Multimedia, so design and storytelling count too.

The brief says "may" everywhere, but judges score Relevance against it. Treat these as required:

- [ ] Uses at least two NASA datasets, named and cited
- [ ] Takes local soil information for the field
- [ ] Uses crop characteristics (water use, nitrogen fixing, rooting depth, season length, frost tolerance)
- [ ] Lets the farmer set priorities (save water, build soil, forage, extra income, reduce erosion)
- [ ] Compares at least three rotation strategies, including the farmer's existing rotation
- [ ] For each strategy shows: why it was suggested, the evidence, the benefits, the information gaps, and the risks needing local review
- [ ] Highlights bare-field periods and seasons when current crops look vulnerable
- [ ] Explains terms in plain language (evapotranspiration, NDVI, soil moisture anomaly, frost risk)
- [ ] Says clearly that it supports, and does not replace, farmer judgment and local experts
- [ ] Is usable by a farmer with no technical or mapping background

**A note on "SI":** the challenge text says "SI" (super intelligence) where you would expect "AI". Use their word in the write-up. They want explainable pattern-finding, not a black box, and they ask how the model handles uncertainty. The challenge video lists acceptable formats as "an SI model, an interactive map, a visualization, a decision-support tool", so our decision-support tool fits the brief directly.

**Bonus points the brief hints at:** an interactive map, a timeline of long-term trends, a what-if slider for rainfall or temperature, and harmonizing datasets of different resolutions onto one grid (the video calls this "different observations, different scales, pieces of the same story"). Pick one, after the checklist is done.

## Our project concept

This is a proposed concept, to argue over for ten minutes at 10:00 a.m. and then lock. A farmer picks a field, tells us what they grow now and what they care about, and gets three rotation strategies side by side with the NASA evidence for each.

**The one-sentence pitch:** "Twenty years of NASA data on your field, turned into three rotation options you can take to your extension agent."

### What the farmer does

1. **Pick the field.** Click a map or type a county. We read latitude and longitude.
2. **Describe the farm.** Current rotation (for example corn then soybean), soil type from a short dropdown, irrigated or not.
3. **Set priorities.** Four sliders: save water, build soil health, earn extra income, grow forage.
4. **Read the field report.** Plain-language cards built from NASA data: how the frost-free season, summer heat, rainfall, and soil moisture have shifted, and when the field usually sits bare.
5. **Compare three strategies.** The current rotation plus two alternatives, each with a fit score and five short answers: why suggested, evidence, benefits, what we do not know, what to check locally.

### How the ranking works

Keep it transparent. Each crop in a small table has traits: water need, heat tolerance, frost tolerance, season length, nitrogen fixing, root depth, cover or cash. The tool scores each rotation against the field's NASA-derived conditions, then weights the scores by the farmer's sliders. Every number on screen traces back to a dataset and a rule we can explain in one sentence. That is our answer on Validity and on "explainable SI".

If there is time, an AI model can rewrite the result into friendlier sentences. The scoring stays rule-based, and the AI use is disclosed.

### Why this can win

- **A real place.** Our demo field is in Henry County or nearby Southside Virginia, the region hosting our event. The team has talked with local farmers about technology; put that in the first slide.
- **A real number.** Our finance angle: show a rough per-acre cost or income effect for each strategy, clearly labeled as an estimate needing local review.
- **Honesty as a feature.** The "what we do not know" box on every strategy is exactly what the brief asks for ("make uncertainty visible") and what most teams skip.
- **Proof it travels.** Run the same tool on the Nevada alfalfa country from the challenge photo to show it is not Virginia-only.

### Decisions to lock at 10:00 a.m.

- [ ] Project name (short, farmer-friendly, no NASA branding)
- [ ] Demo field location and its current rotation. Ask a farmer you know, or use the common local crops and say so.
- [ ] The crop list for version one: 8 to 10 crops, including two cover crops and one nitrogen fixer
- [ ] Tech stack (see Build plan)

## NASA data plan

Start with NASA POWER: one web request returns decades of daily weather and soil-wetness values for any point, with no account. Get that working before touching anything else. NASA data is required to be eligible for Global Awards.

| Priority | Dataset | What it gives the tool | How to get it fast |
| --- | --- | --- | --- |
| 1, must | NASA POWER | Daily min and max temperature, rainfall, root-zone and surface soil wetness since 1981. Feeds frost dates, heat-stress days, dry spells, extreme-rain days. | REST API, JSON or CSV, no login |
| 2, must | MODIS vegetation index (MOD13Q1 NDVI, 250 m, every 16 days) | When the field is green and when it sits bare; years the crop was stressed | ORNL DAAC subset API, simple GET requests by latitude and longitude |
| 3, should | SMAP soil moisture | Satellite soil-moisture check on the POWER values | ORNL subsets list or AppEEARS (needs Earthdata Login) |
| 4, should | GRACE / GRACE-FO | Long-term water-storage trend for the region: is the water table story getting worse? | Download a regional time series; one chart is enough |
| 5, nice | GPM IMERG rainfall | Finer rainfall detail and extreme events | Giovanni or AppEEARS |
| 6, nice | ECOSTRESS, Landsat, SRTM elevation | Heat stress at field scale, slope for erosion risk | Only if the core is done by Saturday 3:00 p.m. |

**Not NASA, but the brief asks for it:**

- **Soil:** USDA Web Soil Survey / SSURGO for US fields, SoilGrids for anywhere else. For version one, a soil-texture dropdown the farmer fills in is acceptable; say so in the gaps box.
- **Crop traits:** build our own table of 8 to 10 crops from USDA and university extension pages (Virginia Cooperative Extension first). Record the source for every row. This table is original work and a big part of our Validity score.
- **Current rotation history:** USDA Cropland Data Layer (CropScape) shows what was grown on a US field each year. A strong stretch goal.

### POWER request to test first

Paste this in a browser at 10:15 a.m. The coordinates are Martinsville. If it returns JSON, the data pipeline is unblocked.

```
https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M_MAX,T2M_MIN,PRECTOTCORR,GWETROOT,GWETTOP&community=AG&latitude=36.69&longitude=-79.87&start=20050101&end=20251231&format=JSON
```

This URL is written from memory of the API format, so check it against the POWER docs if it errors. POWER allows up to 20 parameters per request and warns that apps hammering the same location may be blocked, so save the response to a file and load from the file.

### What we compute from it

| Indicator | Rule | Why a farmer cares |
| --- | --- | --- |
| Frost-free season length | Days between last spring and first fall day with minimum at or below 0 °C, per year | Is there room for a second crop or a cover crop? |
| Heat-stress days | Days per summer with maximum above about 32 °C | Which crops are getting riskier |
| Growing-season rainfall | April to September total, plus year-to-year spread | Water budget and reliability |
| Longest dry spell | Longest run of days under 1 mm, per season | Drought exposure |
| Extreme-rain days | Days above about 50 mm | Erosion risk on bare ground |
| Soil-wetness anomaly | Root-zone wetness versus its long-term average for that month | When current crops are vulnerable |
| Bare-field window | Weeks when NDVI stays low | Where a cover crop fits |

The thresholds are starting points. Pick final values from an extension source and cite it.

**Rule for the whole weekend:** every dataset we touch goes into a shared "Sources" list the moment we use it, with its link. The submission form asks for it, and uncited work can be removed.

## Build plan

The goal for Saturday 4:00 p.m. is an ugly version that works end to end for one field. Sunday is for polish, the second region, the slides, and the submission page. Projects do not need to be finished products, but a working demo beats a big idea.

### Scope

| Version | What it includes | When |
| --- | --- | --- |
| Must ship | One field, POWER data, five indicators, crop table, three rotations scored and explained, priority sliders, public link | Saturday 4:00 p.m. |
| Should ship | NDVI bare-field window, map to pick the field, trend charts, plain-language glossary | Saturday night |
| Nice to have | Second region, what-if rainfall slider, per-acre money estimate, GRACE water trend, AI-written summaries | Sunday morning, only if the rest is solid |

Cut from the bottom. Never cut the three-strategy comparison or the evidence and gaps boxes.

### Tech stack

Pick whichever the Build lead already knows. Do not learn a framework on Saturday.

| Option | Good if | Public link |
| --- | --- | --- |
| Python + Streamlit (pandas, plotly, folium) | Someone knows Python. Fastest route to sliders, charts, and a map. | Streamlit Community Cloud, free, deploys from GitHub |
| Plain HTML + JavaScript (Leaflet, Chart.js) | Someone knows web basics. No server needed. | GitHub Pages, free |

Either way: one public GitHub repo, a README, and the NASA data saved as CSV files in the repo so the demo works even if an API is down.

### Timeline

| Time | Milestone | Owner |
| --- | --- | --- |
| Sat 9:00 | Check in. Open the Project tab and paste a draft project name and summary so the page is never empty. | Story lead |
| Sat 9:30 | Orientation. Ask the local lead how local judging will work and how many teams advance. | All |
| Sat 10:00 | Lock concept, name, demo field, stack. Ten minutes, then stop debating. | All |
| Sat 10:15 | POWER request returns data and is saved to a file | Data lead |
| Sat 10:15 | Empty app is deployed at a public link | Build lead |
| Sat 10:15 | Crop traits table started, with a source per row | Story lead |
| Sat 12:00 | Five indicators computed for the demo field. Eat lunch. | Data lead |
| Sat 1:30 | Scoring works: three rotations ranked from the indicators and sliders | Build + Data |
| Sat 3:00 | End-to-end run on the demo field. Screenshot it. | All |
| Sat 3:30 | Write down what is left, split evening tasks, pack up | All |
| Sat 4:00 | Building closes | |
| Sat evening | NDVI, map, charts. Story lead drafts all submission text. | Remote |
| Sun 10:00 | Feature freeze call. Decide what nice-to-haves are in or out. | All |
| Sun 2:00 | No new features. Bug fixes and wording only. | Build lead |
| Sun 4:00 | Seven slides done with real screenshots | Story lead |
| Sun 6:00 | Every link tested in a private browser window, logged out | Data lead |
| Sun 8:00 | Full read-through of the submission page by all three | All |
| Sun 9:00 | Click Submit for Judging. Confirm the success banner. | Team owner |

### Schedule by role (all times Eastern)

| When | Build lead | Data lead | Story lead |
| --- | --- | --- | --- |
| Tonight | Make a GitHub account, charge up, sleep | Make an Earthdata account, sleep | Read the challenge page, sleep |
| Sat 5:30 a.m. | Leave Richmond | Leave Richmond | Leave Richmond |
| Sat 9:00 | Check in | Check in | Paste a draft name and summary into the Project tab |
| Sat 9:30 | Orientation | Orientation | Ask how many teams advance and whether prior work is allowed |
| Sat 10:00 | Lock name, demo field, crops, stack (10 minutes, all three) | Same | Same |
| Sat 10:15 | Empty app live at a public link | POWER data pulled and saved to a file | Start the crop table |
| Sat 12:00 | Sliders and page layout working | Five indicators computed | Crop table done, Sources list started |
| Sat 1:30 | Scoring ranks three rotations (with Data lead) | Scoring, with Build lead | Draft the summary and the five answer boxes |
| Sat 3:00 | Full run on the demo field, screenshot it | Same | Same |
| Sat 3:30 | List what's left, pack up by 4:00 | Same | Same |
| Sat evening | Map and charts | NDVI bare-field window | Draft all submission text |
| Sun 10:00 | Feature freeze call (all three) | Same | Same |
| Sun morning | Second region if solid | Drought-year back-test | Slides 1 to 4 |
| Sun 2:00 | Bug fixes only | Fill in the NASA data section | Slides 5 to 7 |
| Sun 4:00 | Deploy check | Help with screenshots | Slides done |
| Sun 6:00 | Fix anything broken | Test every link logged out | Finish the page text |
| Sun 8:00 | Read the whole page together | Same | Same |
| Sun 9:00 | Confirm the banner | Confirm the banner | Click Submit for Judging |

### If we fall behind

- **No data by Saturday noon:** download a CSV by hand from the POWER Data Access Viewer and keep going.
- **No scoring by Saturday 3:00:** hard-code three rotations for the demo field and make the evidence real.
- **Deploy is broken on Sunday:** record the app locally, put screenshots in the deck, and link the GitHub repo as the final project.

## Team roles

Three people, three owners. Everyone helps everywhere, but each deliverable has exactly one name on it.

| Role | Owns | Name |
| --- | --- | --- |
| Data lead | NASA data pulls, the indicator calculations, the saved CSVs, the back-test against a drought year, link testing on Sunday, fixing the UI and style of the app | Data lead (name kept off GitHub) |
| Build lead | The app, the scoring logic, the map and charts, the GitHub repo, the public deployment | Build lead (name kept off GitHub) |
| Story lead | The crop traits table, the Sources list, all submission-page text, the seven slides, re-reading the official guides, clicking Submit | Story lead (name kept off GitHub) |

> An earlier draft suggested the Data lead as Build lead "as the strongest coder." The table above is the version with names filled in, so it is the one we use. Change it here if the team decides otherwise.

The Story lead is not the "non-technical" job. Presentation is one fifth of the score and the submission page is what judges read, so give it to the best writer.

## Submission checklist

Judges mainly evaluate the project page itself, so each field below gets real effort. Everything must be in English, and every link must open with no login, password, or access request.

- [ ] Project name
- [ ] High-level summary: what we built, how it answers the challenge, why it matters. Write it for someone with no background. Use the brief's words: compare rotations, reveal trade-offs, understand risk, make uncertainty visible.
- [ ] Link to project demo: seven slides maximum including the title slide, or a video of 30 seconds maximum. Going over makes the project ineligible for Global Judging. Host it externally (Google Slides or Drive set to "anyone with the link").
- [ ] Link to final project: the live app, plus the public GitHub repo
- [ ] Detailed description: what it does, how it works, benefits, goals, and the tools, languages, and software used
- [ ] NASA data: which datasets, and exactly how each one is used in the tool
- [ ] Space agency partner and other data: USDA soil and crop sources, map tiles, libraries, any images
- [ ] Use of artificial intelligence: which tools, where, and how. Be specific and honest.
- [ ] References: every dataset, paper, extension page, and open-source library
- [ ] Both verification boxes ticked: terms accepted and work is original
- [ ] Submit for Judging clicked, and the confirmation banner seen

### The seven slides

1. **Title:** project name, "The Walker Innovators", the challenge name. No team member names (see Final plan)
2. **The problem**, told through one farmer and one decision (the 2024 Galactic Impact winner opened exactly this way)
3. **What the tool does:** a screenshot of the three-strategy comparison
4. **How it works:** field → NASA data → indicators → scored rotations
5. **The NASA data** we used and what each dataset contributes
6. **Evidence it is sound:** the back-test, the cited crop table, the limits we state
7. **Impact and what comes next:** more regions, more crops, farmer testing

The official guide asks slides to show an image of the project, describe the user experience, and explain how space-agency open data made it possible. Slides 3, 4, and 5 cover that. Use short text, large fonts, and real screenshots.

If a team member under 18 is named on the title slide, check the 2026 guide's wording on minors' names first; last year's guide said recognizable names, voices, and likenesses of under-18s must not appear in submissions.

## Rules and traps

These are the ways good projects get thrown out or marked down. Read them once now and once more before submitting.

- **Starting early.** Work cannot begin before Saturday. Plan tonight; build tomorrow.
- **Late submission.** 11:59 p.m. ET Sunday is final. No edits, no exceptions.
- **Demo too long.** More than seven slides or more than 30 seconds of video means no Global Judging.
- **Private links.** A link that asks for a login or permission is a dead link to a judge. Test logged out.
- **No NASA data.** Required for Global Awards. Name the datasets and show where they appear in the tool.
- **Missing citations.** List every outside resource, including open-source code. Uncited material can be removed.
- **Undisclosed AI.** AI tools are allowed, but we must state where and how we used them. AI-generated images or video need a visible watermark (NASA's own challenge video labels every AI shot "GENERATED CONTENT"), and AI-generated code or data must be acknowledged in the description.
- **NASA branding.** Do not put NASA logos, flags, or mission patches in the app, slides, or any AI-generated image.
- **Minors on camera.** No faces or unmodified voices of anyone under 18 in a video.
- **Team membership.** All three of us must be registered, at the same local event, and on the Members tab before submission closes. Nobody can be added afterward.
- **Not English.** The page and all linked material must be in English.
- **Overclaiming.** Do not say the tool tells farmers what to plant. It supports a decision and flags what needs local review. The brief says this twice.
- **Personal information.** No home addresses, phone numbers, or birthdays anywhere in the submission. If we feature a real farmer, get their permission and consider leaving their name out.

**Free tools on offer (optional):** Google Cloud, Microsoft Azure and Planetary Computer, Meteomatics weather API, GoDaddy domain and hosting, and Miro boards. Some ask for a credit card to verify. We do not need any of them for the must-ship version.

**Stuck?** Ask in Space Apps Connect, where navigators and subject-matter experts answer questions during the weekend, or ask the local lead on site.

## Resources: keep it to these

- **NASA POWER:** weather and soil wetness back to 1981, no login. Our first dataset and our must-have.
- **MODIS NDVI (ORNL subset API):** shows when the field is green or bare. Our second NASA dataset.
- **USDA Web Soil Survey:** soil type for the demo field. A dropdown is fine for version one.
- **Virginia Cooperative Extension and USDA crop pages:** for the 8 to 10 crop traits table, with a source per row.
- **Our CRESS survey answers:** the real farmer problem for slide 2, anonymous totals only.
- **Tools:** GitHub, Google Slides, and either Streamlit or GitHub Pages, whichever the Build lead already knows.
- **Help:** Space Apps Connect and Mr. Sumner on site.

Skip SMAP, GRACE, GPM and the sponsor tools unless the core works by Saturday 3:00 p.m.

## Links and sources

- Field Shift challenge page: the brief and the Resources tab are copied at the end of this file
- All 2026 challenges
- Project Submission Guide
- Judging & Awards Guide
- Participant FAQs
- Space Apps Connect
- NASA POWER daily API docs: https://power.larc.nasa.gov/docs/services/api/temporal/daily/
- ORNL DAAC MODIS/VIIRS subset web service: https://daac.ornl.gov/modiswebservice
- Welcome livestream: youtube.com/@wphighered
- Field Shift challenge video: https://youtu.be/cF0U2WXsM7o
- 2024 Global Winners announcement: https://www.youtube.com/watch?v=DcDuDq9wGzg
- Event details: Joe Sumner's email of Nov 10 and the Space Apps GO Team email of Nov 13

Schedule, location, and under-18 rules come from the local lead's email. Judging criteria and submission rules come from the two official guides. The concept, data plan, thresholds, and timeline are recommendations, not official requirements.

---

## Video notes 1: Field Shift challenge video (3:37)

Source: https://youtu.be/cF0U2WXsM7o · Notes from frames and auto-captions.

**What it is:** the official trailer for our challenge. Two minutes of AI-generated flyover footage (farmland, then Earth from space), each shot badged "GENERATED CONTENT", followed by intros from the challenge author and subject-matter experts.

| Time | What happens | Why it matters to us |
| --- | --- | --- |
| 0:14 | "The conditions beneath our feet are changing. Heat shifts, rainfall changes, water becomes less certain, soil loses nutrients, and farmers must decide what comes next." Patchwork of bare brown and green fields. | The four stresses map to our indicators: heat-stress days, rainfall, soil-wetness anomaly, soil input. Bare fields next to green ones are the "bare-field window". |
| 0:44 | "NASA's public Earth observation data gives us new ways to listen. Rainfall, soil moisture, heat, vegetation, water. Different observations, different scales, pieces of the same story." | Lists the expected dataset types: POWER (rain, heat, soil wetness), MODIS NDVI (vegetation), GRACE (water). "Different scales" is the data-harmonizing bonus. |
| 1:12 | **"Your mission: turn these observations into a tool that helps explore what could come next. Compare rotations, reveal trade-offs, understand risk, make uncertainty visible."** | The single most important line. Quote it in the summary and on a slide. |
| 1:25 | "Build an SI model, an interactive map, a visualization, a decision-support tool. Or build something none of us has imagined yet." | A decision-support tool is explicitly on their list. |
| 2:00 | Challenge author (an engineer at NASA Johnson Space Center working on Artemis): "I cannot wait to see what you built." | — |
| 2:36 | Subject-matter experts, all at Johnson Space Center: Anudeep Gogineni (data solutions architect, web apps), William Stefanov (senior Earth system scientist, ISS imagery, a named Field Shift expert), Alex Stoken (data scientist, machine learning on astronaut photos of Earth). | Expect questions on data handling, remote sensing, and how our "SI" handles uncertainty. |

**Open questions:** The video never defines "SI model". We assume an explainable rule-based system counts; check the challenge page. The author's name came from auto-captions; check its spelling before quoting.

## Video notes 2: 2024 Global Winners announcement (17:31)

Source: https://www.youtube.com/watch?v=DcDuDq9wGzg · Notes from official captions (video frames could not be downloaded).

**What it is:** NASA's 2024 Space Apps team announces the 10 Global Winners. 2024 had 93,500+ participants from 163 countries and territories and 9,900+ projects. Each winning team gives a short pitch.

| Award | Team and project | What they built | Lesson for us |
| --- | --- | --- | --- |
| Best Use of Science | WMPGang, SkyShield | Physics-based web model of the solar system showing asteroid and meteoroid threats | Domain knowledge makes it credible. Ours is the cited crop table. |
| **Best Use of Data** | **GammaRamma, WaterWise** | **Farm tool.** Farmers map crops and get irrigation schedules from NASA/OpenET evapotranspiration plus local weather, with an AI layer for insights. "Up to 60 percent of water is wasted through inefficient irrigation." Tested on farms in several locations. | Closest past winner to Field Shift. One farmer action, one key NASA variable, tests in several places, one memorable number. |
| Best Use of Technology | 42 QuakeHeroes | Machine-learning quake detection on Apollo and Mars InSight seismic data | The heavy-tech route; not ours. |
| **Galactic Impact** | **NVS-knot, To Plant or Not To Plant** | **Farm tool.** Started when a team member's dad, a Minnesota farmer, asked which fields were too wet to plant. Satellite data from NASA, ESA, and JAXA, plus Meteomatics forecasts. "Our UX design team made complex data simple and actionable." | Open with one real farmer and one real decision. Simple and actionable wins. |
| Best Mission Concept | AsturExplorers, Landsat Connect | Simple Landsat data access for anyone, whatever their technical level | Accessibility for non-experts is rewarded. |
| Most Inspirational | Innovisionaries, EcoMetropolis | City-building learning game on NASA data, tied to UN SDG 11 | Tie impact to a recognized global goal (for us SDG 2 and 13). |
| Best Storytelling | TerraTales | Climate story website with a game and an AI future projection | Narrative plus real data. |
| Global Connection | Asteroid Destroyer | 3D exoplanet habitability explorer | Not relevant. |
| Art & Technology | Connected Earth Museum | Virtual 3D Earth-systems museum with an AI guide | Not relevant. |
| **Local Impact** | **Team I.O., GROW** | Wildfire planning platform built on NASA open data and local fire history for their own community. "By starting small we believe these localized solutions can be scaled to other regions." | Our template: local place first, then show it scales. |

**Open question:** WaterWise didn't explain how it validated its water-savings claim. Our back-test should state its method clearly, not just its result.

---

## Official challenge text: Field Shift (copied from the challenge page)

### Background

Farmers face increasingly complex decisions as temperatures shift, rainfall becomes less predictable, and soil health declines across many regions. Water shortages, erosion, nutrient depletion, and extreme weather events add further uncertainty. Selecting new crops to add to a rotation can be difficult, because a crop that improves soil health in one place may consume too much water, introduce disease, conflict with local markets, or fall outside expected growing seasons somewhere else.

This challenge is inspired in part by multigenerational farming experience — many families have lived through seasons where better tools for tracking changing conditions could have helped identify healthier, more resilient rotation choices. Today, NASA's long‑term environmental datasets offer new ways to understand local growing conditions, and SI techniques open opportunities to translate that data into practical, farmer‑friendly insights.

### Objectives

You may consider combining NASA Earth observations with local agricultural information to create an app, model, interactive map, or other decision‑support tool. The goal is to help farmers explore crop‑rotation options that may improve soil health and strengthen resilience to changing weather and water conditions.

You may explore NASA datasets such as SMAP, ECOSTRESS, GPM, Landsat, MODIS, NASA POWER, GRACE and GRACE‑FO, and SRTM or other NASA elevation products. Using these datasets, you may analyze patterns in temperature, heat stress, rainfall, soil moisture, evaporation, frost risk, extreme precipitation, vegetation stress, and long‑term water trends. You may also consider local soil information, crop characteristics, and farmer priorities—such as water use, forage value, nitrogen‑fixing potential, erosion reduction, organic matter improvement, or market suitability.

Your tool may highlight times when fields are typically bare, seasons when current crops appear more vulnerable, or opportunities for rotations that could interrupt pest cycles, reduce water demand, improve infiltration, or add supplemental income. You may compare at least three rotation strategies, including the existing rotation. For each strategy, you may explain why it was suggested, what evidence supports it, what benefits it may offer, where information gaps exist, and any risks that would need local review by farmers or agricultural experts.

The intended outcome is a supportive tool — one that helps identify patterns and possibilities, but does not replace farmer judgment or local agricultural expertise.

### Potential Considerations

You may (but are not required to) consider the following:

**Understanding Conditions & Data**

- Explore how changes in temperature, soil moisture, rainfall, evaporation, and vegetation stress relate to crop vulnerability and soil health.
- Consider explaining scientific terms such as evapotranspiration, soil moisture anomalies, vegetation indices (e.g., NDVI), frost risk, and water‑balance indicators.
- Clarify how satellite observations differ from ground‑based measurements, and how combining both may improve accuracy.

**SI, Modeling, and Data Fusion**

- You may compare different SI or statistical approaches for identifying patterns in historical climate and soil conditions.
- Consider how SI could highlight seasonal transitions, bare‑field periods, or times when current crops show increased stress.
- Explain how the model interprets uncertainty and where local expertise would be needed to validate results.
- You may consider harmonizing datasets with different spatial and temporal resolutions by downsampling, aggregating, or resampling them to a common analysis grid. Harmonizing resolution can help the SI combine SMAP soil moisture, ECOSTRESS land‑surface temperature, GPM precipitation, Landsat/MODIS vegetation indices, GEDI biomass, and soil datasets into coherent features that support clear, explainable rotation‑strategy comparisons.

**Rotation Strategy Exploration**

- Compare rotation scenarios by examining nutrient cycling, erosion risk, organic matter contributions, pest‑cycle disruption, water use, forage potential, or market considerations.
- You may consider mapping which rotation ideas best align with farmer priorities—such as conserving water, generating supplemental income, or improving soil structure.
- Include brief explanations of how nitrogen‑fixing crops, cover crops, deep‑rooting crops, or drought‑tolerant crops contribute to long‑term soil health.

**Geospatial Mapping & Visualization**

- Consider whether interactive maps could help users explore trends over time such as long‑term soil moisture, heat waves, or water‑storage declines.
- Explore ways to visualize field‑level vulnerabilities (e.g., zones of erosion risk, water stress hotspots, frost‑prone areas).
- You may include optional add‑ons such as timelines, overlays comparing datasets, or scenario sliders that adjust rainfall or temperature patterns.

**Farmer‑Centered Design**

- Consider how to make the tool easily interpretable for farmers who may have limited technical or geospatial experience.
- Think about ways to allow farmers to input their own priorities or constraints, such as water availability, equipment limitations, or market preferences.
- Share reminders that the tool is intended to support—not replace—local expertise, and highlight where human judgment is particularly important.

### NASA Data & Resources

| Dataset | What the brief says it offers |
| --- | --- |
| **SMAP** (Soil Moisture Active Passive) | Global surface soil moisture and freeze/thaw state every 2–3 days. Drought stress, water availability, infiltration potential, early crop-stress signals. |
| **GPM & IMERG** | Global precipitation rate and accumulation. Rainfall reliability, extreme-storm frequency, erosion risk, water input to soils, long-term moisture trends. Worldview IMERG layers can be downloaded as high-resolution images. |
| **Landsat and MODIS/VIIRS** | Landsat 30 m, MODIS/VIIRS 250–1000 m. Corrected reflectance, NDVI, vegetation indices, plant stress, bare ground, seasonal change. |
| **NASA POWER** | Solar, meteorological, and climatology data used widely in agriculture: temperature, humidity, radiation, and derived indicators for crop water use, growing-season conditions, frost risk, climate suitability. |
| **SRTM** (Shuttle Radar Topography Mission) | Global elevation for slope, runoff, erosion risk, water flow, terrain-driven stress. |
| **ECOSTRESS** | High-resolution land-surface temperature and evapotranspiration. Plant-stress hotspots, heat exposure, shallow-root vulnerability, crop-water demand, field-level microclimate. |
| **GEDI** (Global Ecosystem Dynamics Investigation) | Laser-based forest structure: canopy height, leaf area index, above-ground biomass (Level-4). Best in taller vegetation; gives landscape context around farms. |

### Other data and resources listed

| Dataset | What the brief says it offers |
| --- | --- |
| **USDA Ag Data Commons** | Open agricultural datasets: soils, crops, climate, land management, phenology, water quality. Ground-based context for NASA data. |
| **Web Soil Survey (USDA NRCS)** | Official US soil maps and properties: drainage, erosion risk, hydrologic ratings, organic matter, texture, infiltration, compaction risk. |
| **Cropland Data Layer (CropScape)** | Annual 30 m US crop-type maps (corn, soybeans, cotton, wheat, alfalfa, and more). Existing rotations, bare fields, labeled inputs for models. |
| **PRISM (Oregon State University)** | US daily, monthly, and 30-year normals for precipitation, temperature, dewpoint, frost/freeze dates. Accounts for terrain. Good for validating NASA-derived indicators. |
| **SSURGO / STATSGO2 (USDA NRCS)** | Field-scale and regional soil attributes: texture, organic matter, drainage, hydrologic group, erosion factors, restrictive layers, water-holding capacity. |
| **NAIP** (National Agriculture Imagery Program) | About 1 m aerial imagery in the US growing season. Field boundaries, bare soil, crop development. |
| **USGS NLCD** | 30 m land-cover classes across decades: farmland, pasture, forest, water, wetlands, development. |
| **NLDAS / GLDAS** | Gridded sub-daily temperature, precipitation, soil moisture, ET proxies, radiation. Drought onset and moisture deficits. Search "NLDAS" or "GLDAS" in Earthdata Search. |
| **FAO GAEZ** | Global agro-climatic suitability layers for dozens of crops, soil constraints, water availability, yield potential. |
| **CoCoRaHS** | Volunteer daily rain and snow gauges across North America. Validates satellite rainfall (IMERG) and catches very local extreme rain. |
| **USGS NWIS** | Groundwater levels, streamflow, river stage, water quality. Irrigation water availability and hydrologic stress. |
| **USDA AMS Market News** | Commodity prices, demand, and market conditions. Whether a rotation crop has a local or regional market. |
| **USDA NASS QuickStats** | County and state yields, planted acreage, production history, crop frequency. |
| **OpenET** | Field-scale evapotranspiration for western US states. Crop water demand, irrigation timing, water-use efficiency. |
| **USFS LANDFIRE** | US vegetation type and condition, fuel models, landscape features. |

### Space agency partner resources (ESA)

| Dataset | What the brief says it offers |
| --- | --- |
| **Copernicus Sentinel-2** | Free 10–20 m multispectral imagery with frequent revisits, with red-edge, NIR, and SWIR bands. NDVI/EVI, bare-soil mapping, crop stress at field scale. |
| **ERA5 (ECMWF reanalysis)** | Global hourly climate: temperature, precipitation, wind, humidity, soil temperature, radiation. Fills gaps where weather stations are sparse. |
