# Utility Automation Bots

This repository contains automation bots for scraping utility account information, bills, and payments.

## Features

### CNG Bot
- Login to multiple CNG accounts
- Fetch account information
- Download bill PDFs
- Track payment history
- Upload to Google Drive
- Export data to Google Sheets

### Eversource Bot
- Login to multiple Eversource accounts with MFA handling
- Scrape account information
- Download bill history and PDFs
- Track payment history
- Upload PDFs to Google Drive
- Export all data to Google Sheets

## Setup

### Prerequisites
- Node.js (v14 or higher)
- Google Cloud credentials (for Sheets and Drive API)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/NovaManage/Ari.git
cd Ari
```

2. Install dependencies:
```bash
npm install
```

3. Set up Google credentials:
   - Create a Google Cloud project
   - Enable Google Sheets API and Google Drive API
   - Create a service account and download the credentials JSON file
   - Rename it to `credentials.google-key.json` and place it in the root directory

4. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Fill in your Eversource login credentials
   - Add your Google Sheet ID and Drive Folder ID

```bash
cp .env.example .env
# Edit .env with your credentials
```

## Usage

### Running the CNG Bot

```bash
node cng-login.js
node cng-accounts.js
```

### Running the Eversource Bot

```bash
node eversource-bot.js
```

**Debug mode** (if experiencing issues):
```bash
node eversource-debug.js
```
The debug script runs with a visible browser, takes screenshots at each step, and provides detailed logging.

## Configuration

### CNG Configuration
Edit `cng-config.js` to add/modify CNG login accounts:

```javascript
module.exports = [
  {
    name: "AccountName",
    username: "username",
    password: "password"
  }
];
```

### Eversource Configuration
Set environment variables in `.env` file:

```
EVERSOURCE_LOGIN_1_USER=email@example.com
EVERSOURCE_LOGIN_1_PASS=password123
EVERSOURCE_LOGIN_2_USER=another@example.com
EVERSOURCE_LOGIN_2_PASS=password456
```

### Google Sheets Configuration
The bot will create/update the following sheets:
- `Eversource_Accounts` - Account information
- `Eversource_Bills` - Bill history
- `Eversource_Payments` - Payment history
- `Eversource_PDFs` - PDF download tracking with Drive links

## Output

### PDFs
Downloaded bill PDFs are saved to:
- CNG: `./cng_pdfs/`
- Eversource: `./eversource_pdfs/`

### Google Drive
PDFs are automatically uploaded to the configured Google Drive folder.

### Google Sheets
All data is written to the configured Google Sheet with separate tabs for accounts, bills, and payments.

## Troubleshooting

### Login Issues
- Ensure credentials are correct
- Check if the website has added new security measures
- Review screenshots saved in `/tmp/` directory on failures

**For detailed troubleshooting steps, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md)**

**Quick debug**: Run `node eversource-debug.js` to see exactly what's happening during login.

### MFA Issues
The Eversource bot handles "Ask Me Again Later" prompts automatically. If you encounter issues:
- Check the console output for MFA-related messages
- The bot will try to dismiss common MFA prompts

### PDF Download Issues
- Ensure sufficient disk space
- Check that the PDF folder has write permissions
- Review console output for specific error messages

## Security Notes

- Never commit your `.env` file or `credentials.google-key.json` to version control
- Store credentials securely
- Use environment variables for sensitive data
- Regularly rotate passwords and API keys

## License

This is a private utility automation tool. Use responsibly and in accordance with the terms of service of the respective utility companies.
