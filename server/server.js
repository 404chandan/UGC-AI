import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Load environmental variables
dotenv.config();

import { connectDB } from './db.js';
import { 
  createVideoRecord, 
  getVideos, 
  getVideoById, 
  updateVideoStatus,
  deleteVideoRecord
} from './videoModel.js';
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
import { uploadVideoToCloudinary } from './cloudinary.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Setup directories
const PUBLIC_DIR = path.join(__dirname, 'public');
const OUTPUT_DIR = path.join(PUBLIC_DIR, 'outputs');
const AUDIO_DIR = path.join(PUBLIC_DIR, 'audio');
const CACHE_DIR = path.join(PUBLIC_DIR, 'cache');

fs.mkdirSync(PUBLIC_DIR, { recursive: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.mkdirSync(AUDIO_DIR, { recursive: true });
fs.mkdirSync(CACHE_DIR, { recursive: true });

app.use(cors());
app.use(express.json());

// Serve generated videos and audio tracks
app.use(express.static(PUBLIC_DIR));

// Start pipeline in background
async function runVideoGenerationPipeline(recordId, description, url) {
  try {
    console.log(`[Pipeline] Starting video generation pipeline for record: ${recordId}`);
    
    // Step 1: Website Scraping
    let scrapedText = '';
    if (url && url.trim()) {
      console.log(`[Pipeline] Step 1/5: Scraping site: ${url}`);
      const scrapeResult = await scrapeWebsite(url);
      scrapedText = scrapeResult.text || '';
    } else {
      console.log('[Pipeline] Step 1/5: Skipping scraping, no URL provided');
    }

    // Step 2: Concept Planning with Gemini
    console.log('[Pipeline] Step 2/5: Planning content with Gemini AI...');
    await updateVideoStatus(recordId, 'planning', { extractedText: scrapedText.slice(0, 1000) });
    const concept = await planUGCContent(description, scrapedText);
    
    // Update db with planned content details
    await updateVideoStatus(recordId, 'downloading', {
      productName: concept.productName,
      ugcHooks: concept.ugcHooks,
      selectedHook: concept.selectedHook,
      keywords: {
        video: concept.bgVideoKeywords,
        gif: concept.gifKeywords
      },
      vibe: concept.vibe,
      audioTrack: concept.audioVibe
    });

    // Step 3: Asset Retrieval (Video & GIF)
    console.log('[Pipeline] Step 3/5: Downloading video and GIF assets...');
    const bgVideoPath = await getBackgroundVideo(concept.bgVideoKeywords, concept.vibe);
    const gifResult = await getOverlayGIF(concept.gifKeywords);
    
    const audioTrackConfig = AUDIO_TRACKS[concept.audioVibe] || AUDIO_TRACKS.energetic_pop;
    const audioTrackPath = path.join(AUDIO_DIR, audioTrackConfig.filename);
    
    if (!fs.existsSync(audioTrackPath)) {
      throw new Error(`Audio track ${audioTrackConfig.filename} was not found on server.`);
    }

    // Step 4: Text overlay rendering (using Playwright)
    console.log('[Pipeline] Step 4/5: Generating high-end text caption PNG...');
    await updateVideoStatus(recordId, 'rendering', { gifUrl: gifResult.url });
    
    let captionPngPath = path.join(CACHE_DIR, `caption_${recordId}.png`);
    let hasCaptionPng = true;
    try {
      await renderCaptionImage(concept.selectedHook, captionPngPath);
    } catch (renderError) {
      console.warn(`[Pipeline] Caption PNG generation failed: ${renderError.message}. Falling back to FFmpeg drawtext.`);
      captionPngPath = null;
      hasCaptionPng = false;
    }

    // Step 5: FFmpeg Layer Compositing
    console.log('[Pipeline] Step 5/5: Compositing layers using FFmpeg...');
    const outputName = `ugc_video_${recordId}.mp4`;
    const relativeVideoPath = await compositeVideo({
      bgVideoPath,
      gifPath: gifResult.path,
      captionPngPath: hasCaptionPng ? captionPngPath : null,
      rawText: concept.selectedHook,
      audioTrackPath,
      outputName
    });

    // Cloudinary upload if credentials are provided
    let videoUrl = relativeVideoPath;
    try {
      const absoluteLocalPath = path.join(PUBLIC_DIR, relativeVideoPath);
      const cloudinaryUrl = await uploadVideoToCloudinary(absoluteLocalPath);
      if (cloudinaryUrl) {
        videoUrl = cloudinaryUrl;
        
        // Clean up the local output MP4 if we successfully uploaded to Cloudinary
        if (fs.existsSync(absoluteLocalPath)) {
          fs.unlinkSync(absoluteLocalPath);
          console.log('[Pipeline] Cleaned up local composite video after Cloudinary upload.');
        }
      }
    } catch (cloudErr) {
      console.error('[Pipeline] Cloudinary upload failed, using local fallback:', cloudErr.message);
    }

    // Save final status
    await updateVideoStatus(recordId, 'completed', { videoPath: videoUrl });
    console.log(`[Pipeline] Video generation SUCCESS for record: ${recordId}`);
  } catch (error) {
    console.error(`[Pipeline] Pipeline FAILED for record ${recordId}:`, error);
    await updateVideoStatus(recordId, 'failed', { error: error.message });
  }
}

// API Routes

// Get all generated videos
app.get('/api/videos', async (req, res) => {
  try {
    const list = await getVideos();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a single video status
app.get('/api/videos/:id', async (req, res) => {
  try {
    const video = await getVideoById(req.params.id);
    if (!video) {
      return res.status(404).json({ error: 'Video record not found' });
    }
    res.json(video);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Trigger new video generation
app.post('/api/generate', async (req, res) => {
  const { description, url } = req.body;
  if (!description || !description.trim()) {
    return res.status(400).json({ error: 'Product description is required' });
  }

  try {
    const tempTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Create initial chat history structured context
    const initialChat = [
      {
        id: 'welcome',
        sender: 'bot',
        text: "Hey! 🎬 I'm your UGC video copywriter and editor. Give me a pitch and a website link, and I will write Gen-Z style copy, grab stock footage & reaction GIFs, mix trending audio, and compile a viral 9:16 short for you in seconds! 🚀",
        time: tempTime
      },
      {
        id: `user-${Date.now()}`,
        sender: 'user',
        text: `Pitch: "${description}"${url ? `\nWebsite: ${url}` : ''}`,
        time: tempTime
      },
      {
        id: `widget-${Date.now()}`,
        sender: 'bot',
        text: `Starting assets collection and layout assembly for your product...`,
        isWidget: true,
        videoRecordId: null, // linked below
        status: 'scraping',
        time: tempTime
      }
    ];

    // Create initial record
    const record = await createVideoRecord({
      productDescription: description,
      websiteUrl: url || '',
      status: 'scraping',
      chatHistory: initialChat
    });

    const recordId = record._id.toString();

    // Link the created record ID to the status widget inside the chatHistory array
    initialChat[2].videoRecordId = recordId;
    await updateVideoStatus(recordId, 'scraping', { chatHistory: initialChat });

    // Run pipeline asynchronously so we return HTTP 202 immediately
    runVideoGenerationPipeline(recordId, description, url);

    res.status(202).json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Audio tracks metadata helper
app.get('/api/audio-tracks', (req, res) => {
  res.json(Object.entries(AUDIO_TRACKS).map(([key, track]) => ({
    key,
    title: track.title,
    filename: track.filename
  })));
});

// Delete a video record and its physical file
app.delete('/api/videos/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const video = await getVideoById(id);
    if (!video) {
      return res.status(404).json({ error: 'Video record not found' });
    }

    // Delete physical video file if it exists
    if (video.videoPath) {
      const physicalPath = path.join(PUBLIC_DIR, video.videoPath);
      if (fs.existsSync(physicalPath)) {
        try {
          fs.unlinkSync(physicalPath);
          console.log(`[Server] Deleted physical video file: ${physicalPath}`);
        } catch (fileErr) {
          console.error(`[Server] Failed to delete physical file: ${fileErr.message}`);
        }
      }
    }

    await deleteVideoRecord(id);
    console.log(`[Server] Deleted database record: ${id}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Server Initialization
async function startServer() {
  await connectDB();
  await downloadAudioTracksOnStartup();
  
  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`UGC Video Generator server is listening on port ${PORT}`);
    console.log(`Serving assets from: ${PUBLIC_DIR}`);
    console.log(`======================================================\n`);
  });
}

startServer();
