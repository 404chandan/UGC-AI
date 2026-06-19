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
export function compositeVideo({ bgVideoPath, gifPath, captionPngPath, audioTrackPath, outputName }) {
  return new Promise((resolve, reject) => {
    const outputPath = path.join(OUTPUT_DIR, outputName);
    
    console.log(`[Renderer] Starting video compositing for ${outputName}...`);
    const hasGif = !!gifPath;

    let filterComplex;
    let args;

    if (hasGif) {
      // 4 inputs: bg video (0), GIF (1), caption PNG (2), audio MP3 (3)
      filterComplex = [
        `[0:v]scale=w='iw*max(1080/iw,1920/ih)':h='ih*max(1080/iw,1920/ih)',crop=1080:1920[bg]`,
        `[1:v]scale=360:-1[gif_scaled]`,
        `[bg][gif_scaled]overlay=x=(1080-w)/2:y=1180:shortest=1[bg_gif]`,
        `[bg_gif][2:v]overlay=0:0[outv]`
      ].join(';');

      args = [
        '-y',                       // Overwrite files
        '-t', '7',                  // Cut video output to exactly 7 seconds
        '-i', bgVideoPath,          // Input 0: Background video
        '-ignore_loop', '0',        // Force looping the GIF input
        '-i', gifPath,              // Input 1: Reaction GIF
        '-i', captionPngPath,       // Input 2: Transparent text PNG
        '-i', audioTrackPath,       // Input 3: Audio MP3 track
        '-filter_complex', filterComplex,
        '-map', '[outv]',           // Map our generated video stream
        '-map', '3:a',              // Map the music track (ignore stock video audio)
        '-af', 'afade=t=out:st=6:d=1', // Fade out audio from second 6 to 7
        '-c:v', 'libx264',          // Use H.264 video codec
        '-preset', 'superfast',     // Render extremely fast
        '-pix_fmt', 'yuv420p',      // Browser compatible color pixel format
        '-c:a', 'aac',              // AAC audio codec
        '-b:a', '192k',             // High quality audio bitrate
        '-shortest',                // Finish if inputs finish
        outputPath
      ];
    } else {
      // 3 inputs: bg video (0), caption PNG (1), audio MP3 (2)
      filterComplex = [
        `[0:v]scale=w='iw*max(1080/iw,1920/ih)':h='ih*max(1080/iw,1920/ih)',crop=1080:1920[bg]`,
        `[bg][1:v]overlay=0:0[outv]`
      ].join(';');

      args = [
        '-y',                       // Overwrite files
        '-t', '7',                  // Cut video output to exactly 7 seconds
        '-i', bgVideoPath,          // Input 0: Background video
        '-i', captionPngPath,       // Input 1: Transparent text PNG
        '-i', audioTrackPath,       // Input 2: Audio MP3 track
        '-filter_complex', filterComplex,
        '-map', '[outv]',           // Map our generated video stream
        '-map', '2:a',              // Map the music track (ignore stock video audio)
        '-af', 'afade=t=out:st=6:d=1', // Fade out audio from second 6 to 7
        '-c:v', 'libx264',          // Use H.264 video codec
        '-preset', 'superfast',     // Render extremely fast
        '-pix_fmt', 'yuv420p',      // Browser compatible color pixel format
        '-c:a', 'aac',              // AAC audio codec
        '-b:a', '192k',             // High quality audio bitrate
        '-shortest',                // Finish if inputs finish
        outputPath
      ];
    }

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
        if (fs.existsSync(captionPngPath)) fs.unlinkSync(captionPngPath);
        console.log('[Renderer] Cleaned up temporary asset cache files.');
      } catch (cleanupErr) {
        console.warn('[Renderer] Minor cache cleanup issue:', cleanupErr.message);
      }

      // Return URL path relative to public directory
      resolve(`/outputs/${outputName}`);
    });
  });
}

