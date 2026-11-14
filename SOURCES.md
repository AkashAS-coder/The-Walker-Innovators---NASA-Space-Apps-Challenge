# Sources

Every dataset, web page and library used in this project.

## NASA data

| Source | Used for | Link |
| --- | --- | --- |
| NASA POWER daily point API (v2.10, community AG). Parameters T2M_MAX, T2M_MIN, PRECTOTCORR, GWETROOT, GWETTOP; 2005–2025 | Weather and soil-wetness indicators, frost dates, trends, scoring | https://power.larc.nasa.gov/ · API docs: https://power.larc.nasa.gov/docs/services/api/temporal/daily/ |
| MODIS Terra MOD13Q1 v6.1 NDVI (250 m, 16-day), via ORNL DAAC MODIS/VIIRS Land Product Subsets web service | Greenness chart and bare-field window | https://modis.ornl.gov/rst/api/v1/ · https://daac.ornl.gov/modiswebservice |

## Other data

| Source | Used for | Link |
| --- | --- | --- |
| USDA NRCS Soil Survey Geographic Database (SSURGO) via Soil Data Access | Soil card: texture, slope, drainage, organic matter, water capacity | https://sdmdataaccess.sc.egov.usda.gov/ |
| USDA NASS Cropland Data Layer (CropScape), 2016–2025 | Crop history for each field; choosing real crop fields for the demo | https://nassgeodata.gmu.edu/CropScape/ |
| Virginia Cooperative Extension, Agronomy Handbook (SPES-299) | Crop traits: corn, soybean, grain sorghum, alfalfa | https://www.pubs.ext.vt.edu/content/dam/pubs_ext_vt_edu/424/424-100/spes-299.pdf |
| SARE, Managing Cover Crops Profitably (3rd ed.): winter wheat, cereal rye, crimson clover, sorghum-sudangrass, brassicas chapters | Crop traits for cover and forage crops | https://www.sare.org/resources/managing-cover-crops-profitably-3rd-edition/ |
| NASA Earth Observatory, "Measuring Vegetation (NDVI & EVI)" | NDVI meaning and the bare-ground threshold | https://earthobservatory.nasa.gov/features/MeasuringVegetation |
| CRESS grower survey (team's own, 16 anonymous responses, Nov 2026) | Problem statement only (slides). Not in the repo. | — |

## Software and libraries

| Library | Version | License | Link |
| --- | --- | --- | --- |
| Leaflet | 1.9.4 | BSD-2-Clause | https://leafletjs.com/ (loaded from unpkg.com) |
| Chart.js | 4.4.1 | MIT | https://www.chartjs.org/ (loaded from cdnjs.cloudflare.com) |
| OpenStreetMap map tiles | — | Data © OpenStreetMap contributors, ODbL | https://www.openstreetmap.org/copyright |
| Python 3 standard library | 3.x | PSF | Fetch scripts |
| Node.js built-in test runner | 18+ | MIT | Tests only |
