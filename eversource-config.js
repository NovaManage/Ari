require("dotenv").config();

// Eversource Login Accounts
const EVERSOURCE_LOGINS = [];

for (let i = 1; i <= 9; i++) {
  const user = process.env[`EVERSOURCE_LOGIN_${i}_USER`];
  const pass = process.env[`EVERSOURCE_LOGIN_${i}_PASS`];
  if (user && pass) {
    EVERSOURCE_LOGINS.push({ 
      name: `Account${i}`,
      username: user, 
      password: pass 
    });
  }
}

// Google Sheets and Drive Configuration
const GOOGLE_CONFIG = {
  sheetId: process.env.GOOGLE_SHEET_ID,
  driveFolder: process.env.GOOGLE_DRIVE_FOLDER_ID,
  keyFile: "credentials.google-key.json"
};

// Validate required configuration
if (!GOOGLE_CONFIG.sheetId) {
  console.error("❌ GOOGLE_SHEET_ID environment variable is required");
  process.exit(1);
}

if (!GOOGLE_CONFIG.driveFolder) {
  console.error("❌ GOOGLE_DRIVE_FOLDER_ID environment variable is required");
  process.exit(1);
}

module.exports = {
  EVERSOURCE_LOGINS,
  GOOGLE_CONFIG
};
