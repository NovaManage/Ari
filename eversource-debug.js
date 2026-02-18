require("dotenv").config();
const { chromium } = require("playwright");

/**
 * Debug script for Eversource login
 * This script helps diagnose login issues by providing detailed output
 * and capturing screenshots at each step.
 */

async function debugLogin() {
  console.log("\n" + "=".repeat(60));
  console.log("EVERSOURCE LOGIN DEBUG TOOL");
  console.log("=".repeat(60) + "\n");

  // Get first configured account
  const username = process.env.EVERSOURCE_LOGIN_1_USER;
  const password = process.env.EVERSOURCE_LOGIN_1_PASS;

  if (!username || !password) {
    console.error("❌ No credentials found!");
    console.error("Please set EVERSOURCE_LOGIN_1_USER and EVERSOURCE_LOGIN_1_PASS in .env");
    process.exit(1);
  }

  console.log("📧 Username:", username);
  console.log("🔑 Password:", "*".repeat(password.length));
  console.log("");

  const browser = await chromium.launch({
    headless: false,
    slowMo: 100
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  });

  const page = await context.newPage();

  try {
    // Step 1: Navigate to login page
    console.log("Step 1: Navigating to login page...");
    await page.goto("https://www.eversource.com/security/account/login", {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });
    console.log("✅ Page loaded");
    console.log("URL:", page.url());
    await page.screenshot({ path: "./debug_01_login_page.png" });
    await page.waitForTimeout(2000);

    // Step 2: Check for login fields
    console.log("\nStep 2: Looking for login fields...");
    const usernameField = page.locator('input[name="email"]');
    const passwordField = page.locator('input[type="password"]');
    
    try {
      await usernameField.waitFor({ state: "visible", timeout: 10000 });
      console.log("✅ Username field found");
    } catch (e) {
      console.error("❌ Username field not found");
      await page.screenshot({ path: "./debug_02_no_username_field.png" });
      throw new Error("Cannot find username field");
    }

    try {
      await passwordField.waitFor({ state: "visible", timeout: 5000 });
      console.log("✅ Password field found");
    } catch (e) {
      console.error("❌ Password field not found");
      await page.screenshot({ path: "./debug_03_no_password_field.png" });
      throw new Error("Cannot find password field");
    }

    // Step 3: Fill in credentials
    console.log("\nStep 3: Filling in credentials...");
    await usernameField.click();
    await page.waitForTimeout(500);
    await usernameField.fill(username);
    console.log("✅ Username entered");

    await passwordField.click();
    await page.waitForTimeout(500);
    await passwordField.fill(password);
    console.log("✅ Password entered");
    await page.screenshot({ path: "./debug_04_credentials_filled.png" });
    await page.waitForTimeout(1000);

    // Step 4: Find and click sign in button
    console.log("\nStep 4: Looking for Sign In button...");
    const signInBtn = page.locator('input[type="submit"], button:has-text("Sign In")').first();
    
    try {
      await signInBtn.waitFor({ state: "visible", timeout: 5000 });
      console.log("✅ Sign In button found");
    } catch (e) {
      console.error("❌ Sign In button not found");
      await page.screenshot({ path: "./debug_05_no_signin_button.png" });
      throw new Error("Cannot find Sign In button");
    }

    const urlBeforeClick = page.url();
    console.log("URL before clicking:", urlBeforeClick);

    await signInBtn.click();
    console.log("✅ Sign In button clicked");
    await page.screenshot({ path: "./debug_06_after_signin_click.png" });

    // Step 5: Wait for response
    console.log("\nStep 5: Waiting for login response...");
    
    // Wait up to 30 seconds for URL to change
    let urlChanged = false;
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(1000);
      const currentUrl = page.url();
      
      if (currentUrl !== urlBeforeClick) {
        console.log(`✅ URL changed after ${i + 1} seconds`);
        console.log("New URL:", currentUrl);
        urlChanged = true;
        break;
      }
      
      if (i % 5 === 0) {
        console.log(`⏳ Still waiting... (${i + 1}s)`);
      }
    }

    await page.screenshot({ path: "./debug_07_after_wait.png" });

    if (!urlChanged) {
      console.log("⚠️ URL did not change after 30 seconds");
      console.log("Final URL:", page.url());
      
      // Check for error messages
      console.log("\nChecking for error messages...");
      const errorSelectors = [
        '.error',
        '.alert-danger',
        '[role="alert"]',
        '.invalid-feedback',
        '[class*="error"]',
        '[class*="Error"]'
      ];
      
      for (const selector of errorSelectors) {
        const elements = await page.locator(selector).all();
        if (elements.length > 0) {
          console.log(`Found ${elements.length} element(s) with selector: ${selector}`);
          for (const element of elements) {
            const text = await element.textContent().catch(() => null);
            if (text && text.trim()) {
              console.log(`  Error text: "${text.trim()}"`);
            }
          }
        }
      }
    }

    // Step 6: Check final state
    console.log("\nStep 6: Checking final page state...");
    const finalUrl = page.url();
    console.log("Final URL:", finalUrl);

    if (finalUrl.includes('/login')) {
      console.log("❌ Still on login page - login likely failed");
      console.log("\nPossible issues:");
      console.log("  1. Incorrect username or password");
      console.log("  2. Account locked or disabled");
      console.log("  3. Eversource requires additional verification");
      console.log("  4. Website structure has changed");
    } else {
      console.log("✅ Successfully navigated away from login page");
      
      // Check for MFA
      console.log("\nChecking for MFA prompt...");
      const mfaButtons = await page.locator('button:has-text("Ask Me Again Later"), button:has-text("Maybe Later"), button:has-text("Not Now")').all();
      
      if (mfaButtons.length > 0) {
        console.log(`✅ Found ${mfaButtons.length} MFA-related button(s)`);
        await page.screenshot({ path: "./debug_08_mfa_screen.png" });
      } else {
        console.log("No MFA prompt detected");
      }
    }

    await page.screenshot({ path: "./debug_09_final_state.png" });

    // Step 7: Page content analysis
    console.log("\nStep 7: Analyzing page content...");
    const title = await page.title();
    console.log("Page title:", title);
    
    // Wait before closing so user can see the browser
    console.log("\n⏳ Keeping browser open for 10 seconds for manual inspection...");
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error("\n❌ ERROR:", error.message);
    await page.screenshot({ path: "./debug_error.png" });
  } finally {
    await browser.close();
    console.log("\n" + "=".repeat(60));
    console.log("DEBUG COMPLETE");
    console.log("=".repeat(60));
    console.log("\nScreenshots saved:");
    console.log("  - debug_01_login_page.png");
    console.log("  - debug_04_credentials_filled.png");
    console.log("  - debug_06_after_signin_click.png");
    console.log("  - debug_07_after_wait.png");
    console.log("  - debug_09_final_state.png");
    console.log("\nReview these screenshots to understand what happened.");
  }
}

debugLogin();
