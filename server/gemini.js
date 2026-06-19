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
          description: "Music vibe to overlay. Choose 'mission_impossible' for suspense/hacking/tech/action, 'pink_panther' for funny/sneaky/quirky, 'imperial_march' for villain/warning/fail, 'gonna_fly_now' for motivational/fitness/success, 'titanic_sad' for sad/emotional/dramatic.",
          enum: ["mission_impossible", "pink_panther", "imperial_march", "gonna_fly_now", "titanic_sad"] 
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
  console.log('[Gemini] Generating fallback mock content dynamically.');
  const lowercaseDesc = description.toLowerCase();
  
  // 1. Extract Product Name
  let name = '';
  const namePatterns = [
    /product name is (?:a\s+|an\s+)?([a-zA-Z0-9\s-_'"]{1,20})/i,
    /called (?:a\s+|an\s+)?([a-zA-Z0-9\s-_'"]{1,20})/i,
    /called:?\s*([a-zA-Z0-9\s-_'"]{1,20})/i,
    /product:?\s*([a-zA-Z0-9\s-_'"]{1,20})/i,
    /name:?\s*([a-zA-Z0-9\s-_'"]{1,20})/i,
    /for (?:a\s+|an\s+)?([a-zA-Z0-9\s-_'"]{1,20})/i,
    /about (?:a\s+|an\s+)?([a-zA-Z0-9\s-_'"]{1,20})/i
  ];

  for (const pattern of namePatterns) {
    const match = description.match(pattern);
    if (match && match[1]) {
      name = match[1].trim();
      break;
    }
  }

  if (!name) {
    const urlMatch = description.match(/(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+)\.[a-z]+/i);
    if (urlMatch && urlMatch[1]) {
      name = urlMatch[1];
    }
  }

  if (!name) {
    const cleanDesc = description.replace(/https?:\/\/\S+/g, '').replace(/[^a-zA-Z0-9\s]/g, '').trim();
    const words = cleanDesc.split(/\s+/).filter(w => w.length > 0);
    if (words.length > 0) {
      name = words.slice(0, Math.min(3, words.length)).join(' ');
    }
  }

  if (!name || name.toLowerCase() === 'pitch') {
    name = 'Your Product';
  } else {
    name = name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }

  // 2. Determine Category, Video Keywords, and Hooks
  let videoQuery = [];
  let gifQuery = [];
  let hooks = [];
  let audio = 'gonna_fly_now';
  let vibe = 'funny';

  if (lowercaseDesc.includes('fit') || lowercaseDesc.includes('gym') || lowercaseDesc.includes('health') || lowercaseDesc.includes('calorie') || lowercaseDesc.includes('workout')) {
    videoQuery = ['gym workout vertical', 'person lifting weights vertical'];
    gifQuery = ['heavy lifting', 'tired dog'];
    hooks = [
      `POV: you finally stopped guessing calories with ${name} 👀`,
      `me looking at my gym schedule like I actually go 🤡 thanks to ${name}`,
      `when the preworkout hits and you open ${name} ⚡`
    ];
    audio = 'gonna_fly_now'; // Rocky theme
    vibe = 'energetic';
  } else if (lowercaseDesc.includes('food') || lowercaseDesc.includes('eat') || lowercaseDesc.includes('cook') || lowercaseDesc.includes('recipe') || lowercaseDesc.includes('tomato') || lowercaseDesc.includes('restaurant')) {
    videoQuery = ['cooking meal close up vertical', 'eating salad vertical'];
    gifQuery = ['tasty food', 'drooling'];
    hooks = [
      `stop scrolling if you literally hate cooking but love eating ${name} 🤤`,
      `my kitchen skills at 2 AM vs normal hours with ${name} 🍳`,
      `POV: you tried ${name} and now you can't stop eating it 🍕`
    ];
    audio = 'pink_panther'; // quirky theme
    vibe = 'aesthetic';
  } else if (lowercaseDesc.includes('code') || lowercaseDesc.includes('dev') || lowercaseDesc.includes('tech') || lowercaseDesc.includes('scale') || lowercaseDesc.includes('api') || lowercaseDesc.includes('laptop') || lowercaseDesc.includes('server') || lowercaseDesc.includes('web') || lowercaseDesc.includes('keyboard') || lowercaseDesc.includes('typing') || lowercaseDesc.includes('app') || lowercaseDesc.includes('software') || lowercaseDesc.includes('ai') || lowercaseDesc.includes('program') || lowercaseDesc.includes('system') || lowercaseDesc.includes('database')) {
    videoQuery = ['coding on laptop vertical', 'person working vertical'];
    gifQuery = ['cat laptop', 'typing fast'];
    hooks = [
      `POV: you are trying to write code for ${name} without breaking it 💀`,
      `me pretending to understand what my ${name} code does 🫠`,
      `unpopular opinion: using ${name} is the only hack that actually works 🤫`
    ];
    audio = 'mission_impossible'; // hack/suspense theme
    vibe = 'funny';
  } else if (lowercaseDesc.includes('sad') || lowercaseDesc.includes('cry') || lowercaseDesc.includes('broken') || lowercaseDesc.includes('bad') || lowercaseDesc.includes('emotional')) {
    videoQuery = ['rain on window vertical', 'sad person portrait vertical'];
    gifQuery = ['crying', 'sad face'];
    hooks = [
      `POV: when ${name} doesn't work but you still love it 😭`,
      `me pretending I'm fine but thinking about ${name} 💔`,
      `that sad moment when you realize you need ${name} in your life 💀`
    ];
    audio = 'titanic_sad'; // sad theme
    vibe = 'relatable';
  } else {
    // Random default selection
    const audioOptions = ['mission_impossible', 'pink_panther', 'imperial_march', 'gonna_fly_now', 'titanic_sad'];
    audio = audioOptions[Math.floor(Math.random() * audioOptions.length)];
    
    const vibeOptions = ['energetic', 'calm', 'funny', 'aesthetic', 'relatable'];
    vibe = vibeOptions[Math.floor(Math.random() * vibeOptions.length)];

    videoQuery = ['abstract gradient loop vertical', 'colorful background loop vertical'];
    gifQuery = ['mind blown', 'excited'];
    hooks = [
      `POV: you finally found ${name} and it changes everything 👀`,
      `me explaining why I spent my last $20 on ${name} 🤡`,
      `unpopular opinion: you actually need ${name} in your life 🤫`
    ];
  }

  // 3. Audio vibe term overrides (if user explicitly requests a theme or emotion)
  if (lowercaseDesc.includes('sad') || lowercaseDesc.includes('emotional') || lowercaseDesc.includes('cry')) {
    audio = 'titanic_sad';
  } else if (lowercaseDesc.includes('epic') || lowercaseDesc.includes('action') || lowercaseDesc.includes('suspense') || lowercaseDesc.includes('mission') || lowercaseDesc.includes('hack')) {
    audio = 'mission_impossible';
  } else if (lowercaseDesc.includes('villain') || lowercaseDesc.includes('evil') || lowercaseDesc.includes('fail') || lowercaseDesc.includes('darth') || lowercaseDesc.includes('star wars') || lowercaseDesc.includes('imperial')) {
    audio = 'imperial_march';
  } else if (lowercaseDesc.includes('fitness') || lowercaseDesc.includes('motivation') || lowercaseDesc.includes('workout') || lowercaseDesc.includes('rocky') || lowercaseDesc.includes('win')) {
    audio = 'gonna_fly_now';
  } else if (lowercaseDesc.includes('funny') || lowercaseDesc.includes('sneaky') || lowercaseDesc.includes('comedy') || lowercaseDesc.includes('panther')) {
    audio = 'pink_panther';
  }

  // 4. GIF keyword overrides
  if (lowercaseDesc.includes('meme') || lowercaseDesc.includes('funny') || lowercaseDesc.includes('laugh')) {
    gifQuery = ['funny meme', 'hilarious reaction', 'cat reaction'];
    vibe = 'funny';
  }

  // 5. Custom hook extraction (quotes check)
  const quoteMatch = description.match(/"([^"]{8,80})"/);
  if (quoteMatch && quoteMatch[1]) {
    hooks.unshift(quoteMatch[1]);
  }

  // Select a random hook from the generated array to make it different every time!
  const selectedHook = hooks[Math.floor(Math.random() * hooks.length)] || `POV: you are using ${name} for the first time 😳`;

  return {
    productName: name,
    ugcHooks: hooks.length > 0 ? hooks : [selectedHook],
    selectedHook: selectedHook,
    vibe: vibe,
    bgVideoKeywords: videoQuery,
    gifKeywords: gifQuery,
    audioVibe: audio
  };
}
