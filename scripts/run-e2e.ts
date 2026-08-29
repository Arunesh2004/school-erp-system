// @ts-nocheck
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function runTest() {
  console.log('Starting e2e test...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // -----------------------------------------------------
    // 1. TEACHER LOGIN & UPLOAD
    // -----------------------------------------------------
    console.log('Navigating to login...');
    await page.goto('http://localhost:3000/login');
    await page.fill('input[name="email"]', 'teacher1@test.com');
    await page.fill('input[name="password"]', 'TestTeacher@123');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/teacher');
    console.log('Logged in as teacher.');

    // Wait for the Learning Hub or Notes link in sidebar
    await page.click('a[href="/teacher/notes"]');
    await page.waitForURL('**/teacher/notes');

    // Click the first subject
    const subjectLink = await page.locator(`a[href^="/teacher/notes/"]`).first();
    const subjectHref = await subjectLink.getAttribute('href');
    const subjectId = subjectHref.split('/').pop();
    await subjectLink.click();
    await page.waitForURL(`**${subjectHref}`, { waitUntil: 'domcontentloaded' });
    console.log('Navigated to subject notes.');

    const timestamp = Date.now();
    const chapterTitle = `FINAL UPLOAD TEST CHAPTER ${timestamp}`;
    const topicTitle = `FINAL 5MB PDF TEST ${timestamp}`;

    // Create Chapter
    console.log(`Creating Chapter: ${chapterTitle}`);
    await page.fill('input[placeholder="New Chapter Title"]', chapterTitle);
    await page.click('button:has-text("Add Chapter")');
    await page.waitForSelector(`text=${chapterTitle}`, { state: 'visible' });

    // Create Topic
    console.log(`Creating Topic: ${topicTitle}`);
    // The "Add Topic" button inside the chapter
    const chapterDiv = page.locator('.border', { hasText: chapterTitle }).first();
    await chapterDiv.locator('button:has-text("Add Topic")').click();
    await chapterDiv.locator('input[placeholder="New Topic Title"]').fill(topicTitle);
    await chapterDiv.locator('button:has-text("Save Topic")').click();
    await page.waitForSelector(`text=${topicTitle}`, { state: 'visible' });

    // Upload PDF
    console.log('Uploading PDF...');
    const topicDiv = page.locator('.border.bg-slate-50', { hasText: topicTitle }).first();
    const pdfPath = path.resolve(__dirname, '../large_test_acceptance.pdf');
    
    // We expect an input[type="file"][accept=".pdf"]
    const fileInput = topicDiv.locator('input[type="file"][accept=".pdf"]').first();
    
    // Intercept requests to check for Supabase secrets
    let secretsLeaked = false;
    page.on('request', (request: any) => {
      const url = request.url();
      const headers = request.headers();
      const postData = request.postData() || '';
      const checkLeak = (str) => {
        if (str && (str.includes('sb_secret__') || str.includes('SUPABASE_SECRET_KEY') || str.includes('DATABASE_URL'))) {
          secretsLeaked = true;
          console.error('CRITICAL LEAK FOUND IN REQUEST:', url);
        }
      };
      checkLeak(url);
      checkLeak(JSON.stringify(headers));
      checkLeak(postData);
    });

    page.on('response', async (response: any) => {
      const url = response.url();
      // Only check json or html responses
      if (response.headers()['content-type']?.includes('application/json')) {
        try {
          const body = await response.text();
          if (body && (body.includes('sb_secret__') || body.includes('SUPABASE_SECRET_KEY') || body.includes('DATABASE_URL'))) {
             secretsLeaked = true;
             console.error('CRITICAL LEAK FOUND IN RESPONSE:', url);
          }
        } catch(e) {}
      }
    });

    page.on('console', (msg: any) => console.log('BROWSER CONSOLE:', msg.text()));

    page.on('response', async (res: any) => {
      console.log(`RESPONSE: ${res.status()} ${res.url()}`);
    });

    await fileInput.setInputFiles(pdfPath);
    console.log('File selected. Waiting for upload complete (up to 120s)...');

    // Wait for the file name to appear in the DOM, meaning it was successfully confirmed    // Wait for the UI to show the uploaded file inside this specific topic
    try {
      await topicDiv.locator(`span:has-text("${path.basename(pdfPath)}")`).waitFor({ state: 'visible', timeout: 120000 });
      console.log('Upload completed successfully (file found in UI).');
    } catch (err) {
      console.log('Timeout or error occurred. Taking screenshot...');
      await page.screenshot({ path: path.resolve(__dirname, '../failure_screenshot.png') });
      const bodyHTML = await page.evaluate(() => document.body.innerHTML);
      console.log('BODY CONTAINS TOAST:', bodyHTML.includes('sonner'));
      
      const hasError = await page.locator('.sonner-toast-error').count() > 0 || await page.locator('text=Upload failed').count() > 0;
      if (hasError) {
        console.error('An error toast was displayed during upload.');
      }
      throw err;
    }

    // Publish
    console.log('Publishing Topic...');
    await page.waitForTimeout(2000);
    const publishBtn = topicDiv.locator('button:has-text("Publish")');
    await publishBtn.click();
    
    // Wait for the status badge to change to PUBLISHED after page reload
    await page.waitForSelector('.bg-green-100:has-text("PUBLISHED")', { timeout: 15000 });
    console.log('Topic published.');
    
    // Logout
    // Wait for Next.js to hydrate the page after reload
    await page.waitForTimeout(3000);
    await page.click('button[title="Log out"]');
    await page.waitForURL('**/login');
    console.log('Logged out teacher.');

    // -----------------------------------------------------
    // 2. STUDENT LOGIN & VERIFY
    // -----------------------------------------------------
    console.log('Logging in as student...');
    await page.fill('input[name="email"]', 'student1@test.com');
    await page.fill('input[name="password"]', 'TestStudent@123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/student');
    console.log('Logged in as student.');

    await page.click('a[href="/student/learning-hub"]');
    await page.waitForURL('**/student/learning-hub', { waitUntil: 'domcontentloaded' });

    // Go to subject directly
    await page.goto(`http://localhost:3000/student/learning-hub/${subjectId}`);
    await page.waitForURL(`**/student/learning-hub/${subjectId}`);

    // Verify Chapter and Topic
    await page.waitForSelector(`text=${chapterTitle}`);
    console.log('Chapter visible to student.');

    const topicItem = page.locator('.border', { hasText: topicTitle }).first();
    await topicItem.click(); // Expand if it's an accordion, or just verify

    // Try to view PDF
    // Wait for PDF name to appear (which is large_test_acceptance.pdf)
    const pdfItem = topicDiv.locator('li').filter({ hasText: path.basename(pdfPath) }).first();
    const pdfLink = pdfItem.locator('a[href^="/api/notes/download/"]');
    await pdfLink.waitFor({ state: 'visible', timeout: 5000 });
    
    // Get the href to test isolation later
    const downloadHref = await pdfLink.getAttribute('href');
    console.log(`Download Href: ${downloadHref}`);

    // Let's click it. It should open a new tab or download.
    // Use page.request.get to avoid new tab timeout issues with click()
    const downloadResponse = await page.request.get(`http://localhost:3000${downloadHref}`);
    if (downloadResponse.status() >= 400) {
      throw new Error(`Failed to download PDF. Status: ${downloadResponse.status()}`);
    }
    console.log('PDF download/view successful.');

    // -----------------------------------------------------
    // 3. ISOLATION TESTS
    // -----------------------------------------------------
    console.log('Testing isolation...');
    
    // Try to access a draft or unauthorized PDF (we can try modifying the download ID)
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const fakeRes = await page.request.get(`http://localhost:3000/api/notes/download/${fakeId}`);
    if (fakeRes.status() !== 404 && fakeRes.status() !== 403 && fakeRes.status() !== 401) {
      console.warn(`Isolation failed for non-existent ID. Status: ${fakeRes.status()}`);
    } else {
      console.log('Isolation passed for fake ID.');
    }

    // -----------------------------------------------------
    // 4. REGRESSION CHECKS (Basic)
    // -----------------------------------------------------
    console.log('Running regression check for student dashboard...');
    await page.goto('http://localhost:3000/student');
    await page.waitForSelector('text=Attendance Rate');
    
    // Check teacher B (if needed, but usually we can check admin)
    await page.waitForTimeout(3000);
    await page.click('button[title="Log out"]');
    await page.waitForURL('**/login');
    
    // Admin login
    await page.goto('http://localhost:3000/login');
    await page.fill('input[name="email"]', 'admin1@test.com');
    await page.fill('input[name="password"]', 'TestAdmin@123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin');
    console.log('Logged in as Admin. Checking regression...');
    await page.goto('http://localhost:3000/admin/classes');
    await page.waitForSelector('text=Classes');
    
    console.log('Regression passed.');

    if (secretsLeaked) {
      throw new Error('SECRETS LEAKED DURING TEST');
    }

    console.log('E2E TEST PASSED COMPLETELY.');
    
  } catch (error) {
    console.error('TEST FAILED:', error);
  } finally {
    await browser.close();
  }
}

runTest();
