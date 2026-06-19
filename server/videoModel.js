import mongoose from 'mongoose';
import { isFallbackDB, fallbackDB } from './db.js';

const VideoSchema = new mongoose.Schema({
  productName: { type: String, default: '' },
  productDescription: { type: String, required: true },
  websiteUrl: { type: String, default: '' },
  status: { 
    type: String, 
    enum: ['scraping', 'planning', 'downloading', 'rendering', 'completed', 'failed'], 
    default: 'scraping' 
  },
  error: { type: String, default: '' },
  extractedText: { type: String, default: '' },
  ugcHooks: { type: [String], default: [] },
  selectedHook: { type: String, default: '' },
  keywords: {
    video: { type: [String], default: [] },
    gif: { type: [String], default: [] }
  },
  vibe: { type: String, default: '' },
  bgVideoUrl: { type: String, default: '' },
  gifUrl: { type: String, default: '' },
  audioTrack: { type: String, default: '' },
  videoPath: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const MongoVideo = mongoose.model('Video', VideoSchema);

// Unified access layer to handle MongoDB/JSON transparently
export async function getVideos() {
  if (isFallbackDB) {
    return await fallbackDB.getAll();
  } else {
    return await MongoVideo.find().sort({ createdAt: -1 });
  }
}

export async function getVideoById(id) {
  if (isFallbackDB) {
    const all = await fallbackDB.getAll();
    return all.find(r => r._id === id) || null;
  } else {
    return await MongoVideo.findById(id);
  }
}

export async function createVideoRecord(data) {
  if (isFallbackDB) {
    const id = new mongoose.Types.ObjectId().toString();
    const record = {
      _id: id,
      status: 'scraping',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data
    };
    return await fallbackDB.save(record);
  } else {
    const record = new MongoVideo(data);
    await record.save();
    return record;
  }
}

export async function updateVideoStatus(id, status, details = {}) {
  if (isFallbackDB) {
    return await fallbackDB.updateStatus(id, status, details);
  } else {
    const record = await MongoVideo.findById(id);
    if (!record) return null;
    record.status = status;
    record.updatedAt = new Date();
    
    // Dynamically apply other details
    Object.keys(details).forEach(key => {
      record[key] = details[key];
    });
    
    await record.save();
    return record;
  }
}
