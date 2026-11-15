# Crop table check against sources

This is a first-pass check of every trait in `data/crops.csv` against its two sources, done with Claude Code on Nov 14, 2026 (see `AI_USE.md`). **A team member still needs to confirm it.** Open each source at the page listed, check the claim, and then change `verified` to `yes` for that row.

Sources:

- **VCE** = Virginia Cooperative Extension, Agronomy Handbook, SPES-299, Part I "Crop Descriptions" (PDF page numbers): https://www.pubs.ext.vt.edu/content/dam/pubs_ext_vt_edu/424/424-100/spes-299.pdf
- **SARE** = Managing Cover Crops Profitably, 3rd ed., chapter for that crop (links in `crops.csv`)

Key: ✅ the source supports it · ⚠️ the source doesn't say; it's our judgment · ✏️ changed to match the source

| Crop | What the sources support | Not stated (our judgment) |
| --- | --- | --- |
| Corn | ✅ Planted about a week either side of the last spring frost, so April start (VCE p17). ✅ Not a legume; needs 125–150 lb N (VCE p17). ✅ Less heat- and drought-hardy than sorghum (VCE p36, sorghum entry). | ⚠️ Water need "high", heat "medium", root "medium", forage "medium" (silage use is in VCE p17) |
| Soybean | ✅ Legume, so nitrogen-fixing (VCE p37). ✅ Planted about two weeks after corn, so May start (VCE p38). | ⚠️ Water "medium", heat "medium", root "medium", forage "low" (VCE lists hay and silage as uses) |
| Soybean, double crop | ✅ Planted after small grain, generally after June 15, so June start (VCE p38). | ⚠️ Same trait ratings as full-season soybean; November end month |
| Winter wheat | ✅ Gives grazing before spring growth (SARE). ✅ Fall-planted winter crop. | ⚠️ Water "low", root "medium" (SARE says "fine root system"), heat "low" |
| Grain sorghum | ✅ Handles high heat and drought better than corn (VCE p36), so heat "high" and water "low". ✅ Planted 1–2 weeks after corn, so May (VCE p36). | ⚠️ Root "deep" (VCE doesn't say; SARE says sorghum-sudangrass has aggressive roots), October end |
| Alfalfa | ✅ Perennial with a deep taproot (VCE p9). ✅ Legume; no N at seeding and inoculation essential (VCE p9). ✅ Used for hay, pasture and silage, so forage "high" (VCE p9). | ⚠️ Water need "high", heat "medium" |
| Cereal rye | ✅ The most winter-hardy small grain, so frost "high" (VCE p34). ✅ Fibrous root system, no taproot, so root "medium" (SARE). ✅ Used for grazing and pasture (VCE p34, SARE). ✅ Planted around the first killing frost, so October (VCE p34). | ⚠️ Water "low", heat "low", April end (depends on when it's killed) |
| Crimson clover | ✅ Fixes 70–150 lb N/acre (SARE). ✅ Can winterkill at the northern edge of its range, so frost "medium" (SARE). ✅ Planted 30–60 days before fall frost, so September (VCE p19). ✅ Used for hay and pasture (VCE p19). ✏️ Root changed from "shallow" to **"medium"**: VCE p19 describes a central taproot. | ⚠️ Water "low", heat "low" |
| Sorghum-sudangrass | ✅ Withstands drought (SARE). ✅ Not frost-tolerant (SARE). ✅ Aggressive, subsoiling roots, so root "deep" (SARE). ✅ Prized summer forage (SARE). ✅ Can be planted in summer (SARE), so June after wheat works. ✏️ End month changed from September to **October**: SARE says it regrows until frost. | ⚠️ Heat "high" (inferred from drought tolerance) |
| Forage radish | ✅ Planted in late August and killed by the first hard frost, usually December (SARE, Maryland and Pennsylvania). ✅ Large taproot that can reach about 6 ft (SARE). | ⚠️ Water "low", frost "medium", forage "low" |

## What this means for the judges' "Validity" question

- Every **nitrogen-fixing**, **root depth**, **planting month** and **frost** value is now either backed by a page in a source or flagged above.
- Most **water-need** and **heat-tolerance** ratings are our relative judgment. The one direct source statement is that sorghum handles heat and drought better than corn. The site already says "Crop trait ratings are our reading of extension sources" in every "What we don't know" box.
- A stronger source for water use would be a crop water-use table, for example from the FAO crop information pages or a VCE irrigation guide. That's a good next step if there's time.

## Added Nov 14, 2026 (AI-researched, verified=no): check these first

15 crops were added with one extension or SARE source each. These values had **no supporting line in the source** and are best guesses; a team member must confirm or fix them before relying on them:

- cotton: end month 10, forage low
- peanut: root depth medium, forage low
- oats_spring and winter_oats: root depth; oats_spring start month 3 (Virginia inferred from a Pennsylvania date)
- sunflower: Virginia months, heat medium, forage low
- canola: end month 6, water medium, root medium, forage low
- tobacco: months 5 to 9 and frost low (no Virginia calendar found; ask the Southern Piedmont AREC)
- pearl_millet: root depth medium, heat high (inferred)
- red_clover: water medium, end month 10, heat low (inferred)
- hairy_vetch: root depth medium, heat low
- triticale: root depth, heat
- buckwheat: forage low, the exact June to August window

The 10 new rotations come from the same sources. The weakest are canola_wheat (summer crops adapted) and potato_grain_alfalfa (adapted from a southern Idaho sequence without sugar beet).

