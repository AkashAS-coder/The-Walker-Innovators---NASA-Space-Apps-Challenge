# 3-minute demo script

For the live demo and the video. Every number below is what the live app (https://cresstech.netlify.app) showed for the Franklin County, Virginia example field with the default sliders on Nov 15, 2026. If the data or rules change, re-read the numbers from the screen before presenting.

The app has four steps across the top: **1 Your field, 2 Soil check, 3 Your year, 4 Compare**. There is also a **Proof** page and an **Ask AI** page in the menu.

## 0:00 – 0:25 · The problem

> "Soil wears out slowly, and you can't see it from the tractor. Topsoil washes off bare ground in a heavy rain. Organic matter drops when nothing is growing all winter. By the time yields fall, the damage is years old."

Click **Check my field**. Show how a farmer adds their own land: type a town or scroll the satellite map and click a field. The app pulls 21 years of NASA POWER weather and the USDA soil survey for that spot. Then the field's crop record from USDA CropScape appears, and the crop cycle box starts on the closest match, with the note "From this field's crop record (USDA CropScape). Change it if wrong."

> "Any farmer in the lower 48 can do this for their own fields. No account needed."

Tested example: a field in Southampton County, VA (lat 36.65, lon −76.95) shows corn, peanuts and cotton from 2016 to 2025 and starts on "Peanut then cotton then corn". If the pin lands on a town, forest or water, the app says the record shows no field crops and asks the farmer to check the pin.

Then click **See an example Virginia field**. It opens the saved Franklin County field, a real crop field from the USDA Cropland Data Layer, straight on step 4. Everything for it is saved, so the rest of the demo works even if a NASA service is slow.

## 0:25 – 1:00 · The answer card

Point at the three boxes at the top of step 4:

- **Biggest risk now:** soil washing away; ground is bare in some years in January, when days with over 2 in (50 mm) of rain happen.
- **Option worth a look:** "Sorghum then wheat and double-crop soybean", **83/100 fit against 56 now**, clears 3 of 3 warning signs.
- **Check locally first:** double-crop soybean still growing in mid-November is after the usual first fall frost (Oct 30).

> "Three lines a farmer can read in ten seconds: the risk, one option worth a look, and what to check before trusting it. Every number comes from NASA POWER, MODIS, the USDA soil survey or our crop table, and the scores come from written rules, not AI."

## 1:00 – 1:35 · Why: the soil check and the year

Click **2 Soil check**. **3 of 4 soil warning signs are on** for what this farm grows now (corn, then wheat with double-crop soybean).

> "USDA estimates erosion with one equation, RUSLE: rain power times how easily the soil washes, times slope, times cover, times practices. Here the soil survey lists K at 0.24 on a 5% slope. Rain, soil and slope you can't change. Cover is the part a farmer controls with the crop cycle. We don't invent the missing pieces, so we give risk signs, not tons of soil lost."

Click **3 Your year**: the month strip (tan means bare) and the MODIS greenness chart. Satellites saw little plant cover in December, January and February.

## 1:35 – 2:15 · Compare, sliders and "I want to grow"

Back on **4 Compare**: the current cycle covers the soil **86%** of the heavy-rain season; the sorghum option and "Wheat and double-crop soybean every year" (81) both reach **100%**.

Move the **Forage** slider from 1 to 5: sorghum drops to 80 and "Cotton with Austrian winter pea" rises to 80. Set it back to 1.

> "The farmer's priorities change the ranking. Here the soil fix holds up even when they care more about hay."

On step 1, pick **Cotton** under "A crop you want to grow". Step 4 now shows **"How Cotton fits this field"**: in the ground May to October, inside the usual frost-free season (Apr 10 to Oct 30, NASA POWER); bare November to April when grown alone, and cereal rye or crimson clover can cover those months. The best option becomes "Cotton with Austrian winter pea", **79/100**. Set it back to "No preference".

Open "Evidence, benefits, limits, local checks" on one card: why suggested, evidence, benefits, what we don't know, what to check locally.

Below the cards, point at **Your local experts** (shown for Virginia fields): the Virginia Cooperative Extension office finder and the Southern Piedmont research center in Blackstone.

## 2:15 – 2:45 · Proof

Open **Proof** from the menu.

> "We can't measure erosion from space, so we tested the one part we can check: the dry-soil flag. For every month from 2005 to 2025 we compared NASA POWER soil wetness with the U.S. Drought Monitor for Franklin County. We caught **42 of 48** drought months and missed 6. We also flagged 62 months with no drought on record, and we show that too."

Point at "What we have not proven": scores not tested on real farms, crop table not yet checked by an agronomist, no tons-of-soil-lost number.

## 2:45 – 3:00 · Close

Optional, if time: on **Ask AI**, ask "Which month is my field most bare?". Field Helper Buddy answers only from the results on screen, and the page says it can be wrong.

> "It supports the farmer's decision and the extension agent's advice. It never tells anyone what to plant."

## Backup if the internet is down

Record a full run of this script ahead of time (30 seconds or less for the submission video) and keep it on the laptop and a phone. If the Wi-Fi or a NASA service fails on stage, play the video.

The example field reads only saved files, so steps 2 to 4 and the Proof page work offline from `python3 -m http.server 8000`. The map, the charts, picking your own spot, crop history, sign-in and Ask AI need the internet (crop history and Ask AI only run on the Netlify site).
