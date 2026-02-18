# Troubleshooting Eversource Bot Login Issues

## Common Issue: "Login navigation timeout"

If you see this error:
```
❌ Login navigation timeout
❌ Error processing Account: Login failed or navigation timeout.
```

This means the bot successfully clicked the Sign In button, but the page didn't navigate as expected within 30 seconds.

## Step-by-Step Troubleshooting

### 1. Verify Your Credentials

**First, manually test your login:**
1. Open a browser and go to https://www.eversource.com/security/account/login
2. Enter your username and password
3. Click Sign In
4. Verify you can log in successfully

If manual login fails:
- ✅ **Solution**: Update credentials in `.env` file
- Common issues: Wrong email, wrong password, account locked

### 2. Run the Debug Script

```bash
node eversource-debug.js
```

This will:
- Show you exactly what the bot is doing
- Take screenshots at each step
- Display detailed error messages
- Keep browser open for inspection

**What to look for in debug output:**

#### Scenario A: Credentials are wrong
```
⚠️ URL did not change after 30 seconds
Final URL: https://www.eversource.com/security/account/login
Error text: "Invalid username or password"
```
**Solution**: Fix credentials in `.env` file

#### Scenario B: Login successful but bot doesn't detect it
```
✅ URL changed after 5 seconds
New URL: https://www.eversource.com/
```
**Solution**: The fix in the latest version should handle this. Update to latest code.

#### Scenario C: Website structure changed
```
❌ Username field not found
```
**Solution**: The website HTML structure changed. Selectors need updating (contact developer).

#### Scenario D: Captcha or security check
If you see a captcha or security verification screen in the browser, Eversource may have:
- Detected automated access
- Flagged your account for suspicious activity
- Requires additional verification

**Solution**: 
- Try from a different IP address
- Wait 24 hours and try again
- Contact Eversource to verify account status

### 3. Check Debug Screenshots

After running `eversource-debug.js`, examine these files:

1. **debug_01_login_page.png** - Does the login page load correctly?
2. **debug_04_credentials_filled.png** - Are credentials entered correctly?
3. **debug_06_after_signin_click.png** - What happens right after clicking Sign In?
4. **debug_07_after_wait.png** - What does the page look like after waiting?
5. **debug_09_final_state.png** - Final state - success or error?

### 4. Common Fixes

#### Fix 1: Wrong URL or Website Changed
If Eversource changed their login URL, update line 95 in `eversource-bot.js`:
```javascript
await page.goto(
  "https://www.eversource.com/security/account/login",  // Update this if needed
  { waitUntil: "domcontentloaded", timeout: 60000 }
);
```

#### Fix 2: Slow Internet Connection
Increase timeout values in `eversource-bot.js` line 135:
```javascript
await page.waitForFunction(
  (loginUrl) => window.location.href !== loginUrl,
  urlBeforeClick,
  { timeout: 60000 }  // Changed from 30000 to 60000 (60 seconds)
);
```

#### Fix 3: Account Requires 2FA
If your account has two-factor authentication enabled:
1. The bot will try to click "Ask Me Again Later"
2. If this button doesn't appear, you may need to:
   - Disable 2FA on your Eversource account
   - Or manually complete 2FA the first time, then the bot can work

#### Fix 4: Network or Firewall Issues
- Check if you can access https://www.eversource.com from your computer
- Disable VPN if enabled
- Check firewall settings
- Try from a different network

### 5. Advanced Debugging

#### Enable More Verbose Logging

Edit `eversource-bot.js` and add this after line 1:
```javascript
require("dotenv").config({ debug: true });
```

#### Check for Eversource Maintenance

Visit https://www.eversource.com in your browser. If the site is down for maintenance, you'll see a maintenance page. Try again later.

#### Test with Minimal Delays

For faster debugging, reduce delays in `eversource-bot.js` (lines 101, 116, 119, 123, 126):
```javascript
await page.waitForTimeout(500);  // Reduced from 1000-2000
```

### 6. Getting Help

If none of the above works, provide this information:

1. **Output from debug script**: Copy and paste the entire console output
2. **Screenshots**: Share debug_*.png files, especially:
   - debug_06_after_signin_click.png
   - debug_09_final_state.png
3. **Account type**: Is this a residential or business account?
4. **Error messages**: Any error messages you see
5. **Manual login test**: Can you log in manually through a browser?

## Technical Details

### How Login Works

1. Navigate to login page
2. Fill in username field (`input[name="email"]`)
3. Fill in password field (`input[type="password"]`)
4. Click Sign In button (`input[type="submit"]` or button with "Sign In" text)
5. Wait for URL to change (page navigates away from /login)
6. Handle MFA prompt if present
7. Continue to scrape data

### What Changed in the Fix

**Old code** (problematic):
```javascript
await page.waitForURL('**/eversource.com/**', { timeout: 30000 });
```
This waited for ANY eversource.com URL, which might already be true before clicking.

**New code** (fixed):
```javascript
await page.waitForFunction(
  (loginUrl) => window.location.href !== loginUrl,
  urlBeforeClick,
  { timeout: 30000 }
);
```
This waits for the URL to actually CHANGE from what it was before clicking.

## Still Having Issues?

If you've tried everything above and still can't log in:

1. **Test your .env file format**:
   ```env
   EVERSOURCE_LOGIN_1_USER=your_email@example.com
   EVERSOURCE_LOGIN_1_PASS=YourPassword123
   ```
   - No quotes needed
   - No spaces around the `=`
   - Make sure file is saved as `.env` (not `.env.txt`)

2. **Verify Node.js and dependencies**:
   ```bash
   node --version  # Should be v14 or higher
   npm install     # Reinstall dependencies
   ```

3. **Try a different account**: If you have multiple Eversource accounts, try a different one

4. **Wait and retry**: Sometimes temporary issues resolve themselves after a few hours

5. **Check Eversource status**: Visit https://outagemap.eversource.com/ to see if there are known issues

## Success Indicators

You'll know login worked when you see:
```
✅ Login successful, navigated to: https://www.eversource.com/...
✅ Login complete. Current URL: https://www.eversource.com/...
```

Then the bot will continue to scrape data:
```
📊 Scraping account information...
📄 Scraping bill history...
💳 Scraping payment history...
📥 Downloading bill PDFs...
```
