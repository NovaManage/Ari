const { chromium } = require("playwright");
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
const { EVERSOURCE_LOGINS, GOOGLE_CONFIG } = require("./eversource-config");

const PDF_FOLDER = "./eversource_pdfs";

// ================= GOOGLE SHEETS/DRIVE SETUP =================

async function getGoogleClients() {
  const auth = new google.auth.GoogleAuth({
    keyFile: GOOGLE_CONFIG.keyFile,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive"
    ]
  });

  const authClient = await auth.getClient();
  
  return {
    sheets: google.sheets({ version: "v4", auth: authClient }),
    drive: google.drive({ version: "v3", auth: authClient })
  };
}

async function writeToSheet(sheets, sheetName, rows) {
  console.log(`\n🧾 Writing to sheet: ${sheetName}`);
  console.log("Rows:", rows.length);

  if (!rows || rows.length === 0) {
    console.log(`⚠️ No data for ${sheetName}`);
    return;
  }

  // Clear old data first
  try {
    await sheets.spreadsheets.values.clear({
      spreadsheetId: GOOGLE_CONFIG.sheetId,
      range: `${sheetName}!A2:Z`
    });
  } catch (e) {
    console.log(`Note: Could not clear ${sheetName}, may not exist yet`);
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId: GOOGLE_CONFIG.sheetId,
    range: `${sheetName}!A2`,
    valueInputOption: "RAW",
    requestBody: { values: rows }
  });

  console.log(`✅ Updated sheet: ${sheetName}`);
}

async function uploadPdfToDrive(drive, filePath, fileName) {
  // Check if file already exists
  const existing = await drive.files.list({
    q: `name='${fileName}' and '${GOOGLE_CONFIG.driveFolder}' in parents and trashed=false`,
    fields: "files(id,name)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  });

  if (existing.data.files.length > 0) {
    console.log(`⏭ Drive file already exists: ${fileName}`);
    return existing.data.files[0].id;
  }

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [GOOGLE_CONFIG.driveFolder]
    },
    media: {
      mimeType: "application/pdf",
      body: fs.createReadStream(filePath)
    },
    supportsAllDrives: true
  });

  return res.data.id;
}

// ================= EVERSOURCE LOGIN =================

async function loginEversource(page, username, password) {
  console.log("🔐 Navigating to Eversource login page...");

  await page.goto(
    "https://www.eversource.com/security/account/login",
    { waitUntil: "domcontentloaded", timeout: 60000 }
  );

  // Wait for page to stabilize
  await page.waitForTimeout(1000 + Math.random() * 1000);

  // Human-like mouse movement
  await page.mouse.move(
    300 + Math.random() * 200,
    400 + Math.random() * 200
  );

  const usernameField = page.locator('input[name="email"]');
  const passwordField = page.locator('input[type="password"]');

  await usernameField.waitFor({ state: "visible", timeout: 30000 });

  console.log("⌨️ Filling username...");
  await usernameField.click();
  await page.waitForTimeout(300 + Math.random() * 300);
  await usernameField.fill(username);

  await page.waitForTimeout(700 + Math.random() * 500);

  console.log("⌨️ Filling password...");
  await passwordField.click();
  await page.waitForTimeout(300 + Math.random() * 300);
  await passwordField.fill(password);

  await page.waitForTimeout(900 + Math.random() * 600);

  const signInBtn = page.locator('input[type="submit"], button:has-text("Sign In")').first();

  console.log("🖱 Clicking Sign In...");
  await signInBtn.click();

  // Wait for navigation after login
  try {
    await page.waitForURL('**/eversource.com/**', { timeout: 30000 });
    console.log("✅ Login successful, navigated to:", page.url());
  } catch (error) {
    console.error("❌ Login navigation timeout");
    await page.screenshot({ path: '/tmp/eversource_login_fail.png' });
    throw new Error("Login failed or navigation timeout.");
  }

  // Handle MFA screen if it appears
  try {
    const askLaterBtn = page.locator('button:has-text("Ask Me Again Later"), button:has-text("Maybe Later"), button:has-text("Not Now")').first();
    
    await askLaterBtn.waitFor({ state: 'visible', timeout: 10000 });
    
    console.log("🔐 MFA screen detected, dismissing...");
    await page.waitForTimeout(600 + Math.random() * 600);
    await askLaterBtn.click({ force: true });
    await page.waitForTimeout(2000);
    console.log("✅ MFA dismissed.");
  } catch (e) {
    console.log("No MFA screen detected (or already dismissed).");
  }

  console.log("✅ Login complete. Current URL:", page.url());
}

