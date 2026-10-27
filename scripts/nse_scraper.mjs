import puppeteer from 'puppeteer-core';
import process from 'process';
import fs from 'fs';

function findChromePath() {
    if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
        return process.env.CHROME_PATH;
    }

    const candidates = [
        // Windows
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
        // Linux
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/snap/bin/chromium',
        // MacOS
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ];

    for (const p of candidates) {
        if (p && fs.existsSync(p)) {
            return p;
        }
    }

    return null;
}

async function queryNse(symbol, pan) {
    const chromePath = findChromePath();
    if (!chromePath) {
        console.log('RESULT_START');
        console.log(JSON.stringify({
            success: false,
            message: 'Chrome/Chromium executable not found on the system server.'
        }));
        console.log('RESULT_END');
        process.exit(1);
    }

    let browser = null;
    try {
        browser = await puppeteer.launch({
            executablePath: chromePath,
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-blink-features=AutomationControlled',
                '--window-size=1280,800'
            ]
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36');

        await page.goto('https://www.nseindia.com/invest/check-trades-bids-verify-ipo-bids', {
            waitUntil: 'networkidle2',
            timeout: 25000
        });

        await page.waitForSelector('#ipo_bid_symbol', { timeout: 10000 });

        // Select symbol with flexible option matching
        const selectedValue = await page.evaluate((targetSymbol) => {
            const select = document.querySelector('#ipo_bid_symbol');
            if (!select) return targetSymbol;
            const options = Array.from(select.options);
            const target = targetSymbol.toUpperCase().trim();
            // 1. Direct value or text match
            let found = options.find(o => o.value.trim().toUpperCase() === target || o.text.trim().toUpperCase() === target);
            if (found) return found.value;
            // 2. Substring match
            found = options.find(o => o.value.toUpperCase().includes(target) || o.text.toUpperCase().includes(target));
            if (found) return found.value;
            return target;
        }, symbol);

        if (selectedValue) {
            await page.select('#ipo_bid_symbol', selectedValue);
        }
        await page.type('#pan_no', pan.toUpperCase().trim());

        const responsePromise = page.waitForResponse(response => 
            response.url().includes('/api/ipo-bid-verification-details'),
            { timeout: 15000 }
        );

        // Execute getTable()
        await page.evaluate(() => {
            if (typeof getTable === 'function') {
                getTable();
            } else {
                document.querySelector('button[type="submit"], input[type="submit"], .btn-submit')?.click();
            }
        });

        const response = await responsePromise;
        const text = await response.text();
        console.log('RESULT_START');
        console.log(text);
        console.log('RESULT_END');
    } catch (err) {
        console.log('RESULT_START');
        console.log(JSON.stringify({
            success: false,
            message: 'NSE live verification failed: ' + err.message
        }));
        console.log('RESULT_END');
    } finally {
        if (browser) {
            await browser.close().catch(() => {});
        }
    }
}

const symbol = process.argv[2] || '';
const pan = process.argv[3] || '';

if (!symbol || !pan) {
    console.log('RESULT_START');
    console.log(JSON.stringify({
        success: false,
        message: 'Symbol and PAN are required.'
    }));
    console.log('RESULT_END');
    process.exit(1);
}

queryNse(symbol, pan);
