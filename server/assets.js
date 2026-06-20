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

// Curated famous Hollywood songs and BGMs mapping
export const AUDIO_TRACKS = {
  mission_impossible: {
    url: 'https://archive.org/download/tvtunes_455/Mission%20Impossible.mp3',
    filename: 'mission_impossible.mp3',
    title: 'Mission: Impossible BGM'
  },
  pink_panther: {
    url: 'https://archive.org/download/tvtunes_502/Pink%20Panther.mp3',
    filename: 'pink_panther.mp3',
    title: 'The Pink Panther Theme'
  },
  imperial_march: {
    url: 'https://archive.org/download/tvtunes_16519/Star%20Wars%20-%20The%20Imperial%20March.mp3',
    filename: 'imperial_march.mp3',
    title: 'Star Wars: Imperial March'
  },
  gonna_fly_now: {
    url: 'https://archive.org/download/tvtunes_18483/Rocky%20-%20Bill%20Conti%20-%20Gonna%20Fly%20Now.mp3',
    filename: 'gonna_fly_now.mp3',
    title: 'Rocky: Gonna Fly Now'
  },
  titanic_sad: {
    url: 'https://archive.org/download/romanticas90/Celine%20Dion%20-%20My%20Heart%20Will%20Go%20On.mp3',
    filename: 'titanic_sad.mp3',
    title: 'Titanic: My Heart Will Go On'
  }
};

// Curated fallback vertical videos (9:16 portrait format)
const FALLBACK_VIDEOS = [
  {
    keywords: ['workout', 'gym', 'fitness', 'exercise', 'health', 'lifting'],
    url: 'https://videos.pexels.com/video-files/3252061/3252061-hd_1080_1920_25fps.mp4' // Gym lift vertical
  },
  {
    keywords: ['workout', 'gym', 'fitness', 'exercise', 'health', 'lifting'],
    url: 'https://videos.pexels.com/video-files/3752538/3752538-hd_1080_1920_25fps.mp4' // Fitness running vertical
  },
  {
    keywords: ['cooking', 'food', 'recipe', 'eat', 'kitchen', 'restaurant'],
    url: 'https://videos.pexels.com/video-files/3196238/3196238-hd_1080_1920_25fps.mp4' // Kitchen pouring vertical
  },
  {
    keywords: ['coding', 'laptop', 'typing', 'computer', 'work', 'office', 'programming', 'dev'],
    url: 'https://videos.pexels.com/video-files/852423/852423-hd_1280_720_24fps.mp4' // Keyboard typing (will crop to 9:16)
  },
  {
    keywords: ['coding', 'laptop', 'typing', 'computer', 'work', 'office', 'programming', 'dev'],
    url: 'https://videos.pexels.com/video-files/4383416/4383416-hd_1080_1920_25fps.mp4' // Person typing laptop portrait
  },
  {
    keywords: ['coffee', 'cafe', 'morning', 'drink', 'beverage'],
    url: 'https://videos.pexels.com/video-files/3099955/3099955-hd_1080_1920_25fps.mp4' // Coffee dripping vertical
  },
  {
    keywords: ['abstract', 'gradient', 'loop', 'aesthetic', 'calm', 'vibe'],
    url: 'https://videos.pexels.com/video-files/854298/854298-hd_1280_720_30fps.mp4' // Colorful abstract loop
  },
  {
    keywords: ['shopping', 'unboxing', 'package', 'box', 'gift', 'delivery'],
    url: 'https://videos.pexels.com/video-files/2795400/2795400-hd_1080_1920_25fps.mp4' // Opening package vertical
  },
  {
    keywords: ['phone', 'scroll', 'app', 'mobile', 'screen', 'social'],
    url: 'https://videos.pexels.com/video-files/6321252/6321252-hd_1080_1920_25fps.mp4' // Phone scroll vertical
  },
  {
    keywords: ['funny', 'laugh', 'smile', 'happy', 'joke', 'reaction'],
    url: 'https://videos.pexels.com/video-files/4828608/4828608-hd_1080_1920_25fps.mp4' // Girl laughing vertical
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
    // Select a random keyword from the list to make the search query diverse!
    const query = keywords && keywords.length > 0 
      ? keywords[Math.floor(Math.random() * keywords.length)] 
      : 'abstract vertical';
    console.log(`[Assets] Searching Pexels for: "${query}"...`);
    try {
      const response = await axios.get('https://api.pexels.com/videos/search', {
        headers: { Authorization: pexelsKey },
        params: {
          query,
          per_page: 30, // Request up to 30 vertical videos for high variety
          orientation: 'portrait' // Get 9:16 vertical videos directly!
        },
        timeout: 8000
      });

      const videos = response.data.videos;
      if (videos && videos.length > 0) {
        // Pick a random video from the search results to keep generation dynamic!
        const randomIndex = Math.floor(Math.random() * videos.length);
        const video = videos[randomIndex];
        const file = video.video_files.find(f => f.width < f.height) || video.video_files[0];
        videoUrl = file.link;
        console.log(`[Assets] Found video on Pexels (index ${randomIndex}/${videos.length}): ${videoUrl}`);
      }
    } catch (err) {
      console.error('[Assets] Pexels search failed:', err.message);
    }
  }

  // Fallback if no Pexels key or Pexels search yielded no results
  if (!videoUrl) {
    console.log('[Assets] Using curated fallback background video...');
    const searchTerms = (keywords || []).map(k => k.toLowerCase()).join(' ');
    
    // Filter matching fallbacks
    const matchedVideos = FALLBACK_VIDEOS.filter(video => 
      video.keywords.some(kw => searchTerms.includes(kw))
    );
    
    if (matchedVideos.length > 0) {
      // Pick a random matching fallback video
      const randomIndex = Math.floor(Math.random() * matchedVideos.length);
      videoUrl = matchedVideos[randomIndex].url;
    } else {
      // Pick a random fallback video from all options to keep it diverse
      const randomIndex = Math.floor(Math.random() * FALLBACK_VIDEOS.length);
      videoUrl = FALLBACK_VIDEOS[randomIndex].url;
    }
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
    // Select a random keyword from the list to keep overlays unique!
    const query = keywords && keywords.length > 0 
      ? keywords[Math.floor(Math.random() * keywords.length)] 
      : 'funny emoji';
    console.log(`[Assets] Searching Giphy for: "${query}"...`);
    try {
      const response = await axios.get('https://api.giphy.com/v1/gifs/search', {
        params: {
          api_key: giphyKey,
          q: query,
          limit: 30, // Get up to 30 gifs for randomization
          rating: 'g'
        },
        timeout: 5000
      });

      const gifs = response.data.data;
      if (gifs && gifs.length > 0) {
        // Pick a random GIF from the search results to keep overlays unique!
        const randomIndex = Math.floor(Math.random() * gifs.length);
        const selectedGif = gifs[randomIndex];
        gifUrl = selectedGif.images.downsized.url || selectedGif.images.original.url;
        console.log(`[Assets] Found Giphy GIF (index ${randomIndex}/${gifs.length}): ${gifUrl}`);
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
      // Pick a random fallback GIF from all options
      const gifValues = Object.values(FALLBACK_GIFS);
      const randomIndex = Math.floor(Math.random() * gifValues.length);
      gifUrl = gifValues[randomIndex];
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

