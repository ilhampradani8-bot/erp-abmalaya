const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const docType = args[0] || 'quotation';
const docId = args[1] || '1';
const outputPath = args[2] || path.join(__dirname, '../public/uploads/pdf/document.pdf');
const targetUrl = args[3] || `http://127.0.0.1:8000/view_doc.php?type=${encodeURIComponent(docType)}&id=${encodeURIComponent(docId)}`;

// Ensure output dir exists
const dir = path.dirname(outputPath);
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

let puppeteer;
try {
    puppeteer = require('puppeteer');
} catch (e) {
    try {
        puppeteer = require('puppeteer-core');
    } catch (e2) {
        console.error(JSON.stringify({ status: 'error', message: 'Puppeteer module not found.' }));
        process.exit(1);
    }
}

(async () => {
    try {
        const launchOptions = {
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu'
            ]
        };

        // If puppeteer-core, attempt to find system chrome
        if (puppeteer.executablePath) {
            const possiblePaths = [
                '/usr/bin/google-chrome-stable',
                '/usr/bin/google-chrome',
                '/usr/bin/chromium',
                '/usr/bin/chromium-browser',
                '/snap/bin/chromium'
            ];
            for (const p of possiblePaths) {
                if (fs.existsSync(p)) {
                    launchOptions.executablePath = p;
                    break;
                }
            }
        }

        const { execSync } = require('child_process');
        let htmlContent = null;
        try {
            const viewDocScript = path.join(__dirname, '../public/view_doc.php');
            if (fs.existsSync(viewDocScript)) {
                htmlContent = execSync(`php ${JSON.stringify(viewDocScript)} type=${JSON.stringify(docType)} id=${JSON.stringify(docId)}`, { encoding: 'utf-8', timeout: 10000 });
            }
        } catch (e) {
            // Fallback to HTTP URL navigation
        }

        const browser = await puppeteer.launch(launchOptions);
        const page = await browser.newPage();
        
        if (htmlContent && htmlContent.includes('<html')) {
            await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });
        } else {
            await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 30000 });
        }

        await page.pdf({
            path: outputPath,
            format: 'A4',
            printBackground: true,
            preferCSSPageSize: true
        });

        await browser.close();

        console.log(JSON.stringify({
            status: 'success',
            message: 'PDF generated successfully via Headless Chrome!',
            file: outputPath,
            size: fs.statSync(outputPath).size
        }));
        process.exit(0);
    } catch (err) {
        console.error(JSON.stringify({
            status: 'error',
            message: 'Puppeteer rendering error: ' + err.message
        }));
        process.exit(1);
    }
})();