// ================= SCRAPE ACCOUNT DATA =================

async function scrapeAccountInfo(page, accountName) {
  console.log("\n📊 Scraping account information...");
  
  // Navigate to account overview
  try {
    await page.goto("https://www.eversource.com/residential/my-account/account-summary", {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });
    
    await page.waitForTimeout(5000);
    
    // Try to extract account information from the page
    const accountData = {
      accountName: accountName,
      accountNumber: "",
      serviceAddress: "",
      balance: "",
      dueDate: "",
      lastBillAmount: ""
    };
    
    // Try multiple strategies to extract account number
    try {
      // Strategy 1: Look for text with "Account" followed by numbers
      let accNumElement = await page.locator('text=/Account[:\s#]*\d{10,}/i').first();
      let accText = await accNumElement.textContent({ timeout: 5000 });
      let match = accText.match(/\d{10,}/);
      if (match) accountData.accountNumber = match[0];
    } catch (e) {
      try {
        // Strategy 2: Look for element with account number class
        let accNumElement = await page.locator('[class*="account-number"], [class*="accountNumber"]').first();
        let accText = await accNumElement.textContent({ timeout: 5000 });
        let match = accText.match(/\d{10,}/);
        if (match) accountData.accountNumber = match[0];
      } catch (e2) {
        console.log("Could not extract account number");
      }
    }
    
    // Try to extract balance
    try {
      // Look for balance amount - typically prominently displayed
      const balanceElement = await page.locator('[class*="balance"], [class*="amount-due"]:has-text("$")').first();
      const balanceText = await balanceElement.textContent({ timeout: 5000 });
      const balanceMatch = balanceText.match(/\$[\d,]+\.\d{2}/);
      if (balanceMatch) accountData.balance = balanceMatch[0];
    } catch (e) {
      try {
        // Alternative: Look for any prominent dollar amount
        const balanceElement = await page.locator('text=/Balance.*\$[\d,]+\.\d{2}/i, text=/Amount Due.*\$[\d,]+\.\d{2}/i').first();
        const balanceText = await balanceElement.textContent({ timeout: 5000 });
        const balanceMatch = balanceText.match(/\$[\d,]+\.\d{2}/);
        if (balanceMatch) accountData.balance = balanceMatch[0];
      } catch (e2) {
        console.log("Could not extract balance");
      }
    }
    
    // Try to extract due date
    try {
      const dueDateElement = await page.locator('text=/Due.*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/i').first();
      const dueDateText = await dueDateElement.textContent({ timeout: 5000 });
      const dateMatch = dueDateText.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/);
      if (dateMatch) accountData.dueDate = dateMatch[0];
    } catch (e) {
      console.log("Could not extract due date");
    }
    
    // Try to extract service address
    try {
      const addressElement = await page.locator('[class*="address"], [class*="service-address"]').first();
      const addressText = await addressElement.textContent({ timeout: 5000 });
      accountData.serviceAddress = addressText.trim().substring(0, 100); // Limit length
    } catch (e) {
      console.log("Could not extract service address");
    }
    
    // Try to extract last bill amount
    try {
      const billElement = await page.locator('text=/Last Bill.*\$[\d,]+\.\d{2}/i, text=/Previous Bill.*\$[\d,]+\.\d{2}/i').first();
      const billText = await billElement.textContent({ timeout: 5000 });
      const amountMatch = billText.match(/\$[\d,]+\.\d{2}/);
      if (amountMatch) accountData.lastBillAmount = amountMatch[0];
    } catch (e) {
      console.log("Could not extract last bill amount");
    }
    
    console.log("✅ Account info extracted:", accountData);
    return accountData;
    
  } catch (error) {
    console.error("❌ Error scraping account info:", error.message);
    await page.screenshot({ path: '/tmp/eversource_account_error.png' }).catch(() => {});
    
    return {
      accountName: accountName,
      accountNumber: "N/A",
      serviceAddress: "N/A",
      balance: "N/A",
      dueDate: "N/A",
      lastBillAmount: "N/A"
    };
  }
}

