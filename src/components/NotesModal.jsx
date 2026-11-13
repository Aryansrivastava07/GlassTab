import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  Trash2,
  Check,
  X,
  StickyNote,
  CheckSquare,
  Edit3,
  Lock,
  Unlock,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Eye,
  EyeOff,
  Copy,
  KeyRound,
  LogIn,
  ExternalLink,
  Image as ImageIcon,
  Film,
  Paperclip,
  Download,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  subscribeToUserData,
  updateUserData,
} from '../services/databaseService';
import { getCachedUserData } from '../utils/cacheService';
import { signInWithGoogle, signInWithEmail, registerWithEmail, getExtensionOrigin, getOAuthRedirectURL } from '../services/authService';
import {
  saveMediaLocalFirst,
  syncMediaToCloud,
  resolveMediaSource,
  deleteMediaEverywhere,
  formatBytes,
  MAX_VAULT_MEDIA_BYTES,
} from '../services/mediaService';

// SHA-256 PIN hashing helper using Web Crypto API
const hashPin = async (pin, uid) => {
  const data = new TextEncoder().encode(`secure_vault_${uid}_${pin}`);
  const hashBuf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

const VAULT_CATEGORIES = ['Secret', 'Password', 'API Key', 'Private Note', 'Photo / Media'];

// Lazy-rendered protected media viewer (only fetches/decodes once revealed)
const VaultMediaViewer = ({ item, uid }) => {
  const [resolved, setResolved] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let createdObjUrl = null;

    const load = async () => {
      setLoading(true);
      const res = await resolveMediaSource({
        uid,
        localKey: item.localKey || `vault_${uid}_${item.mediaId}`,
        remoteUrl: item.mediaUrl || null,
        firestoreMediaId: item.firestoreMediaId || null,
        mediaTypeHint: item.mediaType || 'image',
      });
      if (!cancelled) {
        if (res?.isObjectUrl) createdObjUrl = res.src;
        setResolved(res);
        setLoading(false);
      } else if (res?.isObjectUrl) {
        URL.revokeObjectURL(res.src);
      }
    };

    load();

    return () => {
      cancelled = true;
      if (createdObjUrl) URL.revokeObjectURL(createdObjUrl);
    };
  }, [uid, item.mediaId, item.localKey, item.mediaUrl, item.firestoreMediaId, item.mediaType]);

  if (loading) {
    return (
      <div className="p-3 bg-black/30 rounded-lg text-[11px] text-gray-400">
        Loading protected media...
      </div>
    );
  }

  if (!resolved?.src) {
    return (
      <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-[11px] text-red-300">
        Media not found locally or in cloud.
      </div>
    );
  }

  return (
    <div className="relative rounded-lg overflow-hidden bg-black/50 border border-white/10">
      {resolved.mediaType === 'video' ? (
        <video
          src={resolved.src}
          controls
          playsInline
          className="w-full max-h-64 object-contain bg-black"
        />
      ) : (
        <img
          src={resolved.src}
          alt={item.mediaName || item.title}
          className="w-full max-h-64 object-contain bg-black/40"
        />
      )}
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-black/60 text-[10px] text-gray-300 border-t border-white/10">
        <span className="truncate max-w-[70%]">{item.mediaName || 'Protected file'}</span>
        <a
          href={resolved.src}
          download={item.mediaName || `vault-${item.id}`}
          className="inline-flex items-center gap-1 text-amber-300 hover:text-amber-200 cursor-pointer"
        >
          <Download size={11} />
          Save
        </a>
      </div>
    </div>
  );
};

