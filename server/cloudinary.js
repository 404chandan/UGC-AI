import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

const isCloudinaryConfigured = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
  console.log('[Cloudinary] Cloudinary configured successfully.');
} else {
  console.warn('[Cloudinary] Cloudinary credentials missing. Using local file storage fallback.');
}

/**
 * Uploads a local video file to Cloudinary
 * @param {string} localFilePath - Path to local video
 * @returns {Promise<string|null>} Cloudinary secure URL, or null if upload fails or is not configured
 */
export async function uploadVideoToCloudinary(localFilePath) {
  if (!isCloudinaryConfigured) {
    console.log('[Cloudinary] Skipping Cloudinary upload - credentials not configured.');
    return null;
  }

  try {
    console.log(`[Cloudinary] Uploading ${localFilePath} to Cloudinary...`);
    const result = await cloudinary.uploader.upload(localFilePath, {
      resource_type: 'video',
      folder: 'ugc_videos',
      overwrite: true
    });
    console.log('[Cloudinary] Upload success:', result.secure_url);
    return result.secure_url;
  } catch (error) {
    console.error('[Cloudinary] Upload failed:', error);
    return null;
  }
}
