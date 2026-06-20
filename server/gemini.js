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

/**
 * Chats with the UGC Director AI assistant.
 * Analyzes the user's message to decide if it's an explicit request to generate a video.
 * If so, extracts the description/url. Otherwise, returns a conversational reply.
 * @param {string} message - User's chat message
 * @param {array} chatHistory - Array of past messages
 * @returns {Promise<object>} Response containing isGenerationRequest, description, url, reply
 */
export async function chatWithDirector(message, chatHistory = []) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[Gemini] GEMINI_API_KEY is missing! Using mock chat agent.');
    return getMockChatResponse(message, chatHistory);
  }

  console.log('[Gemini] Conversational chat query with UGC Director...');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  // Format past history for Gemini context if available
  const historyText = chatHistory
    .filter(m => !m.isWidget && !m.isTyping) // exclude system widgets or typing indicators
    .map(m => `${m.sender === 'user' ? 'User' : 'UGC Director'}: ${m.text}`)
    .join('\n');

  const prompt = `
You are the "UGC Director", a viral short-form video copywriter, video editor, and expert social media director.
You are chatting with a user who is building video marketing content. Keep your tone helpful, creative, friendly, and Gen-Z savvy (using emojis, trendy vibe, but professional when explaining video metrics or workflows).

Your goal is to converse naturally with the user. Answer questions about UGC videos, how the tool works, video marketing tips, or just greet them.

HOWEVER, you must also detect if the user's latest message is an EXPLICIT request to generate or produce a video for a product or service.
For example:
- "make a video for sunrise alarm clock" -> isGenerationRequest: true
- "generate a reel for my skincare brand" -> isGenerationRequest: true
- "need a short for this website: http://example.com" -> isGenerationRequest: true
- "hi" -> isGenerationRequest: false
- "tell me about what you do" -> isGenerationRequest: false
- "what kind of hooks work best?" -> isGenerationRequest: false

Latest User Message:
"${message}"

Recent Conversation History:
${historyText || "(No history)"}

Generate a structured JSON output according to the provided schema.
`;

  try {
    const chatResponseSchema = {
      type: "object",
      properties: {
        isGenerationRequest: { 
          type: "boolean", 
          description: "true if the user is explicitly requesting to generate/produce/create a video now." 
        },
        description: { 
          type: "string", 
          description: "If isGenerationRequest is true, extract the product description/pitch to use for generation. Otherwise, leave empty." 
        },
        url: { 
          type: "string", 
          description: "If isGenerationRequest is true and the user provided a URL, extract it. Otherwise, leave empty." 
        },
        reply: { 
          type: "string", 
          description: "If isGenerationRequest is false, your natural conversational reply. If isGenerationRequest is true, a short, excited response confirming you're starting the video generator now (e.g. 'OMG yes! Generating that video for you right now... 🚀')." 
        }
      },
      required: ["isGenerationRequest", "description", "url", "reply"]
    };

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: chatResponseSchema,
        temperature: 0.7
      }
    });

    const responseText = result.response.text();
    console.log('[Gemini] Chat agent response:', responseText);
    return JSON.parse(responseText);
  } catch (error) {
    console.error('[Gemini] Chat agent failed:', error);
    return getMockChatResponse(message, chatHistory);
  }
}

/**
 * Mock conversational responses if GEMINI_API_KEY is not set
 */
function getMockChatResponse(message, chatHistory) {
  const cleanMsg = message.toLowerCase().trim();

  // Rules-based classifier for generation requests
  const generateWords = ['generate', 'make', 'create', 'produce', 'render', 'build', 'video for', 'short for', 'need a video'];
  const isGenRequest = generateWords.some(word => cleanMsg.includes(word)) && cleanMsg.length > 8;

  if (isGenRequest) {
    // Attempt to extract product name/description
    let desc = message;
    generateWords.forEach(w => {
      desc = desc.replace(new RegExp(w, 'gi'), '');
    });
    desc = desc.replace(/please/gi, '').replace(/about/gi, '').replace(/for/gi, '').trim();
    if (!desc) desc = "A cool product";

    // Attempt to extract URL
    const urlMatch = message.match(/(https?:\/\/[^\s]+)/i);
    const url = urlMatch ? urlMatch[1] : '';

    return {
      isGenerationRequest: true,
      description: desc,
      url: url,
      reply: `Got it! Let's generate a video for "${desc}" right away! 🎬🚀`
    };
  }

  // Conversational response options based on keywords
  let reply = '';
  if (cleanMsg === 'hi' || cleanMsg === 'hello' || cleanMsg === 'hey' || cleanMsg === 'yo') {
    reply = "Hey there! 👋 I am UGC Chat, your personal video editor and director. Ready to write some viral hooks, find stock loops, and compile a premium short-form video? Just describe your product or type 'Make a video for [product name]'!";
  } else if (cleanMsg.includes('who are you') || cleanMsg.includes('your name') || cleanMsg.includes('what are you')) {
    reply = "I am UGC Chat! 🎬 I'm a Gen-Z styled UGC video copywriter, planner, and editor. I help you turn ideas or website links into short-form viral videos in seconds.";
  } else if (cleanMsg.includes('what can you do') || cleanMsg.includes('help') || cleanMsg.includes('features')) {
    reply = "I can generate full UGC video shorts! Provide a website URL or product pitch, and I'll script viral hooks, grab stock videos/gifs, mix trending audio, and compile a 9:16 video. E.g. try: 'Make a video for a smart water bottle'";
  } else if (cleanMsg.includes('hook') || cleanMsg.includes('viral')) {
    reply = "Viral hooks need to be self-aware and Gen-Z focused! E.g. 'POV: you finally stopped doing X 👀'. I write these dynamically to hook viewers in the first 3 seconds!";
  } else if (cleanMsg.includes('music') || cleanMsg.includes('audio') || cleanMsg.includes('sound')) {
    reply = "I mix trending Hollywood and cinematic audio tracks like the Rocky theme, Mission Impossible suspense BGM, Darth Vader's Imperial March, or Titanic's emotional theme!";
  } else if (cleanMsg.includes('joke')) {
    reply = "Why did the video editor go to therapy? Because they had too many cuts and couldn't resolve their transition issues! 🎬😂";
  } else if (cleanMsg.includes('thank') || cleanMsg.includes('cool') || cleanMsg.includes('awesome') || cleanMsg.includes('nice')) {
    reply = "Aww, thank you! I'm here to help you get views and go viral. Let's make some content! 📈✨";
  } else {
    // Generate a contextual-looking response echoing back some query parts
    const topics = [];
    if (cleanMsg.includes('how')) topics.push('how it works');
    if (cleanMsg.includes('create')) topics.push('creating content');
    if (cleanMsg.includes('why')) topics.push('marketing stats');
    
    if (topics.length > 0) {
      reply = `That's a great question about ${topics.join(' and ')}! As UGC Chat, I plan templates, select vertical visuals, overlay Gen-Z captions, and compile everything using FFmpeg. Would you like to generate a video test now?`;
    } else {
      reply = `I hear you! I am UGC Chat. Since my AI connection is currently offline, I can chat with you about video tips, or you can describe your product pitch (e.g. 'Make a video for a fitness tracker') to start producing! 🚀`;
    }
  }

  return {
    isGenerationRequest: false,
    description: '',
    url: '',
    reply: reply
  };
}

