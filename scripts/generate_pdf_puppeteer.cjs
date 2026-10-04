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

(async () => {
    try {
        let puppeteer;
        try {
            puppeteer = (await import('puppeteer')).default || (await import('puppeteer'));
        } catch (e) {
            try {
                puppeteer = (await import('puppeteer-core')).default || (await import('puppeteer-core'));
            } catch (e2) {
                console.error(JSON.stringify({ status: 'error', message: 'Puppeteer module not found: ' + e2.message }));
                process.exit(1);
            }
        }

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

        // Find executable Chrome / Chromium binary if available
        const possiblePaths = [
            '/usr/bin/google-chrome-stable',
            '/usr/bin/google-chrome',
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser',
            '/snap/bin/chromium',
            '/usr/bin/google-chrome'
        ];
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                launchOptions.executablePath = p;
                break;
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
            if (!htmlContent.includes('<base ')) {
                htmlContent = htmlContent.replace('<head>', '<head><base href="http://127.0.0.1:8000/">');
            }
            await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        } else {
            await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 15000 });
        }

        // Ensure all background images, logos & fonts are fully loaded
        try {
            await page.evaluate(async () => {
                const images = Array.from(document.querySelectorAll('img'));
                await Promise.all(images.map(img => {
                    if (img.complete) return Promise.resolve();
                    return new Promise((resolve) => {
                        img.addEventListener('load', resolve);
                        img.addEventListener('error', resolve);
                    });
                }));
                if (document.fonts) {
                    await document.fonts.ready;
                }
            });
        } catch (e) {}

        await page.pdf({
            path: outputPath,
            printBackground: true,
            preferCSSPageSize: true,
            displayHeaderFooter: false,
            margin: {
                top: '0px',
                bottom: '0px',
                left: '0px',
                right: '0px'
            }
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
