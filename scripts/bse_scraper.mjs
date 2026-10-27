import puppeteer from 'puppeteer-core';
import process from 'process';
import fs from 'fs';

function findChromePath() {
    if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
        return process.env.CHROME_PATH;
    }
    const candidates = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
    ];
    for (const p of candidates) {
        if (p && fs.existsSync(p)) return p;
    }
    return null;
}

const action = process.argv[2] || 'list'; // 'list' or 'query'
const imId = process.argv[3];
const pan = process.argv[4];
const appNo = process.argv[5] || '';

async function run() {
    const chromePath = findChromePath();
    if (!chromePath) {
        console.log('RESULT_START');
        console.log(JSON.stringify({ error: 'Chrome not found' }));
        console.log('RESULT_END');
        process.exit(1);
    }

    const browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
        ]
    });

    try {
        const page = await browser.newPage();
        await page.goto('https://www.bseindia.com/investors/appli_check', { waitUntil: 'domcontentloaded' });

        if (action === 'list') {
            const listData = await page.evaluate(async () => {
                const res = await fetch('https://api.bseindia.com/BseIndiaAPI/api/appli_check_ng/w?itype=BB');
                return await res.json();
            });
            console.log('RESULT_START');
            console.log(JSON.stringify(listData));
            console.log('RESULT_END');
        } else if (action === 'query') {
            const queryData = await page.evaluate(async (id, p, a) => {
                const url = 'https://api.bseindia.com/BseIndiaAPI/api/GETIPOAPPLSTATUS_EQ_Live_ng/w?imId=' + id + '&panNo=' + p + '&appNo=' + a;
                const res = await fetch(url);
                return await res.json();
            }, imId, pan, appNo);
            console.log('RESULT_START');
            console.log(JSON.stringify(queryData));
            console.log('RESULT_END');
        }
    } finally {
        await browser.close();
    }
}

run().catch(err => {
    console.log('RESULT_START');
    console.log(JSON.stringify({ error: err.toString() }));
    console.log('RESULT_END');
});
