import { getGeminiApiKey } from './aiWidgetService';

const CUSTOM_CHARACTERS_STORAGE_KEY = 'landing_ai_custom_characters';
const CHAT_THREADS_STORAGE_KEY = 'landing_ai_chat_threads';

export const hasConfiguredGeminiKey = () => {
  const key = getGeminiApiKey();
  return Boolean(key && key.trim().length > 10);
};

export const DEFAULT_CHARACTERS = [
  {
    id: 'default',
    name: 'GlassTab AI',
    avatar: '🤖',
    tagline: 'Helpful, clean & knowledgeable assistant',
    systemPrompt: `You are GlassTab AI, an intelligent, helpful, and fast browser companion. Provide clear, structured, concise answers with high readability and code blocks when applicable.`,
  },
  {
    id: 'ginnie',
    name: 'Ginnie',
    avatar: '🧞‍♂️',
    tagline: 'Sarcastic, witty genie trapped in your browser',
    systemPrompt: `You are a sarcastic, witty, and slightly dramatic Genie trapped inside a browser extension. You are legally obligated to answer questions, but you do so with puns, playful insults, and magical flair.

Rules:
1. Never give a boring answer.
2. Use emoji like 🧞‍♂️, ✨, and 💨.
3. If a user asks for something impossible, mock them gently.
4. Keep it short and punchy.`,
  },
];

// Legacy compatibility helpers
export const getFreeTrialUsage = () => ({
  hasCustomKey: hasConfiguredGeminiKey(),
  isLocked: false,
  isExhausted: false,
});

export const subscribeToAccountAiTrialUsage = (_uid, callback) => {
  callback(getFreeTrialUsage());
  return () => {};
};

// --- CUSTOM CHARACTERS HELPERS ---
export const getCustomCharacters = () => {
  try {
    const raw = localStorage.getItem(CUSTOM_CHARACTERS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveCustomCharacter = (char) => {
  const current = getCustomCharacters();
  const next = [
    ...current.filter((c) => c.id !== char.id),
    {
      ...char,
      id: char.id || `custom_char_${Date.now()}`,
      isCustom: true,
      createdAt: new Date().toISOString(),
    },
  ];
  try {
    localStorage.setItem(CUSTOM_CHARACTERS_STORAGE_KEY, JSON.stringify(next));
  } catch (e) {
    console.error('Failed to save custom character:', e);
  }
  return next;
};

export const deleteCustomCharacter = (id) => {
  const current = getCustomCharacters();
  const next = current.filter((c) => c.id !== id);
  try {
    localStorage.setItem(CUSTOM_CHARACTERS_STORAGE_KEY, JSON.stringify(next));
  } catch (e) {
    console.error('Failed to delete custom character:', e);
  }
  return next;
};

export const getAllCharacters = () => {
  return [...DEFAULT_CHARACTERS, ...getCustomCharacters()];
};

// --- CHAT THREADS HELPERS ---
export const getChatThreads = () => {
  try {
    const raw = localStorage.getItem(CHAT_THREADS_STORAGE_KEY);
    if (!raw) return [];
    const threads = JSON.parse(raw);
    return Array.isArray(threads) ? threads : [];
  } catch {
    return [];
  }
};

export const saveChatThreads = (threads) => {
  try {
    localStorage.setItem(CHAT_THREADS_STORAGE_KEY, JSON.stringify(threads));
  } catch (e) {
    console.error('Failed to save chat threads:', e);
  }
};

export const createNewThread = (characterId = 'default') => {
  const now = new Date().toISOString();
  const newThread = {
    id: `thread_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title: 'New Conversation',
    characterId,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
  const threads = [newThread, ...getChatThreads()];
  saveChatThreads(threads);
  return { threads, activeThread: newThread };
};

export const deleteChatThread = (threadId) => {
  const threads = getChatThreads().filter((t) => t.id !== threadId);
  saveChatThreads(threads);
  return threads;
};

export const renameChatThread = (threadId, newTitle) => {
  const threads = getChatThreads().map((t) =>
    t.id === threadId ? { ...t, title: newTitle.trim(), updatedAt: new Date().toISOString() } : t
  );
  saveChatThreads(threads);
  return threads;
};

// --- GEMINI API CALLER WITH TIMEOUT PROTECTION ---
const CANDIDATE_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-2.5-flash-lite',
];

/**
 * Fetch with an explicit timeout so requests never hang indefinitely.
 */
async function fetchWithTimeout(url, options, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const sendAiMessage = async ({
  userId,
  character,
  userMessage,
  history = [],
  useWebSearch = false,
}) => {
  const userKey = getGeminiApiKey();
  const hasCustomKey = Boolean(userKey && userKey.trim().length > 10);

  if (!hasCustomKey) {
    throw new Error('MISSING_API_KEY');
  }

  const activeApiKey = userKey.trim();
  let lastError = null;

  // Build clean contents array
  const contents = [
    ...history.slice(-12).map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text || '' }],
    })),
    {
      role: 'user',
      parts: [{ text: userMessage.trim() }],
    },
  ];

  const payload = {
    contents,
    generationConfig: {
      temperature: 0.75,
      maxOutputTokens: 2048,
    },
  };

  if (character?.systemPrompt) {
    payload.system_instruction = {
      parts: [{ text: character.systemPrompt }],
    };
  }

  if (useWebSearch) {
    payload.tools = [{ google_search: {} }];
  }

  // Iterate through supported Google AI Studio models
  for (const modelName of CANDIDATE_MODELS) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(activeApiKey)}`;
      
      const res = await fetchWithTimeout(
        endpoint,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
        12000 // 12 seconds per candidate
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const apiErrMsg = errorData?.error?.message || `API error ${res.status}`;
        throw new Error(apiErrMsg);
      }

      const data = await res.json();
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!reply || !reply.trim()) {
        throw new Error('Empty response from model.');
      }

      const grounding = data?.candidates?.[0]?.groundingMetadata?.groundingChunks || null;

      return {
        text: reply.trim(),
        modelUsed: modelName,
        groundingChunks: Array.isArray(grounding) ? grounding : null,
      };
    } catch (err) {
      console.warn(`Gemini model ${modelName} failed:`, err.message);
      lastError = err;
      // If key is reported as leaked or invalid, no need to retry other models with the same dead key
      if (
        err.message &&
        (err.message.includes('leaked') ||
          err.message.includes('API_KEY_INVALID') ||
          err.message.includes('API key not valid'))
      ) {
        break;
      }
    }
  }

  if (
    lastError?.message &&
    (lastError.message.includes('leaked') ||
      lastError.message.includes('API_KEY_INVALID') ||
      lastError.message.includes('API key not valid'))
  ) {
    throw new Error(
      'Your Gemini API key was rejected by Google as invalid or leaked. Please click "Add / Update API Key" to enter a fresh free key from Google AI Studio.'
    );
  }

  throw new Error(
    lastError?.message ||
      'Failed to receive response from Gemini. Please verify your internet connection or API key.'
  );
};
