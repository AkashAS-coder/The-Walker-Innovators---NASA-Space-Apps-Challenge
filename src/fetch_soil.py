"""Look up USDA SSURGO soil facts for every field in data/fields.json.

Run by hand:  python3 src/fetch_soil.py
Writes:       data/raw/soil_<field id>.json

Source: USDA NRCS Soil Data Access (SDA) tabular service, no login, no key.
        https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest
We ask for the main soil component at the field point and its top layer.
"""
import json
import pathlib
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
API = "https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest"

QUERY = """
SELECT TOP 1
  mu.mukey, mu.muname, mu.farmlndcl,
  c.compname, c.comppct_r, c.slope_r, c.drainagecl, c.hydgrp,
  h.hzdept_r, h.hzdepb_r, h.om_r, h.awc_r, h.kwfact,
  h.sandtotal_r, h.silttotal_r, h.claytotal_r, tg.texdesc
FROM mapunit mu
JOIN component c ON c.mukey = mu.mukey
LEFT JOIN chorizon h ON h.cokey = c.cokey AND h.hzdept_r = 0
LEFT JOIN chtexturegrp tg ON tg.chkey = h.chkey AND tg.rvindicator = 'Yes'
WHERE mu.mukey IN (
  SELECT * FROM SDA_Get_Mukey_from_intersection_with_WktWgs84('point({lon} {lat})')
)
ORDER BY c.comppct_r DESC
"""


def fetch(field):
    body = json.dumps({
        "format": "JSON+COLUMNNAME",
        "query": QUERY.format(lon=field["lon"], lat=field["lat"]),
    }).encode()
    request = urllib.request.Request(
        API, data=body, headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        table = json.load(response)["Table"]
    record = dict(zip(table[0], table[1]))
    record.update({"latitude": field["lat"], "longitude": field["lon"], "source": API})
    out = RAW / f"soil_{field['id']}.json"
    out.write_text(json.dumps(record, indent=2))
    print(f"saved {out.relative_to(ROOT)}: {record['muname']}")


def main():
    RAW.mkdir(parents=True, exist_ok=True)
    fields = json.loads((ROOT / "data" / "fields.json").read_text())
    for field in fields:
        fetch(field)


if __name__ == "__main__":
    main()
