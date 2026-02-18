# Quick Start Guide - Eversource Bot

## Initial Setup (One-Time)

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Google Cloud Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable these APIs:
   - Google Sheets API
   - Google Drive API
4. Create a Service Account:
   - Go to "IAM & Admin" > "Service Accounts"
   - Click "Create Service Account"
   - Give it a name (e.g., "Eversource Bot")
   - Grant it the "Editor" role
   - Click "Done"
5. Create credentials:
   - Click on the service account you just created
   - Go to "Keys" tab
   - Click "Add Key" > "Create new key"
   - Choose "JSON" format
   - Download the file
6. Rename the downloaded file to `credentials.google-key.json` and place it in the project root

### 3. Set Up Google Sheet

1. Create a new Google Sheet
2. Share it with your service account email (found in the JSON file, looks like `xxx@xxx.iam.gserviceaccount.com`)
3. Give it "Editor" permissions
4. Copy the Sheet ID from the URL:
   - URL format: `https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit`
   - Copy only the `{SHEET_ID}` part

### 4. Set Up Google Drive Folder

1. Create a folder in Google Drive for PDF storage
2. Share it with your service account email
3. Give it "Editor" permissions
4. Copy the Folder ID from the URL:
   - URL format: `https://drive.google.com/drive/folders/{FOLDER_ID}`
   - Copy only the `{FOLDER_ID}` part

### 5. Configure Environment Variables

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` file with your actual credentials:
```env
# Eversource Login Credentials (add as many as needed)
EVERSOURCE_LOGIN_1_USER=your_email@example.com
EVERSOURCE_LOGIN_1_PASS=your_password

EVERSOURCE_LOGIN_2_USER=another_email@example.com
EVERSOURCE_LOGIN_2_PASS=another_password

# Google Configuration (required)
GOOGLE_SHEET_ID=your_sheet_id_from_step3
GOOGLE_DRIVE_FOLDER_ID=your_folder_id_from_step4
```

## Running the Bot

```bash
node eversource-bot.js
```

### Debug Mode

If you're experiencing login issues, use the debug script to see exactly what's happening:

```bash
node eversource-debug.js
```

This will:
- Run with visible browser (non-headless)
- Take screenshots at each step
- Show detailed console output
- Check for error messages
- Keep browser open for 10 seconds at the end for manual inspection

Screenshots will be saved as `debug_01_login_page.png`, `debug_04_credentials_filled.png`, etc.

## What the Bot Does

1. **Logs in** to each configured Eversource account
2. **Handles MFA** prompts automatically (clicks "Ask Me Again Later")
3. **Scrapes Account Info**:
   - Account number
   - Service address
   - Current balance
   - Due date
   - Last bill amount
4. **Scrapes Bill History**:
   - Bill dates
   - Bill amounts
   - Due dates
   - Status
5. **Downloads Bill PDFs**:
   - Saves to `./eversource_pdfs/` folder
   - Uploads to Google Drive
6. **Scrapes Payment History**:
   - Payment dates
   - Payment amounts
   - Payment status
   - Confirmation codes
7. **Exports to Google Sheets**:
   - Eversource_Accounts sheet
   - Eversource_Bills sheet
   - Eversource_Payments sheet
   - Eversource_PDFs sheet (with Drive links)

## Output Locations

- **Local PDFs**: `./eversource_pdfs/`
- **Google Drive**: Your configured Drive folder
- **Google Sheets**: Your configured spreadsheet with 4 tabs

## Troubleshooting

### Bot won't start
- Check that all environment variables are set in `.env`
- Verify `credentials.google-key.json` exists in the root folder

### Login fails
- Verify credentials are correct in `.env`
- Check if Eversource website is accessible
- Look for screenshot in `/tmp/eversource_login_fail.png`

### No data scraped
- The bot will still complete even if data extraction fails
- Check console output for specific error messages
- Eversource website structure may have changed (selectors need updating)

### PDFs not downloading
- Ensure you have write permissions in the project folder
- Check console output for specific download errors
- Some bills may not have PDFs available

### Google Sheets errors
- Verify the service account has edit access to your sheet
- Check that GOOGLE_SHEET_ID is correct
- Ensure Google Sheets API is enabled in your project

### Google Drive errors
- Verify the service account has edit access to your folder
- Check that GOOGLE_DRIVE_FOLDER_ID is correct
- Ensure Google Drive API is enabled in your project

## Running in Headless Mode

By default, the bot runs with a visible browser (`headless: false`) so you can see what it's doing. To run in headless mode:

Edit `eversource-bot.js` line ~740:
```javascript
const browser = await chromium.launch({ 
  headless: true,  // Change to true
  slowMo: 50
});
```

## Security Notes

⚠️ **IMPORTANT**: Never commit your `.env` file or `credentials.google-key.json` to version control!

The `.gitignore` file is already configured to prevent this, but double-check before pushing.

## Support

If you encounter issues:
1. Check console output for error messages
2. Look for debug screenshots in `/tmp/`
3. Verify all credentials and permissions
4. Ensure Eversource website hasn't changed their layout
