const { chromium } = require("playwright");
const logins = require("./cng-config");
const fs = require("fs");

async function run() {
  const browser = await chromium.launch({ headless: true });

  for (const acct of logins) {
    console.log("🔐 Logging in:", acct.name);

    const page = await browser.newPage();

    await page.goto("https://portal.cngcorp.com/login", {
      waitUntil: "networkidle"
    });

    await page.fill('input[name="username"]', acct.username);
    await page.fill('input[name="password"]', acct.password);

    await page.click('button[type="submit"]');

    // wait for redirect after login
    await page.waitForTimeout(4000);

    const url = page.url();
    console.log("🌐 Redirect URL:", url);

    const match = url.match(/code=([^&]+)/);

    if (!match) {
      console.log("❌ No auth code for", acct.name);
      continue;
    }

    const authCode = match[1];
    console.log("✅ Auth code:", acct.name);

    fs.writeFileSync(`token-${acct.name}.txt`, authCode);

    await page.close();
  }

  await browser.close();
}

run();
