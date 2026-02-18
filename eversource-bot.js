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
    
    await page.waitForTimeout(3000);
    
    // Try to extract account information from the page
    const accountData = {
      accountName: accountName,
      accountNumber: "",
      serviceAddress: "",
      balance: "",
      dueDate: "",
      lastBillAmount: ""
    };
    
    // Try to extract account number
    try {
      const accNumElement = await page.locator('text=/Account.*\\d{10,}/i').first();
      const accText = await accNumElement.textContent({ timeout: 5000 });
      const match = accText.match(/\d{10,}/);
      if (match) accountData.accountNumber = match[0];
    } catch (e) {
      console.log("Could not extract account number");
    }
    
    // Try to extract balance
    try {
      const balanceElement = await page.locator('text=/\\$[\\d,]+\\.\\d{2}/').first();
      accountData.balance = await balanceElement.textContent({ timeout: 5000 });
    } catch (e) {
      console.log("Could not extract balance");
    }
    
    console.log("✅ Account info extracted:", accountData);
    return accountData;
    
  } catch (error) {
    console.error("❌ Error scraping account info:", error.message);
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
    
    await page.waitForTimeout(3000);
    
    // Wait for billing history section
    try {
      await page.waitForSelector('text=/Billing History/i', { timeout: 15000 });
    } catch (e) {
      console.log("Could not find Billing History section");
      return bills;
    }
    
    // Look for bill rows/entries
    // Eversource typically shows bills in a table or list format
    const billElements = await page.locator('.bill-row, tr:has-text("$"), div:has-text("Bill Date")').all();
    
    console.log(`Found ${billElements.length} potential bill elements`);
    
    for (let i = 0; i < Math.min(billElements.length, 12); i++) {
      try {
        const element = billElements[i];
        const text = await element.textContent();
        
        // Extract bill information from text
        const billData = {
          accountName: accountName,
          billDate: "",
          amount: "",
          dueDate: "",
          status: "N/A"
        };
        
        // Try to find dollar amounts
        const amountMatch = text.match(/\$[\d,]+\.\d{2}/);
        if (amountMatch) billData.amount = amountMatch[0];
        
        // Try to find dates (MM/DD/YYYY or similar formats)
        const dateMatch = text.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/);
        if (dateMatch) billData.billDate = dateMatch[0];
        
        bills.push(billData);
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
    
    await page.waitForTimeout(3000);
    
    // Create PDF folder if it doesn't exist
    if (!fs.existsSync(PDF_FOLDER)) {
      fs.mkdirSync(PDF_FOLDER, { recursive: true });
    }
    
    // Look for "View Bill" buttons or PDF download links
    const viewButtons = await page.locator('button:has-text("View Bill"), button:has-text("View"), a:has-text("View Bill")').all();
    
    console.log(`Found ${viewButtons.length} view/download buttons`);
    
    for (let i = 0; i < Math.min(viewButtons.length, 12); i++) {
      try {
        const button = viewButtons[i];
        
        // Check for data-url attribute
        const dataUrl = await button.getAttribute('data-url');
        let docKey = `bill_${i + 1}`;
        
        if (dataUrl) {
          const match = dataUrl.match(/DocID=([^&]+)/i);
          if (match) docKey = match[1];
        }
        
        const fileName = `Eversource_${accountName}_${docKey}.pdf`;
        const filePath = path.join(PDF_FOLDER, fileName);
        
        // Skip if already downloaded
        if (fs.existsSync(filePath)) {
          console.log(`⏭ PDF already exists: ${fileName}`);
          downloadedFiles.push({ fileName, filePath, docKey });
          continue;
        }
        
        console.log(`⬇ Downloading bill ${i + 1}/${viewButtons.length}...`);
        
        // Set up download listener
        const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
        
        // Click the button
        await button.click();
        
        // Wait for download
        const download = await downloadPromise;
        
        // Save the file
        await download.saveAs(filePath);
        
        console.log(`✅ Downloaded: ${fileName}`);
        
        downloadedFiles.push({ fileName, filePath, docKey });
        
        // Small delay between downloads
        await page.waitForTimeout(1000);
        
      } catch (e) {
        console.log(`Error downloading bill ${i + 1}:`, e.message);
      }
    }
    
    console.log(`✅ Downloaded ${downloadedFiles.length} PDFs`);
    
  } catch (error) {
    console.error("❌ Error downloading PDFs:", error.message);
  }
  
  return downloadedFiles;
}

// ================= SCRAPE PAYMENTS =================

async function scrapePayments(page, accountName) {
  console.log("\n💳 Scraping payment history...");
  
  const payments = [];
  
  try {
    await page.goto(
      "https://www.eversource.com/residential/account-billing/past-bills-payments",
      { waitUntil: "domcontentloaded", timeout: 60000 }
    );
    
    await page.waitForTimeout(3000);
    
    // Look for payment history section
    try {
      await page.waitForSelector('text=/Payment History/i', { timeout: 10000 });
    } catch (e) {
      console.log("Could not find Payment History section");
      return payments;
    }
    
    // Look for payment rows
    const paymentElements = await page.locator('.payment-row, tr:has-text("Payment"), div:has-text("Payment")').all();
    
    console.log(`Found ${paymentElements.length} potential payment elements`);
    
    for (let i = 0; i < Math.min(paymentElements.length, 24); i++) {
      try {
        const element = paymentElements[i];
        const text = await element.textContent();
        
        const paymentData = {
          accountName: accountName,
          paymentDate: "",
          amount: "",
          status: "Completed",
          confirmationCode: "N/A"
        };
        
        // Extract amount
        const amountMatch = text.match(/\$[\d,]+\.\d{2}/);
        if (amountMatch) paymentData.amount = amountMatch[0];
        
        // Extract date
        const dateMatch = text.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/);
        if (dateMatch) paymentData.paymentDate = dateMatch[0];
        
        payments.push(paymentData);
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
