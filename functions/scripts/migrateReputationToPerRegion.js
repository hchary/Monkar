// One-off admin script: node scripts/migrateReputationToPerRegion.js
// Uses Application Default Credentials (run `gcloud auth application-default login` first).
//
// Part of the "Content migration scripts" change (docs/TODO.md): moves every character off the
// single global `reputation` scalar onto `reputations`, the per-region map that replaces it (see
// shared/schema/character.ts).
//
//   reputations[character.region.id] = character.reputation
//
// The scalar is LEFT IN PLACE, deliberately: it stays a documented legacy field so documents written
// before the migration remain schema-valid, and so createCharacter can keep writing it until
// docs/TODO.md "Per-region reputation" takes it out. Nothing here deletes it.
//
// A character only ever held reputation in one place - the region it stands in - so there is nothing
// to split: the whole score moves to that region's entry and every other region starts unset (the
// UI and the `minReputation` condition read the current region's entry, and an absent entry reads as
// 0 there, not as the old global score).
//
// Idempotent: a character that already has an entry for its own region is skipped, so a re-run never
// overwrites a score the game has since moved.
//
// ORDER: safe to run before "Per-region reputation" ships - nothing reads `reputations` yet, so this
// only pre-populates the field. Run it again just before that row goes live if characters have kept
// playing in between, to pick up any `reputation` change made since.
//
// Like every script in this directory, this is generated, reviewed and run by hand - never invoked
// from app code.
const admin = require("firebase-admin");

admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: "monkar-rpg" });
const db = admin.firestore();

async function migrate() {
  const snap = await db.collection("characters").get();

  const skipped = [];
  let updated = 0;
  let alreadyDone = 0;

  for (const doc of snap.docs) {
    const character = doc.data();
    const regionId = character.region?.id;

    if (!regionId) {
      skipped.push(`  ${doc.id} ("${character.name || "?"}") - no region.id to key the score on`);
      continue;
    }

    const reputations = character.reputations || {};
    if (regionId in reputations) {
      alreadyDone++;
      continue;
    }

    // A character written before `reputation` existed reads as 0, which is also the score a region
    // with no entry reads as - writing it explicitly keeps "this character has been here" visible.
    const score = typeof character.reputation === "number" ? character.reputation : 0;
    await doc.ref.update({ [`reputations.${regionId}`]: score });
    updated++;
    console.log(`${doc.id} ("${character.name || "?"}"): reputations.${regionId} = ${score}`);
  }

  console.log(`\nUpdated ${updated}/${snap.size} characters; ${alreadyDone} already had an entry for their region.`);

  if (skipped.length > 0) {
    console.log(`\nSKIPPED - ${skipped.length} character(s) could not be migrated:`);
    for (const line of skipped) console.log(line);
  }
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
