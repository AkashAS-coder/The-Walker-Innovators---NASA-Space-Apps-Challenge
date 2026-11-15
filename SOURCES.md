# Sources

Every dataset, web page and library used in this project.

## NASA data

| Source | Used for | Link |
| --- | --- | --- |
| NASA POWER daily point API (v2.10, community AG). Parameters T2M_MAX, T2M_MIN, PRECTOTCORR, GWETROOT, GWETTOP; 2005–2025 | Weather and soil-wetness indicators, frost dates, trends, scoring. Saved files for the two demo fields; loaded live in the browser for a spot the farmer picks on the map | https://power.larc.nasa.gov/ · API docs: https://power.larc.nasa.gov/docs/services/api/temporal/daily/ |
| MODIS Terra MOD13Q1 v6.1 NDVI (250 m, 16-day), via ORNL DAAC MODIS/VIIRS Land Product Subsets web service | Greenness chart and bare-field window. Saved for the demo fields (2021–2025); for a farmer's own field, 2023–2024 is loaded live in the background | https://modis.ornl.gov/rst/api/v1/ · https://daac.ornl.gov/modiswebservice |

## Other data

| Source | Used for | Link |
| --- | --- | --- |
| USDA NRCS Soil Survey Geographic Database (SSURGO) via Soil Data Access | Soil card: texture, slope, drainage, organic matter, water capacity. Saved for the demo fields; queried live for a picked spot (same query as src/fetch_soil.py) | https://sdmdataaccess.sc.egov.usda.gov/ |
| Crop trait sources for the 15 crops added Nov 14 (one URL per row in data/crops.csv): SARE Managing Cover Crops Profitably, Virginia Tech, NDSU, University of Kentucky, Kansas State, University of Georgia, University of Idaho extension | Water need, heat and frost tolerance, rooting depth, nitrogen fixing, timing and forage value for the new crops (verified=no; see docs/CROP_CHECK.md) | see the source column in data/crops.csv |
| OpenStreetMap Nominatim search (data © OpenStreetMap contributors, ODbL) | Turning a typed address or town into a map location. One search per button press, no type-ahead, per the usage policy | https://nominatim.openstreetmap.org/ · policy: https://operations.osmfoundation.org/policies/nominatim/ |
| USGS The National Map, Imagery Only basemap (public domain) | Satellite photo layer on the field map, so a farmer can find their own field | https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer |
| Seager, R. et al. (2018), "Whither the 100th Meridian? The Once and Future Physical and Human Geography of America's Arid–Humid Divide. Part I", Earth Interactions 22(5) | The rule for a picked spot: west of 100° W is treated as the dry West, east of it as the humid East (the line John Wesley Powell described in 1878) | https://doi.org/10.1175/EI-D-17-0011.1 |
| USDA NASS Cropland Data Layer (CropScape), 2016–2025 | Crop history for each field (saved for the demo fields; looked up live for a farmer's own field through our Netlify Function netlify/functions/cropscape.mjs, because CropScape does not allow web pages to call it); choosing real crop fields for the demo | https://nassgeodata.gmu.edu/CropScape/ |
| Virginia Cooperative Extension, Agronomy Handbook (SPES-299) | Crop traits: corn, soybean, grain sorghum, alfalfa | https://www.pubs.ext.vt.edu/content/dam/pubs_ext_vt_edu/424/424-100/spes-299.pdf |
| SARE, Managing Cover Crops Profitably (3rd ed.): winter wheat, cereal rye, crimson clover, sorghum-sudangrass, brassicas chapters | Crop traits for cover and forage crops | https://www.sare.org/resources/managing-cover-crops-profitably-3rd-edition/ |
| Renard, K.G. and others (1997), *Predicting Soil Erosion by Water: A Guide to Conservation Planning with the Revised Universal Soil Loss Equation (RUSLE)*, USDA Agriculture Handbook 703 | The RUSLE equation (A = R × K × LS × C × P) the page is built around; which factors we have and which we do not | https://www.ars.usda.gov/research/publications/publication/?seqNo115=92824 (chapter record, R factor) |
| USDA NRCS, "Soil Health" page: "reduce disturbance, maximize cover, promote biodiversity, and support living roots" | The basis for the four soil warning signs and the "Why we believe this" section | https://www.nrcs.usda.gov/conservation-basics/soil/soil-health |
| NASA Earth Observatory, "Measuring Vegetation (NDVI & EVI)" | NDVI meaning and the bare-ground threshold | https://earthobservatory.nasa.gov/features/MeasuringVegetation |
| U.S. Drought Monitor, county statistics for Franklin County, VA (FIPS 51067), weekly, 2005–2025. Made by the National Drought Mitigation Center (University of Nebraska-Lincoln), USDA and NOAA; not a NASA product | Proof page only: an outside record to back-test our NASA-based dry-soil flag against. Saved to data/raw/drought_franklin_va.json by src/fetch_drought.py | https://droughtmonitor.unl.edu/ · data service: https://usdmdataservices.unl.edu/api/CountyStatistics/GetDroughtSeverityStatisticsByAreaPercent |
| Virginia Cooperative Extension, "Local Offices" page (opened and checked 2026-11-14) | The "Your local experts" box shown for Virginia fields | https://ext.vt.edu/offices.html |
| Virginia Tech, Southern Piedmont Agricultural Research and Extension Center page: "research and Extension programs for sustainable production of tobacco", forage crops, beef cattle, small fruits and grains (opened and checked 2026-11-14) | The "Your local experts" box shown for Virginia fields | https://www.arec.vaes.vt.edu/arec/southern-piedmont.html |
| Virginia Peanut Growers Association (an industry group, not a government source): "Peanuts in Virginia are grown in eight counties in southeast Virginia" (opened and checked 2026-11-14) | The note on crop cycles with peanut, shown for Virginia fields. We found no checked source for where cotton is grown, so cotton has no such note. | https://aboutpeanuts.com/virginia-peanuts/ |
| CRESS grower survey (team's own, 16 anonymous responses, Nov 2026) | Problem statement (slides) and the "Who we asked" block on the Proof page, totals only. The responses are not in the repo. | — |

## Photos

All from the USDA Natural Resources Conservation Service (US government work, public domain), downloaded from Wikimedia Commons and resized. Stored in `images/`.

| File | Original | Link |
| --- | --- | --- |
| images/logo.svg | Field Shift logo, the team's own. Drawn as SVG code with Claude Code (see AI_USE.md); no outside artwork | — |
| images/hero-field.jpg (shown mirrored) | Soybean Field with Healthy Soil (USDA NRCS) | https://commons.wikimedia.org/wiki/File:Soybean_Field_with_Healthy_Soil_(9316804120).jpg |
| images/erosion.jpg | Sheet erosion in an area of Coto soils (USDA NRCS, 2019) | https://commons.wikimedia.org/wiki/File:Sheet_erosion_in_an_area_of_Coto_soils_(20190402-SR-NRCS-001).jpg |
| images/cover-crop.jpg | Soybeans coming up in a rye cover crop, May 2016 (USDA NRCS) | https://commons.wikimedia.org/wiki/File:Soybeans_coming_up_in_a_rye_cover_crop_May_2016_(29614917692).jpg |
| images/residue.jpg | Corn in Residue with Healthy Soil (USDA NRCS) | https://commons.wikimedia.org/wiki/File:Corn_in_Residue_with_Healthy_Soil_(9314025147).jpg |
| images/soil-profiles.jpg | Three soil profiles taken in central Iowa, slightly vs severely eroded (USDA NRCS photo NRCSIA99352 by Lynn Betts; public domain). The Wikimedia file name says Idaho, but the photo's own description and its NRCS Iowa ("IA") photo number both say central Iowa, so the app says Iowa. | https://commons.wikimedia.org/wiki/File:Three_soil_profile%27s_taken_in_Idaho.jpg |

The "Why cover matters" diagram on the How it works page is our own drawing (inline SVG).

## Software and libraries

| Library | Version | License | Link |
| --- | --- | --- | --- |
| Leaflet | 1.9.4 | BSD-2-Clause | https://leafletjs.com/ (loaded from unpkg.com) |
| Chart.js | 4.4.1 | MIT | https://www.chartjs.org/ (loaded from cdnjs.cloudflare.com) |
| OpenStreetMap map tiles | — | Data © OpenStreetMap contributors, ODbL | https://www.openstreetmap.org/copyright |
| Python 3 standard library | 3.x | PSF | Fetch scripts |
| taste-skill (design guidance only; no code or assets copied) | — | MIT | https://github.com/Leonxlnx/taste-skill |
| Node.js built-in test runner | 18+ | MIT | Tests only |
| Fraunces and Inter fonts (Google Fonts) | — | SIL Open Font License 1.1 | https://fonts.google.com/specimen/Fraunces · https://fonts.google.com/specimen/Inter |
| Lucide icon shapes (map pin, layers, sliders, bookmark), redrawn inline | — | ISC | https://lucide.dev/ |
| Firebase JS SDK (Authentication, Cloud Firestore) | 12.6.0 | Apache-2.0 | https://firebase.google.com/ (loaded from www.gstatic.com/firebasejs) |
| OpenRouter API, free models (google/gemma-4-31b-it:free, with nvidia/nemotron-3.5-lightning:free and google/gemma-4-26b-a4b-it:free as backups), for the optional "Ask AI" helper | — | OpenRouter terms; Gemma terms of use | https://openrouter.ai/ |
| Netlify (hosting and Netlify Functions for the AI helper) | — | Netlify terms | https://www.netlify.com/ |
| Chama Verde (another NASA Space Apps team's site): layout idea only for the home page (sand and deep-green colors, big-number row, dark "How it works." band, closing button). No code, text or assets copied | — | — | https://chama-verde.netlify.app/ |