/**
 * Local heuristic validation to verify if description and/or url make sense.
 * @param {string} desc
 * @param {string} u
 * @returns {{ isValid: boolean, reason: string }}
 */
function runHeuristicValidation(desc, u) {
  if (!desc && !u) {
    return { isValid: false, reason: "Product description or website URL is required." };
  }
  if (u && !u.includes('.')) {
    return { isValid: false, reason: "Please provide a valid website URL." };
  }
  
  // If there's no URL, we require a description of at least 5 characters
  if (!u) {
    if (desc.length < 5) {
      return { isValid: false, reason: "The description is too short to be a valid product pitch." };
    }
    const lower = desc.toLowerCase().trim();
    const useless = ['hi', 'hello', 'hey', 'test', 'asdf', 'yes', 'no', 'ok', 'okay', 'generate', 'video', 'generate video', 'make video'];
    if (useless.includes(lower) || lower.length < 3) {
      return { isValid: false, reason: "Please specify a product or service you want to create a video for." };
    }
  } else {
    // If there is a URL, but also a description, check if the description is a useless word
    if (desc) {
      const lower = desc.toLowerCase().trim();
      const useless = ['hi', 'hello', 'hey', 'test', 'asdf', 'yes', 'no', 'ok', 'okay', 'generate', 'video', 'generate video', 'make video'];
      if (useless.includes(lower)) {
        return { isValid: false, reason: "Please specify a product or service you want to create a video for." };
      }
    }
  }
  
  return { isValid: true, reason: "" };
}


/**
 * Validates if the given description and/or url make sense for a marketing pitch or product URL.
 * @param {string} description
 * @param {string} url
 * @returns {Promise<{ isValid: boolean, reason: string }>}
 */
export async function validateMarketingPitch(description, url) {
  const desc = (description || '').trim();
  const u = (url || '').trim();

  // 1. Run local heuristic check first to filter out obvious junk/gibberish instantly
  const heuristicResult = runHeuristicValidation(desc, u);
  if (!heuristicResult.isValid) {
    return heuristicResult;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return heuristicResult;
  }

  console.log('[Gemini] Validating marketing pitch...');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `
You are an expert marketing reviewer. Your task is to analyze a proposed video generation request and determine if it contains a valid, sensible product description/pitch or a valid website URL that can be used to generate a marketing video.

Input Pitch Description:
"${desc || '(None)'}"

Input Website URL:
"${u || '(None)'}"

A request does NOT make sense if:
- It is just generic greetings (e.g. "hi", "hello")
- It is gibberish, keyboard mashing (e.g. "asdf", "qwerty")
- It is just single generic words that don't specify any product or service (e.g. "test", "yes", "generate", "video")
- The URL is invalid or placeholder (e.g. "google", "none", "http")

A request DOES make sense if:
- It describes a product, app, service, store, brand, startup, or feature (even if brief, e.g. "sunrise alarm clock", "skincare brand for teens", "a mobile app to track habits").
- Or it provides a valid-looking website URL to scrape (e.g. "https://myproduct.com", "example.org").

Generate a structured JSON output with the following fields:
- isValid: boolean (true if it makes sense to generate a marketing video for this input, false otherwise)
- reason: string (if isValid is false, a polite, short feedback message telling the user what kind of input is expected)
`;

  try {
    const responseSchema = {
      type: "object",
      properties: {
        isValid: { type: "boolean" },
        reason: { type: "string" }
      },
      required: ["isValid", "reason"]
    };

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.1
      }
    });

    const responseText = result.response.text();
    console.log('[Gemini] Pitch validation result:', responseText);
    return JSON.parse(responseText);
  } catch (error) {
    console.error('[Gemini] Pitch validation failed, defaulting to heuristic result:', error);
    return heuristicResult;
  }
}

