// netlify/functions/cropscape.mjs
// Looks up what USDA's Cropland Data Layer (CropScape) recorded at one spot, year by year.
// It runs on Netlify because CropScape does not let web pages ask it directly (no CORS).
// Same lookup as src/fetch_cropscape.py. No key, no login, nothing is saved.
//
// The page calls: /.netlify/functions/cropscape?lat=36.83&lon=-79.81
// It returns:     { history: { "2016": "Corn", ... }, source: "..." }  (a year is null if it failed)

const API = 'https://nassgeodata.gmu.edu/axis2/services/CDLService/GetCDLValue';
const YEARS = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

// Latitude/longitude -> USA Contiguous Albers Equal Area (EPSG:5070) meters, which CropScape wants.
// The same standard formula as albers() in src/fetch_cropscape.py.
function albers(lat, lon) {
  const a = 6378137.0, f = 1 / 298.257222101, e2 = 2 * f - f * f, e = Math.sqrt(e2);
  const rad = d => d * Math.PI / 180;
  const [lat1, lat2, lat0, lon0] = [29.5, 45.5, 23.0, -96.0].map(rad);
  const q = p => { const s = Math.sin(p); return (1 - e2) * (s / (1 - e2 * s * s) - (1 / (2 * e)) * Math.log((1 - e * s) / (1 + e * s))); };
  const m = p => { const s = Math.sin(p); return Math.cos(p) / Math.sqrt(1 - e2 * s * s); };
  const n = (m(lat1) ** 2 - m(lat2) ** 2) / (q(lat2) - q(lat1));
  const c = m(lat1) ** 2 + n * q(lat1);
  const rho = p => a * Math.sqrt(c - n * q(p)) / n;
  const theta = n * (rad(lon) - lon0);
  const r = rho(rad(lat));
  return [r * Math.sin(theta), rho(lat0) - r * Math.cos(theta)];
}

const reply = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=86400' },
});

export default async req => {
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get('lat')), lon = Number(url.searchParams.get('lon'));
  // Only the lower 48 states, which is all CropScape covers.
  if (!(lat > 24 && lat < 50 && lon > -125 && lon < -66)) return reply(400, { error: 'Pick a spot in the lower 48 states.' });
  const [x, y] = albers(lat, lon);
  // Ask for all ten years at once; a year that fails is shown as missing, never guessed.
  const years = await Promise.all(YEARS.map(async year => {
    try {
      const res = await fetch(`${API}?year=${year}&x=${x.toFixed(1)}&y=${y.toFixed(1)}`, { signal: AbortSignal.timeout(8000) });
      const match = (await res.text()).match(/category:\s*"?([^",}]+)/);
      return [String(year), match ? match[1].trim() : null];
    } catch (err) {
      return [String(year), null];
    }
  }));
  return reply(200, { history: Object.fromEntries(years), source: `USDA NASS Cropland Data Layer via ${API}` });
};
