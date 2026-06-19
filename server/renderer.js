import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ffmpegPath = ffmpegInstaller.path;
const ffprobePath = ffprobeInstaller.path;

// Ensure output directory exists
const OUTPUT_DIR = path.join(__dirname, 'public', 'outputs');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

console.log(`[Renderer] FFmpeg binary path: ${ffmpegPath}`);
console.log(`[Renderer] FFprobe binary path: ${ffprobePath}`);

/**
 * Composites background video, looping GIF, text PNG, and audio track into a 9:16 vertical video
 * @param {object} params
 * @param {string} params.bgVideoPath - Absolute path to download stock video
 * @param {string} params.gifPath - Absolute path to downloaded GIF
 * @param {string} params.captionPngPath - Absolute path to rendered caption PNG
 * @param {string} params.audioTrackPath - Absolute path to MP3 background track
 * @param {string} params.outputName - Filename of final MP4 (e.g. video_123.mp4)
 * @returns {Promise<string>} Path to completed output video (relative to public directory)
 */
/**
 * Wraps text into lines and escapes special characters for FFmpeg's drawtext filter
 */
function formatTextForFFmpeg(text, maxChars = 24) {
  if (!text) return '';
  
  // Strip stars and double quotes
  const cleanText = text.replace(/[*"]/g, '');
  const words = cleanText.split(' ');
  const lines = [];
  let currentLine = '';
  
  words.forEach(word => {
    if ((currentLine + ' ' + word).trim().length <= maxChars) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  });
  if (currentLine) {
    lines.push(currentLine);
  }
  
  // Escape colons, single quotes, and backslashes for FFmpeg
  return lines.join('\n')
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "'\\\\''")
    .replace(/,/g, '\\,');
}

/**
 * Composites background video, looping GIF, text, and audio track into a 9:16 vertical video
 * @param {object} params
 * @param {string} params.bgVideoPath - Absolute path to download stock video
 * @param {string} params.gifPath - Absolute path to downloaded GIF (optional)
 * @param {string} params.captionPngPath - Absolute path to rendered caption PNG (optional)
 * @param {string} params.rawText - Raw caption text for FFmpeg drawtext fallback
 * @param {string} params.audioTrackPath - Absolute path to MP3 background track
 * @param {string} params.outputName - Filename of final MP4 (e.g. video_123.mp4)
 * @returns {Promise<string>} Path to completed output video (relative to public directory)
 */
export function compositeVideo({ bgVideoPath, gifPath, captionPngPath, rawText, audioTrackPath, outputName }) {
  return new Promise((resolve, reject) => {
    const outputPath = path.join(OUTPUT_DIR, outputName);
    
    console.log(`[Renderer] Starting video compositing for ${outputName}...`);
    const hasGif = !!gifPath;
    const hasPng = !!captionPngPath;

    let filterComplex;
    let args = ['-y', '-t', '7']; // Overwrite and cap at 7 seconds

    // Add Video Input (0)
    args.push('-i', bgVideoPath);

    // Add GIF Input if exists (Index depends on GIF availability)
    if (hasGif) {
      args.push('-ignore_loop', '0', '-i', gifPath);
    }

    // Add PNG Input if exists
    if (hasPng) {
      args.push('-i', captionPngPath);
    }

    // Add Audio Input
    args.push('-i', audioTrackPath);

    // Build filter complex and index mapping dynamically
    // Indices:
    // Video: [0:v]
    // GIF: [1:v] if hasGif
    // PNG: [2:v] (if hasGif and hasPng) or [1:v] (if hasPng and no GIF)
    // Audio: last input index
    const videoIndex = 0;
    const gifIndex = hasGif ? 1 : -1;
    let pngIndex = -1;
    let audioIndex = 1; // default if no GIF and no PNG

    if (hasGif) audioIndex++;
    if (hasPng) {
      pngIndex = hasGif ? 2 : 1;
      audioIndex++;
    }

    // 1. Cover Scale & Crop Background to 1080x1920 (9:16 vertical format)
    let filterString = `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[bg]`;

    // 2. Overlay GIF if exists
    let lastVideoLabel = '[bg]';
    if (hasGif) {
      filterString += `;[${gifIndex}:v]scale=360:-1[gif_scaled];${lastVideoLabel}[gif_scaled]overlay=x=(1080-w)/2:y=1180:shortest=1[bg_gif]`;
      lastVideoLabel = '[bg_gif]';
    }

    // 3. Overlay Text (either transparent PNG overlay or FFmpeg drawtext fallback)
    if (hasPng) {
      filterString += `;${lastVideoLabel}[${pngIndex}:v]overlay=0:0[outv]`;
    } else {
      // Drawtext fallback using pre-downloaded Outfit-Bold font
      const formattedText = formatTextForFFmpeg(rawText);
      const drawtextFilter = `drawtext=fontfile='public/Outfit-Bold.ttf':text='${formattedText}':fontcolor=white:fontsize=46:box=1:boxcolor=0x0C0C0Edc:boxborderw=28:line_spacing=14:x=(w-text_w)/2:y=320[outv]`;
      filterString += `;${lastVideoLabel}${drawtextFilter}`;
    }

    // Append filter complex and final maps to arguments
    args.push(
      '-filter_complex', filterString,
      '-map', '[outv]',
      '-map', `${audioIndex}:a`,
      '-af', 'afade=t=out:st=6:d=1',
      '-c:v', 'libx264',
      '-preset', 'superfast',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-shortest',
      outputPath
    );

    console.log(`[Renderer] Running FFmpeg command...`);
    
    const startTime = Date.now();
    const child = execFile(ffmpegPath, args, (error, stdout, stderr) => {
      if (error) {
        console.error('[Renderer] FFmpeg execution error:', error);
        console.error('[Renderer] FFmpeg stderr logs:', stderr);
        return reject(new Error(`FFmpeg composite failed: ${error.message}`));
      }
      
      const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`[Renderer] Render complete in ${durationSec} seconds. Output saved to: ${outputPath}`);
      
      // Clean up temporary files
      try {
        if (fs.existsSync(bgVideoPath)) fs.unlinkSync(bgVideoPath);
        if (hasGif && fs.existsSync(gifPath)) fs.unlinkSync(gifPath);
        if (hasPng && fs.existsSync(captionPngPath)) fs.unlinkSync(captionPngPath);
        console.log('[Renderer] Cleaned up temporary asset cache files.');
      } catch (cleanupErr) {
        console.warn('[Renderer] Minor cache cleanup issue:', cleanupErr.message);
      }

      // Return URL path relative to public directory
      resolve(`/outputs/${outputName}`);
    });
  });
}