const NotesModal = ({ isOpen, onClose }) => {
  const { currentUser, isGuest } = useAuth();
  const effectiveUid = currentUser?.uid || 'local_guest';

  const initialCached = getCachedUserData(effectiveUid);
  const [activeTab, setActiveTab] = useState('todos'); // 'todos' | 'notes' | 'vault'
  const [todos, setTodos] = useState(() => (Array.isArray(initialCached?.todos) ? initialCached.todos : []));
  const [notes, setNotes] = useState(() => (Array.isArray(initialCached?.notes) ? initialCached.notes : []));
  const [newTodo, setNewTodo] = useState('');
  const [newNote, setNewNote] = useState({ title: '', content: '' });

  // --- Secure Vault State ---
  const [vaultPinHash, setVaultPinHash] = useState(() => initialCached?.vaultPinHash || null);
  const [vaultNotes, setVaultNotes] = useState(() => (Array.isArray(initialCached?.vaultNotes) ? initialCached.vaultNotes : []));
  const [isVaultUnlocked, setIsVaultUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [vaultError, setVaultError] = useState('');
  const [showNewVaultForm, setShowNewVaultForm] = useState(false);
  const [newVaultNote, setNewVaultNote] = useState({ title: '', content: '', tag: 'Secret' });
  const [visibleSecretIds, setVisibleSecretIds] = useState(new Set());
  const [copiedId, setCopiedId] = useState(null);
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [oldPinInput, setOldPinInput] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showEmailAuth, setShowEmailAuth] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [vaultMediaFile, setVaultMediaFile] = useState(null);
  const [savingVaultItem, setSavingVaultItem] = useState(false);

  // Auto-lock vault on modal close for security
  useEffect(() => {
    if (!isOpen) {
      setIsVaultUnlocked(false);
      setPinInput('');
      setNewPin('');
      setConfirmPin('');
      setOldPinInput('');
      setVaultError('');
      setIsChangingPin(false);
      setShowNewVaultForm(false);
      setVaultMediaFile(null);
      setSavingVaultItem(false);
      setVisibleSecretIds(new Set());
    }
  }, [isOpen]);

  const loadData = () => {
    const cachedData = getCachedUserData(effectiveUid);
    if (cachedData) {
      setTodos(Array.isArray(cachedData.todos) ? cachedData.todos : []);
      setNotes(Array.isArray(cachedData.notes) ? cachedData.notes : []);
      setVaultPinHash(cachedData.vaultPinHash || null);
      setVaultNotes(Array.isArray(cachedData.vaultNotes) ? cachedData.vaultNotes : []);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    loadData();

    const unsubscribe = subscribeToUserData(effectiveUid, (userData) => {
      if (userData) {
        setTodos(Array.isArray(userData.todos) ? userData.todos : []);
        setNotes(Array.isArray(userData.notes) ? userData.notes : []);
        setVaultPinHash(userData.vaultPinHash || null);
        setVaultNotes(Array.isArray(userData.vaultNotes) ? userData.vaultNotes : []);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [effectiveUid, isOpen]);

  const persist = async (partial) => {
    try {
      await updateUserData(effectiveUid, partial);
    } catch (e) {
      console.error('Failed to update notes/todos/vault:', e);
    }
  };

  // --- TODOS METHODS ---
  const addTodo = () => {
    if (!newTodo.trim()) return;

    const updatedTodos = [
      ...todos,
      {
        id: Date.now(),
        text: newTodo.trim(),
        completed: false,
        createdAt: new Date().toISOString(),
      },
    ];

    setTodos(updatedTodos);
    persist({ todos: updatedTodos });
    setNewTodo('');
  };

  const toggleTodo = (id) => {
    const updatedTodos = todos.map((todo) =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    );
    setTodos(updatedTodos);
    persist({ todos: updatedTodos });
  };

  const deleteTodo = (id) => {
    const updatedTodos = todos.filter((todo) => todo.id !== id);
    setTodos(updatedTodos);
    persist({ todos: updatedTodos });
  };

  // --- NOTES METHODS & THEMES ---
  const NOTE_THEMES = [
    { id: 'blue', label: 'Sky', dot: '#38bdf8', border: '#38bdf8', glow: 'rgba(56, 189, 248, 0.14)' },
    { id: 'emerald', label: 'Emerald', dot: '#34d399', border: '#34d399', glow: 'rgba(52, 211, 153, 0.14)' },
    { id: 'violet', label: 'Violet', dot: '#a78bfa', border: '#a78bfa', glow: 'rgba(167, 139, 250, 0.14)' },
    { id: 'amber', label: 'Amber', dot: '#fbbf24', border: '#fbbf24', glow: 'rgba(251, 191, 36, 0.14)' },
    { id: 'rose', label: 'Rose', dot: '#fb7185', border: '#fb7185', glow: 'rgba(251, 113, 133, 0.14)' },
    { id: 'slate', label: 'Slate', dot: '#94a3b8', border: '#94a3b8', glow: 'rgba(148, 163, 184, 0.14)' },
  ];

  const [selectedNoteTheme, setSelectedNoteTheme] = useState('blue');
  const [copiedNoteId, setCopiedNoteId] = useState(null);

  const copyNoteText = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedNoteId(id);
    setTimeout(() => setCopiedNoteId(null), 1800);
  };

  const getNoteCardStyles = (note) => {
    const colorKey = note?.theme || note?.color;
    const match = NOTE_THEMES.find((t) => t.id === colorKey || t.dot === colorKey || t.border === colorKey);
    if (match) {
      return {
        border: match.border,
        glow: match.glow,
        dot: match.dot,
      };
    }

    // If it's a legacy hex (#ffccbc, #fed7aa, etc.) or rgba/hsl:
    if (typeof colorKey === 'string' && (colorKey.startsWith('#') || colorKey.startsWith('rgb') || colorKey.startsWith('hsl'))) {
      const isRgba = colorKey.startsWith('rgba');
      return {
        border: isRgba ? colorKey.replace(/[\d\.]+\)$/, '0.85)') : colorKey,
        glow: isRgba ? colorKey : 'rgba(255, 255, 255, 0.05)',
        dot: isRgba ? colorKey.replace(/[\d\.]+\)$/, '1)') : colorKey,
      };
    }

    return {
      border: '#38bdf8',
      glow: 'rgba(56, 189, 248, 0.14)',
      dot: '#38bdf8',
    };
  };

  const formatRelativeTime = (isoString) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now - date;
      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffSecs / 60);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffSecs < 60) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    } catch {
      return '';
    }
  };

  const addNote = () => {
    if (!newNote.title.trim() && !newNote.content.trim()) return;

    const title = newNote.title.trim() || 'Untitled Note';
    const content = newNote.content.trim();
    const theme = selectedNoteTheme || 'blue';

    const updatedNotes = [
      {
        id: Date.now(),
        title,
        content,
        createdAt: new Date().toISOString(),
        theme,
        color: theme,
      },
      ...notes,
    ];

    setNotes(updatedNotes);
    persist({ notes: updatedNotes });
    setNewNote({ title: '', content: '' });
  };

  const deleteNote = (id) => {
    const updatedNotes = notes.filter((note) => note.id !== id);
    setNotes(updatedNotes);
    persist({ notes: updatedNotes });
  };

  // --- SECURE VAULT METHODS ---
  const handleGoogleSignIn = async () => {
    setIsLoggingIn(true);
    setVaultError('');
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Sign in failed:', err);
      setVaultError(err.message || 'Google sign in failed. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setVaultError('');
    try {
      if (isRegistering) {
        await registerWithEmail(authEmail, authPassword);
      } else {
        await signInWithEmail(authEmail, authPassword);
      }
      setAuthEmail('');
      setAuthPassword('');
    } catch (err) {
      console.error('Email auth failed:', err);
      setVaultError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSetupPin = async (e) => {
    e.preventDefault();
    setVaultError('');

    if (!/^\d{4,6}$/.test(newPin)) {
      setVaultError('PIN must be 4 to 6 numbers (0-9)');
      return;
    }

    if (newPin !== confirmPin) {
      setVaultError('PINs do not match');
      return;
    }

    try {
      const hashed = await hashPin(newPin, currentUser.uid);
      await updateUserData(currentUser.uid, { vaultPinHash: hashed });
      setVaultPinHash(hashed);
      setIsVaultUnlocked(true);
      setNewPin('');
      setConfirmPin('');
      setVaultError('');
    } catch (err) {
      console.error('Failed to setup PIN:', err);
      setVaultError('Failed to save security PIN');
    }
  };

  const handleUnlockVault = async (e) => {
    e.preventDefault();
    setVaultError('');

    if (!pinInput.trim()) return;

    try {
      const hashed = await hashPin(pinInput.trim(), currentUser.uid);
      if (hashed === vaultPinHash) {
        setIsVaultUnlocked(true);
        setPinInput('');
        setVaultError('');
      } else {
        setVaultError('Incorrect PIN. Please try again.');
      }
    } catch (err) {
      console.error('Failed to unlock vault:', err);
      setVaultError('Error unlocking vault');
    }
  };

  const handleChangePin = async (e) => {
    e.preventDefault();
    setVaultError('');

    if (!oldPinInput || !newPin || !confirmPin) {
      setVaultError('Please fill in all PIN fields');
      return;
    }

    try {
      const oldHash = await hashPin(oldPinInput, currentUser.uid);
      if (oldHash !== vaultPinHash) {
        setVaultError('Current PIN is incorrect');
        return;
      }

      if (!/^\d{4,6}$/.test(newPin)) {
        setVaultError('New PIN must be 4 to 6 numbers');
        return;
      }

      if (newPin !== confirmPin) {
        setVaultError('New PINs do not match');
        return;
      }

      const newHashed = await hashPin(newPin, currentUser.uid);
      await updateUserData(currentUser.uid, { vaultPinHash: newHashed });
      setVaultPinHash(newHashed);
      setIsChangingPin(false);
      setOldPinInput('');
      setNewPin('');
      setConfirmPin('');
      setVaultError('');
    } catch (err) {
      console.error('Failed to change PIN:', err);
      setVaultError('Error updating PIN');
    }
  };

  const handleAddVaultNote = async (e) => {
    e.preventDefault();
    if (!newVaultNote.title.trim()) return;
    if (!newVaultNote.content.trim() && !vaultMediaFile) {
      setVaultError('Add secret text or attach an image/video.');
      return;
    }

    setVaultError('');
    setSavingVaultItem(true);

    try {
      const noteId = Date.now();
      let mediaMeta = {};

      if (vaultMediaFile) {
        const localRes = await saveMediaLocalFirst({
          uid: effectiveUid,
          file: vaultMediaFile,
          scope: 'vault',
          mediaId: `${noteId}`,
          maxBytes: MAX_VAULT_MEDIA_BYTES,
        });
        mediaMeta = {
          mediaId: `${noteId}`,
          localKey: localRes.localKey,
          mediaType: localRes.mediaType,
          mediaName: localRes.name,
          mediaSize: localRes.size,
          mediaUrl: null,
          firestoreMediaId: null,
          storagePath: null,
        };
      }

      const note = {
        id: noteId,
        title: newVaultNote.title.trim(),
        content: newVaultNote.content.trim(),
        tag: newVaultNote.tag || (vaultMediaFile ? 'Photo / Media' : 'Secret'),
        createdAt: new Date().toISOString(),
        ...mediaMeta,
      };

      const updated = [note, ...vaultNotes];
      setVaultNotes(updated);
      await persist({ vaultNotes: updated });

      const attachedFile = vaultMediaFile;
      setNewVaultNote({ title: '', content: '', tag: 'Secret' });
      setVaultMediaFile(null);
      setShowNewVaultForm(false);

      // Sync media to Firebase Storage / Firestore image fallback / Cloudinary in background
      if (attachedFile && currentUser?.uid && !isGuest) {
        syncMediaToCloud({
          uid: effectiveUid,
          file: attachedFile,
          scope: 'vault',
          mediaId: `${noteId}`,
          localKey: mediaMeta.localKey,
        }).then((syncRes) => {
          if (syncRes.remoteUrl || syncRes.firestoreMediaId) {
            setVaultNotes((prev) => {
              const patched = prev.map((n) =>
                n.id === noteId
                  ? {
                      ...n,
                      mediaUrl: syncRes.remoteUrl || null,
                      storagePath: syncRes.storagePath || null,
                      firestoreMediaId: syncRes.firestoreMediaId || null,
                    }
                  : n
              );
              persist({ vaultNotes: patched });
              return patched;
            });
          }
        });
      }
    } catch (err) {
      setVaultError(err.message || 'Failed to save item to vault');
    } finally {
      setSavingVaultItem(false);
    }
  };

  const handleDeleteVaultNote = async (id) => {
    const target = vaultNotes.find((n) => n.id === id);
    const updated = vaultNotes.filter((n) => n.id !== id);
    setVaultNotes(updated);
    await persist({ vaultNotes: updated });

    if (target && (target.localKey || target.mediaId)) {
      deleteMediaEverywhere({
        uid: effectiveUid,
        localKey: target.localKey || `vault_${effectiveUid}_${target.mediaId}`,
        storagePath: target.storagePath || null,
        firestoreMediaId: target.firestoreMediaId || null,
      });
    }
  };

  const toggleSecretVisibility = (id) => {
    setVisibleSecretIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const copySecretToClipboard = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-xs"
        onClick={onClose}
      />

      {/* Modal - fixed height so switching tabs never shifts position under mouse */}
      <div className="relative w-full max-w-2xl h-[620px] max-h-[90vh] bg-[#0c1017]/95 dark-glass rounded-2xl overflow-hidden border border-white/15 flex flex-col shadow-2xl backdrop-blur-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0 bg-white/[0.02]">
          <h2 className="text-lg font-bold text-white flex items-center tracking-tight">
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center mr-3 text-blue-400 shadow-sm">
              <Edit3 size={17} />
            </div>
            Notes & Vault
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs - Modern Segmented Control with Strict 3-Column Equal Grid */}
        <div className="px-6 py-3 shrink-0 border-b border-white/10 bg-black/25">
          <div className="grid grid-cols-3 w-full p-1 bg-black/40 border border-white/10 rounded-xl gap-1">
            <button
              onClick={() => setActiveTab('todos')}
              className={`w-full h-10 px-3 rounded-lg text-xs font-medium transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'todos'
                  ? 'bg-white/15 text-white shadow-sm border border-white/15 backdrop-blur-md'
                  : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <CheckSquare size={14} className={activeTab === 'todos' ? 'text-blue-400' : ''} />
              <span>Todos</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                activeTab === 'todos' ? 'bg-blue-500/25 text-blue-200' : 'bg-white/10 text-white/50'
              }`}>
                {todos.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('notes')}
              className={`w-full h-10 px-3 rounded-lg text-xs font-medium transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'notes'
                  ? 'bg-white/15 text-white shadow-sm border border-white/15 backdrop-blur-md'
                  : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <StickyNote size={14} className={activeTab === 'notes' ? 'text-sky-400' : ''} />
              <span>Notes</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                activeTab === 'notes' ? 'bg-sky-500/25 text-sky-200' : 'bg-white/10 text-white/50'
              }`}>
                {notes.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('vault')}
              className={`w-full h-10 px-3 rounded-lg text-xs font-medium transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'vault'
                  ? 'bg-amber-500/20 text-amber-200 shadow-sm border border-amber-500/30 backdrop-blur-md'
                  : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              {isVaultUnlocked ? (
                <Unlock size={14} className="text-emerald-400" />
              ) : (
                <Lock size={14} className="text-amber-400" />
              )}
              <span>Vault</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                activeTab === 'vault'
                  ? 'bg-amber-500/25 text-amber-200'
                  : 'bg-white/10 text-white/50'
              }`}>
                {isVaultUnlocked ? vaultNotes.length : (vaultNotes.length > 0 ? vaultNotes.length : 0)}
              </span>
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 overflow-y-auto flex-1 max-h-[60vh]">
          {/* 1. TODOS TAB */}
          {activeTab === 'todos' && (
            <div className="space-y-4">
              {/* Add Todo */}
              <div className="flex space-x-2.5">
                <input
                  type="text"
                  value={newTodo}
                  onChange={(e) => setNewTodo(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addTodo()}
                  placeholder="What needs to get done?"
                  className="flex-1 px-4 py-2.5 bg-black/35 border border-white/15 focus:border-blue-400/60 focus:ring-1 focus:ring-blue-400/20 rounded-xl text-white placeholder-white/40 text-sm transition"
                />
                <button
                  onClick={addTodo}
                  disabled={!newTodo.trim()}
                  className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition cursor-pointer active:scale-95"
                >
                  <Plus size={16} />
                  <span>Add</span>
                </button>
              </div>

              {/* Todo List */}
              <div className="space-y-2">
                {todos.map((todo) => (
                  <div
                    key={todo.id}
                    className="group flex items-center space-x-3 p-3 bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 hover:border-white/20 rounded-xl transition-all"
                  >
                    <button
                      onClick={() => toggleTodo(todo.id)}
                      className={`shrink-0 w-5 h-5 rounded-md border transition-all cursor-pointer flex items-center justify-center ${
                        todo.completed
                          ? 'bg-blue-500 border-blue-500 shadow-xs'
                          : 'border-white/30 hover:border-sky-400 bg-white/5'
                      }`}
                    >
                      {todo.completed && <Check size={12} className="text-white stroke-[3]" />}
                    </button>
                    <span
                      className={`flex-1 text-xs sm:text-sm leading-relaxed transition-all ${
                        todo.completed ? 'text-white/40 line-through' : 'text-slate-100 font-normal'
                      }`}
                    >
                      {todo.text}
                    </span>
                    <button
                      onClick={() => deleteTodo(todo.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-white/40 hover:text-red-400 hover:bg-red-500/15 rounded-lg transition-all cursor-pointer"
                      title="Delete todo"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {todos.length === 0 && (
                  <div className="text-center py-10 text-white/40">
                    <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3 text-white/30">
                      <CheckSquare size={24} />
                    </div>
                    <p className="text-sm font-medium text-white/70">No todos yet</p>
                    <p className="text-xs mt-1 text-white/40">Add your first task to stay organized</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. NOTES TAB */}
          {activeTab === 'notes' && (
            <div className="space-y-4">
              {/* Add Note Card */}
              <div className="p-4 bg-white/[0.03] rounded-2xl border border-white/10 hover:border-white/15 focus-within:border-sky-500/40 focus-within:ring-1 focus-within:ring-sky-500/20 transition-all shadow-md space-y-3">
                <input
                  type="text"
                  value={newNote.title}
                  onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                  placeholder="Note title..."
                  className="w-full px-3.5 py-2 bg-black/35 border border-white/15 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-sky-400/50 text-sm font-medium transition"
                />
                <textarea
                  value={newNote.content}
                  onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                  placeholder="Write a note, paste ideas, write thoughts..."
                  className="w-full px-3.5 py-2 bg-black/35 border border-white/15 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-sky-400/50 resize-none text-xs sm:text-sm leading-relaxed transition"
                  rows={3}
                />
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-white/50 mr-1 font-medium">Accent:</span>
                    {NOTE_THEMES.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedNoteTheme(t.id)}
                        title={t.label}
                        className={`w-5 h-5 rounded-full transition-all cursor-pointer flex items-center justify-center ${
                          selectedNoteTheme === t.id
                            ? 'ring-2 ring-white ring-offset-2 ring-offset-black scale-110 shadow-sm'
                            : 'opacity-70 hover:opacity-100 hover:scale-105'
                        }`}
                        style={{ backgroundColor: t.dot }}
                      />
                    ))}
                  </div>

                  <button
                    onClick={addNote}
                    disabled={!newNote.title.trim() && !newNote.content.trim()}
                    className="px-4 py-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold shadow-md shadow-sky-500/15 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                  >
                    <Plus size={15} />
                    <span>Add Note</span>
                  </button>
                </div>
              </div>

              {/* Notes List */}
              <div className="space-y-3">
                {notes.map((note) => {
                  const style = getNoteCardStyles(note);
                  const isCopied = copiedNoteId === note.id;

                  return (
                    <div
                      key={note.id}
                      className="group relative rounded-xl border border-white/10 hover:border-white/25 transition-all duration-200 overflow-hidden bg-slate-900/80 backdrop-blur-md shadow-lg"
                      style={{
                        borderLeftWidth: '3.5px',
                        borderLeftColor: style.border,
                        backgroundImage: `linear-gradient(135deg, ${style.glow} 0%, rgba(15, 23, 42, 0.45) 100%)`,
                      }}
                    >
                      <div className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span
                              className="w-2 h-2 rounded-full shrink-0 shadow-xs"
                              style={{ backgroundColor: style.dot }}
                            />
                            <h4 className="text-white font-semibold text-sm sm:text-base leading-snug truncate tracking-tight">
                              {note.title || 'Untitled Note'}
                            </h4>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => copyNoteText(note.id, `${note.title || ''}\n\n${note.content || ''}`.trim())}
                              className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer flex items-center gap-1"
                              title={isCopied ? "Copied!" : "Copy note"}
                            >
                              {isCopied ? (
                                <>
                                  <Check size={13} className="text-emerald-400" />
                                  <span className="text-[10px] text-emerald-400 font-medium">Copied</span>
                                </>
                              ) : (
                                <Copy size={13} />
                              )}
                            </button>
                            <button
                              onClick={() => deleteNote(note.id)}
                              className="p-1.5 text-white/40 hover:text-red-400 hover:bg-red-500/15 rounded-lg transition cursor-pointer"
                              title="Delete note"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {note.content && (
                          <p className="text-slate-200/90 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed font-normal selection:bg-sky-500/30">
                            {note.content}
                          </p>
                        )}

                        <div className="pt-1 flex items-center justify-between text-[10px] text-white/40 font-mono">
                          <span>{formatRelativeTime(note.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {notes.length === 0 && (
                  <div className="text-center py-10 text-white/40">
                    <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3 text-white/30">
                      <StickyNote size={24} />
                    </div>
                    <p className="text-sm font-medium text-white/70">No notes yet</p>
                    <p className="text-xs mt-1 text-white/40">Capture thoughts, snippets, and quick ideas</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. SECURE VAULT TAB */}
          {activeTab === 'vault' && (
            <div>
              {/* REQUIREMENT: User must be signed in to access vault */}
              {(!currentUser || isGuest) ? (
                <div className="py-8 px-4 text-center max-w-md mx-auto space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 shadow-lg shadow-amber-500/10">
                    <ShieldAlert size={32} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Personal Secure Vault</h3>
                    <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                      To protect your passwords, keys, and confidential notes with PIN encryption and cloud sync, you must be signed in with your account.
                    </p>
                  </div>

                  <button
                    onClick={handleGoogleSignIn}
                    disabled={isLoggingIn}
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-semibold text-xs flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
                  >
                    <LogIn size={15} />
                    {isLoggingIn ? 'Signing in...' : 'Sign in with Google to Access Vault'}
                  </button>

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowEmailAuth(!showEmailAuth)}
                      className="text-xs text-blue-400 hover:text-blue-300 underline cursor-pointer"
                    >
                      {showEmailAuth ? 'Hide Email Sign-in' : 'Or Sign in with Email & Password'}
                    </button>
                  </div>

                  {showEmailAuth && (
                    <form onSubmit={handleEmailAuth} className="p-3.5 bg-black/40 border border-white/10 rounded-xl space-y-2.5 text-left">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-white">{isRegistering ? 'Create New Account' : 'Sign In with Email'}</span>
                        <button
                          type="button"
                          onClick={() => setIsRegistering(!isRegistering)}
                          className="text-blue-400 hover:text-blue-300 text-[11px] underline cursor-pointer"
                        >
                          {isRegistering ? 'Have an account? Sign In' : "Don't have an account? Sign Up"}
                        </button>
                      </div>
                      <input
                        type="email"
                        required
                        placeholder="Email address"
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        className="w-full px-3 py-2 bg-black/40 border border-white/15 rounded-lg text-xs text-white placeholder-white/40 focus:outline-none focus:border-blue-400"
                      />
                      <input
                        type="password"
                        required
                        minLength={6}
                        placeholder="Password (min 6 characters)"
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        className="w-full px-3 py-2 bg-black/40 border border-white/15 rounded-lg text-xs text-white placeholder-white/40 focus:outline-none focus:border-blue-400"
                      />
                      <button
                        type="submit"
                        disabled={isLoggingIn}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow transition cursor-pointer"
                      >
                        {isLoggingIn ? 'Please wait...' : isRegistering ? 'Register & Access Vault' : 'Sign In & Access Vault'}
                      </button>
                    </form>
                  )}

                  {vaultError && (
                    <div className="text-left text-[11px] text-amber-200 bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl space-y-2">
                      <p>{vaultError}</p>
                      <div className="pt-1.5 border-t border-amber-500/20 space-y-1.5">
                        <span className="text-[10px] text-gray-300 block font-medium">Google OAuth Redirect URI:</span>
                        <div className="flex items-center gap-1.5 bg-black/50 p-1.5 rounded border border-white/10 font-mono text-[10px] text-amber-300">
                          <span className="truncate flex-1 select-all">{getOAuthRedirectURL()}</span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(getOAuthRedirectURL());
                              setVaultError('Copied OAuth Redirect URI! Add to Google Cloud Console Credentials.');
                            }}
                            className="p-1 hover:bg-white/10 rounded text-white shrink-0 cursor-pointer"
                            title="Copy OAuth URI"
                          >
                            <Copy size={12} />
                          </button>
                        </div>
                        <a
                          href="https://console.cloud.google.com/apis/credentials?project=landing-page-efde6"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 hover:underline pt-0.5"
                        >
                          <span>Open Google Cloud Credentials</span>
                          <ExternalLink size={10} />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              ) : !vaultPinHash ? (
                /* FIRST TIME SETUP: Set up master PIN */
                <div className="py-6 px-4 max-w-sm mx-auto text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center mx-auto text-blue-400 shadow-lg shadow-blue-500/10">
                    <KeyRound size={28} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Set Up Vault PIN</h3>
                    <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                      Choose a 4 to 6 digit security PIN. You will need this PIN every time you access your private vault.
                    </p>
                  </div>

                  {vaultError && (
                    <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-2 rounded-lg text-left">
                      {vaultError}
                    </div>
                  )}

                  <form onSubmit={handleSetupPin} className="space-y-3 text-left">
                    <div>
                      <label className="text-xs text-gray-300 block mb-1">Create PIN (4-6 digits)</label>
                      <input
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        required
                        autoFocus
                        placeholder="••••"
                        value={newPin}
                        onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                        className="w-full px-3.5 py-2.5 bg-black/40 border border-white/20 rounded-xl text-center text-lg tracking-widest text-white focus:outline-none focus:border-blue-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-300 block mb-1">Confirm PIN</label>
                      <input
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        required
                        placeholder="••••"
                        value={confirmPin}
                        onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                        className="w-full px-3.5 py-2.5 bg-black/40 border border-white/20 rounded-xl text-center text-lg tracking-widest text-white focus:outline-none focus:border-blue-400"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg transition cursor-pointer"
                    >
                      Set PIN & Unlock Vault
                    </button>
                  </form>
                </div>
              ) : !isVaultUnlocked ? (
                /* LOCKED STATE: Enter PIN to unlock */
                <div className="py-8 px-4 max-w-sm mx-auto text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 shadow-lg shadow-amber-500/10">
                    <Lock size={26} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Vault is Locked</h3>
                    <p className="text-xs text-gray-400 mt-1">
                      Enter your security PIN to access your protected notes.
                    </p>
                  </div>

                  {vaultError && (
                    <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-2 rounded-lg">
                      {vaultError}
                    </div>
                  )}

                  <form onSubmit={handleUnlockVault} className="space-y-3">
                    <input
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      required
                      autoFocus
                      placeholder="••••"
                      value={pinInput}
                      onChange={(e) => {
                        setPinInput(e.target.value.replace(/\D/g, ''));
                        setVaultError('');
                      }}
                      className="w-full px-3.5 py-2.5 bg-black/40 border border-white/20 rounded-xl text-center text-xl tracking-widest text-white focus:outline-none focus:border-amber-400"
                    />
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold shadow-lg transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Unlock size={14} />
                      Unlock Vault
                    </button>
                  </form>
                </div>
              ) : (
                /* UNLOCKED STATE: Full access to Vault Notes */
                <div className="space-y-4">
                  {/* Status & Action Bar */}
                  <div className="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs">
                    <div className="flex items-center gap-2 text-emerald-300 font-medium">
                      <ShieldCheck size={16} className="text-emerald-400" />
                      <span>Vault Unlocked</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setIsChangingPin(!isChangingPin);
                          setVaultError('');
                        }}
                        className="px-2.5 py-1 text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition cursor-pointer"
                      >
                        {isChangingPin ? 'Cancel' : 'Change PIN'}
                      </button>
                      <button
                        onClick={() => {
                          setIsVaultUnlocked(false);
                          setPinInput('');
                        }}
                        className="px-2.5 py-1 text-amber-300 hover:text-amber-200 bg-amber-500/20 hover:bg-amber-500/30 rounded-lg transition flex items-center gap-1 cursor-pointer"
                        title="Lock Vault immediately"
                      >
                        <Lock size={12} />
                        Lock Now
                      </button>
                    </div>
                  </div>

                  {/* Change PIN Form */}
                  {isChangingPin && (
                    <form onSubmit={handleChangePin} className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-3">
                      <h4 className="text-xs font-semibold text-white">Change Security PIN</h4>
                      {vaultError && (
                        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-2 rounded-lg">
                          {vaultError}
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={6}
                          required
                          placeholder="Current PIN"
                          value={oldPinInput}
                          onChange={(e) => setOldPinInput(e.target.value.replace(/\D/g, ''))}
                          className="px-3 py-1.5 bg-black/40 border border-white/15 rounded-lg text-xs text-white"
                        />
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={6}
                          required
                          placeholder="New PIN (4-6 digits)"
                          value={newPin}
                          onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                          className="px-3 py-1.5 bg-black/40 border border-white/15 rounded-lg text-xs text-white"
                        />
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={6}
                          required
                          placeholder="Confirm New PIN"
                          value={confirmPin}
                          onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                          className="px-3 py-1.5 bg-black/40 border border-white/15 rounded-lg text-xs text-white"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setIsChangingPin(false)}
                          className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white rounded-lg text-xs"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium"
                        >
                          Update PIN
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Add Secret Button / Toggle */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">
                      Stored Secrets ({vaultNotes.length})
                    </span>
                    <button
                      onClick={() => setShowNewVaultForm(!showNewVaultForm)}
                      className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Plus size={14} />
                      <span>{showNewVaultForm ? 'Close Form' : 'Add Secret'}</span>
                    </button>
                  </div>

                  {/* Add Secret Form */}
                  {showNewVaultForm && (
                    <form onSubmit={handleAddVaultNote} className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-3">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          required
                          placeholder="Title (e.g. Bank Login, API Key)..."
                          value={newVaultNote.title}
                          onChange={(e) => setNewVaultNote({ ...newVaultNote, title: e.target.value })}
                          className="flex-1 px-3.5 py-2 bg-black/40 border border-white/20 rounded-xl text-xs text-white placeholder-white/40 focus:outline-none focus:border-amber-400"
                        />
                        <select
                          value={newVaultNote.tag}
                          onChange={(e) => setNewVaultNote({ ...newVaultNote, tag: e.target.value })}
                          className="px-3 py-2 bg-black/40 border border-white/20 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                        >
                          {VAULT_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat} className="bg-gray-900 text-white">
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>
                      <textarea
                        placeholder="Confidential secret content (passwords, recovery keys, notes — optional if attaching media)..."
                        value={newVaultNote.content}
                        onChange={(e) => setNewVaultNote({ ...newVaultNote, content: e.target.value })}
                        rows={3}
                        className="w-full px-3.5 py-2 bg-black/40 border border-white/20 rounded-xl text-xs text-white placeholder-white/40 focus:outline-none focus:border-amber-400 resize-none font-mono"
                      />
                      {/* Attach Image or Video inside Vault */}
                      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-black/30 border border-white/10 rounded-lg">
                        <label className="inline-flex items-center gap-1.5 text-xs text-amber-300 hover:text-amber-200 cursor-pointer">
                          <Paperclip size={13} />
                          <span>{vaultMediaFile ? 'Change Image / Video' : 'Attach Image or Video (Max 15 MB)'}</span>
                          <input
                            type="file"
                            accept="image/*,video/mp4,video/webm,video/ogg,video/quicktime"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (file.size > MAX_VAULT_MEDIA_BYTES) {
                                setVaultError(`File exceeds 15 MB limit (${formatBytes(file.size)})`);
                                e.target.value = '';
                                return;
                              }
                              setVaultError('');
                              setVaultMediaFile(file);
                            }}
                            className="hidden"
                          />
                        </label>
                        {vaultMediaFile && (
                          <div className="flex items-center gap-2 text-[11px] text-emerald-300 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                            {vaultMediaFile.type?.startsWith('video/') ? <Film size={12} /> : <ImageIcon size={12} />}
                            <span className="truncate max-w-[160px]">{vaultMediaFile.name}</span>
                            <span className="text-gray-400">({formatBytes(vaultMediaFile.size)})</span>
                            <button
                              type="button"
                              onClick={() => setVaultMediaFile(null)}
                              className="text-red-400 hover:text-red-300 cursor-pointer"
                              title="Remove attachment"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                      {vaultError && (
                        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-2 rounded-lg">
                          {vaultError}
                        </div>
                      )}
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowNewVaultForm(false);
                            setVaultMediaFile(null);
                            setVaultError('');
                          }}
                          className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white rounded-lg text-xs cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={savingVaultItem}
                          className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-white rounded-lg text-xs font-semibold shadow transition cursor-pointer flex items-center gap-1.5"
                        >
                          <Plus size={14} />
                          {savingVaultItem ? 'Saving...' : 'Save to Vault'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Vault Notes Cards */}
                  <div className="space-y-3">
                    {vaultNotes.map((item) => {
                      const isRevealed = visibleSecretIds.has(item.id);
                      const isCopied = copiedId === item.id;
                      const hasMedia = Boolean(item.mediaId || item.mediaUrl || item.firestoreMediaId);

                      return (
                        <div
                          key={item.id}
                          className="p-3.5 bg-white/5 border border-white/10 hover:border-amber-500/30 rounded-xl transition space-y-2 group"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <Shield size={14} className="text-amber-400 shrink-0" />
                              <h4 className="text-xs sm:text-sm font-semibold text-white truncate">{item.title}</h4>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20 shrink-0">
                                {item.tag || 'Secret'}
                              </span>
                              {hasMedia && (
                                <span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/20 text-[10px] flex items-center gap-1 shrink-0">
                                  {item.mediaType === 'video' ? <Film size={10} /> : <ImageIcon size={10} />}
                                  {item.mediaType === 'video' ? 'Video' : 'Image'}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {/* Copy button (when text exists) */}
                              {item.content && (
                                <button
                                  onClick={() => copySecretToClipboard(item.id, item.content)}
                                  className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer flex items-center gap-1 text-[11px]"
                                  title="Copy secret to clipboard"
                                >
                                  {isCopied ? (
                                    <>
                                      <Check size={13} className="text-emerald-400" />
                                      <span className="text-emerald-400 text-[10px]">Copied</span>
                                    </>
                                  ) : (
                                    <Copy size={13} />
                                  )}
                                </button>
                              )}
                              {/* Toggle reveal */}
                              <button
                                onClick={() => toggleSecretVisibility(item.id)}
                                className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
                                title={isRevealed ? 'Hide secret' : 'Reveal secret'}
                              >
                                {isRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
                              </button>
                              {/* Delete button */}
                              <button
                                onClick={() => handleDeleteVaultNote(item.id)}
                                className="opacity-0 group-hover:opacity-100 p-1.5 text-red-400 hover:bg-red-500/20 rounded-lg transition cursor-pointer ml-1"
                                title="Delete from vault"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>

                          {/* Secret Content display (masked until revealed) */}
                          <div className="p-2.5 bg-black/40 border border-white/10 rounded-lg font-mono text-xs space-y-2.5">
                            {isRevealed ? (
                              <>
                                {item.content && (
                                  <p className="text-emerald-300 whitespace-pre-wrap select-all">{item.content}</p>
                                )}
                                {hasMedia && <VaultMediaViewer item={item} uid={effectiveUid} />}
                              </>
                            ) : (
                              <div className="flex items-center justify-between text-white/40 select-none">
                                <span className="tracking-widest">••••••••••••••••••••</span>
                                {hasMedia && (
                                  <span className="text-[10px] font-sans text-amber-300/70">
                                    Hidden {item.mediaType === 'video' ? 'video' : 'image'} — click Eye to reveal
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {vaultNotes.length === 0 && (
                      <div className="text-center py-8 text-white/40">
                        <Shield size={40} className="mx-auto mb-2.5 opacity-30 text-amber-400" />
                        <p className="text-sm font-medium">Vault is Empty</p>
                        <p className="text-xs mt-1">Store passwords, API keys, and sensitive notes safely.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default NotesModal;
