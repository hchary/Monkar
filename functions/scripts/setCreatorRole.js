// One-off admin script: node scripts/setCreatorRole.js <uid>
// Uses Application Default Credentials (run `gcloud auth application-default login` first).
const admin = require("firebase-admin");

admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: "monkar-rpg" });

const uidOrEmail = process.argv[2];
if (!uidOrEmail) {
  console.error("Usage: node scripts/setCreatorRole.js <uid-or-email>");
  process.exit(1);
}

async function run() {
  const uid = uidOrEmail.includes("@") ? (await admin.auth().getUserByEmail(uidOrEmail)).uid : uidOrEmail;
  await admin.auth().setCustomUserClaims(uid, { role: "creator" });
  console.log(`Role 'creator' set for uid ${uid}`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