// ================= SCRAPE BILLS =================

async function scrapeBills(page, accountName) {
  console.log("\n📄 Scraping bill history...");
  
  const bills = [];
  
  try {
    await page.goto(
      "https://www.eversource.com/residential/account-billing/past-bills-payments",
      { waitUntil: "domcontentloaded", timeout: 60000 }
    );
    
    await page.waitForTimeout(5000);
    
    // Wait for the page to fully load
    try {
      await page.waitForSelector('div:has-text("Billing History"), h2:has-text("Billing History"), h3:has-text("Billing History")', { timeout: 20000 });
      console.log("✅ Found Billing History section");
    } catch (e) {
      console.log("⚠️ Could not find Billing History section, trying alternative approach");
    }
    
    // Try multiple selector strategies for bill rows
    let billElements = [];
    
    // Strategy 1: Look for rows in a table
    billElements = await page.locator('table tr:has-text("$")').all();
    
    if (billElements.length === 0) {
      // Strategy 2: Look for div containers with bill data
      billElements = await page.locator('div[class*="bill"], div[class*="row"]:has-text("$")').all();
    }
    
    if (billElements.length === 0) {
      // Strategy 3: Look for any container with date and amount patterns
      billElements = await page.locator('[class*="history"] > *, [class*="billing"] > *').all();
    }
    
    console.log(`Found ${billElements.length} potential bill elements`);
    
    for (let i = 0; i < Math.min(billElements.length, 24); i++) {
      try {
        const element = billElements[i];
        const text = await element.textContent();
        
        // Skip if no meaningful content
        if (!text || text.trim().length < 5) continue;
        
        // Extract bill information from text
        const billData = {
          accountName: accountName,
          billDate: "",
          amount: "",
          dueDate: "",
          status: "Posted"
        };
        
        // Try to find dollar amounts
        const amounts = text.match(/\$[\d,]+\.\d{2}/g);
        if (amounts && amounts.length > 0) {
          billData.amount = amounts[0];
        } else {
          continue; // Skip if no amount found
        }
        
        // Try to find dates (various formats)
        const dateMatches = text.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g);
        if (dateMatches && dateMatches.length > 0) {
          billData.billDate = dateMatches[0];
          if (dateMatches.length > 1) {
            billData.dueDate = dateMatches[1];
          }
        }
        
        // Only add if we have at least an amount
        if (billData.amount) {
          bills.push(billData);
        }
      } catch (e) {
        console.log(`Error processing bill ${i}:`, e.message);
      }
    }
    
    console.log(`✅ Extracted ${bills.length} bills`);
    
  } catch (error) {
    console.error("❌ Error scraping bills:", error.message);
  }
  
  return bills;
}

// ================= DOWNLOAD BILL PDFs =================

