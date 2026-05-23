const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

(async () => {
    const url = process.env.URL || 'http://localhost:5174/animals';
    const browser = await chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const logs = [];

    page.on('console', msg => {
        const type = msg.type();
        const text = msg.text();
        logs.push({ type, text });
        console.log(`[console:${type}] ${text}`);
    });

    page.on('pageerror', err => {
        logs.push({ type: 'pageerror', text: String(err) });
        console.error('[pageerror]', err);
    });

    try {
        // Activate DEV mock user so pages behind auth render in dev environment
        await page.addInitScript(() => {
            try { sessionStorage.setItem('DEV_MOCK_USER', '1'); sessionStorage.removeItem('token'); } catch (e) { }
        });
        await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
        // wait for heading
        await page.waitForSelector('text=Gestion du troupeau', { timeout: 5000 });
        const screenshotPath = path.resolve(__dirname, '..', 'tmp', 'animals.png');
        fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
        await page.screenshot({ path: screenshotPath, fullPage: true });

        // determine if any error-level logs present
        const errors = logs.filter(l => l.type === 'error' || l.type === 'pageerror');
        if (errors.length > 0) {
            console.error('Found console errors:', errors);
            await browser.close();
            process.exit(2);
        }

        console.log('Smoke check passed, screenshot saved to', screenshotPath);
        await browser.close();
        process.exit(0);
    } catch (err) {
        console.error('Smoke check failed:', err);
        try { await page.screenshot({ path: path.resolve(__dirname, '..', 'tmp', 'animals-error.png'), fullPage: true }); } catch { }
        await browser.close();
        process.exit(3);
    }
})();
