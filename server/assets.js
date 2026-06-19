import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AUDIO_DIR = path.join(__dirname, 'public', 'audio');
const CACHE_DIR = path.join(__dirname, 'public', 'cache');

// Ensure directories exist
fs.mkdirSync(AUDIO_DIR, { recursive: true });
fs.mkdirSync(CACHE_DIR, { recursive: true });

// Curated royalty-free background music mapping
export const AUDIO_TRACKS = {
  energetic_pop: {
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    filename: 'energetic_pop.mp3',
    title: 'Upbeat Energetic Pop'
  },
  lofi_chill: {
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
    filename: 'lofi_chill.mp3',
    title: 'Lo-Fi Chill Beat'
  },
  funky_groove: {
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    filename: 'funky_groove.mp3',
    title: 'Funky Groove Bass'
  },
  corporate_beat: {
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    filename: 'corporate_beat.mp3',
    title: 'Modern Corporate Beat'
  },
  dramatic_synth: {
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
    filename: 'dramatic_synth.mp3',
    title: 'Dramatic Cyber Synth'
  }
};

// Curated fallback vertical videos (9:16 portrait format)
const FALLBACK_VIDEOS = [
  {
    keywords: ['workout', 'gym', 'fitness', 'exercise', 'health'],
    url: 'https://videos.pexels.com/video-files/3252061/3252061-hd_1080_1920_25fps.mp4' // Gym lift vertical
  },
  {
    keywords: ['cooking', 'food', 'recipe', 'eat', 'kitchen'],
    url: 'https://videos.pexels.com/video-files/3196238/3196238-hd_1080_1920_25fps.mp4' // Kitchen pouring vertical
  },
  {
    keywords: ['coding', 'laptop', 'typing', 'computer', 'work', 'office'],
    url: 'https://videos.pexels.com/video-files/852423/852423-hd_1280_720_24fps.mp4' // Keyboard typing (will crop to 9:16)
  },
  {
    keywords: ['coffee', 'cafe', 'morning', 'drink'],
    url: 'https://videos.pexels.com/video-files/3099955/3099955-hd_1080_1920_25fps.mp4' // Coffee dripping vertical
  },
  {
    keywords: ['abstract', 'gradient', 'loop', 'aesthetic', 'calm'],
    url: 'https://videos.pexels.com/video-files/854298/854298-hd_1280_720_30fps.mp4' // Colorful abstract loop
  }
];

// Curated fallback GIFs
const FALLBACK_GIFS = {
  mind_blown: 'https://i.giphy.com/26ufdipFbma0huk7K1.gif',
  excited: 'https://i.giphy.com/12PA1eI8FBqEUM.gif',
  facepalm: 'https://i.giphy.com/3xz2BLBOKhjKuqiRjO.gif',
  side_eye: 'https://i.giphy.com/3gNotAoMQZksA9Cix9.gif',
  dancing_cat: 'https://i.giphy.com/yFQ0ywscgobJK.gif',
  typing_fast: 'https://i.giphy.com/13HgwGsXF09K48.gif',
  failed: 'https://i.giphy.com/11s7Ke7wxVOA8w.gif'
};

const FONT_PATH = path.join(__dirname, 'public', 'Outfit-Bold.ttf');

/**
 * Downloads audio tracks and fallback fonts on startup if they do not exist
 */
export async function downloadAudioTracksOnStartup() {
  console.log('[Assets] Checking and downloading audio tracks and fonts...');
  
  // Download Font if missing
  if (!fs.existsSync(FONT_PATH)) {
    console.log('[Assets] Downloading fallback font Outfit-Bold.ttf...');
    try {
      const response = await axios({
        method: 'get',
        url: 'https://fonts.gstatic.com/s/outfit/v15/QGYyz_MVcBeNP4NjuGObqx1XmO1I4deyC4E.ttf',
        responseType: 'stream',
        timeout: 15000
      });
      const writer = fs.createWriteStream(FONT_PATH);
      response.data.pipe(writer);
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
      console.log('[Assets] Successfully downloaded Outfit-Bold.ttf');
    } catch (err) {
      console.error('[Assets] Failed to download font:', err.message);
    }
  }

  for (const [key, track] of Object.entries(AUDIO_TRACKS)) {
    const destPath = path.join(AUDIO_DIR, track.filename);
    if (!fs.existsSync(destPath)) {
      console.log(`[Assets] Downloading audio track: ${track.title}...`);
      try {
        const response = await axios({
          method: 'get',
          url: track.url,
          responseType: 'stream',
          timeout: 15000
        });
        const writer = fs.createWriteStream(destPath);
        response.data.pipe(writer);
        await new Promise((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        });
        console.log(`[Assets] Successfully downloaded ${track.filename}`);
      } catch (err) {
        console.error(`[Assets] Failed to download audio track ${track.filename}:`, err.message);
      }
    }
  }
}

/**
 * Search and download a background video
 */
