# Eversource vs CNG Bot Implementation

## Overview

This repository now contains automation bots for both **CNG** and **Eversource** utility companies.

## Implementation Comparison

### CNG Bot (Original - Reference Implementation)
**Files**: `cng-login.js`, `cng-accounts.js`, `cng-config.js`

**Architecture**:
- Split into separate login and account fetching scripts
- Uses OAuth2 flow with token extraction
- Direct API calls to CNG's backend API
- Simpler authentication flow

**Data Collection**:
- Account information via API
- Bill history via API  
- Payment history via API
- PDF downloads via API endpoints

### Eversource Bot (New Implementation)
**Files**: `eversource-bot.js`, `eversource-config.js`

**Architecture**:
- Single comprehensive script
- Web scraping approach (no public API available)
- Uses Playwright for browser automation
- Handles complex MFA workflows

**Data Collection**:
- Account information via web scraping
- Bill history via web scraping
- Payment history via web scraping
- PDF downloads via browser download events

## Key Differences

| Feature | CNG Bot | Eversource Bot |
|---------|---------|----------------|
| **Data Source** | REST API | Web Scraping |
| **Authentication** | OAuth2 + API Keys | Form-based login |
| **MFA Handling** | Not needed | Automatic dismissal |
| **Reliability** | High (API is stable) | Medium (website changes can break it) |
| **Speed** | Fast (direct API calls) | Slower (browser automation) |
| **Setup Complexity** | Medium | Higher |
| **Maintenance** | Low | Higher (selectors may need updates) |

## Why Different Approaches?

1. **CNG** exposes a proper REST API that can be accessed with authentication tokens
   - More reliable and faster
   - Less prone to breaking changes
   - Better for automation

2. **Eversource** does not have a public API
   - Requires browser automation
   - Must reverse-engineer the website structure
   - Multiple fallback strategies needed for selectors
   - More fragile but only option available

## Common Features

Both bots provide:
- ✅ Multi-account support
- ✅ Account information extraction
- ✅ Bill history tracking
- ✅ Payment history tracking
- ✅ PDF download and storage
- ✅ Google Drive integration
- ✅ Google Sheets export
- ✅ Error handling and logging
- ✅ Secure credential management

## Technical Implementation Highlights

### Eversource Bot Innovations

1. **Multiple Scraping Strategies**: The bot tries multiple selector strategies to find data, making it more resilient to minor website changes.

2. **Human-like Behavior**: Includes random delays, mouse movements, and realistic typing patterns to avoid detection.

3. **Robust Download Handling**: Multiple strategies for finding and clicking download buttons, with retry logic.

4. **MFA Auto-handling**: Automatically detects and dismisses MFA setup prompts.

5. **Comprehensive Error Handling**: Screenshots on failures, detailed logging, graceful degradation.

6. **Modular Design**: Separate functions for login, account info, bills, payments, and PDFs.

## Files Structure

```
Ari/
├── package.json                  # Dependencies (Playwright, googleapis, dotenv)
├── .env.example                  # Template for environment variables
├── .gitignore                    # Prevents committing sensitive files
├── README.md                     # Main documentation
├── QUICKSTART.md                 # Setup guide for Eversource bot
│
├── CNG Bot:
│   ├── cng-login.js             # Login and token extraction
│   ├── cng-accounts.js          # Account data fetching
│   └── cng-config.js            # Login credentials
│
└── Eversource Bot:
    ├── eversource-bot.js        # Main bot implementation (all-in-one)
    └── eversource-config.js     # Configuration with validation
```

## Data Output Schema

### Accounts Sheet
Both bots export similar account data:
- Account name/identifier
- Account number
- Service address
- Current balance
- Due date
- Last bill amount

### Bills Sheet
Both bots export bill history:
- Account name
- Bill date
- Bill amount
- Due date
- Status/Type

### Payments Sheet
Both bots export payment history:
- Account name
- Payment date
- Payment amount
- Status
- Confirmation code

### PDFs Sheet (Eversource only)
Additional tracking for downloaded PDFs:
- Account name
- Document key
- File name
- Google Drive link
- Upload timestamp

## Future Improvements

### For Eversource Bot:
1. **Selector Updates**: Website changes will require updating CSS selectors
2. **Enhanced Data Extraction**: More intelligent parsing of bill/payment details
3. **Parallel Processing**: Process multiple accounts simultaneously
4. **Captcha Handling**: Add support if Eversource implements captchas
5. **Notification System**: Alert on balance changes or new bills

### General:
1. **Unified Interface**: Create a common interface for both bots
2. **Scheduling**: Add cron job support for automated runs
3. **Dashboard**: Web interface to view aggregated data
4. **Alerts**: Email/SMS notifications for important events

## Maintenance Notes

### CNG Bot
- Low maintenance required
- API changes are rare
- Token/credential updates as needed

### Eversource Bot  
- **Monitor for website changes** - Eversource may update their website
- **Test regularly** - Run monthly to catch breaking changes early
- **Update selectors** - If scraping fails, selectors may need adjustment
- **Browser updates** - Keep Playwright updated for latest Chrome

## Security Considerations

Both bots follow security best practices:
- ✅ Credentials stored in `.env` (not committed)
- ✅ Service account keys in `.gitignore`
- ✅ No hardcoded sensitive data
- ✅ HTTPS for all connections
- ✅ Minimal credential exposure
- ✅ Passed CodeQL security analysis

## Testing

Since these bots require real credentials:
1. Test with a single account first
2. Verify data appears in Google Sheets
3. Check PDFs are uploaded to Drive
4. Review console output for errors
5. Gradually add more accounts

## Conclusion

The Eversource bot successfully replicates the CNG bot's functionality using web scraping instead of API calls. While it requires more maintenance, it provides the same valuable data collection and export capabilities for Eversource accounts.
