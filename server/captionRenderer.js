import { chromium } from 'playwright';

/**
 * Renders a UGC-style caption box to a transparent PNG using Playwright.
 * @param {string} text - The caption hook text to display
 * @param {string} destPath - The file path to write the PNG to
 */
export async function renderCaptionImage(text, destPath) {
  console.log(`[CaptionRenderer] Rendering text caption: "${text}"...`);
  let browser = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    // 9:16 portrait viewport
    await page.setViewportSize({ width: 1080, height: 1920 });

    // Design a gorgeous modern TikTok/Reels caption box
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@800&family=Outfit:wght@800&display=swap" rel="stylesheet">
        <style>
          body {
            margin: 0;
            padding: 0;
            background: transparent;
            width: 1080px;
            height: 1920px;
            display: flex;
            flex-direction: column;
            align-items: center;
            /* Position in upper third of the vertical video */
            justify-content: flex-start;
            padding-top: 250px; 
            box-sizing: border-box;
            font-family: 'Outfit', 'Montserrat', -apple-system, sans-serif;
            overflow: hidden;
          }
          .caption-container {
            width: 860px;
            background: rgba(10, 10, 12, 0.88); /* Glassmorphic dark slate */
            backdrop-filter: blur(16px);
            border: 3px solid rgba(255, 255, 255, 0.15);
            border-radius: 28px;
            padding: 40px 50px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
            text-align: center;
            box-sizing: border-box;
            border-bottom: 6px solid #a855f7; /* Purple trendy accent line */
          }
          .caption-text {
            color: #ffffff;
            font-size: 52px;
            font-weight: 800;
            line-height: 1.35;
            letter-spacing: -1px;
            word-wrap: break-word;
            text-shadow: 0 4px 10px rgba(0, 0, 0, 0.5);
          }
          /* Highlight secondary colors for specific terms */
          .highlight {
            color: #f43f5e; /* Vibrant rose color */
          }
          .highlight-alt {
            color: #10b981; /* Emerald green */
          }
        </style>
      </head>
      <body>
        <div class="caption-container" id="caption">
          <div class="caption-text" id="text-box"></div>
        </div>
        <script>
          // Format text with highlights dynamically
          const rawText = ${JSON.stringify(text)};
          const formatted = rawText
            // Highlight text between stars *like this*
            .replace(/\\*([^*]+)\\*/g, '<span class="highlight">$1</span>')
            // Highlight text between quotes "like this"
            .replace(/"([^"]+)"/g, '<span class="highlight-alt">$1</span>');
          
          document.getElementById('text-box').innerHTML = formatted;
        </script>
      </body>
      </html>
    `;

    await page.setContent(htmlContent);
    
    // Wait for fonts to load
    await page.evaluate(() => document.fonts.ready);

    // Save transparent screenshot
    await page.screenshot({
      path: destPath,
      omitBackground: true,
      type: 'png'
    });

    console.log(`[CaptionRenderer] Successfully rendered transparent caption PNG to ${destPath}`);
  } catch (error) {
    console.error('[CaptionRenderer] Rendering caption failed:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
