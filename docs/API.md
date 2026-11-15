# API documentation

This tool has two kinds of "API":

1. **External data APIs** that our fetch scripts call by hand to download data. For the two demo fields the website reads the saved files and never calls these. For a field the farmer picks on the map, the page calls the same services live with the same requests.
2. **Internal API**: the saved data files the website reads, and the JavaScript functions that turn them into indicators and scores.

```
 NASA POWER ─┐
 MODIS NDVI ─┤  src/fetch_*.py   ┌─ data/raw/*.json ─┐  js/indicators.js   js/scoring.js    js/app.js
 USDA SSURGO ┤ ───────────────▶ │                   │ ────────────────▶ ─────────────▶ ──────────▶ page
 CropScape  ─┘  (run by hand)    └─ data/*.csv ──────┘   field indicators   3 scored options
```

---

## 1. External data APIs

None of these need a login or an API key. All were tested on Nov 14, 2026.

### 1.1 NASA POWER daily point API (NASA dataset #1)

| | |
| --- | --- |
| What it gives us | Daily weather and soil wetness for one point, 2005–2025 |
| Script | `src/fetch_power.py` |
| Saves to | `data/raw/power_<field id>.json` |
| Docs | https://power.larc.nasa.gov/docs/services/api/temporal/daily/ |
| Limits | Up to 20 parameters per request. Repeated requests for the same spot may be blocked, so we save and reuse the file. |

**Request**

```
GET https://power.larc.nasa.gov/api/temporal/daily/point
    ?parameters=T2M_MAX,T2M_MIN,PRECTOTCORR,GWETROOT,GWETTOP
    &community=AG
    &latitude=36.83&longitude=-79.81
    &start=20050101&end=20251231
    &format=JSON
```

| Parameter | Meaning | Units |
| --- | --- | --- |
| `T2M_MAX` | Highest air temperature of the day, 2 m above ground | °C |
| `T2M_MIN` | Lowest air temperature of the day | °C |
| `PRECTOTCORR` | Rainfall (and snow as water), bias-corrected | mm/day |
| `GWETROOT` | Root-zone soil wetness, 0 = bone dry, 1 = saturated | fraction |
| `GWETTOP` | Surface soil wetness (top 5 cm) | fraction |

**Response (shortened)**

```json
{
  "geometry": { "coordinates": [-79.81, 36.83, 290.1] },
  "properties": { "parameter": {
    "T2M_MAX": { "20050101": 12.3, "20050102": 14.1 },
    "PRECTOTCORR": { "20050101": 0.0, "20050102": 3.2 }
  } },
  "header": { "fill_value": -999.0, "sources": ["MERRA2", "POWER"] }
}
```

Missing days use the `fill_value` (-999). `parsePower()` turns them into `null` and skips them. The site counts and shows how many days were missing.

### 1.2 MODIS MOD13Q1 NDVI via ORNL DAAC subsets (NASA dataset #2)

| | |
| --- | --- |
| What it gives us | Greenness (NDVI) for the 250 m pixel at the field, one value every 16 days |
| Script | `src/fetch_ndvi.py` (optional argument: one field id) |
| Saves to | `data/raw/ndvi_<field id>.json` |
| Docs | https://daac.ornl.gov/modiswebservice |
| Limits | At most 10 dates per request. The server is slow and often returns 502/503, so the script retries and saves after every chunk. Re-running it resumes where it stopped. |

**Requests**

```
GET https://modis.ornl.gov/rst/api/v1/MOD13Q1/dates?latitude=36.83&longitude=-79.81
GET https://modis.ornl.gov/rst/api/v1/MOD13Q1/subset
    ?latitude=36.83&longitude=-79.81
    &band=250m_16_days_NDVI
    &startDate=A2021001&endDate=A2021145      (A + year + day of year)
    &kmAboveBelow=0&kmLeftRight=0               (just the one pixel)
```

**What we save**

```json
{
  "product": "MOD13Q1", "band": "250m_16_days_NDVI",
  "latitude": 36.83, "longitude": -79.81,
  "scale": 0.0001, "fill_value": -3000,
  "values": { "2021-01-01": 3120, "2021-01-17": 2954 }
}
```

NDVI = raw value × `scale` (so 3120 → 0.312). Values equal to `fill_value` are dropped.

### 1.3 USDA NRCS Soil Data Access (SSURGO soil survey)

| | |
| --- | --- |
| What it gives us | Soil name, texture, slope, drainage, organic matter, water-holding capacity at the field |
| Script | `src/fetch_soil.py` |
| Saves to | `data/raw/soil_<field id>.json` |
| Docs | https://sdmdataaccess.sc.egov.usda.gov/ |

