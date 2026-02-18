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
  sheetId: process.env.GOOGLE_SHEET_ID || "1dfd9PaO3tHxY0S8ZfLvKjgmh7G-fv7_3ckmgGeJJIcY",
  driveFolder: process.env.GOOGLE_DRIVE_FOLDER_ID || "0AImp-xo89wsoUk9PVA",
  keyFile: "credentials.google-key.json"
};

module.exports = {
  EVERSOURCE_LOGINS,
  GOOGLE_CONFIG
};
