import React, { useState, useEffect, useRef } from 'react';
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
  getFreeTrialUsage,
  subscribeToAccountAiTrialUsage,
  sendAiMessage,
} from '../services/aiChatService';
import { getGeminiApiKey, saveGeminiApiKey, maskApiKey, subscribeToCloudGeminiKey } from '../services/aiWidgetService';
import { useAuth } from '../context/AuthContext';
import { signInWithGoogle, signInWithEmail, registerWithEmail } from '../services/authService';

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

export const GlassAIStudio = ({ onScrollToDashboard }) => {
  const { currentUser, isGuest } = useAuth();
  const isSignedIn = !isGuest && Boolean(currentUser?.uid && currentUser.uid !== 'local_guest');
  const effectiveUid = isSignedIn ? currentUser.uid : 'local_guest';

  const [isSigningIn, setIsSigningIn] = useState(false);
  const [signInError, setSignInError] = useState('');

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
  const [apiKeyInput, setApiKeyInput] = useState(() => getGeminiApiKey());
  const [showKeyPassword, setShowKeyPassword] = useState(false);
  const [apiKeyNotice, setApiKeyNotice] = useState('');
  const [trialUsage, setTrialUsage] = useState(() => getFreeTrialUsage(effectiveUid));
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const isUnlocked = isSignedIn || Boolean(trialUsage.hasCustomKey);

  // Subscribe to real-time Cloud Firestore trial usage & encrypted Gemini key
  useEffect(() => {
    const unsubTrial = subscribeToAccountAiTrialUsage(effectiveUid, (usage) => {
      setTrialUsage(usage);
    });
    const unsubKey = subscribeToCloudGeminiKey(effectiveUid, (cloudKey) => {
      if (cloudKey) setApiKeyInput(cloudKey);
      setTrialUsage(getFreeTrialUsage(effectiveUid));
    });

    const onKeyChanged = (e) => {
      if (e.detail?.key !== undefined) {
        setApiKeyInput(e.detail.key);
      }
      setTrialUsage(getFreeTrialUsage(effectiveUid));
    };
    window.addEventListener('landing_gemini_key_changed', onKeyChanged);

    return () => {
      unsubTrial();
      unsubKey();
      window.removeEventListener('landing_gemini_key_changed', onKeyChanged);
    };
  }, [effectiveUid]);

  const [showEmailAuth, setShowEmailAuth] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setSignInError('');
    try {
      await signInWithGoogle();
    } catch (err) {
      if (err?.code === 'auth/popup-closed-by-user') {
        setSignInError('Sign-in window was closed. Please try again or use Email.');
      } else if (err?.code === 'auth/network-request-failed') {
        setSignInError('Network connection issue. Please check your internet connection.');
      } else {
        setSignInError(err?.message || 'Unable to sign in with Google. Please try again or use Email.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleEmailAuthSubmit = async (e) => {
    e.preventDefault();
    setIsEmailSubmitting(true);
    setSignInError('');
    try {
      if (isRegistering) {
        await registerWithEmail(emailInput, passwordInput);
      } else {
        await signInWithEmail(emailInput, passwordInput);
      }
      setEmailInput('');
      setPasswordInput('');
    } catch (err) {
      setSignInError(err?.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsEmailSubmitting(false);
    }
  };

  // Custom Character Form State
  const [newCharName, setNewCharName] = useState('');
  const [newCharAvatar, setNewCharAvatar] = useState('✨');
  const [newCharTagline, setNewCharTagline] = useState('');
  const [newCharPrompt, setNewCharPrompt] = useState('');

  // Speech-to-Text State
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

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
    setActiveThreadId(threadId);
    setIsMobileSidebarOpen(false);
    const target = threads.find((t) => t.id === threadId);
    if (target?.characterId) {
      setActiveCharacterId(target.characterId);
    }
  };

  const handleCreateNewChat = (charId = activeCharacterId) => {
    setIsMobileSidebarOpen(false);
    const { threads: nextThreads, activeThread: created } = createNewThread(charId);
    setThreads(nextThreads);
    setActiveThreadId(created.id);
    setShowCharacterMenu(false);
  };

  const handleDeleteThread = (threadId, e) => {
    e.stopPropagation();
    const updated = deleteChatThread(threadId);
    setThreads(updated);
    if (activeThreadId === threadId) {
      setActiveThreadId(updated[0]?.id || null);
    }
  };

  const handleSwitchCharacter = (charId) => {
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
    await saveGeminiApiKey(apiKeyInput.trim(), effectiveUid);
    setTrialUsage(getFreeTrialUsage(effectiveUid));
    setApiKeyNotice(
      isSignedIn
        ? '🔒 Encrypted with AES-256 and synced to your Google Account!'
        : 'API Key saved securely in your browser!'
    );
    setTimeout(() => {
      setShowApiKeyModal(false);
      setApiKeyNotice('');
    }, 1400);
  };

  const handleRemoveApiKey = async () => {
    await saveGeminiApiKey('', effectiveUid);
    setApiKeyInput('');
    setTrialUsage(getFreeTrialUsage(effectiveUid));
    setApiKeyNotice('API Key removed.');
    setTimeout(() => {
      setApiKeyNotice('');
    }, 1200);
  };

  const handleSendMessage = async (customPrompt = null) => {
    if (!isUnlocked) {
      setSignInError('Please sign in with Google to start chatting with AI companions.');
      return;
    }

    const textToSend = (customPrompt || inputMessage).trim();
    if (!textToSend || isGenerating) return;

    const currentUsage = getFreeTrialUsage(effectiveUid);
    if (currentUsage.isExhausted && !currentUsage.hasCustomKey) {
      setShowApiKeyModal(true);
      return;
    }

    if (!customPrompt) setInputMessage('');

    // Append user message immediately
    const userMsg = {
      id: `msg_${Date.now()}`,
      role: 'user',
      text: textToSend,
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

    const updatedThreads = threads.map((t) =>
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
    setIsGenerating(true);

    try {
      const reply = await sendAiMessage({
        userId: effectiveUid,
        character: activeCharacter,
        userMessage: textToSend,
        history: updatedMessages.slice(0, -1),
        useWebSearch,
      });

      const aiMsg = {
        id: `msg_${Date.now()}_ai`,
        role: 'model',
        text: reply.text,
        modelUsed: reply.modelUsed,
        groundingChunks: reply.groundingChunks,
        timestamp: new Date().toISOString(),
      };

      const finalThreads = updatedThreads.map((t) =>
        t.id === targetThread.id
          ? {
              ...t,
              messages: [...updatedMessages, aiMsg],
              updatedAt: new Date().toISOString(),
            }
          : t
      );

      setThreads(finalThreads);
      saveChatThreads(finalThreads);
      setTrialUsage(getFreeTrialUsage(effectiveUid));
    } catch (err) {
      if (err.message === 'SIGN_IN_REQUIRED') {
        setSignInError('Sign in with Google to use AI Studio.');
      } else if (err.message === 'TRIAL_EXHAUSTED' || err.message === 'MISSING_API_KEY') {
        setShowApiKeyModal(true);
      } else {
        const errorMsg = {
          id: `msg_${Date.now()}_err`,
          role: 'model',
          text: `⚠️ **Error:** ${err.message || 'Unable to connect to Gemini API. Please check your network or API key.'}`,
          isError: true,
          timestamp: new Date().toISOString(),
        };

        const finalThreads = updatedThreads.map((t) =>
          t.id === targetThread.id
            ? { ...t, messages: [...updatedMessages, errorMsg] }
            : t
        );
        setThreads(finalThreads);
        saveChatThreads(finalThreads);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // Web Speech API Voice Dictation
  const toggleListening = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Speech Recognition is not supported in this browser.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInputMessage((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
  };

  return (
    <div className="w-full max-w-6xl h-[88vh] bg-[#0c1017]/95 dark-glass rounded-3xl border border-white/15 flex shadow-[0_24px_80px_rgba(0,0,0,0.8)] overflow-hidden backdrop-blur-2xl relative select-text">
      
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
              <span className="text-[10px] text-gray-400 font-mono">Gemini 3.8 Flash</span>
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

        {/* Sidebar Footer: Fair-Use Trial Counter & Key Status */}
        <div className="p-3.5 border-t border-white/10 bg-black/20 space-y-2">
          {!isSignedIn ? (
            <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-sky-500/10 border border-sky-400/25 space-y-2 text-center">
              <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-white">
                <Lock size={13} className="text-sky-400" />
                <span>Account Required</span>
              </div>
              <p className="text-[10px] text-gray-300 leading-tight">
                Sign in with Google to get 10 free messages synced to your account.
              </p>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSigningIn}
                className="w-full py-1.5 px-2.5 rounded-xl bg-white hover:bg-gray-100 text-gray-900 font-semibold text-[11px] flex items-center justify-center gap-1.5 shadow-md transition cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <span>{isSigningIn ? 'Signing In...' : 'Sign in with Google'}</span>
              </button>
            </div>
          ) : trialUsage.hasCustomKey ? (
            <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300">
              <span className="flex items-center gap-1.5 font-medium">
                <ShieldCheck size={14} className="text-emerald-400" />
                Unlimited API Active
              </span>
              <button
                onClick={() => setShowApiKeyModal(true)}
                className="text-[10px] text-emerald-400 underline hover:text-emerald-200 cursor-pointer"
              >
                Edit Key
              </button>
            </div>
          ) : (
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-gray-300 font-medium">Free Trial Messages</span>
                <span className="font-mono text-sky-400 font-bold">
                  {trialUsage.count} / {trialUsage.max}
                </span>
              </div>
              {/* Progress bar */}
              <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/10">
                <div
                  className="h-full bg-gradient-to-r from-sky-400 to-blue-500 transition-all duration-300"
                  style={{ width: `${Math.min(100, (trialUsage.count / trialUsage.max) * 100)}%` }}
                />
              </div>
              <button
                onClick={() => setShowApiKeyModal(true)}
                className="w-full py-1 text-[10px] bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-400/20 rounded-lg font-medium flex items-center justify-center gap-1 transition cursor-pointer"
              >
                <KeyRound size={11} />
                <span>Add Free Gemini Key for Unlimited</span>
              </button>
            </div>
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
              className={`px-2.5 py-1 rounded-xl text-xs font-medium flex items-center gap-1.5 transition cursor-pointer border ${
                useWebSearch
                  ? 'bg-blue-600/80 text-white border-blue-400 shadow-sm'
                  : 'bg-white/5 text-gray-400 hover:text-white border-white/10'
              }`}
              title="Toggle Live Google Search Grounding"
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
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          
          {/* Guest Lock Screen: Require Google sign-in to chat and claim 10 free messages */}
          {!isUnlocked ? (
            <div className="h-full min-h-[380px] flex items-center justify-center p-4 animate-fadeIn">
              <div className="max-w-md w-full p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-white/15 backdrop-blur-2xl text-center space-y-5 shadow-2xl">
                <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-sky-500/20 to-indigo-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400 mx-auto shadow-xl shadow-sky-500/10">
                  <Lock size={28} />
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-white tracking-tight">
                    Sign in to Unlock AI Studio
                  </h3>
                  <p className="text-xs text-gray-300 leading-relaxed max-w-sm mx-auto">
                    Sign in to get <strong className="text-sky-300">10 free AI chats</strong> powered by Gemini 2.5 Flash with live Google Search. Your trial is securely synced to your account across devices.
                  </p>
                </div>

                {signInError && (
                  <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs text-left leading-relaxed flex items-center gap-2 animate-fadeIn">
                    <AlertCircle size={15} className="text-amber-400 shrink-0" />
                    <span>{signInError}</span>
                  </div>
                )}

                <div className="space-y-2.5 pt-1">
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isSigningIn}
                    className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-gray-100 text-gray-900 font-semibold text-sm flex items-center justify-center gap-2.5 shadow-lg transition cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>{isSigningIn ? 'Connecting to Google...' : 'Continue with Google'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowEmailAuth(!showEmailAuth)}
                    className="w-full py-1 text-xs text-gray-400 hover:text-white transition cursor-pointer text-center"
                  >
                    {showEmailAuth ? 'Hide email sign-in' : 'Or sign in / register with Email'}
                  </button>

                  {showEmailAuth && (
                    <form onSubmit={handleEmailAuthSubmit} className="p-3 bg-white/5 border border-white/10 rounded-xl space-y-2 text-left animate-fadeIn">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-white">{isRegistering ? 'Create Account' : 'Email Sign In'}</span>
                        <button
                          type="button"
                          onClick={() => setIsRegistering(!isRegistering)}
                          className="text-sky-400 hover:text-sky-300 text-[11px] underline cursor-pointer"
                        >
                          {isRegistering ? 'Have an account? Sign In' : 'Sign Up'}
                        </button>
                      </div>
                      <input
                        type="email"
                        required
                        placeholder="Email address"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        className="w-full px-3 py-1.5 bg-black/40 border border-white/15 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-sky-400"
                      />
                      <input
                        type="password"
                        required
                        minLength={6}
                        placeholder="Password (min 6 characters)"
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        className="w-full px-3 py-1.5 bg-black/40 border border-white/15 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-sky-400"
                      />
                      <button
                        type="submit"
                        disabled={isEmailSubmitting}
                        className="w-full py-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white rounded-lg text-xs font-semibold shadow transition cursor-pointer disabled:opacity-50"
                      >
                        {isEmailSubmitting ? 'Please wait...' : (isRegistering ? 'Create Account & Unlock' : 'Sign In & Unlock')}
                      </button>
                    </form>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowApiKeyModal(true)}
                    className="w-full py-2 px-3 text-xs text-sky-400 hover:text-sky-300 font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <KeyRound size={13} />
                    <span>Have a Gemini API key? Unlock unlimited chat</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Trial Exhausted Inline Banner */}
              {trialUsage.isExhausted && !trialUsage.hasCustomKey && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-amber-200 animate-fadeIn shadow-lg">
                  <div className="flex items-center gap-2.5">
                    <Sparkles size={16} className="text-amber-400 shrink-0" />
                    <span>You&apos;ve used all 10 free trial messages on this account. Add your own free key for unlimited chats!</span>
                  </div>
                  <button
                    onClick={() => setShowApiKeyModal(true)}
                    className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-900 font-semibold rounded-xl text-xs shrink-0 transition cursor-pointer active:scale-95"
                  >
                    Add Free Key
                  </button>
                </div>
              )}

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
                      <FormattedMessage text={msg.text} />
                      {msg.isError && (
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
            </>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-white/10 bg-black/35 shrink-0">
          <div className="flex items-center gap-2 bg-black/40 border border-white/15 focus-within:border-sky-400/60 focus-within:ring-1 focus-within:ring-sky-400/20 rounded-2xl px-3 py-2 shadow-inner transition">
            
            {/* Voice Dictation Button */}
            <button
              onClick={toggleListening}
              disabled={!isUnlocked}
              className={`p-2 rounded-xl transition cursor-pointer ${
                !isUnlocked
                  ? 'opacity-30 cursor-not-allowed text-gray-500'
                  : isListening
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
              title={!isUnlocked ? 'Sign in to use voice dictation' : (isListening ? 'Stop listening' : 'Speak message')}
            >
              {isListening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>

            {/* Textarea */}
            <textarea
              rows={1}
              value={inputMessage}
              disabled={!isUnlocked || isGenerating}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={
                !isUnlocked
                  ? "Sign in with Google to start chatting with AI companions..."
                  : trialUsage.isExhausted && !trialUsage.hasCustomKey
                  ? "Trial limit reached (10/10) - add a Gemini API key to continue..."
                  : `Ask ${activeCharacter.name}... (Press Enter to send, Shift+Enter for newline)`
              }
              className="flex-1 bg-transparent text-white placeholder-gray-500 text-xs sm:text-sm focus:outline-none resize-none max-h-32 leading-relaxed disabled:opacity-40 disabled:cursor-not-allowed"
            />

            {/* Send Button */}
            <button
              onClick={() => handleSendMessage()}
              disabled={!isUnlocked || !inputMessage.trim() || isGenerating || (trialUsage.isExhausted && !trialUsage.hasCustomKey)}
              className="p-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white shadow-md shadow-sky-500/20 transition cursor-pointer active:scale-95"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* ================= MODAL 1: BUILD CUSTOM CHARACTER ================= */}
      {showCustomCharModal && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
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

      {/* ================= MODAL 2: 10-MESSAGE TRIAL GATE & API KEY SETUP ================= */}
      {showApiKeyModal && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md bg-[#121622] border border-white/15 rounded-3xl p-6 shadow-2xl space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10">
              <KeyRound size={26} />
            </div>

            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                Google Gemini API Key
              </h3>
              <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                Add your personal free Gemini key for <strong>unlimited AI chats</strong> with Ginnie &amp; custom personas. Synced securely to your Google account with AES-256 encryption.
              </p>
            </div>

            {/* Currently Active Masked Key Display */}
            {trialUsage.hasCustomKey && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl text-left space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-emerald-300 flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-emerald-400" />
                    {isSignedIn ? 'AES-256 Encrypted & Cloud Synced' : 'Active & Stored Locally'}
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
                  {trialUsage.hasCustomKey ? 'Replace API Key' : 'Paste Your Gemini API Key'}
                </label>
                <div className="relative">
                  <input
                    type={showKeyPassword ? 'text' : 'password'}
                    required
                    placeholder="AIzaSy..."
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
                  <span>How to get your free key in 30 seconds:</span>
                </span>
                <p className="text-[10px] text-gray-400 leading-normal">
                  Google AI Studio gives free API keys with no credit card required.
                </p>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 font-medium underline pt-1"
                >
                  <span>Open Google AI Studio &gt; Create API Key</span>
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
                  Save &amp; Encrypt Key
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
