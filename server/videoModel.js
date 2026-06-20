import mongoose from 'mongoose';
import { isFallbackDB, fallbackDB } from './db.js';

const VideoSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  productName: { type: String, default: '' },
  productDescription: { type: String, required: true },
  websiteUrl: { type: String, default: '' },
  status: { 
    type: String, 
    enum: ['scraping', 'planning', 'downloading', 'rendering', 'completed', 'failed'], 
    default: 'scraping' 
  },
  isPaused: { type: Boolean, default: false },
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
  chatHistory: { type: [mongoose.Schema.Types.Mixed], default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const MongoVideo = mongoose.model('Video', VideoSchema);

// Helper to keep chat history and progress widget steps in sync with db status
function syncChatHistory(chatHistory, status, errorMsg = '', productName = '') {
  if (!Array.isArray(chatHistory) || chatHistory.length === 0) {
    return chatHistory;
  }
  
  // Find widget message in history
  const widgetIdx = chatHistory.findIndex(m => m.isWidget);
  if (widgetIdx !== -1) {
    chatHistory[widgetIdx] = {
      ...chatHistory[widgetIdx],
      status: status
    };
    if (productName) {
      chatHistory[widgetIdx].videoRecord = {
        ...chatHistory[widgetIdx].videoRecord,
        productName: productName
      };
    }
  }
  
  // Check if we already appended a final done/fail message to avoid duplicates
  const hasFinalMsg = chatHistory.some(m => m.id.startsWith('done-') || m.id.startsWith('fail-'));
  if (!hasFinalMsg) {
    if (status === 'completed') {
      chatHistory.push({
        id: `done-${Date.now()}`,
        sender: 'bot',
        text: `✨ Done! Your UGC short is ready. "${productName || 'Your product'}" is going to be viral. 📈 Check the interactive phone preview on the right!`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    } else if (status === 'failed') {
      chatHistory.push({
        id: `fail-${Date.now()}`,
        sender: 'bot',
        text: `❌ Oh no, rendering failed: ${errorMsg || 'Unknown rendering engine error'}`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    }
  }
  
  return chatHistory;
}

// Unified access layer to handle MongoDB/JSON transparently
export async function getVideos(userId) {
  if (isFallbackDB) {
    const all = await fallbackDB.getAll();
    return all.filter(r => r.userId === userId);
  } else {
    return await MongoVideo.find({ userId }).sort({ createdAt: -1 });
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
  // 1. Fetch current record details to read current chatHistory
  const record = await getVideoById(id);
  if (!record) return null;

  // 2. Sync chatHistory based on new status
  const productName = details.productName || record.productName;
  const errorMsg = details.error || record.error;
  const updatedChatHistory = syncChatHistory(
    [...(record.chatHistory || [])],
    status,
    errorMsg,
    productName
  );

  const fullDetails = {
    ...details,
    chatHistory: updatedChatHistory
  };

  if (isFallbackDB) {
    return await fallbackDB.updateStatus(id, status, fullDetails);
  } else {
    const mongoRecord = await MongoVideo.findById(id);
    if (!mongoRecord) return null;
    mongoRecord.status = status;
    mongoRecord.updatedAt = new Date();
    
    // Dynamically apply details
    Object.keys(fullDetails).forEach(key => {
      mongoRecord[key] = fullDetails[key];
    });
    
    await mongoRecord.save();
    return mongoRecord;
  }
}

export async function updateVideoChatHistory(id, chatHistory) {
  const record = await getVideoById(id);
  if (!record) return null;
  
  if (isFallbackDB) {
    return await fallbackDB.updateStatus(id, record.status, { chatHistory });
  } else {
    const mongoRecord = await MongoVideo.findById(id);
    if (!mongoRecord) return null;
    mongoRecord.chatHistory = chatHistory;
    mongoRecord.updatedAt = new Date();
    await mongoRecord.save();
    return mongoRecord;
  }
}

export async function deleteVideoRecord(id) {
  if (isFallbackDB) {
    return await fallbackDB.delete(id);
  } else {
    return await MongoVideo.findByIdAndDelete(id);
  }
}