export async function getBackgroundVideo(keywords, vibe) {
  const pexelsKey = process.env.PEXELS_API_KEY;
  const fileName = `bg_video_${Date.now()}.mp4`;
  const destPath = path.join(CACHE_DIR, fileName);

  let videoUrl = '';

  if (pexelsKey) {
    const query = keywords && keywords.length > 0 ? keywords[0] : 'abstract vertical';
    console.log(`[Assets] Searching Pexels for: "${query}"...`);
    try {
      const response = await axios.get('https://api.pexels.com/videos/search', {
        headers: { Authorization: pexelsKey },
        params: {
          query,
          per_page: 5,
          orientation: 'portrait' // Get 9:16 vertical videos directly!
        },
        timeout: 8000
      });

      const videos = response.data.videos;
      if (videos && videos.length > 0) {
        // Find best video file (prefer vertical, HD quality)
        const video = videos[0];
        const file = video.video_files.find(f => f.width < f.height) || video.video_files[0];
        videoUrl = file.link;
        console.log(`[Assets] Found video on Pexels: ${videoUrl}`);
      }
    } catch (err) {
      console.error('[Assets] Pexels search failed:', err.message);
    }
  }

  // Fallback if no Pexels key or Pexels search yielded no results
  if (!videoUrl) {
    console.log('[Assets] Using curated fallback background video...');
    const searchTerms = (keywords || []).map(k => k.toLowerCase()).join(' ');
    
    // Attempt to match keywords
    const matched = FALLBACK_VIDEOS.find(video => 
      video.keywords.some(kw => searchTerms.includes(kw))
    );
    
    // Choose the matched fallback or a random one
    videoUrl = matched ? matched.url : FALLBACK_VIDEOS[4].url; // abstract loop default
    console.log(`[Assets] Selected fallback video url: ${videoUrl}`);
  }

  // Download the selected video
  console.log(`[Assets] Downloading video to ${destPath}...`);
  try {
    const response = await axios({
      method: 'get',
      url: videoUrl,
      responseType: 'stream',
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });
    
    const writer = fs.createWriteStream(destPath);
    response.data.pipe(writer);
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    console.log('[Assets] Video download complete.');
    return destPath;
  } catch (err) {
    console.error('[Assets] Video download failed, copying local fallback...');
    // Create a dummy video file or use a pre-installed one if download totally fails
    throw new Error(`Failed to download background video: ${err.message}`);
  }
}

/**
 * Search and download a reaction GIF
 */
export async function getOverlayGIF(keywords) {
  const giphyKey = process.env.GIPHY_API_KEY;
  const fileName = `gif_${Date.now()}.gif`;
  const destPath = path.join(CACHE_DIR, fileName);

  let gifUrl = '';

  if (giphyKey) {
    const query = keywords && keywords.length > 0 ? keywords[0] : 'funny emoji';
    console.log(`[Assets] Searching Giphy for: "${query}"...`);
    try {
      const response = await axios.get('https://api.giphy.com/v1/gifs/search', {
        params: {
          api_key: giphyKey,
          q: query,
          limit: 3,
          rating: 'g'
        },
        timeout: 5000
      });

      const gifs = response.data.data;
      if (gifs && gifs.length > 0) {
        // Get the downsized GIF URL to optimize download speed & memory
        gifUrl = gifs[0].images.downsized.url || gifs[0].images.original.url;
        console.log(`[Assets] Found Giphy GIF: ${gifUrl}`);
      }
    } catch (err) {
      console.error('[Assets] Giphy search failed:', err.message);
    }
  }

  // Fallback mapping if no key or no results
  if (!gifUrl) {
    console.log('[Assets] Using curated fallback reaction GIF...');
    const searchTerms = (keywords || []).map(k => k.toLowerCase()).join(' ');
    
    if (searchTerms.includes('blown') || searchTerms.includes('shock') || searchTerms.includes('mind')) {
      gifUrl = FALLBACK_GIFS.mind_blown;
    } else if (searchTerms.includes('fail') || searchTerms.includes('clown') || searchTerms.includes('wall')) {
      gifUrl = FALLBACK_GIFS.failed;
    } else if (searchTerms.includes('excit') || searchTerms.includes('danc') || searchTerms.includes('celebrat')) {
      gifUrl = FALLBACK_GIFS.excited;
    } else if (searchTerms.includes('eye') || searchTerms.includes('dog') || searchTerms.includes('judge')) {
      gifUrl = FALLBACK_GIFS.side_eye;
    } else if (searchTerms.includes('type') || searchTerms.includes('code') || searchTerms.includes('fast')) {
      gifUrl = FALLBACK_GIFS.typing_fast;
    } else {
      // Default to dancing cat because it's funny and fits almost everything
      gifUrl = FALLBACK_GIFS.dancing_cat;
    }
    console.log(`[Assets] Selected fallback GIF url: ${gifUrl}`);
  }

  // Download the GIF
  console.log(`[Assets] Downloading GIF to ${destPath}...`);
  try {
    const response = await axios({
      method: 'get',
      url: gifUrl,
      responseType: 'stream',
      timeout: 15000
    });
    
    const writer = fs.createWriteStream(destPath);
    response.data.pipe(writer);
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    console.log('[Assets] GIF download complete.');
    return { path: destPath, url: gifUrl };
  } catch (err) {
    console.warn(`[Assets] GIF download failed: ${err.message}. Continuing pipeline without GIF.`);
    return { path: null, url: '' };
  }
}