async function downloadBillPdfs(page, accountName) {
  console.log("\n📥 Downloading bill PDFs...");
  
  const downloadedFiles = [];
  
  try {
    await page.goto(
      "https://www.eversource.com/residential/account-billing/past-bills-payments",
      { waitUntil: "domcontentloaded", timeout: 60000 }
    );
    
    await page.waitForTimeout(5000);
    
    // Create PDF folder if it doesn't exist
    if (!fs.existsSync(PDF_FOLDER)) {
      fs.mkdirSync(PDF_FOLDER, { recursive: true });
    }
    
    // Try multiple strategies to find download buttons
    let viewButtons = [];
    
    // Strategy 1: Look for buttons with "View Bill" text
    viewButtons = await page.locator('button:has-text("View Bill"), a:has-text("View Bill")').all();
    
    if (viewButtons.length === 0) {
      // Strategy 2: Look for buttons with "View" text  
      viewButtons = await page.locator('button:has-text("View"), a:has-text("View")').all();
    }
    
    if (viewButtons.length === 0) {
      // Strategy 3: Look for buttons with data-url attribute
      viewButtons = await page.locator('button[data-url*="DocID"], a[href*="DocID"]').all();
    }
    
    if (viewButtons.length === 0) {
      // Strategy 4: Look for PDF links
      viewButtons = await page.locator('a[href*=".pdf"], button[onclick*="pdf"]').all();
    }
    
    console.log(`Found ${viewButtons.length} view/download buttons`);
    
    if (viewButtons.length === 0) {
      console.log("⚠️ No bill download buttons found");
      return downloadedFiles;
    }
    
    // Process each button
    for (let i = 0; i < Math.min(viewButtons.length, 24); i++) {
      try {
        const button = viewButtons[i];
        
        // Try to extract a document identifier
        let docKey = `bill_${Date.now()}_${i + 1}`;
        
        // Check for data-url attribute
        const dataUrl = await button.getAttribute('data-url').catch(() => null);
        if (dataUrl) {
          const match = dataUrl.match(/DocID=([^&]+)/i);
          if (match) docKey = match[1];
        }
        
        // Check for href attribute
        const href = await button.getAttribute('href').catch(() => null);
        if (href && href.includes('DocID')) {
          const match = href.match(/DocID=([^&]+)/i);
          if (match) docKey = match[1];
        }
        
        const fileName = `Eversource_${accountName.replace(/[^a-zA-Z0-9]/g, '_')}_${docKey}.pdf`;
        const filePath = path.join(PDF_FOLDER, fileName);
        
        // Skip if already downloaded
        if (fs.existsSync(filePath)) {
          console.log(`⏭ PDF already exists: ${fileName}`);
          downloadedFiles.push({ fileName, filePath, docKey });
          continue;
        }
        
        console.log(`⬇ Downloading bill ${i + 1}/${viewButtons.length}...`);
        
        try {
          // Set up download listener with timeout
          const downloadPromise = page.waitForEvent('download', { timeout: 45000 });
          
          // Click the button - try multiple strategies
          try {
            await button.click({ timeout: 5000 });
          } catch (clickError) {
            // If normal click fails, try force click
            await button.click({ force: true, timeout: 5000 });
          }
          
          // Wait for download
          const download = await downloadPromise;
          
          // Save the file
          await download.saveAs(filePath);
          
          // Verify file was saved
          if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            if (stats.size > 0) {
              console.log(`✅ Downloaded: ${fileName} (${stats.size} bytes)`);
              downloadedFiles.push({ fileName, filePath, docKey });
            } else {
              console.log(`⚠️ Downloaded file is empty: ${fileName}`);
              fs.unlinkSync(filePath);
            }
          } else {
            console.log(`⚠️ File not found after download: ${fileName}`);
          }
          
          // Delay between downloads to avoid rate limiting
          await page.waitForTimeout(2000 + Math.random() * 1000);
          
        } catch (downloadError) {
          console.log(`❌ Download failed for bill ${i + 1}:`, downloadError.message);
          
          // Try to go back to the bills page if we navigated away
          if (!page.url().includes('past-bills-payments')) {
            await page.goto(
              "https://www.eversource.com/residential/account-billing/past-bills-payments",
              { waitUntil: "domcontentloaded", timeout: 30000 }
            );
            await page.waitForTimeout(3000);
            
            // Re-fetch buttons after navigation
            if (viewButtons.length > i + 1) {
              viewButtons = await page.locator('button:has-text("View Bill"), a:has-text("View Bill"), button:has-text("View")').all();
            }
          }
        }
        
      } catch (e) {
        console.log(`❌ Error processing bill ${i + 1}:`, e.message);
      }
    }
    
    console.log(`✅ Successfully downloaded ${downloadedFiles.length} PDFs`);
    
  } catch (error) {
    console.error("❌ Error in PDF download process:", error.message);
    await page.screenshot({ path: '/tmp/eversource_pdf_error.png' }).catch(() => {});
  }
  
  return downloadedFiles;
}

