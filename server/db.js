import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export let isFallbackDB = false;
const FALLBACK_DB_PATH = path.join(__dirname, 'db_fallback.json');

// Initialize JSON fallback database if it doesn't exist
if (!fs.existsSync(FALLBACK_DB_PATH)) {
  fs.writeFileSync(FALLBACK_DB_PATH, JSON.stringify([], null, 2));
}

export async function connectDB() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ugc-generator';
  console.log(`Connecting to MongoDB at ${mongoUri}...`);
  
  try {
    // Set connection timeout to 3 seconds to fail fast if Mongo is not running
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 3000
    });
    console.log('Successfully connected to MongoDB.');
    isFallbackDB = false;
  } catch (error) {
    console.warn('\n======================================================');
    console.warn('WARNING: MongoDB is not running or could not be reached.');
    console.warn('Falling back to local JSON storage (db_fallback.json).');
    console.warn('======================================================\n');
    isFallbackDB = true;
  }
}

// Fallback DB CRUD operations
export const fallbackDB = {
  async getAll() {
    try {
      const data = await fs.promises.readFile(FALLBACK_DB_PATH, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      return [];
    }
  },
  
  async save(record) {
    try {
      const records = await this.getAll();
      const newRecord = {
        _id: record._id || new mongoose.Types.ObjectId().toString(),
        createdAt: record.createdAt || new Date().toISOString(),
        ...record
      };
      records.unshift(newRecord); // Add to the beginning of the list
      await fs.promises.writeFile(FALLBACK_DB_PATH, JSON.stringify(records, null, 2));
      return newRecord;
    } catch (e) {
      console.error('Failed to write to fallback DB:', e);
      throw e;
    }
  },

  async updateStatus(id, status, details = {}) {
    try {
      const records = await this.getAll();
      const idx = records.findIndex(r => r._id === id);
      if (idx !== -1) {
        records[idx] = {
          ...records[idx],
          status,
          ...details,
          updatedAt: new Date().toISOString()
        };
        await fs.promises.writeFile(FALLBACK_DB_PATH, JSON.stringify(records, null, 2));
        return records[idx];
      }
      return null;
    } catch (e) {
      console.error('Failed to update fallback DB:', e);
      throw e;
    }
  },

  async delete(id) {
    try {
      const records = await this.getAll();
      const filtered = records.filter(r => r._id !== id);
      await fs.promises.writeFile(FALLBACK_DB_PATH, JSON.stringify(filtered, null, 2));
      return true;
    } catch (e) {
      console.error('Failed to delete from fallback DB:', e);
      throw e;
    }
  }
};