**Request**: `POST https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest` with a JSON body `{"format": "JSON+COLUMNNAME", "query": "<SQL>"}`. The SQL (in the script) finds the soil map unit under the point with `SDA_Get_Mukey_from_intersection_with_WktWgs84('point(lon lat)')`, then takes its main component and that component's top soil layer.

**Saved fields we use**

| Field | Meaning |
| --- | --- |
| `muname` | Map unit name, for example "Clifford fine sandy loam, 2 to 8 percent slopes" |
| `compname` | Main soil series |
| `slope_r` | Typical slope, % |
| `drainagecl` | Drainage class |
| `hydgrp` | Hydrologic group A–D (A soaks in fast, D runs off) |
| `om_r` | Topsoil organic matter, % |
| `awc_r` | Available water capacity, cm of water per cm of soil |
| `texdesc` | Texture, for example "Sandy loam" |

### 1.4 USDA NASS Cropland Data Layer (CropScape)

| | |
| --- | --- |
| What it gives us | The crop recorded on the field's 30 m pixel each year, 2016–2025 |
| Script | `src/fetch_cropscape.py` |
| Saves to | `data/raw/cropscape_<field id>.json` |
| Site | https://nassgeodata.gmu.edu/CropScape/ |

**Request**

```
GET https://nassgeodata.gmu.edu/axis2/services/CDLService/GetCDLValue?year=2023&x=<x>&y=<y>
```

`x` and `y` are meters in the USA Contiguous Albers Equal Area projection (EPSG:5070), not latitude and longitude. `albers()` in the script converts them. The reply is a short text snippet; we read the `category` value (for example `"Corn"`).

---

## 2. Internal API

### 2.1 Data files the website reads

| File | Written by | Contents |
| --- | --- | --- |
| `data/fields.json` | Hand-edited | List of fields: `id`, `name`, `place`, `lat`, `lon`, `region` (`east` or `west`), `irrigated`, `sells_forage`, `default_rotation`, `note` |
| `data/crops.csv` | Hand-edited | One crop per row: traits plus a `source` URL and `verified` (yes/no) |
| `data/rotations.csv` | Hand-edited | Candidate rotations |
| `data/raw/*.json` | Fetch scripts only | Saved API responses. Never edit by hand. |

**`crops.csv` columns**

| Column | Values | Meaning |
| --- | --- | --- |
| `id` | text | Used in `rotations.csv` |
| `role` | cash / cover / forage | Sold for grain, grown for the soil, or for hay and grazing |
| `family` | grass / legume / brassica | Plant family; a new family can break pest cycles |
| `season` | warm / cool / perennial | When it grows |
| `start_month`, `end_month` | 1–12 | Months it is in the ground in Virginia (wraps past December for winter crops) |
| `water_need` | low / medium / high | |
| `heat_tolerance` | low / medium / high | |
| `frost_tolerance` | low / medium / high | |
| `root_depth` | shallow / medium / deep | |
| `nitrogen_fixing` | yes / no | |
| `forage_value` | low / medium / high | |
| `source` | URL | Where the traits come from |
| `verified` | yes / no | Has a team member checked this row against the source? |

**`rotations.csv` format**: `region` is `east` (humid, rain-fed, built for Virginia), `west` (dry, irrigated, built from crops CropScape records near Fallon, NV) or `any`. A field is only offered rotations for its region. The `sequence` column lists years separated by `;`. Each year is `main crop>winter crop`. Use `bare` for nothing. Example: `corn>cereal_rye;soybean>bare` means year 1 is corn and then rye over winter, and year 2 is soybean and then a bare winter.

**Adding a new field**: add it to `data/fields.json`, then run the four fetch scripts:

```bash
python3 src/fetch_power.py
python3 src/fetch_soil.py
python3 src/fetch_cropscape.py
python3 src/fetch_ndvi.py <new field id>
```

### 2.2 `js/indicators.js`

All functions are pure (data in, numbers out). Thresholds are in `THRESHOLDS` at the top of the file.

| Function | Input | Output |
| --- | --- | --- |
| `parsePower(powerJson)` | Saved POWER file | `[{date, year, month, tmax, tmin, rain, rootWet, topWet}]`; fill values become `null` |
| `yearlyIndicators(days)` | Output of `parsePower` | One row per year: `lastSpringFrost`, `firstFallFrost` (day of year), `frostFreeDays`, `heatDays`, `seasonRainMm`, `longestDrySpell`, `extremeRainDays`, `missingDays` |
| `longestDryRun(days)` | List of days | Longest run of days under `DRY_DAY_MM` |
| `change(yearly, key)` | Yearly rows, a field name | `{early, recent, diff}`: averages for 2005–2009 and 2021–2025, and the difference |
| `monthlyProfile(days)` | Days | 12 rows: `heatDaysPerYear`, `extremeRainPerYear`, `frostNightsPerYear`, `rainMmPerYear`, `rootWetLongTerm`, `rootWetRecent`, `wetAnomaly` |
| `parseNdvi(ndviJson)` | Saved NDVI file or `null` | `[{date, year, doy, ndvi}]` |
| `ndviByMonth(points)` | NDVI points | 12 rows: `median`, `bare` (median under the low-cover line), `count`; the array's `line` property is the cut-off used |
| `bareWeeksByYear(points)` | NDVI points | Per year: `bareImages`, `bareWeeks`, `peak` |
| `computeFieldIndicators(powerJson, ndviJson)` | Both saved files | Everything above in one object (`yearly`, `monthly`, `frostFree`, `heat`, `rain`, `drySpell`, `extremeRain`, `medianLastSpringFrost`, `medianFirstFallFrost`, `missingDays`, `ndvi`) |

