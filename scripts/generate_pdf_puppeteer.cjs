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
            await page.setContent(htmlContent, { waitUntil: ['domcontentloaded', 'networkidle0'] });
        } else {
            await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 30000 });
        }

        // Extract branding info for native Puppeteer header and footer templates
        const branding = await page.evaluate(() => {
            const logoImg = document.querySelector('.logo-box img') || document.querySelector('.footer-logo-row img');
            const logoUrl = logoImg ? logoImg.src : '';
            return {
                logoUrl: logoUrl,
                companyName: 'AB MALAYA SDN. BHD.',
                companyAddress: '2-2-40, 2nd Floor Wisma Rampai, Jalan 34/26, Taman Sri Rampai, 53300 Kuala Lumpur.',
                email: 'sales@abmalaya.com',
                phone: '+60 3-8000 1234',
                website: 'abmalaya.com'
            };
        });

        const headerTemplate = `<div></div>`;

        const footerTemplate = `
            <div style="font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; font-size: 8px; font-weight: 700; width: 100%; margin: 0 8mm; display: flex; justify-content: flex-end; align-items: center; color: #475569; -webkit-print-color-adjust: exact;">
                <div>
                    Halaman <span class="pageNumber"></span> dari <span class="totalPages"></span>
                </div>
            </div>
        `;

        await page.pdf({
            path: outputPath,
            format: 'A4',
            printBackground: true,
            displayHeaderFooter: true,
            headerTemplate: headerTemplate,
            footerTemplate: footerTemplate,
            margin: {
                top: '6mm',
                bottom: '10mm',
                left: '6mm',
                right: '6mm'
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
