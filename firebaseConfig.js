const admin = require("firebase-admin");
const { config } = require("./src/utils/config");

if (!config.environment.isTest) {
  admin.initializeApp({
    credential: admin.credential.cert(config.firebase),
    projectId: config.firebase.project_id,
  });
}

module.exports = admin;