**Indicator rules**

| Indicator | Rule |
| --- | --- |
| Frost-free season | Days between the last night ≤ 0 °C before July 1 and the first night ≤ 0 °C after July 1 |
| Hot days | June–August days with a maximum above 32 °C |
| Growing-season rain | April–September rainfall total; spread = standard deviation across years |
| Longest dry spell | Longest run of April–September days with under 1 mm of rain |
| Extreme-rain days | Days with over 50 mm of rain |
| Soil-wetness anomaly | 2021–2025 average root-zone wetness for a month minus the 2005–2025 average for that month |
| Bare-field window | Months whose median NDVI is below 0.3, or below half of the field's greenest month (whichever line is higher). The second rule exists because a 250 m pixel mixes the field with tree lines and grass, which keeps winter NDVI above 0.3. |

### 2.3 `js/scoring.js`

Rule-based. No machine learning and no AI in the scoring. Rule weights are in `RULES` at the top of the file.

| Function | Input | Output |
| --- | --- | --- |
| `parseCsv(text)` | CSV text | Array of row objects |
| `parseCrops(rows)` | Rows of `crops.csv` | `{id: crop}` with numeric levels (low = 1, medium = 2, high/deep = 3) |
| `parseRotations(rows, crops)` | Rows of `rotations.csv` | `[{id, name, description, years: [{main, winter}]}]` |
| `coverageByMonth(rotation)` | One rotation | 12 numbers from 0 to 1: the share of years with a living crop that month |
| `frostRisks(rotation, field)` | Rotation, field | Sentences about frost-sensitive crops whose window crosses the usual frost dates |
| `scoreRotation(rotation, field, weights)` | See below | `{total, sub: {water, soil, income, forage, erosion}, cover, bareMonths, frostRisks}`; every sub-score has `score` (0–100) and `reasons` |
| `vulnerableMonths(result, field)` | A scored rotation, field | 12 rows `{month, flags}`; flags are `heat`, `dry soil`, `bare in heavy rain`, `bare (satellite)` |
| `compareRotations(rotations, currentId, field, weights, constraints)` | All rotations, the farmer's current one | `[current, best alternative, second alternative]`, each with `explain: {why, evidence, benefits, unknowns, checkLocally}` |

**The `field` object**

```js
{ id: 'henry_va', region: 'east', irrigated: false, sellsForage: false, texture: 'Sandy loam',
  soil: { /* saved soil file */ }, ind: { /* computeFieldIndicators output */ } }
```

**`weights`**: slider values from 0 to 5, `{water, soil, income, forage, erosion}`. If all are 0, every priority counts equally.

**`constraints`**: `{noHay: true}` removes rotations that include a forage crop. Rotations from another region are always removed.

**Fit score** = Σ (slider × sub-score) ÷ Σ sliders.

**Sub-score rules**

| Sub-score | Rule |
| --- | --- |
| Save water | 100 × (3 − average water need of main crops) ÷ 2. On a rain-fed field, high-water crops lose 10 points for each June–August month whose recent root-zone wetness is below normal, and 10 more on sandy soil. |
| Build soil health | 40 × share of winters with living roots + 25 × share of years with a nitrogen fixer + 15 if any deep-rooted crop + 10 per extra plant family (up to 2) |
| Extra income | Harvests per year ÷ 1.5 × 100 (hay = half a harvest, or a full one if the farmer ticks "I can sell hay or feed it"), minus 0.5 × recent hot days × missing heat tolerance (max 30), minus 10 per frost-timing risk. Counts harvests, not dollars. |
| Forage | Average yearly forage value ÷ 3 × 100 |
| Reduce erosion | Share of the year with a living crop, where each month is weighted by its extreme-rain days per year (+0.05 base) |

### 2.4 Tests

```bash
node --test tests/run.test.js
```

The tests check the dry-spell counter, that every crop in `rotations.csv` exists in `crops.csv`, winter coverage, and that the saved Henry County data gives three scored options with all five boxes filled.
