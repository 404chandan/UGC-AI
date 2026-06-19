import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { isFallbackDB } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FALLBACK_USERS_PATH = path.join(__dirname, 'db_users_fallback.json');

// Initialize users JSON file if it doesn't exist
if (!fs.existsSync(FALLBACK_USERS_PATH)) {
  fs.writeFileSync(FALLBACK_USERS_PATH, JSON.stringify([], null, 2));
}

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, lowercase: true },
  passwordHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const MongoUser = mongoose.model('User', UserSchema);

export const userFallbackDB = {
  async getAll() {
    try {
      const data = await fs.promises.readFile(FALLBACK_USERS_PATH, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      return [];
    }
  },

  async findByUsername(username) {
    const users = await this.getAll();
    const cleanUsername = username.trim().toLowerCase();
    return users.find(u => u.username === cleanUsername) || null;
  },

  async findById(id) {
    const users = await this.getAll();
    return users.find(u => u._id === id) || null;
  },

  async create(username, password) {
    const users = await this.getAll();
    const cleanUsername = username.trim().toLowerCase();
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    const newUser = {
      _id: new mongoose.Types.ObjectId().toString(),
      username: cleanUsername,
      passwordHash: passwordHash,
      createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    await fs.promises.writeFile(FALLBACK_USERS_PATH, JSON.stringify(users, null, 2));
    return newUser;
  }
};

/**
 * Registers a new user (handles both MongoDB and JSON Fallback)
 */
export async function registerUser(username, password) {
  const cleanUsername = username.trim().toLowerCase();
  
  if (isFallbackDB) {
    // Check if exists
    const existing = await userFallbackDB.findByUsername(cleanUsername);
    if (existing) {
      throw new Error('Username already exists');
    }
    return await userFallbackDB.create(cleanUsername, password);
  } else {
    // Check if exists in Mongo
    const existing = await MongoUser.findOne({ username: cleanUsername });
    if (existing) {
      throw new Error('Username already exists');
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    const user = new MongoUser({
      username: cleanUsername,
      passwordHash
    });
    await user.save();
    return user;
  }
}

/**
 * Authenticates user credentials (handles both MongoDB and JSON Fallback)
 */
export async function authenticateUser(username, password) {
  const cleanUsername = username.trim().toLowerCase();
  let user = null;
  
  if (isFallbackDB) {
    user = await userFallbackDB.findByUsername(cleanUsername);
  } else {
    user = await MongoUser.findOne({ username: cleanUsername });
  }
  
  if (!user) {
    throw new Error('Invalid username or password');
  }
  
  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw new Error('Invalid username or password');
  }
  
  return {
    id: user._id.toString(),
    username: user.username
  };
}

/**
 * Finds user by ID
 */
export async function findUserById(id) {
  if (isFallbackDB) {
    return await userFallbackDB.findById(id);
  } else {
    return await MongoUser.findById(id);
  }
}
