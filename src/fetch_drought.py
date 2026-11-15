"""Download the U.S. Drought Monitor weekly record for a demo field's county.

Run by hand:  python3 src/fetch_drought.py
Writes:       data/raw/drought_<field id>.json

Source: U.S. Drought Monitor data services, no login, no key.
        https://droughtmonitor.unl.edu/DmData/DataDownload/WebServiceInfo.aspx
The Drought Monitor is made by the National Drought Mitigation Center (University of
Nebraska-Lincoln), USDA and NOAA. It is not a NASA product. We use it only on the Proof
page, as an outside record to check our NASA-based dry-soil flag against.

Each week has the percent of the county in each drought class or worse:
d0 = abnormally dry or worse, d1 = moderate drought or worse, up to d4 = exceptional.
We keep only the date and those percentages; nothing is changed or filled in.
"""
import json
import pathlib
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
API = ("https://usdmdataservices.unl.edu/api/CountyStatistics/"
       "GetDroughtSeverityStatisticsByAreaPercent")
# Same years as the NASA POWER files (src/fetch_power.py).
START, END = "1/1/2005", "12/31/2025"
# County FIPS codes (US Census) for the demo fields in data/fields.json.
COUNTY_FIPS = {"franklin_va": "51067"}


def fetch(field_id, fips):
    url = f"{API}?aoi={fips}&startdate={START}&enddate={END}&statisticsType=1"
    request = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=120) as response:
        rows = json.load(response)
    weeks = sorted(
        ({"date": r["mapDate"][:10], "none": r["none"], "d0": r["d0"], "d1": r["d1"],
          "d2": r["d2"], "d3": r["d3"], "d4": r["d4"]} for r in rows),
        key=lambda w: w["date"],
    )
    record = {
        "source": url,
        "fips": fips,
        "county": f"{rows[0]['county']}, {rows[0]['state']}",
        "note": "Percent of the county in each drought class or worse, one row per weekly map.",
        "weeks": weeks,
    }
    out = RAW / f"drought_{field_id}.json"
    out.write_text(json.dumps(record, separators=(",", ":")))
    print(f"saved {out.relative_to(ROOT)}: {len(weeks)} weeks, "
          f"{weeks[0]['date']} to {weeks[-1]['date']}")


if __name__ == "__main__":
    for field_id, fips in COUNTY_FIPS.items():
        fetch(field_id, fips)
