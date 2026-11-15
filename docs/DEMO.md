# 3-minute demo script

For the live demo and the video. Every number below is what the app shows for the Henry County demo field with the default settings on Nov 14, 2026. If the data or rules change, re-read the numbers from the screen before presenting.

## 0:00 – 0:30 · The problem

> "Soil wears out slowly, and you can't see it from the tractor. Topsoil washes off bare ground in a heavy rain. Organic matter drops when nothing is growing all winter. By the time yields fall, the damage is years old."

Open the app and click **Check my field**. Show how a farmer finds their own land in a few seconds: type a town (for example "Martinsville, VA") in the address box, or scroll the satellite map and click a field. The app pulls 21 years of NASA POWER weather and the USDA soil survey for that exact spot in about 2 seconds.

> "Any farmer in the lower 48 can do this with their own field. No account needed."

Then pick **Demo field in northern Henry County** from the field list for the full walkthrough. It's a real crop field picked from the USDA Cropland Data Layer, and it's the one with saved satellite greenness and crop history. Spots you pick get weather and soil only, and the app says so.

## 0:30 – 1:15 · Step 1: Check your soil

Point at the headline: **"With what you grow now, your soil is covered for 86% of the heavy-rain season."** Then the equation:

> "USDA estimates soil erosion with one equation, RUSLE: soil loss equals rain power, times how easily the soil washes away, times slope, times cover, times conservation practices. For this field the USDA soil survey lists K at 0.24 on a 5% slope. Rain, soil and slope you can't change. Cover, the green C, is the one a farmer controls with the crop cycle."

Point out the labels: K is from the soil survey; R and LS are stand-ins because NASA POWER is daily and slope length is unknown; P is unknown. "We don't invent the missing pieces, so we don't give a tons-per-acre number. These are risk signs, not a soil-loss prediction."

Then the warning signs: **"3 of 4 soil warning signs are on."**

> "This farm grows corn, then wheat with double-crop soybean. We read 21 years of NASA POWER weather and five years of MODIS satellite greenness for the 250-meter pixel around this spot. Satellites saw it with little plant cover in December, January and February."

Walk across the four tiles. Each one names its data source.

- Soil washing away: bare ground in a heavy-rain month (NASA POWER).
- Soil losing organic matter: living roots in only half of winters.
- Nitrogen: OK, because soybean is a legume.
- Thirsty crops: corn grows in May and June, when root-zone soil was drier than usual in 2021–2025.

## 1:15 – 1:45 · Step 2: See the cycle

Scroll to the month strip and the greenness chart.

> "Here's the cycle month by month. Tan means bare. The chart is what the satellite actually saw: green in summer, brown in winter. That bare winter window is when the soil is most exposed to erosion."

## 1:45 – 2:30 · Step 3: Compare fixes

Point at the finding sentence and the three cards.

> "We compare what you grow now with the two rotations that best fit this field. Sorghum, then wheat and double-crop soybean, raises cover in the heavy-rain season from 86% to 100%, clears all three warning signs under our rules, and scores 83 against 56. These scores come from written rules, not AI, and they haven't been tested on real farms yet, so it's a starting point for the extension agent."

The third card is wheat and double-crop soybean every year (81). Move the **Forage** slider from 1 to 5: every score shifts (sorghum 83 to 80, wheat-soybean 81 to 78, current 56 to 55), but sorghum stays on top: "For this field, the soil fix holds up even when the farmer cares more about hay."

Open "Evidence, benefits, what we don't know" on one card:

> "Every option shows why it was suggested, the evidence, the benefits, what we don't know, and what to check locally. For example, we only have 100 of 115 satellite images, and our crop water ratings still need an agronomist to check them."

## 2:30 – 3:00 · Why trust it, and what's next

Scroll to "Why we believe this".

> "The equation is USDA's own (Agriculture Handbook 703), and the warning signs come from published soil health advice from USDA NRCS, SARE and Virginia Extension, applied to real NASA data. No black box and no AI in the scores, just written rules you can read. It supports the farmer's decision and the extension agent's advice; it never tells anyone what to plant. Next: on-the-ground soil sensors to check what the satellite sees."

## Backup if the internet is down

Record a full run of this script ahead of time and keep the video on the laptop and on a phone. If the Wi-Fi or a NASA service fails on stage, play the video.

The demo fields read only saved data files, so the warning signs, month strip and three cards work offline from `python3 -m http.server 8000`. The map (Leaflet) and the charts (Chart.js) load from the internet, so they will be missing offline; picking your own spot needs the internet too. Use the demo field list instead and keep a screenshot of the greenness chart ready.
