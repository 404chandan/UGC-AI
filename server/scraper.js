import { chromium } from 'playwright';
import axios from 'axios';

/**
 * Scrapes a website's text content, title, and meta tags using Playwright
 * with an Axios fallback in case browser launch is restricted or fails.
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

  // 1. Try Axios first (extremely fast, low resource usage, cloud-friendly)
  try {
    console.log(`[Scraper] Trying Axios extraction for ${targetUrl}...`);
    const response = await axios.get(targetUrl, {
      timeout: 4000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const html = response.data;
    
    // Extract title
    const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'Website';
    
    // Extract meta description
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) ||
                      html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i) ||
                      html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i);
    const description = descMatch ? descMatch[1].trim() : '';

    // Extract headings
    const headings = [];
    const headingRegex = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi;
    let match;
    while ((match = headingRegex.exec(html)) !== null && headings.length < 10) {
      const cleanHeading = match[1].replace(/<[^>]*>/g, '').trim().replace(/\s+/g, ' ');
      if (cleanHeading) headings.push(cleanHeading);
    }

    // Extract paragraph texts
    const paragraphs = [];
    const paragraphRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    while ((match = paragraphRegex.exec(html)) !== null && paragraphs.length < 25) {
      const cleanParagraph = match[1].replace(/<[^>]*>/g, '').trim().replace(/\s+/g, ' ');
      if (cleanParagraph && cleanParagraph.split(/\s+/).length > 4 && cleanParagraph.length < 500) {
        paragraphs.push(cleanParagraph);
      }
    }

    const combinedText = [
      `Title: ${title}`,
      `Meta Description: ${description}`,
      `Key Headings: ${headings.join(' | ')}`,
      `Body Content excerpt:`,
      ...paragraphs
    ].join('\n');

    // If we extracted a reasonable amount of text, return it immediately to avoid Playwright launch!
    if (combinedText.length >= 300) {
      console.log(`[Scraper] Axios successfully scraped content from ${targetUrl} (${combinedText.length} chars). Bypassing Playwright.`);
      return {
        title,
        description,
        text: combinedText.slice(0, 5000),
        success: true
      };
    } else {
      console.log(`[Scraper] Axios retrieved insufficient text (${combinedText.length} chars). Falling back to Playwright.`);
    }
  } catch (axiosError) {
    console.warn(`[Scraper] Axios extraction failed: ${axiosError.message}. Falling back to Playwright.`);
  }

  // 2. Playwright fallback (runs headless browser for heavy SPA sites)
  let browser = null;
  try {
    console.log(`[Scraper] Launching Playwright browser for ${targetUrl}...`);
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    const page = await context.newPage();

    // Block non-essential asset loads (images, styles, fonts, videos) to speed up loading
    await page.route('**/*', (route) => {
      const resourceType = route.request().resourceType();
      if (['image', 'stylesheet', 'font', 'media', 'other'].includes(resourceType)) {
        route.abort();
      } else {
        route.continue();
      }
    });
    
    // Set a fast timeout (6 seconds) since heavy media assets are blocked
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 6000 });
    
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
          const text = el.innerText ? el.innerText.trim() : '';
          return text;
        })
        .filter(text => text && text.split(/\s+/).length > 4 && text.length < 500)
        .slice(0, 40);
        
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

    console.log(`[Scraper] Playwright successfully scraped content from ${targetUrl} (${combinedText.length} chars).`);
    return {
      title,
      description: metaDescription,
      text: combinedText.slice(0, 5000),
      success: true
    };
  } catch (playwrightError) {
    console.error(`[Scraper] Playwright failed:`, playwrightError.message);
    if (browser) {
      try {
        await browser.close();
      } catch (_) {}
    }
    return {
      error: playwrightError.message,
      text: `Failed to scrape website contents (Axios and Playwright failed. Playwright: ${playwrightError.message})`,
      success: false
    };
  }
}
