const puppeteer = require('puppeteer');

(async () => {
    try {
        const browser = await puppeteer.launch({headless: "new"});
        const page = await browser.newPage();
        
        let errors = [];
        page.on('pageerror', err => {
            console.log('PAGE ERROR:', err.message);
            errors.push(err.message);
        });
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log('CONSOLE ERROR:', msg.text());
                errors.push(msg.text());
            }
        });

        await page.goto('http://127.0.0.1:5000/', { waitUntil: 'networkidle0', timeout: 15000 });
        
        if (errors.length === 0) {
            console.log("No JS errors detected.");
        }
        await browser.close();
    } catch(e) {
        console.log("Script failed", e);
    }
})();
