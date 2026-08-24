// One-off admin script: node scripts/seedAreasFromRegions.js
// Uses Application Default Credentials (run `gcloud auth application-default login` first).
//
// Part of the "Content migration scripts" change (docs/TODO.md): bootstraps the new
// worldData/areas/items catalog from the regions that already exist, so every region has an Area to
// point at instead of each one being authored by hand in the creator's Zones tab.
//
// One Area document per DISTINCT climate/relief combination across all regions: two regions sharing
// the same climateIds + reliefIds sets end up on the same Area, which is exactly the sharing the
// Area collection exists for (see shared/schema/area.ts). Each region then gets `areaId` set to its
// combination's Area.
//
// BEST EFFORT ON `type`. Areas carry an AREA_TYPES key (shared/lib/areaTypes.ts) and the old data
// has no such field, so the script guesses: first from the region's climate `bannerKey` (which
// overlaps the area-type list on ville/grotte/desert/volcan), then from keywords in the climate and
// relief names, and finally falls back to "plaine". Every Area whose type was guessed is listed in
// the output under "TO REVIEW" - open the Zones tab and fix it, because a region whose Area type no
// monster covers generates an empty journal.
//
// `tagIds` and `lootTableIds` are left empty: neither has a source in the old data, and
// lootTableIds is read by nothing until docs/TODO.md "Metier rework".
//
// Idempotent: Area ids are derived from the combination itself, an existing Area of that id is left
// untouched, and a region that already has a non-null `areaId` is skipped - so a hand-authored Area
// or link is never clobbered by a re-run.
//
// Like every script in this directory, this is generated, reviewed and run by hand - never invoked
// from app code.
const admin = require("firebase-admin");

admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: "monkar-rpg" });
const db = admin.firestore();

// Mirrors shared/lib/areaTypes.ts's AREA_TYPES values. Hardcoded rather than imported: this
// directory is CommonJS and shares no build with the Vite app, the same reason every other script
// here restates the enums it needs.
const AREA_TYPE_VALUES = ["ville", "marais", "grotte", "plaine", "montagne", "desert", "ruines_anciennes", "volcan"];
const FALLBACK_AREA_TYPE = "plaine";

// worldData/climats/items `bannerKey` values that name an area type outright (see
// shared/schema/climat.ts). The remaining banner keys - foret, glace, pleine_mer, bord_mer - have no
// area type of their own and fall through to the keyword pass below.
const BANNER_KEY_TO_AREA_TYPE = { ville: "ville", grotte: "grotte", desert: "desert", volcan: "volcan" };

// Keyword -> area type, tried in order against the lowercased, accent-stripped climate and relief
// names of the combination. Deliberately small: a confident wrong guess is worse than a fallback
// that gets flagged for review.
const NAME_KEYWORDS = [
  ["marais", "marais"],
  ["marecage", "marais"],
  ["tourbiere", "marais"],
  ["grotte", "grotte"],
  ["caverne", "grotte"],
  ["souterrain", "grotte"],
  ["montagne", "montagne"],
  ["mont", "montagne"],
  ["pic", "montagne"],
  ["falaise", "montagne"],
  ["sommet", "montagne"],
  ["desert", "desert"],
  ["dune", "desert"],
  ["aride", "desert"],
  ["ruine", "ruines_anciennes"],
  ["vestige", "ruines_anciennes"],
  ["volcan", "volcan"],
  ["lave", "volcan"],
  ["cendre", "volcan"],
  ["ville", "ville"],
  ["cite", "ville"],
  ["plaine", "plaine"],
  ["prairie", "plaine"],
  ["steppe", "plaine"],
];

