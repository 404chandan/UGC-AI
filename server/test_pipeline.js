import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

import { connectDB } from './db.js';
import { createVideoRecord, getVideoById } from './videoModel.js';
import { scrapeWebsite } from './scraper.js';
import { planUGCContent } from './gemini.js';
import { 
  getBackgroundVideo, 
  getOverlayGIF, 
  downloadAudioTracksOnStartup, 
  AUDIO_TRACKS 
} from './assets.js';
import { renderCaptionImage } from './captionRenderer.js';
import { compositeVideo } from './renderer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = path.join(__dirname, 'public');
const OUTPUT_DIR = path.join(PUBLIC_DIR, 'outputs');
const AUDIO_DIR = path.join(PUBLIC_DIR, 'audio');
const CACHE_DIR = path.join(PUBLIC_DIR, 'cache');

// Ensure directories exist
fs.mkdirSync(PUBLIC_DIR, { recursive: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.mkdirSync(AUDIO_DIR, { recursive: true });
fs.mkdirSync(CACHE_DIR, { recursive: true });

async function runTest() {
  console.log('=== STARTING END-TO-END PIPELINE TEST ===');
  
  // 1. Connect DB
  await connectDB();
  
  // 2. Download audio tracks
  await downloadAudioTracksOnStartup();
  
  // Create video record
  const description = 'A portable espresso maker for campers called NomadPress. Makes creamy espresso anywhere.';
  const url = 'https://react.dev';
  
  const record = await createVideoRecord({
    productDescription: description,
    websiteUrl: url,
    status: 'scraping'
  });
  
  const recordId = record._id.toString();
  console.log(`Created test record with ID: ${recordId}`);
  
  try {
    // 1. Website Scraping
    console.log('\n--- 1. Testing Playwright Scraper ---');
    const scrapeResult = await scrapeWebsite(url);
    console.log('Scraper title result:', scrapeResult.title);
    console.log('Scraper excerpt length:', scrapeResult.text ? scrapeResult.text.length : 0);
    
    // 2. Planning
    console.log('\n--- 2. Testing Gemini AI Planner ---');
    const concept = await planUGCContent(description, scrapeResult.text);
    console.log('Gemini generated concept:', JSON.stringify(concept, null, 2));
    
    // 3. Downloading Assets
    console.log('\n--- 3. Testing Stock Assets Downloader ---');
    const bgVideoPath = await getBackgroundVideo(concept.bgVideoKeywords, concept.vibe);
    console.log('Downloaded background video path:', bgVideoPath);
    
    const gifResult = await getOverlayGIF(concept.gifKeywords);
    console.log('Downloaded GIF path:', gifResult.path);
    console.log('GIF URL:', gifResult.url);
    
    const audioTrackConfig = AUDIO_TRACKS[concept.audioVibe] || AUDIO_TRACKS.energetic_pop;
    const audioTrackPath = path.join(AUDIO_DIR, audioTrackConfig.filename);
    console.log('Selected audio track path:', audioTrackPath);
    
    // 4. Caption rendering
    console.log('\n--- 4. Testing Caption PNG Generation ---');
    const captionPngPath = path.join(CACHE_DIR, `caption_${recordId}.png`);
    await renderCaptionImage(concept.selectedHook, captionPngPath);
    console.log('Caption PNG written to:', captionPngPath);
    
    // 5. Compositing
    console.log('\n--- 5. Testing FFmpeg Compositor ---');
    const outputName = `test_output_${recordId}.mp4`;
    const relativeVideoPath = await compositeVideo({
      bgVideoPath,
      gifPath: gifResult.path,
      captionPngPath,
      audioTrackPath,
      outputName
    });
    
    console.log('\n=======================================');
    console.log('SUCCESS! E2E pipeline run completed!');
    console.log('Rendered video saved relative path:', relativeVideoPath);
    console.log('Full video path:', path.join(OUTPUT_DIR, outputName));
    console.log('=======================================');
  } catch (error) {
    console.error('\nE2E PIPELINE RUN FAILED:', error);
  }
  
  process.exit(0);
}

runTest();
