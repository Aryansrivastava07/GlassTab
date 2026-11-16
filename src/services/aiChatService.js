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

// --- TIMEOUT PROTECTION ---
async function fetchWithTimeout(url, options, timeoutMs = 12000) {
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

// Current Gemini models (Gemini 3.5 & 3.8 family)
const INTERACTION_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-3.7-flash',
];

const GENERATE_CONTENT_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.5-flash',
];

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

  // 1. PRIMARY: Try modern Interactions API (Google recommended)
  const formattedHistory = history
    .slice(-12)
    .map((msg) => `${msg.role === 'user' ? 'User' : (character?.name || 'Assistant')}: ${msg.text}`)
    .join('\n\n');
  const interactionInput = formattedHistory
    ? `${formattedHistory}\n\nUser: ${userMessage.trim()}\n\n${character?.name || 'Assistant'}:`
    : userMessage.trim();

  for (const modelName of INTERACTION_MODELS) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/interactions?key=${encodeURIComponent(activeApiKey)}`;
      const payload = {
        model: modelName,
        input: interactionInput,
      };

      if (character?.systemPrompt) {
        payload.system_instruction = character.systemPrompt;
      }

      if (useWebSearch) {
        payload.tools = [{ type: 'google_search' }];
      }

      const res = await fetchWithTimeout(
        endpoint,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': activeApiKey,
            'Api-Revision': '2026-05-20',
          },
          body: JSON.stringify(payload),
        },
        12000
      );

      if (res.ok) {
        const data = await res.json();
        let replyText = '';

        if (typeof data?.output_text === 'string' && data.output_text) {
          replyText = data.output_text;
        } else if (Array.isArray(data?.steps)) {
          const modelSteps = data.steps.filter((s) => s.type === 'model_output');
          const lastStep = modelSteps[modelSteps.length - 1];
          const textPart = lastStep?.content?.find((c) => c.type === 'text');
          replyText = textPart?.text || '';
        } else if (Array.isArray(data?.outputs)) {
          const textOutputs = data.outputs.filter((o) => o.type === 'text');
          replyText = textOutputs[textOutputs.length - 1]?.text || '';
        }

        if (replyText && replyText.trim()) {
          const grounding = data?.grounding_metadata?.grounding_chunks || null;
          return {
            text: replyText.trim(),
            modelUsed: modelName,
            groundingChunks: Array.isArray(grounding) ? grounding : null,
          };
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        const errMsg = errJson?.error?.message || `Interactions API error ${res.status}`;
        lastError = new Error(errMsg);

        // Check for fatal credential rejection
        if (
          errMsg.includes('leaked') ||
          errMsg.includes('API_KEY_INVALID') ||
          errMsg.includes('API key not valid')
        ) {
          throw lastError;
        }
      }
    } catch (err) {
      if (
        err.message &&
        (err.message.includes('leaked') ||
          err.message.includes('API_KEY_INVALID') ||
          err.message.includes('API key not valid'))
      ) {
        throw new Error(
          'Your Gemini API key was rejected by Google as leaked or invalid. Please click "Add / Update API Key" to enter a fresh free key from Google AI Studio.'
        );
      }
      console.warn(`Interactions API with ${modelName} failed:`, err.message);
      lastError = err;
    }
  }

  // 2. SECONDARY: Fallback to generateContent API
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

  const gcPayload = {
    contents,
    generationConfig: {
      temperature: 0.75,
      maxOutputTokens: 2048,
    },
  };

  if (character?.systemPrompt) {
    gcPayload.system_instruction = {
      parts: [{ text: character.systemPrompt }],
    };
  }

  if (useWebSearch) {
    gcPayload.tools = [{ google_search: {} }];
  }

  for (const modelName of GENERATE_CONTENT_MODELS) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(activeApiKey)}`;

      const res = await fetchWithTimeout(
        endpoint,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(gcPayload),
        },
        12000
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
      console.warn(`Gemini generateContent model ${modelName} failed:`, err.message);
      lastError = err;
      if (
        err.message &&
        (err.message.includes('leaked') ||
          err.message.includes('API_KEY_INVALID') ||
          err.message.includes('API key not valid'))
      ) {
        throw new Error(
          'Your Gemini API key was rejected by Google as leaked or invalid. Please click "Add / Update API Key" to enter a fresh free key from Google AI Studio.'
        );
      }
    }
  }

  throw new Error(
    lastError?.message ||
      'Failed to receive response from Gemini. Please check your network or enter a fresh API key.'
  );
};