function deaccent(text) {
  return (text || "").normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function slugify(text) {
  return deaccent(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// The identity of a climate/relief combination: both id lists deduplicated and sorted, so member
// order never splits one combination into two Areas.
function combinationKey(region) {
  const climateIds = [...new Set(region.climateIds || [])].sort();
  const reliefIds = [...new Set(region.reliefIds || [])].sort();
  return `${climateIds.join("+")}|${reliefIds.join("+")}`;
}

// Deterministic document id, so a re-run finds the same Area instead of creating a second one.
function areaIdFor(climateNames, reliefNames) {
  const slug = slugify([...climateNames, ...reliefNames].join("-"));
  return slug ? `zone-${slug}`.slice(0, 120) : "zone-sans-terrain";
}

function areaNameFor(climateNames, reliefNames) {
  if (climateNames.length === 0 && reliefNames.length === 0) return "Zone sans terrain";
  return [climateNames.join(" / "), reliefNames.join(" / ")].filter(Boolean).join(" - ");
}

// Returns { type, guessed }. `guessed` is false only when a bannerKey named the type outright,
// which is the one signal in the old data that actually means "this terrain is of that kind".
function guessAreaType(bannerKeys, climateNames, reliefNames) {
  for (const key of bannerKeys) {
    const mapped = BANNER_KEY_TO_AREA_TYPE[key];
    if (mapped) return { type: mapped, guessed: false };
  }

  const haystack = deaccent([...climateNames, ...reliefNames].join(" ")).toLowerCase();
  for (const [keyword, type] of NAME_KEYWORDS) {
    if (haystack.includes(keyword)) return { type, guessed: true };
  }

  return { type: FALLBACK_AREA_TYPE, guessed: true };
}

async function seedAreas() {
  const [regionsSnap, climatsSnap, reliefsSnap, areasSnap] = await Promise.all([
    db.collection("worldData").doc("regions").collection("items").get(),
    db.collection("worldData").doc("climats").collection("items").get(),
    db.collection("worldData").doc("reliefs").collection("items").get(),
    db.collection("worldData").doc("areas").collection("items").get(),
  ]);

  const climats = new Map(climatsSnap.docs.map((d) => [d.id, d.data()]));
  const reliefs = new Map(reliefsSnap.docs.map((d) => [d.id, d.data()]));
  const existingAreaIds = new Set(areasSnap.docs.map((d) => d.id));
  const areasRef = db.collection("worldData").doc("areas").collection("items");
  const regionsRef = db.collection("worldData").doc("regions").collection("items");

  // Group regions by combination first, so one Area is written per combination rather than one per
  // region carrying it.
  const combinations = new Map();
  for (const doc of regionsSnap.docs) {
    const region = { id: doc.id, ...doc.data() };
    const key = combinationKey(region);
    if (!combinations.has(key)) {
      combinations.set(key, {
        regions: [],
        climateIds: [...new Set(region.climateIds || [])].sort(),
        reliefIds: [...new Set(region.reliefIds || [])].sort(),
      });
    }
    combinations.get(key).regions.push(region);
  }

  const toReview = [];
  let areasWritten = 0;
  let regionsLinked = 0;
  let regionsSkipped = 0;

  for (const combination of combinations.values()) {
    const climateNames = combination.climateIds.map((id) => climats.get(id)?.name).filter(Boolean);
    const reliefNames = combination.reliefIds.map((id) => reliefs.get(id)?.name).filter(Boolean);
    const bannerKeys = combination.climateIds.map((id) => climats.get(id)?.bannerKey).filter(Boolean);

    const areaId = areaIdFor(climateNames, reliefNames);
    const { type, guessed } = guessAreaType(bannerKeys, climateNames, reliefNames);
    const regionNames = combination.regions.map((r) => r.name).join(", ");

    if (existingAreaIds.has(areaId)) {
      console.log(`Area ${areaId} already exists - left untouched.`);
    } else {
      await areasRef.doc(areaId).set({
        name: areaNameFor(climateNames, reliefNames),
        type,
        tagIds: [],
        lootTableIds: [],
      });
      existingAreaIds.add(areaId);
      areasWritten++;
      console.log(`Created Area ${areaId} (type "${type}") for: ${regionNames}`);
      if (guessed) toReview.push(`  ${areaId} -> type "${type}" - regions: ${regionNames}`);
    }

    for (const region of combination.regions) {
      if (region.areaId) {
        regionsSkipped++;
        continue;
      }
      await regionsRef.doc(region.id).update({ areaId });
      regionsLinked++;
    }
  }

  console.log(`\nCreated ${areasWritten} Area documents from ${combinations.size} distinct climate/relief combinations.`);
  console.log(`Linked ${regionsLinked} regions; skipped ${regionsSkipped} that already had an areaId.`);

  if (toReview.length > 0) {
    console.log(`\nTO REVIEW - ${toReview.length} Area type(s) were guessed, not read from the data:`);
    for (const line of toReview) console.log(line);
    console.log(`\nOpen the creator's Carte > Zones tab and set the right type on each.`);
    console.log(`Valid types: ${AREA_TYPE_VALUES.join(", ")}.`);
  }
}

seedAreas()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
