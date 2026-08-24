// One-off admin script: node scripts/migrateTriggeredSubjectsToMonsters.js
// Uses Application Default Credentials (run `gcloud auth application-default login` first).
//
// Part of the "Content migration scripts" change (docs/TODO.md): copies every character's
// `triggeredSubjectIds` into `triggeredMonsterIds`, the field that replaces it now that the trigger
// sweep grants monsters rather than mission Subjects (see shared/schema/character.ts).
//
// RUN scripts/migrateSubjectsToMonsters.js FIRST. That script gives each new monster its Subject's
// own document id, so the mapping here is the identity - an id already in triggeredSubjectIds is
// the monster id too. This script does not blindly copy, though: it checks each id against
// worldData/monsters/items and reports the ones with no monster behind them (a Subject deleted
// before the migration, or a migration that has not run) instead of writing a dangling reference.
//
// The legacy `triggeredSubjectIds` array is LEFT IN PLACE: it stays documented rather than deleted
// (the project's schema convention), the sweep still writes it until docs/TODO.md "Mission
// generation from the bestiary" repoints it, and the result pop-up still resolves its ids against
// missionSubjects until then. Nothing here deletes it.
//
// Idempotent: uses arrayUnion, so a re-run adds nothing that is already there. Because both fields
// stay live and hold the same ids, the notification pipeline shows each grant once either way.
//
// Like every script in this directory, this is generated, reviewed and run by hand - never invoked
// from app code.
const admin = require("firebase-admin");

admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: "monkar-rpg" });
const db = admin.firestore();

async function migrate() {
  const [charactersSnap, monstersSnap] = await Promise.all([
    db.collection("characters").get(),
    db.collection("worldData").doc("monsters").collection("items").get(),
  ]);

  const monsterIds = new Set(monstersSnap.docs.map((d) => d.id));
  const dangling = [];
  let updated = 0;
  let unchanged = 0;

  for (const doc of charactersSnap.docs) {
    const character = doc.data();
    const subjectIds = character.triggeredSubjectIds || [];
    if (subjectIds.length === 0) {
      unchanged++;
      continue;
    }

    const known = subjectIds.filter((id) => monsterIds.has(id));
    for (const id of subjectIds) {
      if (!monsterIds.has(id)) dangling.push(`  ${doc.id} ("${character.name || "?"}") -> ${id}`);
    }

    const alreadyThere = new Set(character.triggeredMonsterIds || []);
    const missing = known.filter((id) => !alreadyThere.has(id));
    if (missing.length === 0) {
      unchanged++;
      continue;
    }

    await doc.ref.update({ triggeredMonsterIds: admin.firestore.FieldValue.arrayUnion(...missing) });
    updated++;
    console.log(`${doc.id} ("${character.name || "?"}"): +${missing.length} triggered monster(s).`);
  }

  console.log(`\nUpdated ${updated}/${charactersSnap.size} characters; ${unchanged} already up to date or with nothing to carry.`);

  if (dangling.length > 0) {
    console.log(`\nNOT CARRIED - ${dangling.length} triggered id(s) have no monster document:`);
    for (const line of dangling) console.log(line);
    console.log(`\nRun scripts/migrateSubjectsToMonsters.js first if that is the reason; otherwise the Subject was`);
    console.log(`deleted before the migration and the grant is simply lost, which is harmless - the character just`);
    console.log(`never sees that notification again.`);
  }
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