// ================= SCRAPE PAYMENTS =================

async function scrapePayments(page, accountName) {
  console.log("\n💳 Scraping payment history...");
  
  const payments = [];
  
  try {
    // Check if we're already on the past bills page
    if (!page.url().includes('past-bills-payments')) {
      await page.goto(
        "https://www.eversource.com/residential/account-billing/past-bills-payments",
        { waitUntil: "domcontentloaded", timeout: 60000 }
      );
      await page.waitForTimeout(5000);
    }
    
    // Look for payment history section
    try {
      await page.waitForSelector('text=/Payment History/i, h2:has-text("Payment"), h3:has-text("Payment")', { timeout: 15000 });
      console.log("✅ Found Payment History section");
    } catch (e) {
      console.log("⚠️ Could not find Payment History section, trying alternative approach");
    }
    
    // Try multiple strategies to find payment elements
    let paymentElements = [];
    
    // Strategy 1: Look for table rows with payment data
    paymentElements = await page.locator('table tr:has-text("Payment"), table tr:has-text("Paid")').all();
    
    if (paymentElements.length === 0) {
      // Strategy 2: Look for div containers with payment class
      paymentElements = await page.locator('div[class*="payment"], div[class*="transaction"]').all();
    }
    
    if (paymentElements.length === 0) {
      // Strategy 3: Look for any element containing payment-related text and amount
      paymentElements = await page.locator('[class*="history"] div:has-text("$")').all();
    }
    
    console.log(`Found ${paymentElements.length} potential payment elements`);
    
    for (let i = 0; i < Math.min(paymentElements.length, 36); i++) {
      try {
        const element = paymentElements[i];
        const text = await element.textContent();
        
        // Skip if no meaningful content
        if (!text || text.trim().length < 5) continue;
        
        // Look for payment indicators
        if (!text.toLowerCase().includes('payment') && 
            !text.toLowerCase().includes('paid') && 
            !text.match(/\$[\d,]+\.\d{2}/)) {
          continue;
        }
        
        const paymentData = {
          accountName: accountName,
          paymentDate: "",
          amount: "",
          status: "Completed",
          confirmationCode: ""
        };
        
        // Extract amount
        const amounts = text.match(/\$[\d,]+\.\d{2}/g);
        if (amounts && amounts.length > 0) {
          paymentData.amount = amounts[0];
        } else {
          continue; // Skip if no amount found
        }
        
        // Extract date
        const dateMatches = text.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g);
        if (dateMatches && dateMatches.length > 0) {
          paymentData.paymentDate = dateMatches[0];
        }
        
        // Try to extract confirmation/reference number
        const confMatch = text.match(/(?:Confirmation|Reference|Ref)[:\s#]*([A-Z0-9]{6,})/i);
        if (confMatch) {
          paymentData.confirmationCode = confMatch[1];
        }
        
        // Determine status from text
        if (text.toLowerCase().includes('pending')) {
          paymentData.status = "Pending";
        } else if (text.toLowerCase().includes('failed')) {
          paymentData.status = "Failed";
        }
        
        // Only add if we have an amount
        if (paymentData.amount) {
          payments.push(paymentData);
        }
      } catch (e) {
        console.log(`Error processing payment ${i}:`, e.message);
      }
    }
    
    console.log(`✅ Extracted ${payments.length} payments`);
    
  } catch (error) {
    console.error("❌ Error scraping payments:", error.message);
  }
  
  return payments;
}

// ================= MAIN ORCHESTRATION =================

async function processAccount(browser, account, sheets, drive) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Processing account: ${account.name} (${account.username})`);
  console.log("=".repeat(60));
  
  const context = await browser.newContext({
    viewport: null,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  });
  
  const page = await context.newPage();
  
  const accountRows = [];
  const billRows = [];
  const paymentRows = [];
  
  try {
    // Step 1: Login
    await loginEversource(page, account.username, account.password);
    
    // Step 2: Scrape account information
    const accountInfo = await scrapeAccountInfo(page, account.name);
    accountRows.push([
      accountInfo.accountName,
      accountInfo.accountNumber,
      accountInfo.serviceAddress,
      accountInfo.balance,
      accountInfo.dueDate,
      accountInfo.lastBillAmount
    ]);
    
    // Step 3: Scrape bills
    const bills = await scrapeBills(page, account.name);
    for (const bill of bills) {
      billRows.push([
        bill.accountName,
        bill.billDate,
        bill.amount,
        bill.dueDate,
        bill.status
      ]);
    }
    
    // Step 4: Download bill PDFs
    const downloadedPdfs = await downloadBillPdfs(page, account.name);
    
    // Upload PDFs to Drive
    for (const pdf of downloadedPdfs) {
      try {
        console.log(`📤 Uploading ${pdf.fileName} to Drive...`);
        const driveId = await uploadPdfToDrive(drive, pdf.filePath, pdf.fileName);
        const driveUrl = driveId ? `https://drive.google.com/file/d/${driveId}/view` : "";
        
        // Add PDF info to bill rows
        billRows.push([
          account.name,
          pdf.docKey,
          pdf.fileName,
          driveUrl
        ]);
        
        console.log(`✅ Uploaded to Drive: ${pdf.fileName}`);
      } catch (e) {
        console.error(`Error uploading ${pdf.fileName}:`, e.message);
      }
    }
    
    // Step 5: Scrape payments
    const payments = await scrapePayments(page, account.name);
    for (const payment of payments) {
      paymentRows.push([
        payment.accountName,
        payment.paymentDate,
        payment.amount,
        payment.status,
        payment.confirmationCode
      ]);
    }
    
    console.log(`\n✅ Completed processing ${account.name}`);
    
    // Return data for this account
    return { accountRows, billRows, paymentRows };
    
  } catch (error) {
    console.error(`❌ Error processing ${account.name}:`, error.message);
    return { accountRows: [], billRows: [], paymentRows: [] };
  } finally {
    await context.close();
  }
}

