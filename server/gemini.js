import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Generates UGC hooks, search keywords, and vibes using Gemini API
 * @param {string} description - User's product description
 * @param {string} scrapedContent - Text scraped from the website
 * @returns {Promise<object>} Planned asset selections and copy
 */
export async function planUGCContent(description, scrapedContent) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[Gemini] GEMINI_API_KEY is missing! Using mock content generation.');
    return getMockContent(description);
  }

  console.log('[Gemini] Planning UGC content with Gemini...');
  const genAI = new GoogleGenerativeAI(apiKey);
  
  // Use gemini-1.5-flash as the fast, cost-effective default model
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `
You are a Gen Z UGC (User Generated Content) TikTok & Instagram Reels viral marketing expert.
Your job is to read a user's product description and its website's scraped text, understand the product, and plan a short 5-10 second UGC style video concept that is funny, clever, self-aware, and fits current social media trends.

Guidelines for copy:
- Do NOT make it sound like a corporate ad. Avoid words like "revolutionary", "introducing", "seamless", "the ultimate solution".
- Use Gen Z formatting, lowercase where appropriate, trendy slang, and self-aware humor.
- Example TikTok templates:
  * "POV: you finally stop guessing calories 👀"
  * "My therapist: 'So, are we going to fix your posture or just keep complaining?' Me:"
  * "Unpopular opinion: this is the only productivity hack that actually works 🤫"
  * "I was today years old when I found out you can..."
  * "the scream I scrumpt when I saw..."
  * "tell me you're addicted to caffeine without telling me..."

Product Description:
"${description}"

Scraped Website Content:
"${scrapedContent}"

Generate a structured JSON output mapping the planned assets according to the provided schema.
`;

  try {
    const responseSchema = {
      type: "object",
      properties: {
        productName: { type: "string", description: "Catchy short name of the product (1-3 words)" },
        ugcHooks: { 
          type: "array", 
          items: { type: "string" },
          description: "3 highly engaging, trendy, funny UGC hook texts. Keep them under 70 characters each and include emojis. They should feel like text captions on TikTok/Reels."
        },
        selectedHook: { type: "string", description: "The single best and funniest hook selected from the ugcHooks array." },
        vibe: { 
          type: "string", 
          description: "Vibe/tone category",
          enum: ["energetic", "calm", "funny", "aesthetic", "relatable"] 
        },
        bgVideoKeywords: { 
          type: "array", 
          items: { type: "string" }, 
          description: "3 search queries for vertical stock video search (e.g. 'frustrated typing on laptop vertical', 'person cooking in kitchen vertical', 'aesthetic bedroom portrait'). Keep them simple and search-friendly."
        },
        gifKeywords: { 
          type: "array", 
          items: { type: "string" },
          description: "3 search queries for Giphy reaction/meme GIFs (e.g. 'mind blown', 'facepalm', 'happy dance', 'side eye')."
        },
        audioVibe: { 
          type: "string", 
          description: "Music genre to overlay",
          enum: ["energetic_pop", "lofi_chill", "funky_groove", "corporate_beat", "dramatic_synth"] 
        }
      },
      required: ["productName", "ugcHooks", "selectedHook", "vibe", "bgVideoKeywords", "gifKeywords", "audioVibe"]
    };

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.85
      }
    });

    const responseText = result.response.text();
    console.log('[Gemini] Generation result:', responseText);
    return JSON.parse(responseText);
  } catch (error) {
    console.error('[Gemini] Planning failed:', error);
    return getMockContent(description);
  }
}

/**
 * Fallback mock generator in case of API failures or missing key
 */
function getMockContent(description) {
  console.log('[Gemini] Generating fallback mock content.');
  const lowercaseDesc = description.toLowerCase();
  
  let name = 'Your Product';
  let videoQuery = ['coding on laptop vertical', 'person working vertical'];
  let gifQuery = ['cat laptop', 'typing fast'];
  let hooks = [
    'POV: you are trying to write code without breaking it 💀',
    'me pretending to understand what my boss is saying 🫠',
    'if this isn\'t your daily routine, what are you doing? 🤨'
  ];
  let audio = 'energetic_pop';
  
  if (lowercaseDesc.includes('fit') || lowercaseDesc.includes('gym') || lowercaseDesc.includes('health') || lowercaseDesc.includes('calorie')) {
    name = 'FitLife';
    videoQuery = ['gym workout vertical', 'person lifting weights vertical'];
    gifQuery = ['heavy lifting', 'tired dog'];
    hooks = [
      'POV: you finally stopped guessing calories and did this 👀',
      'me looking at my gym schedule like I actually go 🤡',
      'when the preworkout hits and you can see colors ⚡'
    ];
    audio = 'energetic_pop';
  } else if (lowercaseDesc.includes('food') || lowercaseDesc.includes('eat') || lowercaseDesc.includes('cook') || lowercaseDesc.includes('recipe')) {
    name = 'NomNom';
    videoQuery = ['cooking meal close up vertical', 'eating salad vertical'];
    gifQuery = ['tasty food', 'drooling'];
    hooks = [
      'stop scrolling if you literally hate cooking but love eating 🤤',
      'my kitchen skills at 2 AM vs normal hours 🍳',
      'the exact moment I gave up on ordering takeout 💸'
    ];
    audio = 'funky_groove';
  }

  return {
    productName: name,
    ugcHooks: hooks,
    selectedHook: hooks[0],
    vibe: 'funny',
    bgVideoKeywords: videoQuery,
    gifKeywords: gifQuery,
    audioVibe: audio
  };
}
