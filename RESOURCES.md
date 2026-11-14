# Resources

Datasets and tools listed in the "Field Shift" challenge brief, with links. This is a reference list. Anything we actually use in the app also goes into `SOURCES.md`.

**Plan** marks the ones our plan uses (see [docs/PLAN.md](docs/PLAN.md)).

## NASA data

| Dataset | What it gives us | Links | Plan |
| --- | --- | --- | --- |
| NASA POWER | Daily temperature, rainfall, soil wetness, radiation for any point. Our main dataset. | [Home](https://power.larc.nasa.gov/) · [Daily API docs](https://power.larc.nasa.gov/docs/services/api/temporal/daily/) · [Data Access Viewer](https://power.larc.nasa.gov/data-access-viewer/) | Yes |
| MODIS (NDVI, MOD13Q1) | 250 m vegetation greenness every 16 days. Shows bare-field periods. | [MODIS home](https://modis.gsfc.nasa.gov/) · [ORNL subset service docs](https://daac.ornl.gov/modiswebservice) · [ORNL API](https://modis.ornl.gov/rst/api/v1/) | Yes |
| SMAP | Surface soil moisture and freeze/thaw, every 2–3 days. | [Mission](https://smap.jpl.nasa.gov/) · [Data at NSIDC](https://nsidc.org/data/smap) | Maybe |
| GPM / IMERG | Rainfall rate and totals. Storm frequency, erosion risk. | [IMERG](https://gpm.nasa.gov/data/imerg) · [Worldview](https://worldview.earthdata.nasa.gov/) | Optional |
| Landsat | 30 m reflectance and NDVI. Crop vigor, bare ground. | [Landsat](https://landsat.gsfc.nasa.gov/) · [EarthExplorer](https://earthexplorer.usgs.gov/) | Optional |
| VIIRS | 375–750 m vegetation indices, successor to MODIS. | [VIIRS (LAADS DAAC)](https://ladsweb.modaps.eosdis.nasa.gov/missions-and-measurements/viirs/) | No |
| SRTM | Elevation. Slope, runoff, erosion risk. | [SRTMGL1 at LP DAAC](https://lpdaac.usgs.gov/products/srtmgl1v003/) | Optional |
| ECOSTRESS | Land-surface temperature and evapotranspiration at field scale. | [Mission](https://ecostress.jpl.nasa.gov/) | Optional |
| NLDAS / GLDAS | Gridded soil moisture, temperature, rainfall, ET time series. | [NLDAS](https://ldas.gsfc.nasa.gov/nldas) · [GLDAS](https://ldas.gsfc.nasa.gov/gldas) · [Earthdata Search](https://search.earthdata.nasa.gov/) | No |
| GEDI | Canopy height and biomass from laser. Best for forests. | [GEDI](https://gedi.umd.edu/) · [GEDI at ORNL DAAC](https://daac.ornl.gov/GEDI/) | No |

## Soil, crop, and farm data (USDA and others)

| Dataset | What it gives us | Links | Plan |
| --- | --- | --- | --- |
| SSURGO / STATSGO2 | Field-scale soil texture, organic matter, drainage, water-holding capacity. | [SSURGO](https://www.nrcs.usda.gov/resources/data-and-reports/soil-survey-geographic-database-ssurgo) · [STATSGO2](https://www.nrcs.usda.gov/resources/data-and-reports/description-of-statsgo2-database) · [Soil Data Access](https://sdmdataaccess.nrcs.usda.gov/) | Yes |
| Web Soil Survey | Map tool for the same NRCS soil data. Easiest way to look up one field. | [Web Soil Survey](https://websoilsurvey.nrcs.usda.gov/) | Yes |
| Cropland Data Layer (CropScape) | Which crop grew on each 30 m pixel, every year. Real rotation history. | [CropScape](https://nassgeodata.gmu.edu/CropScape/) | Yes |
| USDA NASS QuickStats | County yields, acres, production history. | [QuickStats](https://quickstats.nass.usda.gov/) | Yes |
| PRISM (Oregon State) | Local climate normals, frost dates. Used to check POWER. | [PRISM](https://prism.oregonstate.edu/) | Yes |
| USDA Ag Data Commons | Open agricultural research datasets. | [Ag Data Commons](https://data.nal.usda.gov/) | No |
| NAIP | 1 m aerial photos in the growing season. | [NAIP (USGS EarthExplorer)](https://earthexplorer.usgs.gov/) | No |
| USGS NLCD | Land cover at 30 m: farmland, forest, water, towns. | [MRLC / NLCD](https://www.mrlc.gov/) | No |
| FAO GAEZ | Global crop suitability by climate and soil. | [GAEZ](https://gaez.fao.org/) | No |
| CoCoRaHS | Volunteer daily rain gauges. Checks satellite rainfall. | [CoCoRaHS](https://www.cocorahs.org/) | No |
| USGS NWIS | Streamflow and groundwater records. | [NWIS](https://waterdata.usgs.gov/nwis) | No |
| USDA AMS Market News | Crop prices and demand. | [Market News](https://www.ams.usda.gov/market-news) · [MyMarketNews](https://mymarketnews.ams.usda.gov/) | Maybe |
| OpenET | Field-scale evapotranspiration. Western U.S. only, so not Virginia. | [OpenET](https://openetdata.org/) | No |
| USFS LANDFIRE | Vegetation type and condition layers. | [LANDFIRE](https://landfire.gov/) | No |

## Partner space agencies (ESA / Copernicus)

| Dataset | What it gives us | Links | Plan |
| --- | --- | --- | --- |
| Sentinel-2 | 10–20 m imagery for NDVI and bare soil. | [Sentinel-2 mission](https://sentiwiki.copernicus.eu/web/s2-mission) · [Copernicus Browser](https://browser.dataspace.copernicus.eu/) | No |
| ERA5 (ECMWF) | Hourly global climate reanalysis. | [ERA5 single levels](https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels) | No |

## Event sponsor tools

| Tool | What it gives us | Links | Plan |
| --- | --- | --- | --- |
| Meteomatics Weather API | Historic, current, and forecast weather (temperature, rain, wind, and more) for any point or grid. Hackathon account valid until Nov 22, 2026. Not NASA data, so it does not count toward the two NASA datasets. | [Getting started](https://www.meteomatics.com/en/api/getting-started/) · API base: `https://api.meteomatics.com/` | Optional |

How a Meteomatics query is built:

```
https://api.meteomatics.com/<time>/<parameters>/<lat,lon>/<format>
```

Example for the demo field (hourly temperature and rain for three days, as JSON):

```
https://api.meteomatics.com/2026-11-14T00:00:00Z--2026-11-17T00:00:00Z:PT1H/t_2m:C,precip_1h:mm/36.69,-79.87/json
```

- Change `json` to `html`, `csv`, `png`, or `netcdf` to get a different format.
- Separate several parameters with commas.
- The login is a username and password. **Never put them in this repo.** Keep them in a local `.env` file (gitignored) or a password manager, and share them with teammates privately.

## Accounts

- NASA Earthdata login (needed for SMAP, GPM, Landsat, ECOSTRESS downloads): https://urs.earthdata.nasa.gov/
- NASA POWER, the MODIS ORNL subset service, CropScape, and Web Soil Survey need no login.
