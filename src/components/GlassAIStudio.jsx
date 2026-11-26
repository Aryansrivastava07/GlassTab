import React, { useState, useEffect, useRef } from 'react';
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
  Volume2,
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
import { signInWithGoogle, signInWithEmail, registerWithEmail } from '../services/authService';
import { AI_VOICES, transcribeVoiceRecording, getVoiceScript, generateVoicePhrase } from '../services/aiVoiceService';
import { getAudioRecoveryDelay, isUsableVoiceBuffer, voiceAudioMatchesScript } from '../utils/voiceSpeech';

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
  const characterDialogRef = useRef(null);
  const keyDialogRef = useRef(null);
  useDialogFocus(characterDialogRef, isActive && showCustomCharModal, () => setShowCustomCharModal(false));
  useDialogFocus(keyDialogRef, isActive && showApiKeyModal, () => setShowApiKeyModal(false));
  const [aiSettings, setAiSettings] = useState(getAiSettings);
  const provider = aiSettings.provider;
  const providerInfo = AI_PROVIDERS[provider];
  const activeModel = aiSettings.models[provider] || providerInfo.model;
  const [apiKeyInput, setApiKeyInput] = useState(() => getProviderApiKey(getAiSettings().provider));
  const [showKeyPassword, setShowKeyPassword] = useState(false);
  const [apiKeyNotice, setApiKeyNotice] = useState('');
  const [hasKey, setHasKey] = useState(() => Boolean(getProviderApiKey(getAiSettings().provider).trim()));
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const isUnlocked = true;

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

  // Voice conversation state. Recording stops while the AI generates and plays audio.
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPreparingVoice, setIsPreparingVoice] = useState(false);
  const [isRestoringAudio, setIsRestoringAudio] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [showVoiceSetup, setShowVoiceSetup] = useState(false);
  const [voiceApiKeyInput, setVoiceApiKeyInput] = useState('');
  const [hasVoiceKey, setHasVoiceKey] = useState(() => Boolean(getProviderApiKey('groqcloud').trim()));
  const [preferredVoiceName, setPreferredVoiceName] = useState(() => {
    try {
      const saved = window.localStorage.getItem('landing_ai_generated_voice');
      return AI_VOICES.some((voice) => voice.id === saved) ? saved : 'autumn';
    }
    catch { return 'autumn'; }
  });
  const [microphones, setMicrophones] = useState([]);
  const [selectedMicId, setSelectedMicId] = useState(() => {
    try { return window.localStorage.getItem('landing_ai_microphone') || ''; }
    catch { return ''; }
  });
  const voiceModeRef = useRef(false);
  const isGeneratingRef = useRef(false);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const playbackContextRef = useRef(null);
  const micClosePromiseRef = useRef(Promise.resolve());
  const micReleasedAtRef = useRef(0);
  const refreshMicrophonesRef = useRef(null);
  const listenTimerRef = useRef(null);
  const audioRef = useRef(null);
  const audioDoneRef = useRef(null);
  const voiceRequestRef = useRef(null);
  const voiceSessionRef = useRef(0);
  const sessionVoiceRef = useRef('autumn');
  const sessionMicRef = useRef('');
  const restartTimerRef = useRef(null);
  const sendMessageRef = useRef(null);
  const stopVoiceRef = useRef(null);

  useEffect(() => {
    const refreshVoiceKey = (event) => {
      if (!event || event.detail?.provider === 'groqcloud') {
        setHasVoiceKey(Boolean(getProviderApiKey('groqcloud').trim()));
      }
    };
    window.addEventListener('landing_ai_provider_key_changed', refreshVoiceKey);
    return () => window.removeEventListener('landing_ai_provider_key_changed', refreshVoiceKey);
  }, []);

  useEffect(() => {
    const media = navigator.mediaDevices;
    if (!media?.enumerateDevices) return undefined;
    let mounted = true;
    const refresh = async () => {
      try {
        const devices = await media.enumerateDevices();
        if (mounted) setMicrophones(devices.filter((device) =>
          device.kind === 'audioinput' && device.deviceId && !['default', 'communications'].includes(device.deviceId)
        ));
      } catch { /* The system default microphone remains available. */ }
    };
    refreshMicrophonesRef.current = refresh;
    refresh();
    media.addEventListener?.('devicechange', refresh);
    return () => {
      mounted = false;
      media.removeEventListener?.('devicechange', refresh);
      refreshMicrophonesRef.current = null;
    };
  }, []);

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
    if (provider === 'gemini') await saveGeminiApiKey(apiKeyInput.trim(), effectiveUid);
    else saveProviderApiKey(provider, apiKeyInput.trim());
    setHasKey(Boolean(apiKeyInput.trim()));
    setApiKeyNotice(provider === 'gemini' && isSignedIn ? 'Gemini key saved and cloud synced.' : 'API key saved in this browser.');
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

  function releaseMicrophone() {
    clearInterval(listenTimerRef.current);
    listenTimerRef.current = null;
    const stream = streamRef.current;
    const context = audioContextRef.current;
    stream?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    audioContextRef.current = null;
    if (stream || context) {
      micClosePromiseRef.current = (context && context.state !== 'closed'
        ? context.close().catch(() => {})
        : Promise.resolve()).then(() => { micReleasedAtRef.current = performance.now(); });
    }
    return micClosePromiseRef.current;
  }

  function cancelRecording() {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      if (recorder.state !== 'inactive') recorder.stop();
    }
    releaseMicrophone();
  }

  function stopVoiceConversation(message = '', updateUi = true) {
    voiceModeRef.current = false;
    voiceSessionRef.current += 1;
    clearTimeout(restartTimerRef.current);
    restartTimerRef.current = null;
    cancelRecording();
    voiceRequestRef.current?.abort();
    voiceRequestRef.current = null;
    audioRef.current?.pause();
    audioDoneRef.current?.();
    audioDoneRef.current = null;
    playbackContextRef.current?.close().catch(() => {});
    playbackContextRef.current = null;
    if (updateUi) {
      setIsVoiceMode(false);
      setIsListening(false);
      setIsSpeaking(false);
      setIsPreparingVoice(false);
      setIsRestoringAudio(false);
      setIsTranscribing(false);
      setVoiceError(message);
    }
  }
  stopVoiceRef.current = stopVoiceConversation;

  async function startVoiceListening() {
    if (!voiceModeRef.current || recorderRef.current || isGeneratingRef.current || audioRef.current) return;
    const session = voiceSessionRef.current;
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        ...(sessionMicRef.current ? { deviceId: { exact: sessionMicRef.current } } : {}),
      } });
      if (!voiceModeRef.current || session !== voiceSessionRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      refreshMicrophonesRef.current?.();
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const context = new AudioContextClass();
      audioContextRef.current = context;
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      if (context.state === 'suspended') context.resume().catch(() => {});
      const samples = new Float32Array(analyser.fftSize);
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
        .find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      const chunks = [];
      let speechDetected = false;
      let loudFrames = 0;
      let noiseFloor = 0.004;
      let lastSpeechAt = 0;
      const startedAt = performance.now();
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = async () => {
        if (recorderRef.current !== recorder) return;
        recorderRef.current = null;
        await releaseMicrophone();
        setIsListening(false);
        if (!voiceModeRef.current || session !== voiceSessionRef.current) return;
        if (!speechDetected || !chunks.length) {
          restartTimerRef.current = setTimeout(startVoiceListening, 250);
          return;
        }
        setIsTranscribing(true);
        const controller = new AbortController();
        voiceRequestRef.current = controller;
        try {
          const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          const transcript = await transcribeVoiceRecording(blob, controller.signal);
          if (!voiceModeRef.current || session !== voiceSessionRef.current) return;
          setIsTranscribing(false);
          if (transcript) {
            setInputMessage(transcript);
            sendMessageRef.current?.(transcript);
          } else {
            restartTimerRef.current = setTimeout(startVoiceListening, 350);
          }
        } catch (error) {
          if (session === voiceSessionRef.current) stopVoiceConversation(error.message || 'Could not transcribe your voice.');
        } finally {
          if (voiceRequestRef.current === controller) voiceRequestRef.current = null;
        }
      };
      recorder.start(250);
      setIsListening(true);
      listenTimerRef.current = setInterval(() => {
        if (recorder.state !== 'recording') return;
        analyser.getFloatTimeDomainData(samples);
        let power = 0;
        for (const sample of samples) power += sample * sample;
        const volume = Math.sqrt(power / samples.length);
        const now = performance.now();
        const loud = volume > Math.max(0.016, noiseFloor * 2.2);
        if (!speechDetected) noiseFloor = Math.min(0.03, noiseFloor * 0.96 + volume * 0.04);
        loudFrames = loud ? loudFrames + 1 : 0;
        if (loudFrames >= 3) {
          speechDetected = true;
          lastSpeechAt = now;
        }
        if ((speechDetected && now - lastSpeechAt > 1100 && now - startedAt > 700) ||
            now - startedAt > 25000 || (!speechDetected && now - startedAt > 12000)) {
          recorder.stop();
        }
      }, 100);
    } catch (error) {
      cancelRecording();
      if (session !== voiceSessionRef.current) return;
      stopVoiceConversation(error.name === 'NotAllowedError'
        ? 'Microphone access was denied. Allow it to use AI voice chat.'
        : error.name === 'OverconstrainedError' || error.name === 'NotFoundError'
          ? 'The selected microphone is unavailable. Choose another one in Voice setup.'
          : `Could not start AI voice: ${error.message}`);
    }
  }

  async function speakVoiceReply(text) {
    if (!voiceModeRef.current) return;
    const session = voiceSessionRef.current;
    setIsPreparingVoice(true);
    const controller = new AbortController();
    voiceRequestRef.current = controller;
    let playbackContext = null;
    let played = false;
    try {
      const script = await getVoiceScript(text, controller.signal);
      if (!voiceModeRef.current || session !== voiceSessionRef.current) return;
      if (!script) {
        setIsPreparingVoice(false);
        restartTimerRef.current = setTimeout(startVoiceListening, 350);
        return;
      }
      let blob = await generateVoicePhrase(script, sessionVoiceRef.current, controller.signal);
      if (!voiceModeRef.current || session !== voiceSessionRef.current) return;

      setIsRestoringAudio(true);
      await micClosePromiseRef.current;
      if (!voiceModeRef.current || session !== voiceSessionRef.current) return;
      const recoveryRemaining = getAudioRecoveryDelay(micReleasedAtRef.current, performance.now());
      if (recoveryRemaining) await new Promise((resolve) => setTimeout(resolve, recoveryRemaining));
      if (!voiceModeRef.current || session !== voiceSessionRef.current) return;
      setIsRestoringAudio(false);

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      playbackContext = new AudioContextClass();
      playbackContextRef.current = playbackContext;
      let buffer = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try { buffer = await playbackContext.decodeAudioData(await blob.arrayBuffer()); }
        catch { buffer = null; }
        if (!voiceModeRef.current || session !== voiceSessionRef.current) return;
        if (isUsableVoiceBuffer(buffer, script)) {
          const verifiedText = await transcribeVoiceRecording(blob, controller.signal, 'en');
          if (!voiceModeRef.current || session !== voiceSessionRef.current) return;
          if (voiceAudioMatchesScript(script, verifiedText)) break;
        }
        if (attempt === 1) throw new Error('AI voice returned incomplete audio twice. Try another voice in Voice setup.');
        blob = await generateVoicePhrase(script, sessionVoiceRef.current, controller.signal);
      }
      if (voiceRequestRef.current === controller) voiceRequestRef.current = null;
      if (!voiceModeRef.current || session !== voiceSessionRef.current) return;
      await playbackContext.resume();
      if (!voiceModeRef.current || session !== voiceSessionRef.current) return;

      setIsRestoringAudio(false);
      setIsPreparingVoice(false);
      setIsSpeaking(true);
      await new Promise((resolve, reject) => {
        const source = playbackContext.createBufferSource();
        source.buffer = buffer;
        source.connect(playbackContext.destination);
        let settled = false;
        const finish = (error) => {
          if (settled) return;
          settled = true;
          source.onended = null;
          audioRef.current = null;
          audioDoneRef.current = null;
          if (error) reject(error);
          else resolve();
        };
        audioRef.current = { pause: () => { try { source.stop(); } catch { /* Already stopped. */ } finish(); } };
        audioDoneRef.current = () => finish();
        source.onended = () => finish();
        try { source.start(); }
        catch (error) { finish(error); }
      });
      played = true;
    } catch (error) {
      if (session === voiceSessionRef.current) stopVoiceConversation(error.message || 'AI voice generation failed.');
    } finally {
      if (voiceRequestRef.current === controller) voiceRequestRef.current = null;
      if (playbackContextRef.current === playbackContext) playbackContextRef.current = null;
      await playbackContext?.close().catch(() => {});
    }
    if (played && voiceModeRef.current && session === voiceSessionRef.current) {
      setIsSpeaking(false);
      setIsPreparingVoice(false);
      restartTimerRef.current = setTimeout(startVoiceListening, 350);
    }
  }

  const handleSendMessage = async (customPrompt = null) => {
    if (!hasKey) {
      setShowApiKeyModal(true);
      return;
    }

    const textToSend = (customPrompt || inputMessage).trim();
    if (!textToSend || isGeneratingRef.current) return;

    const wasVoiceTurn = voiceModeRef.current;
    if (wasVoiceTurn) {
      voiceSessionRef.current += 1;
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
      cancelRecording();
      voiceRequestRef.current?.abort();
      voiceRequestRef.current = null;
      audioRef.current?.pause();
      audioDoneRef.current?.();
      playbackContextRef.current?.close().catch(() => {});
      playbackContextRef.current = null;
      setIsListening(false);
      setIsSpeaking(false);
      setIsPreparingVoice(false);
      setIsRestoringAudio(false);
      setIsTranscribing(false);
    }

    if (!customPrompt || wasVoiceTurn) setInputMessage('');

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
    isGeneratingRef.current = true;
    setIsGenerating(true);

    try {
      const reply = await sendAiMessage({
        provider,
        model: activeModel,
        character: activeCharacter,
        userMessage: textToSend,
        history: updatedMessages.slice(0, -1),
        useWebSearch,
        voiceMode: wasVoiceTurn,
      });

      const aiMsg = {
        id: `msg_${Date.now()}_ai`,
        role: 'model',
        text: reply.text,
        modelUsed: reply.modelUsed,
        usage: reply.usage,
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
      speakVoiceReply(reply.text);
    } catch (err) {
      if (voiceModeRef.current) stopVoiceConversation('The AI request failed. Read the error in chat and tap the microphone to try again.');
      if (err.message === 'MISSING_API_KEY') {
        setShowApiKeyModal(true);
      } else {
        const errorMsg = {
          id: `msg_${Date.now()}_err`,
          role: 'model',
          text: `⚠️ **Error:** ${err.message || 'Unable to connect to the AI provider. Please check your network or API key.'}`,
          isError: true,
          keyIssue: /api key|invalid key|credits|billing|permission/i.test(err.message || ''),
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
      isGeneratingRef.current = false;
      setIsGenerating(false);
    }
  };

  sendMessageRef.current = handleSendMessage;

  const toggleVoiceConversation = () => {
    if (voiceModeRef.current) {
      stopVoiceConversation();
      return;
    }
    if (!hasKey) {
      setShowApiKeyModal(true);
      return;
    }
    if (!getProviderApiKey('groqcloud').trim()) {
      setShowVoiceSetup(true);
      setVoiceError('Add your GroqCloud API key to start AI voice chat.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder ||
        !(window.AudioContext || window.webkitAudioContext)) {
      setVoiceError('AI voice chat needs microphone recording support. Try a current version of Chrome or Edge.');
      return;
    }
    setVoiceError('');
    setShowVoiceSetup(false);
    voiceModeRef.current = true;
    sessionVoiceRef.current = preferredVoiceName;
    sessionMicRef.current = selectedMicId;
    setIsVoiceMode(true);
    startVoiceListening();
  };

  useEffect(() => {
    if (!isActive && voiceModeRef.current) stopVoiceRef.current?.();
  }, [isActive]);

  useEffect(() => () => stopVoiceRef.current?.('', false), []);

  const voiceStage = isListening ? 'listening' : isTranscribing || isGenerating ? 'thinking' : isRestoringAudio ? 'restoring' : isSpeaking ? 'speaking' : isPreparingVoice ? 'preparing' : 'connecting';
  const voiceStageCopy = {
    listening: ['Listening', 'I’ll respond when you finish speaking.'],
    thinking: [isTranscribing ? 'Understanding' : 'Thinking', isTranscribing ? 'Transcribing your voice…' : 'Putting a reply together…'],
    speaking: ['Speaking', `${activeCharacter.name} is replying with AI voice`],
    preparing: ['Preparing voice', 'Generating and checking speech…'],
    restoring: ['Restoring audio', 'Waiting for your headphones to return to full quality…'],
    connecting: ['Getting ready', 'Starting the microphone…'],
  };

  const handleVoiceSelection = (event) => {
    const name = event.target.value;
    setPreferredVoiceName(name);
    try { window.localStorage.setItem('landing_ai_generated_voice', name); }
    catch { /* The current session can still use the chosen voice. */ }
  };

  const handleMicrophoneSelection = (event) => {
    const deviceId = event.target.value;
    setSelectedMicId(deviceId);
    try { window.localStorage.setItem('landing_ai_microphone', deviceId); }
    catch { /* This call can still use the selected microphone. */ }
  };

  const handleSaveVoiceKey = (event) => {
    event.preventDefault();
    const key = voiceApiKeyInput.trim();
    if (!key) return;
    saveProviderApiKey('groqcloud', key);
    setHasVoiceKey(true);
    setVoiceApiKeyInput('');
    setVoiceError('');
    setShowVoiceSetup(false);
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
                {provider === 'gemini' && isSignedIn ? 'Gemini Cloud Synced' : `${providerInfo.label} Key Active`}
              </span>
              <button
                onClick={() => setShowApiKeyModal(true)}
                className="text-[10px] text-emerald-400 underline hover:text-emerald-200 cursor-pointer font-medium"
              >
                Manage
              </button>
            </div>
          ) : (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1.5 text-left">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-300">
                <KeyRound size={13} className="text-amber-400" />
                <span>{providerInfo.label} API Key Required</span>
              </div>
              <p className="text-[10px] text-gray-400 leading-tight">
                Add your {providerInfo.label} API key to start chatting. Provider quotas and billing apply.
              </p>
              <button
                onClick={() => setShowApiKeyModal(true)}
                className="w-full py-1.5 text-[10px] bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white rounded-lg font-semibold flex items-center justify-center gap-1 transition cursor-pointer shadow-md shadow-amber-500/10"
              >
                <KeyRound size={11} />
                <span>Add API Key</span>
              </button>
            </div>
          )}

          {!isSignedIn && (
            <div className="text-[10px] text-gray-400 text-center pt-0.5">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSigningIn}
                className="text-sky-400 hover:text-sky-300 underline font-medium cursor-pointer"
              >
                {isSigningIn ? 'Signing In...' : 'Sign in with Google'}
              </button>
              <span> to sync across devices</span>
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
          
          {/* Missing API Key Banner */}
              {!hasKey && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-amber-200 animate-fadeIn shadow-lg">
                  <div className="flex items-center gap-2.5">
                    <KeyRound size={16} className="text-amber-400 shrink-0" />
                    <span>Add a {providerInfo.label} API key to start chatting with {activeCharacter.name}.</span>
                  </div>
                  <button
                    onClick={() => setShowApiKeyModal(true)}
                    className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white font-semibold rounded-xl text-xs shrink-0 transition cursor-pointer active:scale-95 shadow-md shadow-amber-500/20"
                  >
                    Add API Key
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
                      {!isUser && !msg.isError && msg.usage?.total && (
                        <div className="mt-2 text-[10px] text-gray-500">{msg.modelUsed} · {msg.usage.total} tokens</div>
                      )}
                      {msg.isError && msg.keyIssue && (
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
          {isVoiceMode && (
            <div className={`voice-stage voice-stage--${voiceStage} mb-3`} role="status" aria-live="polite">
              <div className="voice-orb-wrap" aria-hidden="true">
                <span className="voice-ring voice-ring--one" />
                <span className="voice-ring voice-ring--two" />
                <span className="voice-orb">
                  {isSpeaking ? <Volume2 size={22} strokeWidth={1.8} /> : <Mic size={22} strokeWidth={1.8} />}
                </span>
              </div>
              <div className="voice-stage-copy">
                <div className="voice-stage-title">{voiceStageCopy[voiceStage][0]}</div>
                <div className="voice-stage-subtitle">{voiceStageCopy[voiceStage][1]}</div>
                <div className="voice-choice">
                  <span>AI voice</span>
                  <strong>{AI_VOICES.find((voice) => voice.id === sessionVoiceRef.current)?.label || 'Autumn'}</strong>
                </div>
                <div className="voice-source">AI generated · GroqCloud</div>
              </div>
              <div className="voice-bars" aria-hidden="true">
                {Array.from({ length: 7 }, (_, index) => <i key={index} />)}
              </div>
              <button type="button" className="voice-end" onClick={() => stopVoiceConversation()} aria-label="End voice conversation">
                <MicOff size={16} />
              </button>
            </div>
          )}
          {showVoiceSetup && (
            <div className="mb-3 rounded-2xl border border-sky-300/25 bg-slate-900/95 p-3 text-xs text-slate-200">
              <div className="flex items-center justify-between gap-2">
                <strong className="text-sm text-white">AI voice setup</strong>
                <button type="button" onClick={() => setShowVoiceSetup(false)} className="rounded-lg p-1 text-slate-400 hover:text-white" aria-label="Close voice setup"><X size={15} /></button>
              </div>
              <p className="mt-1 text-slate-400">GroqCloud Whisper understands your microphone; Orpheus creates expressive female speech in English. Each reply includes an audio quality check and uses your GroqCloud quota.</p>
              <label className="mt-3 flex items-center gap-2 text-slate-300">
                <span>AI voice</span>
                <select value={preferredVoiceName} onChange={handleVoiceSelection} disabled={isVoiceMode} className="rounded-lg border border-white/20 bg-slate-800 px-2 py-1.5 text-white disabled:opacity-50">
                  {AI_VOICES.map((voice) => <option key={voice.id} value={voice.id}>{voice.label}</option>)}
                </select>
                {isVoiceMode && <span className="text-slate-400">End the call to change voice.</span>}
              </label>
              <label className="mt-2 flex items-center gap-2 text-slate-300">
                <span>Microphone</span>
                <select value={selectedMicId} onChange={handleMicrophoneSelection} disabled={isVoiceMode} className="min-w-0 flex-1 rounded-lg border border-white/20 bg-slate-800 px-2 py-1.5 text-white disabled:opacity-50">
                  <option value="">System default</option>
                  {selectedMicId && !microphones.some((device) => device.deviceId === selectedMicId) && <option value={selectedMicId}>Saved microphone unavailable</option>}
                  {microphones.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Microphone ${index + 1}`}</option>)}
                </select>
              </label>
              <p className="mt-1 text-[11px] text-slate-400">For steady stereo sound in Bluetooth buds, choose your laptop microphone if available. Microphone names appear after access is allowed.</p>
              <form onSubmit={handleSaveVoiceKey} className="mt-3 flex gap-2">
                <input type="password" autoComplete="off" value={voiceApiKeyInput} onChange={(event) => setVoiceApiKeyInput(event.target.value)} placeholder={hasVoiceKey ? 'Replace saved GroqCloud key' : 'Paste GroqCloud API key'} aria-label="GroqCloud voice API key" className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white outline-none focus:border-sky-400" />
                <button type="submit" disabled={!voiceApiKeyInput.trim()} className="rounded-lg bg-sky-600 px-3 py-2 font-medium text-white disabled:opacity-40">Save key</button>
              </form>
              <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                <span>{hasVoiceKey ? 'GroqCloud key saved in this browser.' : 'A GroqCloud key is required for AI voice.'}</span>
                <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="text-sky-300 hover:text-sky-200">Get a key ↗</a>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 bg-black/40 border border-white/15 focus-within:border-sky-400/60 focus-within:ring-1 focus-within:ring-sky-400/20 rounded-2xl px-3 py-2 shadow-inner transition">
            
            {/* Hands-free voice conversation */}
            <button
              onClick={toggleVoiceConversation}
              type="button"
              aria-pressed={isVoiceMode}
              className={`p-2 rounded-xl transition cursor-pointer inline-flex items-center gap-1.5 shrink-0 ${
                isVoiceMode
                  ? 'bg-rose-500/20 text-rose-200'
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
              title={isVoiceMode ? 'End voice conversation' : 'Start voice conversation'}
            >
              {isVoiceMode ? <MicOff size={16} /> : <Mic size={16} />}
              <span className="hidden sm:inline text-xs font-medium">{isVoiceMode ? 'End' : 'Talk'}</span>
            </button>
            <button type="button" onClick={() => setShowVoiceSetup((value) => !value)} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white" title="AI voice setup" aria-label="AI voice setup">
              <KeyRound size={15} />
            </button>

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
                !hasKey
                  ? `Add a ${providerInfo.label} API key to chat with ${activeCharacter.name}...`
                  : `Ask ${activeCharacter.name}... (Press Enter to send, Shift+Enter for newline)`
              }
              className="flex-1 bg-transparent text-white placeholder-gray-500 text-xs sm:text-sm focus:outline-none resize-none max-h-32 leading-relaxed disabled:opacity-40 disabled:cursor-not-allowed"
            />

            {/* Send Button */}
            <button
              onClick={() => handleSendMessage()}
              aria-label="Send message"
              disabled={!inputMessage.trim() || isGenerating}
              className="p-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white shadow-md shadow-sky-500/20 transition cursor-pointer active:scale-95"
            >
              <Send size={15} />
            </button>
          </div>
          {voiceError && <div className="mt-2 text-xs text-rose-300" role="alert">{voiceError}</div>}
        </div>
      </div>

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
                    {provider === 'gemini' && isSignedIn ? 'Encrypted & Cloud Synced' : 'Stored in this browser'}
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
