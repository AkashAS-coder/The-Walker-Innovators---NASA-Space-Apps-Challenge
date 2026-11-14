"""Pull daily NASA POWER data for every field in data/fields.json.

Run by hand:  python3 src/fetch_power.py
Writes:       data/raw/power_<field id>.json  (the API response, unedited)

The app never calls the API itself. It reads these saved files, so the demo
still works if the API is down and we do not hammer NASA POWER.
Uses only the Python standard library (no pip install needed).
"""
import json
import pathlib
import time
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"

# T2M_MAX / T2M_MIN: daily max and min air temperature at 2 m (deg C)
# PRECTOTCORR: daily rainfall, bias-corrected (mm/day)
# GWETROOT / GWETTOP: root-zone and surface soil wetness (0 = dry, 1 = saturated)
PARAMETERS = "T2M_MAX,T2M_MIN,PRECTOTCORR,GWETROOT,GWETTOP"
START = "20050101"
END = "20251231"
API = "https://power.larc.nasa.gov/api/temporal/daily/point"


def fetch(field):
    url = (
        f"{API}?parameters={PARAMETERS}&community=AG"
        f"&latitude={field['lat']}&longitude={field['lon']}"
        f"&start={START}&end={END}&format=JSON"
    )
    print("GET", url)
    with urllib.request.urlopen(url, timeout=300) as response:
        data = json.load(response)
    out = RAW / f"power_{field['id']}.json"
    out.write_text(json.dumps(data))
    days = len(data["properties"]["parameter"]["T2M_MAX"])
    print(f"  saved {out.relative_to(ROOT)} ({days} days)")


def main():
    RAW.mkdir(parents=True, exist_ok=True)
    fields = json.loads((ROOT / "data" / "fields.json").read_text())
    for field in fields:
        fetch(field)
        time.sleep(2)  # be polite to the API between requests


if __name__ == "__main__":
    main()
