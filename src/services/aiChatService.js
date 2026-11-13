import { doc, getDoc, setDoc, increment, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { getGeminiApiKey, saveGeminiApiKey } from './aiWidgetService';

// Built-in starter demo key fallback for the first 10 trial messages
const DEMO_STARTER_KEY = 'AIzaSyAM_jXOZ4Na4FqxySLpGwMyaXx-ePntF44';

export const FREE_TRIAL_LIMIT = 10;
const getTrialStorageKey = (uid) => `landing_ai_trial_count_${uid || 'guest'}`;
const CUSTOM_CHARACTERS_STORAGE_KEY = 'landing_ai_custom_characters';
const CHAT_THREADS_STORAGE_KEY = 'landing_ai_chat_threads';

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

// --- FREE TRIAL USAGE HELPERS (FIREBASE CLOUD-SYNCED & PERSISTED) ---
export const getFreeTrialUsage = (userId = null) => {
  const customKey = getGeminiApiKey();
  const hasCustomKey = Boolean(customKey && customKey.trim().length > 10);
  const isAnonymous = !userId || userId === 'local_guest';

  // Guest/non-logged-in users cannot access free trial
  if (isAnonymous) {
    return {
      count: 0,
      max: FREE_TRIAL_LIMIT,
      hasCustomKey,
      isLocked: true,
      isExhausted: true,
      remaining: 0,
    };
  }

  try {
    const raw = localStorage.getItem(getTrialStorageKey(userId));
    // Check legacy storage key if account-specific key is not populated yet
    const legacyRaw = localStorage.getItem('landing_ai_trial_count');
    const localParsed = raw ? parseInt(raw, 10) : (legacyRaw ? parseInt(legacyRaw, 10) : 0);
    const count = Math.max(0, localParsed || 0);

    return {
      count,
      max: FREE_TRIAL_LIMIT,
      hasCustomKey,
      isLocked: false,
      isExhausted: !hasCustomKey && count >= FREE_TRIAL_LIMIT,
      remaining: hasCustomKey ? Infinity : Math.max(0, FREE_TRIAL_LIMIT - count),
    };
  } catch {
    return {
      count: 0,
      max: FREE_TRIAL_LIMIT,
      hasCustomKey,
      isLocked: false,
      isExhausted: false,
      remaining: FREE_TRIAL_LIMIT,
    };
  }
};

/**
 * Synchronizes the user's trial usage with Cloud Firestore.
 * Ensures cross-browser consistency (same Google account in Chrome, Edge, etc. shares the 10 messages).
 */
export const subscribeToAccountAiTrialUsage = (userId, callback) => {
  if (!userId || userId === 'local_guest') {
    callback(getFreeTrialUsage(null));
    return () => {};
  }

  // 1. Immediately emit with current local/cached usage
  callback(getFreeTrialUsage(userId));

  let unsubscribe = () => {};
  try {
    const userDocRef = doc(db, 'users', userId);
    unsubscribe = onSnapshot(
      userDocRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const cloudCount = typeof data?.aiTrialCount === 'number' ? data.aiTrialCount : 0;
          const currentLocal = getFreeTrialUsage(userId).count;
          const resolvedCount = Math.max(cloudCount, currentLocal);

          try {
            localStorage.setItem(getTrialStorageKey(userId), String(resolvedCount));
          } catch {
            // ignore
          }

          // If local was higher than cloud (e.g. offline usage), back-propagate to Firestore
          if (currentLocal > cloudCount) {
            setDoc(userDocRef, { aiTrialCount: currentLocal }, { merge: true }).catch(() => {});
          }
        }
        callback(getFreeTrialUsage(userId));
      },
      (err) => {
        console.warn('Firestore AI trial snapshot warning:', err.message);
      }
    );
  } catch (err) {
    console.warn('Could not attach Firestore trial listener:', err);
  }

  return () => unsubscribe();
};

/**
 * Atomically increments the user's trial usage in Cloud Firestore and local storage.
 */