// ================= MAIN ENTRY POINT =================

(async () => {
  console.log("\n" + "=".repeat(60));
  console.log("EVERSOURCE BOT STARTED");
  console.log("=".repeat(60) + "\n");
  
  if (EVERSOURCE_LOGINS.length === 0) {
    console.error("❌ No Eversource login accounts configured!");
    console.error("Please set environment variables: EVERSOURCE_LOGIN_1_USER, EVERSOURCE_LOGIN_1_PASS, etc.");
    process.exit(1);
  }
  
  console.log(`Found ${EVERSOURCE_LOGINS.length} configured account(s)`);
  
  const { sheets, drive } = await getGoogleClients();
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 50
  });
  
  // Aggregate data from all accounts
  const allAccountRows = [];
  const allBillRows = [];
  const allPaymentRows = [];
  
  for (const account of EVERSOURCE_LOGINS) {
    try {
      const result = await processAccount(browser, account, sheets, drive);
      
      allAccountRows.push(...result.accountRows);
      allBillRows.push(...result.billRows);
      allPaymentRows.push(...result.paymentRows);
      
    } catch (error) {
      console.error(`❌ Fatal error for ${account.name}:`, error.message);
    }
  }
  
  // Write all data to Google Sheets
  console.log("\n" + "=".repeat(60));
  console.log("WRITING DATA TO GOOGLE SHEETS");
  console.log("=".repeat(60));
  
  await writeToSheet(sheets, "Eversource_Accounts", allAccountRows);
  await writeToSheet(sheets, "Eversource_Bills", allBillRows);
  await writeToSheet(sheets, "Eversource_Payments", allPaymentRows);
  
  await browser.close();
  
  console.log("\n" + "=".repeat(60));
  console.log("EVERSOURCE BOT FINISHED");
  console.log("=".repeat(60) + "\n");
})();
