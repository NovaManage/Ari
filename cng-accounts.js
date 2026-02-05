const fs = require("fs");
const fetch = require("node-fetch");
const logins = require("./cng-config");

const CLIENT_ID = "id-ced3b1eb-7fb1-5339-af46-52777c61d71";
const CLIENT_SECRET = "secret-3e5b66bd-1fab-c523-85ca-5c0edfe3a1";

async function run() {
  for (const acct of logins) {
    console.log("🔄 Token:", acct.name);

    const code = fs.readFileSync(`token-${acct.name}.txt`, "utf8").trim();

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: "https://portal.cngcorp.com/login",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET
    });

    const tokenRes = await fetch("https://sso.cngcorp.com/o/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.log("❌ Token failed:", acct.name, tokenData);
      continue;
    }

    const token = tokenData.access_token;
    console.log("✅ Token OK:", acct.name);

    const accRes = await fetch("https://apim.avangrid.com/cng/v1/accounts", {
      headers: {
        Authorization: `Bearer ${token}`,
        "ocp-apim-subscription-key": "a8de8551d9964f5bac84aae22bddafe5"
      }
    });

    const accounts = await accRes.json();

    fs.writeFileSync(
      `accounts-${acct.name}.json`,
      JSON.stringify(accounts, null, 2)
    );

    console.log("📦 Accounts saved:", acct.name);
  }
}

run();
