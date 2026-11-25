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

export { sendAiMessage, AI_PROVIDERS, getAiSettings, saveAiSettings, getProviderApiKey, saveProviderApiKey } from './aiProviderService';
