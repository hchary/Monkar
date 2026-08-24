// One-off admin script: node scripts/migrateSubjectsToMonsters.js
// Uses Application Default Credentials (run `gcloud auth application-default login` first).
//
// Part of the "Content migration scripts" change (docs/TODO.md): carries the retired
// worldData/missionSubjects/items catalog onto the bestiary, worldData/monsters/items (see
// shared/schema/monster.ts). One monster document per Subject, BEST EFFORT - the new contract asks
// for things the old one never stored.
//
// What carries over cleanly:
//   name     <- subject.name, unchanged.
//   tagIds   <- the union of every difficultyTiers[].tagIds and variations[].tagIds, deduplicated.
//               The old draw picked one tier plus one variation, so the union is a superset of any
//               single generated mission's tag pool; it is the closest thing the old data has to
//               "the tags this creature carries".
//   trigger  <- subject.trigger, verbatim (same row shape, same evaluator - the field only changed
//               collection, see shared/schema/monster.ts's `trigger`).
//
// What is GUESSED and needs a hand pass afterwards:
//   difficulty   The old Subject spanned several tiers at once; a monster has exactly one. The
//                script takes the LOWEST tier present, since on the new rules difficulty is not a
//                gate on generation - it only raises the loot rarity ceiling (docs/TODO.md
//                "Monster-pool loot") - so the lowest tier is the conservative choice. Subjects with
//                no difficultyTiers at all get "facile".
//   areaType     No source in the old data (Subjects matched on climateIds, which say nothing about
//                terrain kind). Written as null, which means "inherit from the parent chain" - and a
//                monster whose whole chain resolves to null CAN NEVER BE GENERATED. Every migrated
//                monster is therefore listed under "TO AUTHOR" below.
//   lootItemIds  No source either: the old pipeline drew loot from tables matched on tags, not from
//                a per-creature pool. Written as [], which means a hunt pays nothing.
//
// Not guessed at all: parentId (null - the inheritance chains are an authoring decision) and
// talentRewardId (null - docs/TODO.md "Talent training roll and monster talent reward").
//
// ID MAPPING IS THE IDENTITY. The monster keeps its Subject's document id, rather than getting a
// fresh one and writing a lookup table somewhere. That makes every id that already points at a
// Subject elsewhere - character.triggeredSubjectIds, questChains steps[].subjectId - a valid monster
// id after this runs, and makes the script re-runnable without a side file. An existing monster of
// that id is left untouched, so a re-run never overwrites hand-authoring done in between.
//
// ORDER: safe to run at any time - it only writes a new collection, and the live code path
// (functions/src/actions/recherche.js) keeps reading missionSubjects until docs/TODO.md "Mission
// generation from the bestiary" repoints it. Do the "TO AUTHOR" pass before that row ships.
//
// Like every script in this directory, this is generated, reviewed and run by hand - never invoked
// from app code.
const admin = require("firebase-admin");

admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: "monkar-rpg" });
const db = admin.firestore();

// Mirrors src/lib/difficulties.js's DIFFICULTIES values, easiest first. Hardcoded rather than
// imported: this directory is CommonJS and shares no build with the Vite app.
const DIFFICULTY_VALUES = ["facile", "moyen", "difficile", "tres_difficile", "epique", "mythique"];
const FALLBACK_DIFFICULTY = "facile";

// The union of the Subject's per-tier and per-variation tag pools - the old generation drew one of
// each, so no single mission ever carried all of these at once.
function unionTagIds(subject) {
  const tiers = subject.difficultyTiers || [];
  const variations = subject.variations || [];
  return [...new Set([...tiers, ...variations].flatMap((entry) => entry.tagIds || []))];
}

// The lowest DIFFICULTIES tier the Subject was authored for; the fallback when it has none.
function lowestDifficulty(subject) {
  const authored = (subject.difficultyTiers || []).map((tier) => tier.difficulty).filter(Boolean);
  for (const value of DIFFICULTY_VALUES) {
    if (authored.includes(value)) return value;
  }
  return FALLBACK_DIFFICULTY;
}

async function migrate() {
  const [subjectsSnap, monstersSnap] = await Promise.all([
    db.collection("worldData").doc("missionSubjects").collection("items").get(),
    db.collection("worldData").doc("monsters").collection("items").get(),
  ]);

  const existingMonsterIds = new Set(monstersSnap.docs.map((d) => d.id));
  const monstersRef = db.collection("worldData").doc("monsters").collection("items");

  const toAuthor = [];
  let created = 0;
  let skipped = 0;

  for (const doc of subjectsSnap.docs) {
    const subject = doc.data();

    if (existingMonsterIds.has(doc.id)) {
      console.log(`Monster ${doc.id} already exists - left untouched.`);
      skipped++;
      continue;
    }

    const monster = {
      name: subject.name || "",
      difficulty: lowestDifficulty(subject),
      areaType: null,
      parentId: null,
      tagIds: unionTagIds(subject),
      lootItemIds: [],
      talentRewardId: null,
      trigger: subject.trigger || null,
    };

    await monstersRef.doc(doc.id).set(monster);
    created++;
    console.log(`Created monster ${doc.id} ("${monster.name}", difficulty ${monster.difficulty}).`);
    toAuthor.push(`  ${doc.id} "${monster.name}" - areaType: null, lootItemIds: []`);
  }

  console.log(`\nCreated ${created} monsters from ${subjectsSnap.size} mission Subjects; skipped ${skipped} already present.`);

  if (toAuthor.length > 0) {
    console.log(`\nTO AUTHOR - ${toAuthor.length} monster(s) carry no areaType and no loot:`);
    for (const line of toAuthor) console.log(line);
    console.log(`\nOpen the creator's Missions > Monstres tab and give each one an area type and a loot pool.`);
    console.log(`Until then a monster is never drawn (null areaType) and its missions pay nothing (empty loot).`);
    console.log(`Their difficulty is the lowest tier the old Subject was authored for - review it too.`);
  }
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