export const incrementFreeTrialUsage = async (userId) => {
  if (!userId || userId === 'local_guest') {
    throw new Error('SIGN_IN_REQUIRED');
  }

  const current = getFreeTrialUsage(userId);
  if (current.hasCustomKey) return current;

  const nextCount = current.count + 1;
  try {
    localStorage.setItem(getTrialStorageKey(userId), String(nextCount));
  } catch {
    // ignore
  }

  // Atomically increment in Cloud Firestore under /users/{userId}
  try {
    const userDocRef = doc(db, 'users', userId);
    await setDoc(
      userDocRef,
      {
        aiTrialCount: increment(1),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Failed to sync trial increment to Firestore:', err.message);
  }

  const updatedUsage = {
    ...current,
    count: nextCount,
    isExhausted: nextCount >= FREE_TRIAL_LIMIT,
    remaining: Math.max(0, FREE_TRIAL_LIMIT - nextCount),
  };

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('landing_ai_trial_updated', { detail: updatedUsage }));
  }

  return updatedUsage;
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

// --- GEMINI API CALLER ---
export const sendAiMessage = async ({
  userId,
  character,
  userMessage,
  history = [],
  useWebSearch = false,
}) => {
  const userKey = getGeminiApiKey();
  const hasCustomKey = Boolean(userKey && userKey.trim().length > 10);

  if ((!userId || userId === 'local_guest') && !hasCustomKey) {
    throw new Error('SIGN_IN_REQUIRED');
  }

  const usage = getFreeTrialUsage(userId);
  if (usage.isExhausted && !hasCustomKey) {
    throw new Error('TRIAL_EXHAUSTED');
  }

  const activeApiKey = hasCustomKey ? userKey.trim() : DEMO_STARTER_KEY;

  if (!activeApiKey) {
    throw new Error('Please add a free Google Gemini API key to start chatting.');
  }

  let lastError = null;

  // 1. PRIMARY: Modern Gemini Interactions API (Native endpoint for gemini-3.8-flash)
  const interactionModels = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash-lite'];

  // Format multi-turn transcript for input
  let interactionInput = userMessage.trim();
  if (history && history.length > 0) {
    const transcript = history
      .slice(-12)
      .map((msg) => `${msg.role === 'user' ? 'User' : (character?.name || 'Assistant')}: ${msg.text}`)
      .join('\n\n');
    interactionInput = `${transcript}\n\nUser: ${userMessage.trim()}\n\n${character?.name || 'Assistant'}:`;
  }

  for (const modelName of interactionModels) {
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

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': activeApiKey,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || `Interactions API error ${res.status}`);
      }

      const data = await res.json();
      let replyText = '';

      if (Array.isArray(data?.steps)) {
        const modelSteps = data.steps.filter((s) => s.type === 'model_output');
        const lastStep = modelSteps[modelSteps.length - 1];
        const textPart = lastStep?.content?.find((c) => c.type === 'text');
        replyText = textPart?.text || '';
      } else if (Array.isArray(data?.outputs)) {
        const textOutputs = data.outputs.filter((o) => o.type === 'text');
        replyText = textOutputs[textOutputs.length - 1]?.text || '';
      }

      if (!replyText && typeof data?.outputText === 'string') replyText = data.outputText;
      if (!replyText && typeof data?.output_text === 'string') replyText = data.output_text;

      if (!replyText || !replyText.trim()) {
        throw new Error('Empty response from model.');
      }

      const grounding = data?.groundingMetadata?.groundingChunks || null;

      if (!usage.hasCustomKey) {
        await incrementFreeTrialUsage(userId);
      }

      return {
        text: replyText.trim(),
        modelUsed: modelName,
        groundingChunks: Array.isArray(grounding) ? grounding : null,
      };
    } catch (err) {
      console.warn(`Interactions model ${modelName} failed:`, err.message);
      lastError = err;
    }
  }

  // 2. SECONDARY: Classic generateContent API (Fallback for keys limited to generateContent)
  const generateContentModels = [
    'gemini-3.8-flash',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-3-flash-preview',
  ];
  const contents = [
    ...history.slice(-14).map((msg) => ({
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

  for (const modelName of generateContentModels) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(activeApiKey)}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gcPayload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || `API error ${res.status}`);
      }

      const data = await res.json();
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!reply || !reply.trim()) {
        throw new Error('Empty response from model.');
      }

      const grounding = data?.candidates?.[0]?.groundingMetadata?.groundingChunks || null;

      if (!usage.hasCustomKey) {
        await incrementFreeTrialUsage(userId);
      }

      return {
        text: reply.trim(),
        modelUsed: modelName,
        groundingChunks: Array.isArray(grounding) ? grounding : null,
      };
    } catch (err) {
      console.warn(`generateContent model ${modelName} failed:`, err.message);
      lastError = err;
    }
  }

  const isCustomKey = Boolean(userKey && userKey.trim().length > 10);
  const hint = isCustomKey
    ? 'Please check your Gemini API key in Google AI Studio.'
    : 'The starter trial key is rate-limited. Please add your own free Gemini API key to chat.';

  throw new Error(`${lastError?.message || 'Failed to generate response.'} (${hint})`);
};
