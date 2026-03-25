const puppeteer = require('puppeteer');

(async () => {
    try {
        const browser = await puppeteer.launch({headless: "new"});
        const page = await browser.newPage();
        
        let errors = [];
        page.on('pageerror', err => {
            errors.push(err.message);
            console.log('UNCAUGHT EXCEPTION:', err.message);
        });
        
        page.on('console', msg => {
            if (msg.type() === 'error') {
                errors.push(msg.text());
                console.log('CONSOLE ERROR:', msg.text());
                const location = msg.location();
                if (location) {
                    console.log(`LOCATION: ${location.url} line ${location.lineNumber}`);
                }
            }
        });

        await page.goto('http://127.0.0.1:5000/', { waitUntil: 'domcontentloaded', timeout: 15000 });
        
        await new Promise(r => setTimeout(r, 2000));
        
        await page.click('#select-professional');
        await new Promise(r => setTimeout(r, 500));
        
        try {
            await page.click('#switch-mode-btn');
            console.log("Successfully clicked #switch-mode-btn with Puppeteer!");
        } catch(e) {
            console.log("Failed to click #switch-mode-btn:", e.message);
        }

        const evalResults = await page.evaluate(() => {
            return {
                currentMode: typeof currentMode !== 'undefined' ? currentMode : null,
                proDisplay: document.getElementById('professional-mode') ? document.getElementById('professional-mode').style.display : null,
                easyDisplay: document.getElementById('easy-mode') ? document.getElementById('easy-mode').style.display : null
            };
        });
        require('fs').writeFileSync('debug_state.json', JSON.stringify({evalResults}, null, 2));
        await browser.close();
    } catch(e) {
        console.log("Script failed", e);
    }
})();
