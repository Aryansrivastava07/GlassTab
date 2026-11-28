import './StudioEntry.css';
﻿import React, { useState, useEffect, useRef } from 'react';
import { generateFreeImage, sendFreeText } from '../services/aiAccess';
import { getBoundedHistory, imageModeNotice, validateFiles, GROQ_VISION } from '../services/aiProviderService';
import { deleteLocalMedia, getLocalMedia, saveLocalMedia } from '../utils/localMediaDb';
import useDialogFocus from '../hooks/useDialogFocus';
import {
  Sparkles,
  Plus,
  Send,
  Trash2,
  Copy,
  Check,
  Search,
  ExternalLink,
  ChevronDown,
  ArrowUp,
  X,
  KeyRound,
  Bot,
  User,
  Wand2,
  Mic,
  MicOff,
  Paperclip,
  Image as ImageIcon,
  Edit2,
  ShieldCheck,
  Globe,
  Lock,
  AlertCircle,
  MessageSquare,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  DEFAULT_CHARACTERS,
  getAllCharacters,
  saveCustomCharacter,
  deleteCustomCharacter,
  getChatThreads,
  saveChatThreads,
  createNewThread,
  deleteChatThread,
  renameChatThread,
  sendAiMessage,
  AI_PROVIDERS,
  getAiSettings,
  saveAiSettings,
  getProviderApiKey,
  saveProviderApiKey,
} from '../services/aiChatService';
import { getGeminiApiKey, saveGeminiApiKey, maskApiKey, subscribeToCloudGeminiKey } from '../services/aiWidgetService';
import { useAuth } from '../context/AuthContext';
import { signInWithGoogle } from '../services/authService';
import { startGeminiLive, LIVE_MODEL } from '../services/geminiLive';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebase';

const voiceKeyStorage = 'glasstab_gemini_live_key';

const temporaryImages = new Map();

function GeneratedImage({ mediaKey, prompt }) {
  const [url, setUrl] = useState('');
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let active = true;
    let objectUrl;
    async function load() {
      const blob = temporaryImages.get(mediaKey) || (await getLocalMedia(mediaKey))?.blob;
      if (!active) return;
      if (!blob) { setMissing(true); return; }
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    }
    load();
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [mediaKey]);
  if (!url) return <small>{missing ? 'Image unavailable on this device.' : 'Loading image...'}</small>;
  return <a href={url} download="ginnie-image" className="block text-xs text-sky-300">
    <img src={url} alt={prompt} className="mb-2 max-h-80 max-w-full rounded-xl object-contain" />Download image
  </a>;
}

// Lightweight Zero-Dependency Markdown Formatter with Copyable Code Blocks
const FormattedMessage = ({ text }) => {
  const [copiedIndex, setCopiedIndex] = useState(null);

  const copyCode = (code, index) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1800);
  };

  if (!text) return null;

  // Split into code blocks (```lang ... ```) and text blocks
  const parts = text.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2 text-xs sm:text-sm leading-relaxed">
      {parts.map((part, idx) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const firstLineEnd = part.indexOf('\n');
          const lang = part.substring(3, firstLineEnd).trim() || 'code';
          const code = part.substring(firstLineEnd + 1, part.length - 3);

          return (
            <div key={idx} className="my-2 rounded-xl overflow-hidden border border-white/15 bg-black/60 shadow-lg">
              <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-white/10 text-[11px] text-gray-400 font-mono">
                <span className="uppercase text-[10px] tracking-wider text-sky-400">{lang}</span>
                <button
                  onClick={() => copyCode(code, idx)}
                  className="flex items-center gap-1 hover:text-white transition cursor-pointer"
                  title="Copy Code"
                >
                  {copiedIndex === idx ? (
                    <>
                      <Check size={12} className="text-emerald-400" />
                      <span className="text-[10px] text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3 text-[11px] sm:text-xs overflow-x-auto text-sky-100 font-mono whitespace-pre leading-relaxed select-all">
                <code>{code}</code>
              </pre>
            </div>
          );
        }

        // Render normal text with line breaks, bold, and bullet points
        const lines = part.split('\n');
        return (
          <div key={idx} className="space-y-1">
            {lines.map((line, lIdx) => {
              if (!line.trim()) return <div key={lIdx} className="h-1" />;

              // Bullet points
              if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
                return (
                  <div key={lIdx} className="flex items-start gap-2 pl-2">
                    <span className="text-sky-400 font-bold">•</span>
                    <span>{renderInlineFormatting(line.trim().substring(2))}</span>
                  </div>
                );
              }

              // Headings
              if (line.startsWith('### ')) {
                return <h5 key={lIdx} className="font-bold text-white text-sm pt-1">{renderInlineFormatting(line.substring(4))}</h5>;
              }
              if (line.startsWith('## ')) {
                return <h4 key={lIdx} className="font-bold text-white text-base pt-1">{renderInlineFormatting(line.substring(3))}</h4>;
              }

              return <p key={lIdx}>{renderInlineFormatting(line)}</p>;
            })}
          </div>
        );
      })}
    </div>
  );
};

