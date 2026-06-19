import { chromium } from 'playwright';

/**
 * Scrapes a website's text content, title, and meta tags using Playwright
 * @param {string} url - The URL to scrape
 * @returns {Promise<object>} Scraped title, description, headings, and clean text
 */
export async function scrapeWebsite(url) {
  if (!url || !url.trim()) {
    return { error: 'No URL provided', text: '' };
  }

  // Add protocol if missing
  let targetUrl = url.trim();
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = 'http://' + targetUrl;
  }

  console.log(`[Scraper] Starting scrape for ${targetUrl}...`);
  let browser = null;
  
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    const page = await context.newPage();
    
    // Set shorter timeout (10 seconds) to keep performance fast
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
    
    // Extract metadata
    const title = await page.title();
    
    const metaDescription = await page.evaluate(() => {
      const meta = document.querySelector('meta[name="description"]') || 
                   document.querySelector('meta[property="og:description"]');
      return meta ? meta.getAttribute('content') : '';
    });

    const metaKeywords = await page.evaluate(() => {
      const meta = document.querySelector('meta[name="keywords"]');
      return meta ? meta.getAttribute('content') : '';
    });

    // Extract headers and key body text
    const extractedData = await page.evaluate(() => {
      // Remove script tags, styles, noscript, etc.
      const elementsToRemove = document.querySelectorAll('script, style, noscript, svg, path, iframe, nav, footer, header');
      elementsToRemove.forEach(el => el.remove());
      
      const headers = Array.from(document.querySelectorAll('h1, h2, h3'))
        .map(h => h.innerText.trim())
        .filter(Boolean)
        .slice(0, 10);
        
      // Extract main text content paragraphs
      const paragraphs = Array.from(document.querySelectorAll('p, li, span, div'))
        .map(el => {
          // Only get direct text to prevent huge duplicates
          const text = el.innerText ? el.innerText.trim() : '';
          return text;
        })
        .filter(text => text && text.split(/\s+/).length > 4 && text.length < 500)
        .slice(0, 40); // cap number of segments
        
      return {
        headers,
        paragraphs: [...new Set(paragraphs)] // Deduplicate
      };
    });

    await browser.close();
    
    const combinedText = [
      `Title: ${title}`,
      `Meta Description: ${metaDescription}`,
      `Keywords: ${metaKeywords}`,
      `Key Headings: ${extractedData.headers.join(' | ')}`,
      `Body Content excerpt:`,
      ...extractedData.paragraphs.slice(0, 15)
    ].join('\n');

    console.log(`[Scraper] Successfully scraped content from ${targetUrl} (${combinedText.length} chars).`);
    return {
      title,
      description: metaDescription,
      text: combinedText.slice(0, 5000), // Cap at 5000 characters
      success: true
    };
  } catch (error) {
    console.error(`[Scraper] Scrape failed for ${targetUrl}:`, error.message);
    if (browser) {
      try {
        await browser.close();
      } catch (_) {}
    }
    return {
      error: error.message,
      text: `Failed to scrape website contents due to error: ${error.message}`,
      success: false
    };
  }
}
