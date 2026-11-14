"""Look up what was grown on each field, year by year, from the USDA Cropland Data Layer.

Run by hand:  python3 src/fetch_cropscape.py
Writes:       data/raw/cropscape_<field id>.json

Source: USDA NASS CropScape CDL web service (no login, no key)
        https://nassgeodata.gmu.edu/CropScape/
The service wants map coordinates in "Albers equal-area" meters (EPSG:5070),
not latitude/longitude, so albers() below converts them with the standard formula.
"""
import json
import math
import pathlib
import re
import time
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
API = "https://nassgeodata.gmu.edu/axis2/services/CDLService/GetCDLValue"
YEARS = range(2016, 2026)


def albers(lat, lon):
    """Latitude/longitude -> USA Contiguous Albers Equal Area (EPSG:5070) x, y in meters."""
    a = 6378137.0                 # GRS80 ellipsoid radius
    f = 1 / 298.257222101         # GRS80 flattening
    e2 = 2 * f - f * f
    e = math.sqrt(e2)
    lat1, lat2, lat0, lon0 = map(math.radians, (29.5, 45.5, 23.0, -96.0))

    def q(p):
        s = math.sin(p)
        return (1 - e2) * (s / (1 - e2 * s * s) - (1 / (2 * e)) * math.log((1 - e * s) / (1 + e * s)))

    def m(p):
        s = math.sin(p)
        return math.cos(p) / math.sqrt(1 - e2 * s * s)

    n = (m(lat1) ** 2 - m(lat2) ** 2) / (q(lat2) - q(lat1))
    c = m(lat1) ** 2 + n * q(lat1)

    def rho(p):
        return a * math.sqrt(c - n * q(p)) / n

    theta = n * (math.radians(lon) - lon0)
    r = rho(math.radians(lat))
    return r * math.sin(theta), rho(lat0) - r * math.cos(theta)


def fetch(field):
    x, y = albers(field["lat"], field["lon"])
    history = {}
    for year in YEARS:
        url = f"{API}?year={year}&x={x:.1f}&y={y:.1f}"
        try:
            text = urllib.request.urlopen(url, timeout=90).read().decode()
            match = re.search(r'category:\s*"?([^",}]+)', text)
            history[str(year)] = match.group(1).strip() if match else None
        except Exception as error:
            print(f"  {year} failed: {error}")
            history[str(year)] = None  # shown as missing, never guessed
        time.sleep(0.5)
    out = RAW / f"cropscape_{field['id']}.json"
    out.write_text(json.dumps({
        "latitude": field["lat"], "longitude": field["lon"],
        "albers_x": round(x, 1), "albers_y": round(y, 1),
        "source": "USDA NASS Cropland Data Layer via " + API,
        "history": history,
    }, indent=2))
    print(f"saved {out.relative_to(ROOT)}: {history}")


def main():
    RAW.mkdir(parents=True, exist_ok=True)
    for field in json.loads((ROOT / "data" / "fields.json").read_text()):
        fetch(field)


if __name__ == "__main__":
    main()