// Inline bold, italic, code helper
const renderInlineFormatting = (text) => {
  const elements = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Inline code `...`
    const codeMatch = remaining.match(/`([^`]+)`/);
    // Bold **...**
    const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);

    let match = null;
    let type = null;

    if (codeMatch && (!boldMatch || codeMatch.index < boldMatch.index)) {
      match = codeMatch;
      type = 'code';
    } else if (boldMatch) {
      match = boldMatch;
      type = 'bold';
    }

    if (!match) {
      elements.push(remaining);
      break;
    }

    if (match.index > 0) {
      elements.push(remaining.substring(0, match.index));
    }

    if (type === 'code') {
      elements.push(
        <code key={key++} className="px-1.5 py-0.5 rounded bg-white/10 text-sky-200 text-[11px] font-mono border border-white/10">
          {match[1]}
        </code>
      );
    } else if (type === 'bold') {
      elements.push(<strong key={key++} className="font-semibold text-white">{match[1]}</strong>);
    }

    remaining = remaining.substring(match.index + match[0].length);
  }

  return elements;
};

export const GlassAIStudio = ({ onScrollToDashboard, isActive = true }) => {
  const { googleUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (googleUser) return <SignedInStudio key={googleUser.uid} effectiveUid={googleUser.uid} isActive={isActive} onScrollToDashboard={onScrollToDashboard} />;
  return <section className="entry-panel" aria-labelledby="studio-login-heading">
    <header className="entry-cover">
      <div className="entry-brand"><Sparkles size={18}/>AI Studio</div>
      <button className="entry-dismiss" aria-label="Back to dashboard" onClick={onScrollToDashboard}><X size={17}/></button>
      <h2 id="studio-login-heading">Sign in to use GlassTab AI</h2>
    </header>
    <div className="entry-body">
    <p className="mb-5 text-sm leading-relaxed text-slate-300">Use your Google account to start a conversation, talk to Ginnie, or create your first image. Free images have a daily limit per account.</p>
    <button disabled={busy} className="entry-primary w-full" onClick={async () => {
      setBusy(true); setError('');
      try { await signInWithGoogle(); }
      catch (err) { setError(err.code === 'auth/popup-closed-by-user' ? 'Sign-in window closed.' : 'Google sign-in failed. Please try again.'); }
      finally { setBusy(false); }
    }}>{busy ? 'Signing in...' : 'Sign in with Google'}</button>
    {error && <p role="alert" className="mt-2 text-sm text-rose-300">{error}</p>}
    </div>
  </section>;
};

function SignedInStudio({ effectiveUid, isActive, onScrollToDashboard }) {
  // --- STATE ---
  const [characters, setCharacters] = useState(() => getAllCharacters());
  const [activeCharacterId, setActiveCharacterId] = useState('ginnie'); // Ginnie as highlighted, Default available
  const [threads, setThreads] = useState(() => getChatThreads());
  const [activeThreadId, setActiveThreadId] = useState(null);

  const [inputMessage, setInputMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [useWebSearch, setUseWebSearch] = useState(false);

  // Modals & Panels
  const [showCharacterMenu, setShowCharacterMenu] = useState(false);
  const [showCustomCharModal, setShowCustomCharModal] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const characterDialogRef = useRef(null);
  const keyDialogRef = useRef(null);
  useDialogFocus(characterDialogRef, isActive && showCustomCharModal, () => setShowCustomCharModal(false));
  useDialogFocus(keyDialogRef, isActive && showApiKeyModal, () => setShowApiKeyModal(false));
  const [aiSettings, setAiSettings] = useState(getAiSettings);
  const provider = aiSettings.provider;
  const providerInfo = AI_PROVIDERS[provider];
  const activeModel = aiSettings.models[provider] || providerInfo.model;
  const [showTools, setShowTools] = useState(false);
  const [files, setFiles] = useState([]);
  const [createImage, setCreateImage] = useState(false);
  const [toolError, setToolError] = useState('');
  const uploadRef = useRef(null);
  const toolsRef = useRef(null);
  useEffect(() => {
    setFiles([]); setCreateImage(false); setToolError(''); setShowTools(false);
  }, [provider, activeThreadId, isActive]);
  useEffect(() => {
    if (!showTools) return;
    const dismiss = event => { if (!toolsRef.current?.contains(event.target)) setShowTools(false); };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('focusin', dismiss);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('focusin', dismiss);
    };
  }, [showTools]);
  const [apiKeyInput, setApiKeyInput] = useState(() => getProviderApiKey(getAiSettings().provider));
  const [showKeyPassword, setShowKeyPassword] = useState(false);
  const [apiKeyNotice, setApiKeyNotice] = useState('');
  const [hasKey, setHasKey] = useState(() => Boolean(getProviderApiKey(getAiSettings().provider).trim()));
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);


  // Subscribe to real-time Cloud Firestore encrypted Gemini key
  useEffect(() => {
    const unsubKey = subscribeToCloudGeminiKey(effectiveUid, (cloudKey) => {
      if (provider === 'gemini') {
        setApiKeyInput(cloudKey || '');
        setHasKey(Boolean(cloudKey?.trim()));
      }
    });

    const onKeyChanged = (e) => {
      const k = e.detail?.key !== undefined ? e.detail.key : getGeminiApiKey();
      if (provider === 'gemini') {
        setApiKeyInput(k);
        setHasKey(Boolean(k?.trim()));
      }
    };
    window.addEventListener('landing_gemini_key_changed', onKeyChanged);

    return () => {
      unsubKey();
      window.removeEventListener('landing_gemini_key_changed', onKeyChanged);
    };
  }, [effectiveUid, provider]);

  const handleProviderChange = (nextProvider) => {
    if (!AI_PROVIDERS[nextProvider]) return;
    if (voiceModeRef.current) stopVoiceConversation();
    setAiSettings(saveAiSettings({ provider: nextProvider }));
    const key = getProviderApiKey(nextProvider);
    setApiKeyInput(key);
    setHasKey(Boolean(key.trim()));
    setApiKeyNotice('');
    setUseWebSearch(false);
  };

  const handleModelChange = (nextModel) => {
    const models = { ...aiSettings.models, [provider]: nextModel };
    setAiSettings(saveAiSettings({ models }));
  };

  // Custom Character Form State
  const [newCharName, setNewCharName] = useState('');
  const [newCharAvatar, setNewCharAvatar] = useState('✨');
  const [newCharTagline, setNewCharTagline] = useState('');
  const [newCharPrompt, setNewCharPrompt] = useState('');

  const [voiceStage, setVoiceStage] = useState('');
  const [voiceError, setVoiceError] = useState('');
  const [showVoiceKey, setShowVoiceKey] = useState(false);
  const [voiceKeyInput, setVoiceKeyInput] = useState('');
  const voiceDialogRef = useRef(null);
  useDialogFocus(voiceDialogRef, isActive && showVoiceKey, () => setShowVoiceKey(false));
  const voiceModeRef = useRef(null);
  const isVoiceMode = Boolean(voiceStage);
  const isGeneratingRef = useRef(false);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const isInitialMount = useRef(true);

  // Initialize active thread
  useEffect(() => {
    if (threads.length === 0) {
      const { threads: freshThreads, activeThread } = createNewThread(activeCharacterId);
      setThreads(freshThreads);
      setActiveThreadId(activeThread.id);
    } else if (!activeThreadId) {
      setActiveThreadId(threads[0].id);
    }
  }, [threads, activeThreadId, activeCharacterId]);

  // Sync active thread with active character
  const activeThread = threads.find((t) => t.id === activeThreadId) || threads[0] || null;
  const activeCharacter = characters.find((c) => c.id === (activeThread?.characterId || activeCharacterId)) || characters[0];

  // Auto-scroll messages inside the chat viewport only (NEVER scroll parent window or root viewport!)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [activeThread?.messages, isGenerating]);

  // When selecting another thread, scroll chat container to bottom instantly
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [activeThreadId]);

  // --- ACTIONS ---
  const handleSelectThread = (threadId) => {
    if (voiceModeRef.current) stopVoiceConversation();
    setActiveThreadId(threadId);
    setIsMobileSidebarOpen(false);
    const target = threads.find((t) => t.id === threadId);
    if (target?.characterId) {
      setActiveCharacterId(target.characterId);
    }
  };

  const handleCreateNewChat = (charId = activeCharacterId) => {
    if (voiceModeRef.current) stopVoiceConversation();
    setIsMobileSidebarOpen(false);
    const { threads: nextThreads, activeThread: created } = createNewThread(charId);
    setThreads(nextThreads);
    setActiveThreadId(created.id);
    setShowCharacterMenu(false);
  };

  const handleDeleteThread = (threadId, e) => {
    e.stopPropagation();
    if (activeThreadId === threadId && voiceModeRef.current) stopVoiceConversation();
    for (const msg of threads.find(thread => thread.id === threadId)?.messages || []) {
      if (msg.mediaKey) { temporaryImages.delete(msg.mediaKey); void deleteLocalMedia(msg.mediaKey); }
    }
    const updated = deleteChatThread(threadId);
    setThreads(updated);
    if (activeThreadId === threadId) {
      setActiveThreadId(updated[0]?.id || null);
    }
  };

  const handleSwitchCharacter = (charId) => {
    if (voiceModeRef.current) stopVoiceConversation();
    setActiveCharacterId(charId);
    setShowCharacterMenu(false);

    // If active thread has no messages, switch its character; otherwise create fresh
    if (activeThread && activeThread.messages.length === 0) {
      const updated = threads.map((t) => (t.id === activeThread.id ? { ...t, characterId: charId } : t));
      setThreads(updated);
      saveChatThreads(updated);
    } else {
      handleCreateNewChat(charId);
    }
  };

  const handleSaveCustomCharacter = (e) => {
    e.preventDefault();
    if (!newCharName.trim() || !newCharPrompt.trim()) return;

    const char = {
      name: newCharName.trim(),
      avatar: newCharAvatar.trim() || '✨',
      tagline: newCharTagline.trim() || 'Custom AI Character',
      systemPrompt: newCharPrompt.trim(),
    };

    const nextChars = saveCustomCharacter(char);
    setCharacters(nextChars);
    setShowCustomCharModal(false);
    setNewCharName('');
    setNewCharAvatar('✨');
    setNewCharTagline('');
    setNewCharPrompt('');

    // Switch to newly created character
    const created = nextChars[nextChars.length - 1];
    if (created) {
      handleSwitchCharacter(created.id);
    }
  };

  const handleSaveApiKey = async (e) => {
    e.preventDefault();
    if (provider === 'gemini') await saveGeminiApiKey(apiKeyInput.trim(), effectiveUid);
    else saveProviderApiKey(provider, apiKeyInput.trim());
    setHasKey(Boolean(apiKeyInput.trim()));
    setApiKeyNotice(provider === 'gemini' ? 'Gemini key saved and cloud synced.' : 'API key saved in this browser.');
    setTimeout(() => {
      setShowApiKeyModal(false);
      setApiKeyNotice('');
    }, 1400);
  };

  const handleRemoveApiKey = async () => {
    if (provider === 'gemini') await saveGeminiApiKey('', effectiveUid);
    else saveProviderApiKey(provider, '');
    setApiKeyInput('');
    setHasKey(false);
    setApiKeyNotice('API Key removed.');
    setTimeout(() => {
      setApiKeyNotice('');
    }, 1200);
  };

  function stopVoiceConversation(message = '') {
    voiceModeRef.current?.abort();
    voiceModeRef.current = null;
    setVoiceStage('');
    setVoiceError(message);
  }

  function openVoiceKey() {
    setShowCharacterMenu(false);
    setVoiceKeyInput('');
    setShowVoiceKey(true);
  }

  useEffect(() => {
    if (!isActive) stopVoiceConversation();
    return () => { voiceModeRef.current?.abort(); voiceModeRef.current = null; };
  }, [isActive, effectiveUid]);

  useEffect(() => { setVoiceStage(''); }, [effectiveUid]);

  const handleSendMessage = async (customPrompt = null) => {
    const textToSend = (customPrompt || inputMessage).trim();
    if (!textToSend || isGeneratingRef.current) return;

    if (voiceModeRef.current) stopVoiceConversation();
    const attachments = customPrompt ? [] : files;
    const freeImage = !customPrompt && createImage === 'free';
    const generate = !customPrompt && createImage === 'paid';
    const freeText = !hasKey && !freeImage && !generate && !attachments.length && !useWebSearch;
    if (!hasKey && !freeImage && !freeText) { setShowApiKeyModal(true); return; }
    if (freeText && textToSend.length > 4000) { setToolError('Free chat accepts up to 4,000 characters per message.'); return; }
    if (freeImage && (attachments.length || textToSend.length > 2048)) {
      setToolError('Free image generation accepts a text prompt up to 2,048 characters. Remove any attachments.'); return;
    }
    try { validateFiles(attachments, provider, generate); }
    catch (error) { setToolError(error.message); return; }
    if (!customPrompt) {
      setInputMessage(''); setFiles([]); setCreateImage(false); setToolError(''); setShowTools(false);
    }

    // Append user message immediately
    const userMsg = {
      id: `msg_${Date.now()}`,
      role: 'user',
      text: textToSend,
      filenames: attachments.map(file => file.name),
      timestamp: new Date().toISOString(),
    };

    let targetThread = activeThread;
    if (!targetThread) {
      const { threads: fresh, activeThread: created } = createNewThread(activeCharacter.id);
      targetThread = created;
      setThreads(fresh);
      setActiveThreadId(created.id);
    }

    const updatedMessages = [...(targetThread.messages || []), userMsg];
    // If first message, auto-title the thread
    const newTitle = targetThread.messages.length === 0 ? textToSend.substring(0, 32) : targetThread.title;

    const updatedThreads = getChatThreads().map((t) =>
      t.id === targetThread.id
        ? {
            ...t,
            title: newTitle,
            characterId: activeCharacter.id,
            messages: updatedMessages,
            updatedAt: new Date().toISOString(),
          }
        : t
    );

    setThreads(updatedThreads);
    saveChatThreads(updatedThreads);
    isGeneratingRef.current = true;
    setIsGenerating(true);

    try {
      const reply = freeImage ? await generateFreeImage(textToSend)
        : freeText ? await sendFreeText(textToSend, getBoundedHistory(targetThread.messages), activeCharacter.systemPrompt)
        : await sendAiMessage({
        provider,
        model: activeModel,
        character: activeCharacter,
        userMessage: textToSend,
        history: updatedMessages.slice(0, -1),
        useWebSearch, files: attachments, createImage: generate,
      });

      let mediaKey;
      if (reply.image && getChatThreads().some(t => t.id === targetThread.id)) {
        mediaKey = `ginnie-image-${crypto.randomUUID()}`;
        if (!await saveLocalMedia(mediaKey, reply.image)) {
          temporaryImages.set(mediaKey, reply.image);
          reply.text += ' Download this image before closing this tab. Local storage is full or unavailable.';
        }
      }
      const aiMsg = {
        id: `msg_${Date.now()}_ai`,
        role: 'model',
        text: reply.text,
        mediaKey, imagePrompt: mediaKey ? textToSend : undefined,
        modelUsed: reply.modelUsed,
        usage: reply.usage,
        groundingChunks: reply.groundingChunks,
        timestamp: new Date().toISOString(),
      };

      const finalThreads = getChatThreads().map((t) =>
        t.id === targetThread.id
          ? {
              ...t,
              messages: [...t.messages, aiMsg],
              updatedAt: new Date().toISOString(),
            }
          : t
      );

      setThreads(finalThreads);
      saveChatThreads(finalThreads);
    } catch (err) {
      if (voiceModeRef.current) stopVoiceConversation('The AI request failed. Read the error in chat and tap the microphone to try again.');
      if (err.message === 'MISSING_API_KEY') {
        setShowApiKeyModal(true);
      } else {
        const errorMsg = {
          id: `msg_${Date.now()}_err`,
          role: 'model',
          text: `⚠️ **Error:** ${err.message || 'Unable to connect to the AI provider. Please check your network or API key.'}`,
          freeImagePrompt: freeImage ? textToSend : undefined,
          isError: true,
          keyIssue: /api key|invalid key|credits|billing|permission/i.test(err.message || ''),
          timestamp: new Date().toISOString(),
        };

        const finalThreads = getChatThreads().map((t) =>
          t.id === targetThread.id
            ? { ...t, messages: [...t.messages, errorMsg] }
            : t
        );
        setThreads(finalThreads);
        saveChatThreads(finalThreads);
      }
    } finally {
      isGeneratingRef.current = false;
      setIsGenerating(false);
    }
  };

  const toggleVoiceConversation = async () => {
    if (voiceModeRef.current) return stopVoiceConversation();
    if (isGeneratingRef.current || !activeThread) return;
    const key = localStorage.getItem(voiceKeyStorage) || getGeminiApiKey();
    const controller = new AbortController();
    voiceModeRef.current = controller;
    setVoiceError('');
    setVoiceStage('Connecting');
    try {
      await startGeminiLive({
        shared: !key,
        signal: controller.signal,
        instruction: activeCharacter.systemPrompt + ' Give concise, natural spoken replies.',
        credential: async () => {
          if (key) return { key };
          const issue = httpsCallable(getFunctions(app), 'geminiLiveToken');
          try { return (await issue()).data; }
          catch (error) {
            if (error.code === 'functions/resource-exhausted') throw new Error('Shared voice quota reached. Try later or add a Gemini voice key.');
            throw new Error('Shared voice is unavailable. Sign in again or add a Gemini voice key from the companion menu.');
          }
        },
        onStage: setVoiceStage,
        onEnd: stopVoiceConversation,
        onTurn: (input, output) => {
          if (controller.signal.aborted) return;
          const timestamp = new Date().toISOString();
          const messages = [['user', input], ['model', output]].filter(([, text]) => text)
            .map(([role, text]) => ({ id: crypto.randomUUID(), timestamp, role, text, modelUsed: LIVE_MODEL }));
          const updated = getChatThreads().map(thread => thread.id === activeThread.id
            ? { ...thread, title: thread.messages.length ? thread.title : (input || output).slice(0, 32),
                updatedAt: timestamp, messages: [...thread.messages, ...messages] }
            : thread);
          saveChatThreads(updated);
          setThreads(updated);
        },
      });
    } catch (error) {
      if (!controller.signal.aborted) stopVoiceConversation(error.name === 'NotAllowedError'
        ? 'Allow microphone access to start a Gemini Live call.' : error.message);
    }
  };

  return (
    <div className="w-full max-w-6xl h-[min(88dvh,100%)] bg-[#0c1017]/95 dark-glass rounded-3xl border border-white/15 flex shadow-[0_24px_80px_rgba(0,0,0,0.8)] overflow-hidden backdrop-blur-2xl relative select-text">
      
      {/* Mobile backdrop for sidebar */}
      {isMobileSidebarOpen && (
        <div
          className="md:hidden absolute inset-0 bg-black/60 z-20 backdrop-blur-xs"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* ================= LEFT SIDEBAR (THREADS & HISTORY) ================= */}
      <div className={`w-64 sm:w-72 bg-[#0c1017] sm:bg-black/40 border-r border-white/10 flex flex-col shrink-0 z-30 transition-transform duration-200 ${
        isMobileSidebarOpen
          ? 'absolute inset-y-0 left-0 shadow-2xl translate-x-0'
          : 'hidden md:flex'
      }`}>
        
        {/* Sidebar Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 flex items-center justify-center text-white shadow-md shadow-sky-500/20">
              <Sparkles size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight leading-tight">AI Studio</h2>
              <span className="text-[10px] text-gray-400 font-mono">{providerInfo.label} · {activeModel}</span>
            </div>
          </div>
          
          <button
            onClick={() => handleCreateNewChat(activeCharacterId)}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
            title="Start New Chat"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* Thread History List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 block mb-1">
            Conversations ({threads.length})
          </span>

          {threads.map((thread) => {
            const isSelected = thread.id === activeThreadId;
            const threadChar = characters.find((c) => c.id === thread.characterId) || DEFAULT_CHARACTERS[0];

            return (
              <div
                key={thread.id}
                onClick={() => handleSelectThread(thread.id)}
                className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-white/15 text-white border border-white/15 shadow-sm'
                    : 'text-gray-300 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm shrink-0">{threadChar.avatar}</span>
                  <span className="text-xs truncate font-medium">{thread.title || 'Untitled Chat'}</span>
                </div>

                <button
                  onClick={(e) => handleDeleteThread(thread.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-400 transition rounded"
                  title="Delete chat"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}

          {threads.length === 0 && (
            <div className="text-center py-10 text-gray-500 text-xs">
              No conversations yet.
            </div>
          )}
        </div>

        {/* Sidebar Footer: selected provider key */}
        <div className="p-3.5 border-t border-white/10 bg-black/20 space-y-2">
          {hasKey ? (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300">
              <span className="flex items-center gap-1.5 font-medium">
                <ShieldCheck size={14} className="text-emerald-400" />
                {provider === 'gemini' ? 'Gemini Cloud Synced' : `${providerInfo.label} Key Active`}
              </span>
              <button
                onClick={() => setShowApiKeyModal(true)}
                className="text-[10px] text-emerald-400 underline hover:text-emerald-200 cursor-pointer font-medium"
              >
                Manage
              </button>
            </div>
          ) : (
            <button onClick={() => setShowApiKeyModal(true)} className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-xs text-slate-200 hover:bg-white/10">
              <KeyRound size={14}/>Set up personal chat
            </button>
          )}


        </div>
      </div>

      {/* ================= MAIN CHAT VIEWPORT ================= */}
      <div className="flex-1 flex flex-col min-w-0 bg-transparent">
        
        {/* Top Chat Header */}
        <div className="h-14 px-4 sm:px-6 border-b border-white/10 flex items-center justify-between bg-black/25 shrink-0">
          
          {/* Top Left: Mobile Sidebar Toggle + Character Selector & Avatar Menu */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen((prev) => !prev)}
              className="md:hidden p-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white transition cursor-pointer"
              title="Toggle Conversations"
            >
              <MessageSquare size={16} />
            </button>

            <div className="relative">
              <button
                onClick={() => setShowCharacterMenu(!showCharacterMenu)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
              >
                <span className="text-base">{activeCharacter.avatar}</span>
                <span className="truncate max-w-[120px]">{activeCharacter.name}</span>
                <ChevronDown size={13} className="text-gray-400" />
              </button>

            {/* Character Dropdown Menu */}
            {showCharacterMenu && (
              <div className="absolute top-full left-0 mt-2 w-72 bg-[#121622] border border-white/15 rounded-2xl shadow-2xl z-50 p-2 space-y-1 animate-fadeIn backdrop-blur-xl">
                <span className="text-[10px] uppercase tracking-wider text-gray-400 px-2 font-bold block pt-1">
                  Choose Companion
                </span>

                {characters.map((char) => (
                  <button
                    key={char.id}
                    onClick={() => handleSwitchCharacter(char.id)}
                    className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-left transition cursor-pointer ${
                      char.id === activeCharacter.id ? 'bg-blue-600/30 border border-blue-400/40 text-white' : 'hover:bg-white/5 text-gray-200'
                    }`}
                  >
                    <span className="text-xl p-1 bg-black/30 rounded-lg">{char.avatar}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-white flex items-center justify-between">
                        <span>{char.name}</span>
                        {char.id === 'ginnie' && <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded border border-amber-500/30">Genie ✨</span>}
                      </div>
                      <div className="text-[10px] text-gray-400 truncate">{char.tagline}</div>
                    </div>
                  </button>
                ))}

                <button type="button" onClick={openVoiceKey} className="w-full flex items-center gap-2 p-2 rounded-xl text-sm text-sky-200 hover:bg-white/10">
                  <KeyRound size={15} /> Gemini voice API key
                </button>
                <div className="pt-1 border-t border-white/10">
                  <button
                    onClick={() => {
                      setShowCharacterMenu(false);
                      setShowCustomCharModal(true);
                    }}
                    className="w-full py-2 px-2.5 rounded-xl bg-gradient-to-r from-sky-500/20 to-indigo-500/20 hover:from-sky-500/30 hover:to-indigo-500/30 border border-sky-400/30 text-sky-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Wand2 size={13} />
                    <span>Build Custom Character</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

          {/* Top Right: Web Search Grounding, Model badge & Return Button */}
          <div className="flex items-center gap-2.5">
            {/* Live Web Search Grounding Toggle */}
            <button
              onClick={() => setUseWebSearch(!useWebSearch)}
              disabled={provider !== 'gemini'}
              className={`px-2.5 py-1 rounded-xl text-xs font-medium flex items-center gap-1.5 transition cursor-pointer border ${
                useWebSearch
                  ? 'bg-blue-600/80 text-white border-blue-400 shadow-sm'
                  : 'bg-white/5 text-gray-400 hover:text-white border-white/10'
              }`}
              title={provider === 'gemini' ? 'Toggle Google Search Grounding' : 'Web search is available with Gemini only'}
            >
              <Globe size={13} className={useWebSearch ? 'text-sky-300' : ''} />
              <span className="hidden sm:inline">Web Search</span>
            </button>

            {/* Back to Dashboard Button */}
            {onScrollToDashboard && (
              <button
                onClick={onScrollToDashboard}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 hover:text-white text-xs font-medium flex items-center gap-1 transition cursor-pointer border border-white/10"
                title="Return to GlassTab Dashboard"
              >
                <ArrowUp size={13} />
                <span className="hidden sm:inline">Dashboard</span>
              </button>
            )}
          </div>
        </div>

        {/* Message Stream Area */}
        <div ref={messagesContainerRef} role="log" aria-label="Chat messages" aria-live="polite" className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          
              {/* Welcome Screen when thread is fresh */}
              {(!activeThread?.messages || activeThread.messages.length === 0) && (
                <div className="py-12 max-w-lg mx-auto text-center space-y-4 animate-fadeIn">
                  <div className="w-16 h-16 rounded-3xl bg-black/40 border border-white/15 flex items-center justify-center text-3xl mx-auto shadow-2xl shadow-sky-500/10">
                    {activeCharacter.avatar}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white tracking-tight">{activeCharacter.name}</h3>
                    <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto leading-relaxed">{activeCharacter.tagline}</p>
                  </div>

                  {/* Starter Prompt Chips */}
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    {activeCharacter.id === 'ginnie' ? (
                      <>
                        <button
                          onClick={() => handleSendMessage("Grant me a wish to become a billionaire today")}
                          className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-gray-300 hover:text-white transition cursor-pointer"
                        >
                          🧞‍♂️ &quot;Grant me a wish to be rich&quot;
                        </button>
                        <button
                          onClick={() => handleSendMessage("Explain quantum physics in a sarcastic way")}
                          className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-gray-300 hover:text-white transition cursor-pointer"
                        >
                          ✨ &quot;Sarcastic quantum physics&quot;
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleSendMessage("Help me write clean Python code for web scraping")}
                          className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-gray-300 hover:text-white transition cursor-pointer"
                        >
                          💻 Write Python scraper
                        </button>
                        <button
                          onClick={() => handleSendMessage("Give me 5 productive ideas to build in React")}
                          className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-gray-300 hover:text-white transition cursor-pointer"
                        >
                          💡 5 React project ideas
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Render Messages */}
              {activeThread?.messages?.map((msg) => {
                const isUser = msg.role === 'user';

                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'} animate-fadeIn`}
                  >
                    {!isUser && (
                      <div className="w-8 h-8 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center text-lg shrink-0 select-none shadow-md">
                        {activeCharacter.avatar}
                      </div>
                    )}

                    <div
                      className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 shadow-xl ${
                        isUser
                          ? 'bg-blue-600 text-white rounded-br-xs shadow-blue-500/10'
                          : msg.isError
                          ? 'bg-rose-950/40 border border-rose-500/30 text-rose-200 rounded-bl-xs'
                          : 'bg-slate-900/80 border border-white/10 text-slate-100 rounded-bl-xs'
                      }`}
                    >
                      {msg.filenames?.length > 0 && <div className="mb-1 break-all text-xs opacity-80">{msg.filenames.join(' / ')}</div>}
                      {msg.mediaKey && <GeneratedImage mediaKey={msg.mediaKey} prompt={msg.imagePrompt} />}
                      {msg.text && <FormattedMessage text={msg.text} />}
                      {!isUser && !msg.isError && msg.usage?.total && (
                        <div className="mt-2 text-[10px] text-gray-500">{msg.modelUsed} · {msg.usage.total} tokens</div>
                      )}
                      {msg.freeImagePrompt && <button disabled={isGenerating} className="mt-3 block rounded-lg border border-white/20 px-3 py-1 text-xs" onClick={() => {
                        setInputMessage(msg.freeImagePrompt); setFiles([]); setCreateImage('free'); setToolError('');
                        toolsRef.current?.parentElement?.querySelector('textarea')?.focus();
                      }}>Edit and retry image</button>}
                      {msg.isError && !msg.freeImagePrompt && msg.keyIssue && (
                        <button
                          onClick={() => setShowApiKeyModal(true)}
                          className="mt-2.5 px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-200 text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <KeyRound size={12} />
                          <span>Add / Update API Key</span>
                        </button>
                      )}
                    </div>

                    {isUser && (
                      <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-xs text-blue-300 font-bold shrink-0 select-none">
                        <User size={15} />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Thinking / Streaming Indicator */}
              {isGenerating && (
                <div className="flex gap-3 justify-start animate-fadeIn">
                  <div className="w-8 h-8 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center text-lg shrink-0">
                    {activeCharacter.avatar}
                  </div>
                  <div className="px-4 py-3 rounded-2xl bg-slate-900/80 border border-white/10 text-xs text-sky-400 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                    <span>{activeCharacter.name} is thinking...</span>
                  </div>
                </div>
              )}
            <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-white/10 bg-black/35 shrink-0">
          {isVoiceMode && <div role="status" className="mb-2 text-sm text-sky-200">Gemini Live &middot; {voiceStage}</div>}
          {createImage && <div role="status" className="mb-2 text-xs text-amber-200"><button onClick={() => setCreateImage(false)} className="mr-2 rounded-lg bg-amber-400/15 px-2 py-1" aria-label="Cancel image creation">Create image &times;</button>{createImage === 'free' ? 'Free text-to-image with Cloudflare FLUX. Daily limits apply.' : imageModeNotice(provider)}</div>}
          {files.length > 0 && <div className="mb-2 flex flex-wrap gap-1 text-xs text-sky-200">{files.map((file, i) =>
            <button key={i} aria-label={`Remove ${file.name}`} onClick={() => setFiles(files.filter((_, index) => index !== i))} className="max-w-full truncate rounded-lg bg-sky-400/10 px-2 py-1">{file.name} &times;</button>)}
            {provider === 'groqcloud' && files.some(f => f.type.startsWith('image/')) && <span>Image analysis uses {GROQ_VISION}</span>}
          </div>}
          {toolError && <div role="alert" className="mb-2 text-xs text-amber-200">{toolError}</div>}
          <input ref={uploadRef} type="file" multiple hidden accept={`.txt,.md,.csv,.json${['gemini','groqcloud'].includes(provider) ? ',image/png,image/jpeg,image/webp' : ''}${provider === 'gemini' && !createImage ? ',application/pdf' : ''}`} onChange={event => {
            const next = [...files, ...event.target.files];
            event.target.value = '';
            if (createImage === 'free') { setToolError('Free image creation accepts text only. Cancel image creation to attach files.'); return; }
            try { validateFiles(next, provider, createImage); setFiles(next); setToolError(''); }
            catch (error) { setToolError(error.message); }
          }} />
          <div className="compound-field min-w-0 flex items-center gap-2 bg-black/40 border border-white/15 rounded-2xl px-3 py-2 shadow-inner transition">
            
            <div ref={toolsRef} className="relative shrink-0" onKeyDown={event => {
              if (showTools && event.key === 'Escape') {
                event.preventDefault(); event.stopPropagation(); setShowTools(false);
                toolsRef.current.querySelector('button').focus();
              }
            }}>
              <button type="button" disabled={isGenerating || !activeThread} aria-label={isVoiceMode ? 'End Gemini Live call' : 'Composer tools'}
                aria-expanded={showTools} onClick={() => isVoiceMode ? toggleVoiceConversation() : setShowTools(!showTools)}
                className="flex items-center gap-1 rounded-xl p-2 text-sky-200 hover:bg-white/10">
                {isVoiceMode ? <MicOff size={17} /> : <Plus size={18} />}<span className="hidden text-xs sm:inline">{isVoiceMode ? 'End' : 'Tools'}</span>
              </button>
              {showTools && <div className="absolute bottom-full left-0 z-20 mb-2 grid w-52 gap-1 rounded-xl border border-white/15 bg-slate-900 p-2 text-left text-sm text-white shadow-xl [&>button]:flex [&>button]:items-center [&>button]:gap-2 [&>button]:rounded-lg [&>button]:p-2 [&>button:hover]:bg-white/10">
                <button aria-label="Talk to Gemini Live" onClick={() => { setShowTools(false); toggleVoiceConversation(); }}><Mic size={16} />Talk</button>
                <button onClick={() => { setShowTools(false); uploadRef.current.click(); }}><Paperclip size={16} />Attach files or images</button>
                <button onClick={() => {
                  setShowTools(false);
                  if (files.length) { setToolError('Remove attachments to create a free image from text.'); return; }
                  setCreateImage('free'); setToolError('');
                }}><ImageIcon size={16} />Create image (free)</button>
                {provider === 'gemini' && <button onClick={() => {
                  setShowTools(false);
                  try { validateFiles(files, provider, true); setCreateImage('paid'); setToolError(''); }
                  catch (error) { setToolError(error.message); }
                }}><ImageIcon size={16} />Gemini image (paid)</button>}
              </div>}
            </div>
            {/* Textarea */}
            <textarea
              rows={1}
              aria-label={`Message ${activeCharacter.name}`}
              value={inputMessage}
              disabled={isGenerating}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={
                !hasKey && createImage !== 'free'
                  ? 'Message Ginnie with free GroqCloud chat...'
                  : createImage ? 'Describe the image to create...' : `Ask ${activeCharacter.name}... (Press Enter to send, Shift+Enter for newline)`
              }
              className="min-w-0 flex-1 bg-transparent text-white placeholder-gray-500 text-xs sm:text-sm focus:outline-none resize-none max-h-32 leading-relaxed disabled:opacity-40 disabled:cursor-not-allowed"
            />

            {/* Send Button */}
            <button
              onClick={() => handleSendMessage()}
              aria-label={createImage === 'free' ? 'Generate free image' : createImage ? 'Generate paid image' : 'Send message'}
              disabled={!inputMessage.trim() || isGenerating}
              className="p-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white shadow-md shadow-sky-500/20 transition cursor-pointer active:scale-95"
            >
              {createImage ? <ImageIcon size={15} /> : <Send size={15} />}
            </button>
          </div>
          {voiceError && <div className="mt-2 text-xs text-rose-300" role="alert">{voiceError}</div>}
        </div>
      </div>

      {showVoiceKey && (
        <div ref={voiceDialogRef} role="dialog" aria-modal="true" aria-label="Gemini voice API key" tabIndex={-1}
          className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/75 p-4">
          <form className="w-full max-w-sm space-y-4 rounded-2xl bg-slate-900 p-5 text-white" onSubmit={event => {
            event.preventDefault();
            if (!voiceKeyInput.trim()) return;
            localStorage.setItem(voiceKeyStorage, voiceKeyInput.trim());
            stopVoiceConversation();
            setVoiceKeyInput('');
            setShowVoiceKey(false);
          }}>
            <label className="block">Gemini voice API key
              <input autoComplete="off" type="password" value={voiceKeyInput} onChange={event => setVoiceKeyInput(event.target.value)}
                placeholder="Paste a new key" className="mt-2 w-full rounded-lg bg-black/40 p-2" />
            </label>
            <p className="text-sm text-slate-300">A voice key stays in this browser and uses its own project quota. Without one, calls use your saved Gemini chat key or signed-in GlassTab access.</p>
            {localStorage.getItem(voiceKeyStorage) && <button type="button" className="text-sm text-rose-300" onClick={() => {
              localStorage.removeItem(voiceKeyStorage); stopVoiceConversation(); setVoiceKeyInput(''); setShowVoiceKey(false);
            }}>Remove saved voice key</button>}
            <div className="flex justify-end gap-4">
              <button type="button" onClick={() => setShowVoiceKey(false)}>Cancel</button>
              <button disabled={!voiceKeyInput.trim()} className="rounded-lg bg-blue-600 px-3 py-1.5 disabled:opacity-50">Save key</button>
            </div>
          </form>
        </div>
      )}

      {/* ================= MODAL 1: BUILD CUSTOM CHARACTER ================= */}
      {showCustomCharModal && (
        <div ref={characterDialogRef} role="dialog" aria-modal="true" aria-label="Build custom character" tabIndex={-1} className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-[#121622] border border-white/15 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Wand2 size={18} className="text-sky-400" />
                Build Custom Character
              </h3>
              <button
                onClick={() => setShowCustomCharModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveCustomCharacter} className="space-y-3">
              <div className="flex gap-2">
                <div className="w-16">
                  <label className="text-[10px] text-gray-400 block mb-1">Avatar</label>
                  <input
                    type="text"
                    maxLength={3}
                    value={newCharAvatar}
                    onChange={(e) => setNewCharAvatar(e.target.value)}
                    className="w-full text-center text-xl py-1.5 bg-black/40 border border-white/15 rounded-xl text-white focus:outline-none focus:border-sky-400"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-gray-400 block mb-1">Character Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Code Architect, Socrates"
                    aria-label="Character name"
                    value={newCharName}
                    onChange={(e) => setNewCharName(e.target.value)}
                    className="w-full px-3 py-1.5 bg-black/40 border border-white/15 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-sky-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-gray-400 block mb-1">Tagline</label>
                <input
                  type="text"
                  placeholder="e.g. Master of clean code and system design"
                  aria-label="Character description"
                  value={newCharTagline}
                  onChange={(e) => setNewCharTagline(e.target.value)}
                  className="w-full px-3 py-1.5 bg-black/40 border border-white/15 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-sky-400"
                />
              </div>

              <div>
                <label className="text-[10px] text-gray-400 block mb-1">
                  Personality &amp; System Prompt (Rules)
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Describe how this character talks, behaves, and what rules it follows..."
                  aria-label="Character instructions"
                  value={newCharPrompt}
                  onChange={(e) => setNewCharPrompt(e.target.value)}
                  className="w-full px-3 py-2 bg-black/40 border border-white/15 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-sky-400 resize-none leading-relaxed"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowCustomCharModal(false)}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-gray-300 text-xs rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-md transition"
                >
                  Create Character
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: API KEY SETUP ================= */}
      {showApiKeyModal && (
        <div ref={keyDialogRef} role="dialog" aria-modal="true" aria-label="AI provider and API key" tabIndex={-1} className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md bg-[#121622] border border-white/15 rounded-3xl p-6 shadow-2xl space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10">
              <KeyRound size={26} />
            </div>

            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                AI Provider &amp; API Key
              </h3>
              <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                Choose a provider and model. Gennie sends a short recent history and caps each response. Provider quotas and billing still apply.
              </p>
              {provider === 'grok' && (
                <p className="text-[11px] text-amber-300 mt-2">Use an xAI API key from console.x.ai. Cursor access to Grok does not provide an xAI API key.</p>
              )}
              {provider === 'openrouter' && (
                <p className="text-[11px] text-emerald-300 mt-2">The openrouter/free router selects an available free model. Free usage has daily limits.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-left">
              <label className="text-[11px] text-gray-300">Provider
                <select value={provider} onChange={(e) => handleProviderChange(e.target.value)} className="mt-1 w-full bg-black/40 border border-white/20 rounded-xl px-3 py-2 text-white text-xs">
                  {Object.entries(AI_PROVIDERS).map(([id, info]) => <option key={id} value={id}>{info.label}</option>)}
                </select>
              </label>
              <label className="text-[11px] text-gray-300">Model ID
                <input value={activeModel} onChange={(e) => handleModelChange(e.target.value)} className="mt-1 w-full bg-black/40 border border-white/20 rounded-xl px-3 py-2 text-white text-xs" />
              </label>
            </div>

            {/* Currently Active Masked Key Display */}
            {hasKey && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl text-left space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-emerald-300 flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-emerald-400" />
                    {provider === 'gemini' ? 'Encrypted & Cloud Synced' : 'Stored in this browser'}
                  </span>
                  <button
                    type="button"
                    onClick={handleRemoveApiKey}
                    className="text-[10px] text-rose-400 hover:text-rose-300 underline cursor-pointer"
                  >
                    Remove Key
                  </button>
                </div>
                <div className="text-xs font-mono text-gray-300 tracking-wider bg-black/40 px-2.5 py-1.5 rounded-lg border border-white/10 flex items-center justify-between">
                  <span>{maskApiKey(apiKeyInput)}</span>
                  <span className="text-[9px] text-emerald-400 uppercase font-sans font-bold">Active</span>
                </div>
              </div>
            )}

            {apiKeyNotice && (
              <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium">
                {apiKeyNotice}
              </div>
            )}

            <form onSubmit={handleSaveApiKey} className="space-y-3 text-left">
              <div>
                <label className="text-[11px] text-gray-300 block mb-1 font-medium">
                  {hasKey ? `Replace ${providerInfo.label} API Key` : `Paste Your ${providerInfo.label} API Key`}
                </label>
                <div className="relative">
                  <input
                    type={showKeyPassword ? 'text' : 'password'}
                    required
                    placeholder={`${providerInfo.label} API key`}
                    aria-label={`${providerInfo.label} API key`}
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 pr-10 bg-black/40 border border-white/20 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeyPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition"
                    title={showKeyPassword ? 'Hide Key' : 'Show Key'}
                  >
                    {showKeyPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1 text-left">
                <span className="text-[11px] text-white font-semibold flex items-center gap-1">
                  <span>Get a {providerInfo.label} API key:</span>
                </span>
                <p className="text-[10px] text-gray-400 leading-normal">
                  Check your provider’s usage limits and billing before sending messages.
                </p>
                <a
                  href={providerInfo.keyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 font-medium underline pt-1"
                >
                  <span>Open {providerInfo.label} API key page</span>
                  <ExternalLink size={11} />
                </a>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowApiKeyModal(false)}
                  className="flex-1 py-2 bg-white/10 hover:bg-white/15 text-gray-300 text-xs rounded-xl transition"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white text-xs font-semibold rounded-xl shadow-lg transition"
                >
                  Save API Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GlassAIStudio;
