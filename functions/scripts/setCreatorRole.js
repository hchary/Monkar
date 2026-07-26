// One-off admin script: node scripts/setCreatorRole.js <uid>
// Requires a service account key at functions/serviceAccountKey.json (never commit this file).
const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const uid = process.argv[2];
if (!uid) {
  console.error("Usage: node scripts/setCreatorRole.js <uid>");
  process.exit(1);
}

admin
  .auth()
  .setCustomUserClaims(uid, { role: "creator" })
  .then(() => {
    console.log(`Role 'creator' set for uid ${uid}`);
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
