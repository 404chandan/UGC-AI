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
  updateVideoChatHistory,
  deleteVideoRecord
} from './videoModel.js';
import { scrapeWebsite } from './scraper.js';
import { planUGCContent, chatWithDirector, validateMarketingPitch } from './gemini.js';
import { 
  getBackgroundVideo, 
  getOverlayGIF, 
  downloadAudioTracksOnStartup, 
  AUDIO_TRACKS 
} from './assets.js';
import { renderCaptionImage } from './captionRenderer.js';
import { compositeVideo } from './renderer.js';
import { uploadVideoToCloudinary } from './cloudinary.js';
import jwt from 'jsonwebtoken';
import { registerUser, authenticateUser, findUserById } from './userModel.js';

const JWT_SECRET = process.env.JWT_SECRET || 'ugc_studio_super_secret_key_12345';

// Authentication verification middleware
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ error: 'Authentication token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

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
    let finalAudioVibe = concept.audioVibe;
    // Map legacy vibes to new Hollywood BGMs
    if (finalAudioVibe === 'energetic_pop') finalAudioVibe = 'gonna_fly_now';
    else if (finalAudioVibe === 'funky_groove') finalAudioVibe = 'pink_panther';
    else if (finalAudioVibe === 'dramatic_synth') finalAudioVibe = 'mission_impossible';
    else if (finalAudioVibe === 'corporate_beat') finalAudioVibe = 'gonna_fly_now';
    else if (finalAudioVibe === 'lofi_chill') finalAudioVibe = 'titanic_sad';

    const audioTrackConfig = AUDIO_TRACKS[finalAudioVibe] || AUDIO_TRACKS.gonna_fly_now;
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

// --- Auth Routes ---

// Register User
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !username.trim() || !password || !password.trim()) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const user = await registerUser(username, password);
    const userId = user._id || user.id;
    const token = jwt.sign({ id: userId, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({
      token,
      user: { id: userId, username: user.username }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Login User
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !username.trim() || !password || !password.trim()) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const user = await authenticateUser(username, password);
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      user
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get profile details
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User profile not found' });
    }
    res.json({
      id: user._id || user.id,
      username: user.username
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// --- Video Generation Routes (Authorized) ---

// Get all generated videos (scoped to authenticated user)
app.get('/api/videos', authenticateToken, async (req, res) => {
  try {
    const list = await getVideos(req.user.id);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a single video status (scoped to owner)
app.get('/api/videos/:id', authenticateToken, async (req, res) => {
  try {
    const video = await getVideoById(req.params.id);
    if (!video) {
      return res.status(404).json({ error: 'Video record not found' });
    }
    if (video.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied: You do not own this video record' });
    }
    res.json(video);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Trigger new video generation (scoped to owner)
app.post('/api/generate', authenticateToken, async (req, res) => {
  const { description, url } = req.body;
  if (!description || !description.trim()) {
    return res.status(400).json({ error: 'Product description is required' });
  }

  try {
    // Validate that the description/url makes sense for a marketing pitch/url
    const validation = await validateMarketingPitch(description, url);
    if (!validation.isValid) {
      return res.status(400).json({ error: validation.reason });
    }

    const tempTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Create initial chat history structured context
    const initialChat = [
      {
        id: 'welcome',
        sender: 'bot',
        text: "Hey! 🎬 I am UGC Chat. Describe your product pitch or share a website link, and chat with me to write Gen-Z copy, grab stock footage/reaction GIFs, mix trending audio, and generate viral 9:16 shorts with me! 🚀",
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

    // Create initial record with userId
    const record = await createVideoRecord({
      userId: req.user.id,
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

// Conversational chat with the UGC Director (scoped to owner)
app.post('/api/chat', authenticateToken, async (req, res) => {
  const { message, videoId, chatHistory } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const tempTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Call Gemini to decide if this is a video generation request or conversation
    const chatResult = await chatWithDirector(message, chatHistory || []);

    if (chatResult.isGenerationRequest) {
      // 1. Trigger Video Generation Pipeline
      const description = chatResult.description || message;
      const url = chatResult.url || '';

      // Validate that it makes sense for a marketing pitch/url
      const validation = await validateMarketingPitch(description, url);
      if (!validation.isValid) {
        // Override generation request to conversational, replying with validation reason
        chatResult.isGenerationRequest = false;
        chatResult.reply = validation.reason;
      }
    }

    if (chatResult.isGenerationRequest) {
      // 1. Trigger Video Generation Pipeline
      const description = chatResult.description || message;
      const url = chatResult.url || '';

      const initialChat = [
        {
          id: 'welcome',
          sender: 'bot',
          text: "Hey! 🎬 I am UGC Chat. Describe your product pitch or share a website link, and chat with me to write Gen-Z copy, grab stock footage/reaction GIFs, mix trending audio, and generate viral 9:16 shorts with me! 🚀",
          time: tempTime
        },
        // We put the previous conversational messages, followed by the generation start
        ...(chatHistory || []).filter(m => m.id !== 'welcome' && !m.isTyping),
        {
          id: `bot-excited-${Date.now()}`,
          sender: 'bot',
          text: chatResult.reply || "OMG yes, let's make a video for that right now! 🎬🚀",
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

      // Create record
      const record = await createVideoRecord({
        userId: req.user.id,
        productDescription: description,
        websiteUrl: url,
        status: 'scraping',
        chatHistory: initialChat
      });

      const recordId = record._id.toString();
      initialChat[initialChat.length - 1].videoRecordId = recordId;
      const updatedRecord = await updateVideoStatus(recordId, 'scraping', { chatHistory: initialChat });

      // Run background pipeline
      runVideoGenerationPipeline(recordId, description, url);

      return res.status(202).json({
        action: 'generate',
        record: updatedRecord
      });
    } else {
      // 2. Normal Conversational Chat response
      let updatedVideo = null;
      if (videoId) {
        // Scoped to active video, save in history
        const record = await getVideoById(videoId);
        if (record && record.userId === req.user.id) {
          const currentHistory = record.chatHistory || [];
          
          // Append user message and bot response
          const nextHistory = [
            ...currentHistory,
            {
              id: `user-${Date.now()}`,
              sender: 'user',
              text: message,
              time: tempTime
            },
            {
              id: `bot-${Date.now()}`,
              sender: 'bot',
              text: chatResult.reply,
              time: tempTime
            }
          ];

          // Save record with updated chatHistory
          updatedVideo = await updateVideoChatHistory(videoId, nextHistory);
        }
      }

      return res.json({
        action: 'chat',
        responseText: chatResult.reply,
        updatedVideo
      });
    }
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

// Delete a video record (scoped to owner)
app.delete('/api/videos/:id', authenticateToken, async (req, res) => {
  try {
    const id = req.params.id;
    const video = await getVideoById(id);
    if (!video) {
      return res.status(404).json({ error: 'Video record not found' });
    }
    if (video.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied: You do not own this video record' });
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
