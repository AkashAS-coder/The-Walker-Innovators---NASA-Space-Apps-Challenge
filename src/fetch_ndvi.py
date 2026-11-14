"""Pull MODIS NDVI (MOD13Q1, 250 m, every 16 days) for every field in data/fields.json.

Run by hand:  python3 src/fetch_ndvi.py
Writes:       data/raw/ndvi_<field id>.json

Source: ORNL DAAC MODIS/VIIRS Land Product Subsets web service
        https://modis.ornl.gov/rst/api/v1/   (no login, no key)

The service allows at most 10 dates per request and is often slow, so we ask
for one pixel (the field point), in chunks of 10 dates, retrying on errors.
The saved file keeps the raw NDVI values exactly as returned (scaled
integers); the app multiplies by the scale (0.0001) and drops the fill value.
"""
import json
import pathlib
import sys
import time
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
API = "https://modis.ornl.gov/rst/api/v1/MOD13Q1"
BAND = "250m_16_days_NDVI"
# Five recent years. The service is slow (often minutes per request), so more
# years would take hours. Widen this range when there is time to wait.
FIRST_YEAR = 2021
LAST_YEAR = 2025
CHUNK = 10
RETRIES = 5


def get_json(url):
    request = urllib.request.Request(url, headers={"Accept": "application/json"})
    for attempt in range(1, RETRIES + 1):
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                return json.load(response)
        except Exception as error:  # server often returns 502 when busy
            print(f"  attempt {attempt} failed: {error}")
            time.sleep(10 * attempt)
    raise RuntimeError(f"gave up on {url}")


def fetch(field):
    lat, lon = field["lat"], field["lon"]
    out = RAW / f"ndvi_{field['id']}.json"
    # Resume: keep any dates already saved from an earlier, interrupted run.
    saved = json.loads(out.read_text()) if out.exists() else {"values": {}}
    values = saved["values"]

    dates = get_json(f"{API}/dates?latitude={lat}&longitude={lon}")["dates"]
    wanted = [
        d["modis_date"] for d in dates
        if FIRST_YEAR <= int(d["modis_date"][1:5]) <= LAST_YEAR
        and d["calendar_date"] not in values
    ]
    print(f"{field['id']}: {len(wanted)} dates to fetch")

    for i in range(0, len(wanted), CHUNK):
        chunk = wanted[i:i + CHUNK]
        url = (
            f"{API}/subset?latitude={lat}&longitude={lon}&band={BAND}"
            f"&startDate={chunk[0]}&endDate={chunk[-1]}"
            f"&kmAboveBelow=0&kmLeftRight=0"
        )
        data = get_json(url)
        for item in data["subset"]:
            values[item["calendar_date"]] = item["data"][0]
        saved.update({
            "product": "MOD13Q1", "band": BAND, "latitude": lat, "longitude": lon,
            "scale": float(data.get("scale", 0.0001)), "fill_value": -3000,
            "source": API, "values": dict(sorted(values.items())),
        })
        out.write_text(json.dumps(saved))  # save after every chunk
        print(f"  {chunk[0]}..{chunk[-1]} ok ({len(values)} dates saved)")
        time.sleep(1)


def main():
    # Optional: pass one field id (python3 src/fetch_ndvi.py henry_va) to fetch only that field,
    # so two fields can download at the same time in two terminals.
    RAW.mkdir(parents=True, exist_ok=True)
    fields = json.loads((ROOT / "data" / "fields.json").read_text())
    only = sys.argv[1] if len(sys.argv) > 1 else None
    for field in fields:
        if only is None or field["id"] == only:
            fetch(field)


if __name__ == "__main__":
    main()
