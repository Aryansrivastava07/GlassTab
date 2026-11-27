import { WallpaperChoices, setWallpaperMode } from './DailyWallpaper';
import { useState, useEffect, useCallback } from 'react';
import { X, Plus, Heart, Trash2, RotateCcw, Check, User, ShieldCheck, Move, Copy, ExternalLink, Cloud, Film, Layers, KeyRound, Pencil, RefreshCw, CloudDownload, CloudUpload, Sliders, Grid, Zap, BookOpen, Search, Clock, Sparkles, Loader2, AlertCircle, Focus } from 'lucide-react';
import { SiteThumbnail } from '../utils/thumbnailHelper';
import { useAuth } from '../context/AuthContext';
import { 
  getStoredFeatures,
  saveStoredFeatures,
  toggleFeature,
  DEFAULT_FEATURES,
} from '../utils/featureToggleService';
import { 
  addFavorite, 
  deleteFavorite, 
  addSpeedDial,
  deleteSpeedDial,
  subscribeToUserData,
  updateWallpaper,
  pullFromAccount,
  pushToAccount,
  checkCloudSyncStatus,
  getCloudSyncMeta,
  SYNC_STATUS_EVENT
} from '../services/databaseService';
import { getCachedUserData, updateCachedWallpaper } from '../utils/cacheService';
import {
  saveMediaLocalFirst,
  deleteMediaEverywhere,
  detectMediaType,
  MAX_WALLPAPER_BYTES,
  getUserOnlyCloudinaryConfig,
  saveCloudinaryConfig,
  DEFAULT_CLOUDINARY_FALLBACK,
  generateFileThumbnail,
} from '../services/mediaService';
import { getUrlSuggestionsForName } from '../utils/urlSuggestionService';
import UrlSuggestions from './UrlSuggestions';
import GlassThemeControls from './GlassThemeControls';
import AccessibilitySettings from './AccessibilitySettings';
import { UPDATER_URL } from '../hooks/useExtensionUpdate';
import ClockSettings from './ClockSettings';

const formatSyncTimestamp = (iso) => {
  if (!iso) return 'Never';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Unknown';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const SYNC_STATUS_BADGE = {
  in_sync: { label: 'In Sync', cls: 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300' },
  cloud_newer: { label: 'Cloud Newer', cls: 'bg-blue-500/20 border-blue-400/40 text-blue-300' },
  local_newer: { label: 'Local Unpushed', cls: 'bg-amber-500/20 border-amber-400/40 text-amber-300' },
  diverged: { label: 'Both Changed', cls: 'bg-purple-500/20 border-purple-400/40 text-purple-200' },
  cloud_empty: { label: 'Not Pushed Yet', cls: 'bg-white/10 border-white/20 text-gray-300' },
  unknown: { label: 'Manual Sync', cls: 'bg-white/10 border-white/15 text-gray-300' },
};
import { getGeminiApiKey, saveGeminiApiKey, maskApiKey } from '../services/aiWidgetService';
import { saveWallpaperMeta } from './WallpaperManager';
import defaultLocalWallpaper from '../assets/wallpaper-default.webp';
import { signInWithGoogle, signInWithEmail, registerWithEmail, logout, getExtensionOrigin, getOAuthRedirectURL } from '../services/authService';

const PRESET_WALLPAPERS = [
  { id: 'preset_default', name: 'Default Anime / Sky', url: defaultLocalWallpaper },
  { id: 'preset_nebula', name: 'Deep Space Nebula', url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1920&q=80' },
  { id: 'preset_cyberpunk', name: 'Dark Cyberpunk', url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1920&q=80' },
  { id: 'preset_mountains', name: 'Minimalist Mountains', url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1920&q=80' },
];

const FEATURE_ITEMS = [
  { key: 'search', name: 'Search Bar', desc: 'Search with engine shortcuts (g, b, y)', perfBadge: 'Optional', icon: Search },
  { key: 'autoFocusSearch', name: 'Auto-focus Search on New Tab', desc: 'Focus search bar instead of address bar on Ctrl+T', perfBadge: 'Instant Type', icon: Focus },
  { key: 'clock', name: 'Clock', desc: 'Analog or digital time in your selected time zone', perfBadge: 'Stops timer', icon: Clock },
  { key: 'weather', name: 'Weather Widget', desc: 'Current conditions and 5-day forecast', perfBadge: 'Stops API Polling', icon: Cloud },
  { key: 'speedDials', name: 'Speed Dials Dock', desc: 'Visual shortcut icons dock on the dashboard', perfBadge: 'Reduces DOM', icon: Grid },
  { key: 'favorites', name: 'Favorites Bar', desc: 'Bookmark categories and quick links bar', perfBadge: 'Reduces DOM', icon: Heart },
  { key: 'customWidgets', name: 'Custom Sandboxed Widgets', desc: 'User-created HTML/JS interactive widgets', perfBadge: 'Stops Iframes', icon: Layers },
  { key: 'notesButton', name: 'Quick Notes & Todos', desc: 'Floating action button and notepad modal', perfBadge: 'Frees Listeners', icon: Pencil },
  { key: 'aiStudio', name: 'AI Studio Bottom Capsule', desc: 'Show the AI chat and voice shortcut', perfBadge: 'Optional', icon: Sparkles },
  { key: 'videoWallpapers', name: 'Video Wallpapers', desc: 'Allow live video wallpapers (falls back to a still image)', perfBadge: 'Less decoding', icon: Film },
  { key: 'searchSuggestions', name: 'Search Autocomplete', desc: 'Live query suggestions as you type', perfBadge: 'Zero Network Fetch', icon: Sliders },
];

const Sidebar = ({
  isOpen,
  onClose,
  activeTab = 'appearance',
  isDragEnabled,
  onToggleDrag,
  onResetLayout,
  onOpenWidgetStudio,
  customWidgets = [],
  onEditWidget,
  onDeleteWidget,
}) => {
  const { currentUser, isGuest } = useAuth();
  const effectiveUid = currentUser?.uid || 'local_guest';

  // Normalize tab ids across internal and navbar category keys
  const normalizedTab =
    activeTab === 'appearance' ? 'wallpaper' :
    activeTab === 'widgets' ? 'settings' :
    activeTab === 'shortcuts' ? 'favorites' :
    activeTab === 'performance' ? 'performance' :
    activeTab;

  const [features, setFeatures] = useState(() => getStoredFeatures());

  useEffect(() => {
    const handleFeatures = (e) => {
      setFeatures(e.detail || getStoredFeatures());
    };
    window.addEventListener('landing_features_updated', handleFeatures);
    return () => window.removeEventListener('landing_features_updated', handleFeatures);
  }, []);

  const handleToggleFeature = (key) => {
    const updated = toggleFeature(key);
    setFeatures(updated);
  };

  const handleResetFeatures = () => {
    const reset = saveStoredFeatures(DEFAULT_FEATURES);
    setFeatures(reset);
    setSavedSuccess('Performance settings reset to defaults');
    setTimeout(() => setSavedSuccess(''), 2500);
  };
  const [favorites, setFavorites] = useState([]);
  const [speedDials, setSpeedDials] = useState([]);
  const [shortcutsSubTab, setShortcutsSubTab] = useState('speedDials'); // 'speedDials' | 'favorites'

  // Favorites Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', url: '' });
  const [favUrlSuggestions, setFavUrlSuggestions] = useState([]);
  const [isFavUrlEdited, setIsFavUrlEdited] = useState(false);

  // Speed Dial Form State
  const [showAddSpeedDialForm, setShowAddSpeedDialForm] = useState(false);
  const [newSpeedDial, setNewSpeedDial] = useState({ name: '', url: '' });
  const [speedDialUrlSuggestions, setSpeedDialUrlSuggestions] = useState([]);
  const [isSpeedDialUrlEdited, setIsSpeedDialUrlEdited] = useState(false);

  const resetFavForm = () => {
    setNewItem({ name: '', url: '' });
    setFavUrlSuggestions([]);
    setIsFavUrlEdited(false);
    setShowAddForm(false);
  };

  const handleFavNameChange = (e) => {
    const name = e.target.value;
    const { primaryUrl, suggestions } = getUrlSuggestionsForName(name);
    setFavUrlSuggestions(suggestions);
    setNewItem((prev) => ({
      ...prev,
      name,
      url: isFavUrlEdited ? prev.url : (primaryUrl || prev.url)
    }));
  };

  const handleFavUrlChange = (e) => {
    setIsFavUrlEdited(true);
    setNewItem((prev) => ({ ...prev, url: e.target.value }));
  };

  const handleSelectFavSuggestion = (suggestedUrl) => {
    setIsFavUrlEdited(true);
    setNewItem((prev) => ({ ...prev, url: suggestedUrl }));
  };

  const resetSpeedDialForm = () => {
    setNewSpeedDial({ name: '', url: '' });
    setSpeedDialUrlSuggestions([]);
    setIsSpeedDialUrlEdited(false);
    setShowAddSpeedDialForm(false);
  };

  const handleSpeedDialNameChange = (e) => {
    const name = e.target.value;
    const { primaryUrl, suggestions } = getUrlSuggestionsForName(name);
    setSpeedDialUrlSuggestions(suggestions);
    setNewSpeedDial((prev) => ({
      ...prev,
      name,
      url: isSpeedDialUrlEdited ? prev.url : (primaryUrl || prev.url),
    }));
  };

  const handleSpeedDialUrlChange = (e) => {
    setIsSpeedDialUrlEdited(true);
    setNewSpeedDial((prev) => ({ ...prev, url: e.target.value }));
  };

  const handleSelectSpeedDialSuggestion = (suggestedUrl) => {
    setIsSpeedDialUrlEdited(true);
    setNewSpeedDial((prev) => ({ ...prev, url: suggestedUrl }));
  };
  const [customWallpaperUrl, setCustomWallpaperUrl] = useState('');
  const [loginMessage, setLoginMessage] = useState('');
  const [isGoogleLoggingIn, setIsGoogleLoggingIn] = useState(false);
  const [isEmailLoggingIn, setIsEmailLoggingIn] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState('');
  const [showEmailAuth, setShowEmailAuth] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [uploadingWallpaper, setUploadingWallpaper] = useState(false);
  const [syncBusy, setSyncBusy] = useState(null); // 'pull' | 'push' | 'check' | null
  const [syncInfo, setSyncInfo] = useState(() => ({
    status: 'unknown',
    localUpdatedAt: getCachedUserData(effectiveUid)?.updatedAt || null,
    remoteUpdatedAt: getCloudSyncMeta(effectiveUid)?.baseCloudUpdatedAt || null,
    remoteSyncedAt: getCloudSyncMeta(effectiveUid)?.remoteSyncedAt || null,
  }));
  const [cloudinaryCfg, setCloudinaryCfg] = useState(() => getUserOnlyCloudinaryConfig() || { cloudName: '', uploadPreset: '' });
  const [geminiApiKey, setGeminiApiKey] = useState(() => getGeminiApiKey());

  const refreshSyncTimestamps = useCallback(async (withSpinner = false) => {
    const localUpdatedAt = getCachedUserData(effectiveUid)?.updatedAt || null;
    const localMeta = getCloudSyncMeta(effectiveUid);
    if (isGuest || !currentUser?.uid) {
      setSyncInfo({
        status: 'unknown',
        localUpdatedAt,
        remoteUpdatedAt: null,
        remoteSyncedAt: null,
      });
      return;
    }

    if (withSpinner) setSyncBusy('check');
    try {
      const res = await checkCloudSyncStatus(currentUser.uid);
      setSyncInfo(res);
    } catch {
      setSyncInfo((prev) => ({
        ...prev,
        localUpdatedAt,
        remoteUpdatedAt: localMeta?.baseCloudUpdatedAt || prev.remoteUpdatedAt,
      }));
    } finally {
      if (withSpinner) setSyncBusy(null);
    }
  }, [effectiveUid, isGuest, currentUser?.uid]);

  useEffect(() => {
    if (isOpen) {
      refreshSyncTimestamps(false);
    }
    const handleSyncMetaChanged = (e) => {
      if (e.detail?.userId === effectiveUid) {
        setSyncInfo((prev) => ({
          ...prev,
          localUpdatedAt: getCachedUserData(effectiveUid)?.updatedAt || prev.localUpdatedAt,
        }));
      }
    };
    window.addEventListener(SYNC_STATUS_EVENT, handleSyncMetaChanged);
    return () => window.removeEventListener(SYNC_STATUS_EVENT, handleSyncMetaChanged);
  }, [isOpen, effectiveUid, refreshSyncTimestamps]);

  useEffect(() => {
    // Load favorites and speed dials
    const cached = getCachedUserData(effectiveUid);
    if (cached) {
      if (Array.isArray(cached.favorites)) setFavorites(cached.favorites);
      if (Array.isArray(cached.speedDials)) setSpeedDials(cached.speedDials);
    }

    const unsubscribe = subscribeToUserData(effectiveUid, (userData) => {
      if (userData) {
        if (Array.isArray(userData.favorites)) setFavorites(userData.favorites);
        if (Array.isArray(userData.speedDials)) setSpeedDials(userData.speedDials);
      }
    });

    return () => unsubscribe();
  }, [effectiveUid]);

  const showNotice = (msg) => {
    setSavedSuccess(msg);
    setTimeout(() => setSavedSuccess(''), 2500);
  };

  // --- Speed Dials Management ---
  const handleAddSpeedDial = async (e) => {
    e.preventDefault();
    if (!newSpeedDial.name.trim() || !newSpeedDial.url.trim()) return;

    try {
      let finalUrl = newSpeedDial.url.trim();
      if (!/^https?:\/\//i.test(finalUrl)) {
        finalUrl = `https://${finalUrl}`;
      }

      let domain = "";
      try {
        domain = new URL(finalUrl).hostname;
      } catch {
        domain = finalUrl;
      }

      const item = {
        name: newSpeedDial.name.trim(),
        url: finalUrl,
        logo: `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
      };

      await addSpeedDial(effectiveUid, item);
      resetSpeedDialForm();
      showNotice('Speed dial added & synced!');
    } catch (err) {
      console.error('Error adding speed dial:', err);
    }
  };

  const handleDeleteSpeedDial = async (id) => {
    try {
      await deleteSpeedDial(effectiveUid, id);
      showNotice('Speed dial removed');
    } catch (err) {
      console.error('Error deleting speed dial:', err);
    }
  };

  // --- Favorites Management ---
  const handleAddFavorite = async (e) => {
    e.preventDefault();
    if (!newItem.name.trim() || !newItem.url.trim()) return;

    try {
      let finalUrl = newItem.url.trim();
      if (!/^https?:\/\//i.test(finalUrl)) {
        finalUrl = `https://${finalUrl}`;
      }

      let domain = "";
      try {
        domain = new URL(finalUrl).hostname;
      } catch {
        domain = finalUrl;
      }

      const item = {
        name: newItem.name.trim(),
        url: finalUrl,
        icon: `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
      };

      await addFavorite(effectiveUid, item);
      resetFavForm();
      showNotice('Favorite added!');
    } catch (err) {
      console.error('Error adding favorite:', err);
    }
  };

  const handleDeleteFavorite = async (id) => {
    try {
      await deleteFavorite(effectiveUid, id);
      showNotice('Favorite deleted');
    } catch (err) {
      console.error('Error deleting favorite:', err);
    }
  };

  // --- Wallpaper Management ---
  const applyWallpaper = async (urlOrData, isLocalBlob = false, mediaType = null, explicitWallpaperId = null) => {
    const type = mediaType || detectMediaType(urlOrData || '');
    const wallpaperId = explicitWallpaperId || `wp_${Date.now()}`;
    const storedUrl = wallpaperId === 'preset_default' ? null : urlOrData;

    if (!isLocalBlob) {
      await deleteMediaEverywhere({ uid: effectiveUid, localKey: `wallpaper_${effectiveUid}` });
      saveWallpaperMeta(effectiveUid, wallpaperId === 'preset_default' ? null : {
        hasLocalBlob: false,
        wallpaperId,
        mediaType: type,
        remoteUrl: storedUrl,
      });
    }
    updateCachedWallpaper(effectiveUid, storedUrl);
    window.dispatchEvent(new CustomEvent('wallpaperUpdate', {
      detail: { wallpaper: urlOrData, mediaType: type, wallpaperId },
    }));
    updateWallpaper(effectiveUid, storedUrl, {
      wallpaperId,
      wallpaperType: type,
      wallpaperMediaId: null,
    });
    setWallpaperMode('personal');
    showNotice('Wallpaper updated!');
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const wallpaperId = `wp_${Date.now()}`;
    setUploadingWallpaper(true);
    try {
      // 1. Generate lightweight replica thumbnail (< 3KB) for 0ms blur-up on reload
      const thumbnail = await generateFileThumbnail(file, 64, 36);

      // 2. Store full image or video immediately in IndexedDB (instant playback!)
      const localRes = await saveMediaLocalFirst({
        uid: effectiveUid,
        file,
        scope: 'wallpaper',
        mediaId: wallpaperId,
        maxBytes: MAX_WALLPAPER_BYTES,
      });

      saveWallpaperMeta(effectiveUid, {
        hasLocalBlob: true,
        wallpaperId,
        mediaType: localRes.mediaType,
        remoteUrl: null,
        thumbnail,
      });

      window.dispatchEvent(
        new CustomEvent('wallpaperUpdate', {
          detail: {
            wallpaper: localRes.objectUrl,
            mediaType: localRes.mediaType,
            wallpaperId,
            thumbnail,
          },
        })
      );

      setWallpaperMode('personal');
      await updateWallpaper(effectiveUid, null, {
        wallpaperId,
        wallpaperType: localRes.mediaType,
        wallpaperMediaId: null,
      });

      showNotice(
        !isGuest
          ? `${localRes.mediaType === 'video' ? 'Video' : 'Image'} saved locally! Click Push to Cloud to sync.`
          : `${localRes.mediaType === 'video' ? 'Video' : 'Image'} saved to local DB!`
      );
    } catch (err) {
      alert(err.message || 'Failed to upload wallpaper');
    } finally {
      setUploadingWallpaper(false);
      e.target.value = '';
    }
  };

  const handleUrlWallpaper = (e) => {
    e.preventDefault();
    if (!customWallpaperUrl.trim()) return;
    const url = customWallpaperUrl.trim();
    applyWallpaper(url, false, detectMediaType(url), `url_${Date.now()}`);
    setCustomWallpaperUrl('');
  };

  const handleResetWallpaper = async () => {
    localStorage.removeItem(`wallpaper_image_${effectiveUid}`);
    saveWallpaperMeta(effectiveUid, null);
    await deleteMediaEverywhere({
      uid: effectiveUid,
      localKey: `wallpaper_${effectiveUid}`,
    });
    updateCachedWallpaper(effectiveUid, null);
    window.dispatchEvent(
      new CustomEvent('wallpaperUpdate', {
        detail: { wallpaper: null, wallpaperId: 'preset_default' },
      })
    );
    updateWallpaper(effectiveUid, null, {
      wallpaperId: 'preset_default',
      wallpaperType: 'image',
      wallpaperMediaId: null,
    });
    setWallpaperMode('personal');
    showNotice('Reset to default wallpaper');
  };

  const handlePullFromCloud = async () => {
    if (isGuest || !currentUser?.uid) {
      showNotice('Sign in first to pull from cloud');
      return;
    }
    setSyncBusy('pull');
    try {
      const res = await pullFromAccount(currentUser.uid);
      setSyncInfo({
        hasRemote: true,
        localUpdatedAt: res.remoteUpdatedAt,
        remoteUpdatedAt: res.remoteUpdatedAt,
        remoteSyncedAt: res.remoteSyncedAt,
        status: 'in_sync',
      });
      const wpId = res?.userData?.wallpaperId;
      showNotice(
        wpId
          ? `Pulled cloud snapshot (${formatSyncTimestamp(res.remoteUpdatedAt)}) + wallpaper!`
          : `Pulled cloud snapshot (${formatSyncTimestamp(res.remoteUpdatedAt)})!`
      );
    } catch (err) {
      showNotice(err.message || 'Pull failed — check internet connection');
    } finally {
      setSyncBusy(null);
    }
  };

  const handlePushToCloud = async () => {
    if (isGuest || !currentUser?.uid) {
      showNotice('Sign in first to push to cloud');
      return;
    }
    setSyncBusy('push');
    try {
      const res = await pushToAccount(currentUser.uid);
      setSyncInfo({
        hasRemote: true,
        localUpdatedAt: res.updatedAt,
        remoteUpdatedAt: res.updatedAt,
        remoteSyncedAt: res.syncedAt,
        status: 'in_sync',
      });
      showNotice(
        res.wallpaperUploadNote
          ? `Pushed local snapshot to cloud! (${res.wallpaperUploadNote})`
          : `Pushed local snapshot to Firebase (${formatSyncTimestamp(res.syncedAt)})!`
      );
    } catch (err) {
      showNotice(err.message || 'Push failed — check internet connection');
    } finally {
      setSyncBusy(null);
    }
  };

  // --- Google Login Handling with loader & user-friendly error ---
  const handleGoogleLogin = async () => {
    setIsGoogleLoggingIn(true);
    setLoginMessage('');
    try {
      await signInWithGoogle();
      showNotice('Signed in with Google!');
    } catch (err) {
      console.warn('Google sign-in exception:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setLoginMessage('Sign-in was closed. Please try again or use Email.');
      } else if (err.code === 'auth/network-request-failed') {
        setLoginMessage('Network connection issue. Please check your internet connection.');
      } else {
        setLoginMessage('Unable to complete Google sign-in. Please try again or use Email.');
      }
    } finally {
      setIsGoogleLoggingIn(false);
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setIsEmailLoggingIn(true);
    setLoginMessage('');
    try {
      if (isRegistering) {
        await registerWithEmail(emailInput, passwordInput);
        showNotice('Account created and signed in!');
      } else {
        await signInWithEmail(emailInput, passwordInput);
        showNotice('Signed in successfully!');
      }
      setEmailInput('');
      setPasswordInput('');
    } catch (err) {
      console.warn('Email auth exception:', err);
      setLoginMessage(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsEmailLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      showNotice('Logged out');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Floating Settings & Customization Panel (opened below the navbar pill with border & margins on all ends) */}
      <div
        className="fixed top-[74px] left-5 right-5 sm:left-auto sm:right-5 sm:w-[445px] max-h-[calc(100vh-94px)] bg-[#10131b]/92 backdrop-blur-2xl text-white rounded-2xl border border-white/15 ring-1 ring-white/5 shadow-[0_24px_64px_rgba(0,0,0,0.72)] z-50 flex flex-col overflow-hidden animate-fadeIn"
      >
        {/* Header (reflects active category from top pill bar) */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-black/40">
          <div>
            <h2 className="text-base sm:text-lg font-bold tracking-tight">
              {normalizedTab === 'wallpaper'
                ? 'Appearance & Wallpaper'
                : normalizedTab === 'glass'
                ? 'Glass Blur & RGB Styling'
                : normalizedTab === 'settings'
                ? 'Widgets & Layout'
                : (normalizedTab === 'favorites' || normalizedTab === 'shortcuts')
                ? 'Shortcuts & Speed Dials'
                : normalizedTab === 'performance'
                ? 'Performance & Modes'
                : normalizedTab === 'accessibility'
                ? 'Accessibility'
                : 'Account & Cloud Sync'}
            </h2>
            <p className="text-[11px] text-gray-400">
              {normalizedTab === 'wallpaper'
                ? 'Customize background image, video, or presets'
                : normalizedTab === 'glass'
                ? 'Customize blur level and RGB colors for search box, shortcuts & speed dial'
                : normalizedTab === 'settings'
                ? 'Drag & resize, positions, custom widgets & AI keys'
                : (normalizedTab === 'favorites' || normalizedTab === 'shortcuts')
                ? 'Add, edit, and sync dock speed dials & saved bookmark shortcuts'
                : normalizedTab === 'performance'
                ? 'Lite mode for low-spec PCs, standby reading mode, and individual feature toggles'
                : normalizedTab === 'accessibility'
                ? 'Reading comfort, motion, and keyboard navigation'
                : 'Offline status, Google sign-in & manual Pull/Push sync'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
            title="Close Settings"
          >
            <X size={18} />
          </button>
        </div>

        {/* Success notification banner */}
        {savedSuccess && (
          <div role="status" className="bg-emerald-500/20 border-b border-emerald-500/30 text-emerald-300 text-xs py-2 px-4 flex items-center gap-2">
            <Check size={14} />
            <span>{savedSuccess}</span>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {normalizedTab === 'accessibility' && <AccessibilitySettings />}
          {/* TAB 1: WALLPAPER */}
          {normalizedTab === 'wallpaper' && (
            <div className="space-y-5">
              <section className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                <h4 className="text-sm font-semibold">Wallpaper rotation</h4>
                <WallpaperChoices />
                <p className="text-xs text-slate-300">A different Unsplash landscape each day. Daily motion adds a slow pan and shifting light.</p>
              </section>
              {/* Upload local image or video */}
              <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Film size={16} className="text-blue-400" />
                    Custom Wallpaper (Image / Video)
                  </h4>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    Max 25 MB
                  </span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Select a photo or live video (MP4/WebM). Stored in local IndexedDB for instant offline load and synced to Firebase when signed in.
                </p>
                <label className={`block w-full py-2.5 px-4 ${uploadingWallpaper ? 'bg-blue-700/60 cursor-wait' : 'bg-blue-600 hover:bg-blue-500 cursor-pointer'} text-white text-xs font-semibold rounded-lg text-center transition`}>
                  {uploadingWallpaper ? 'Saving Wallpaper...' : 'Choose Image or Video'}
                  <input
                    type="file"
                    accept="image/*,video/mp4,video/webm,video/ogg,video/quicktime"
                    disabled={uploadingWallpaper}
                    onChange={handleFileUpload}
                    className="sr-only"
                  />
                </label>
              </div>

              {/* Paste image or video URL */}
              <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-3">
                <h4 className="text-sm font-semibold">Image or Video URL</h4>
                <form onSubmit={handleUrlWallpaper} className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://... (.jpg, .png, .mp4, .webm)"
                    aria-label="Wallpaper image or video URL"
                    value={customWallpaperUrl}
                    onChange={(e) => setCustomWallpaperUrl(e.target.value)}
                    className="flex-1 px-3 py-2 bg-black/40 border border-white/15 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-400"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-lg transition cursor-pointer"
                  >
                    Apply
                  </button>
                </form>
              </div>

              {/* Presets */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Preset Wallpapers
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {PRESET_WALLPAPERS.map((preset, idx) => (
                    <button
                      key={preset.id || idx}
                      onClick={() => applyWallpaper(preset.url, false, 'image', preset.id)}
                      className="group relative h-20 rounded-lg overflow-hidden border border-white/10 hover:border-blue-400 transition text-left cursor-pointer"
                    >
                      <img
                        src={preset.url}
                        alt={preset.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-end p-2">
                        <span className="text-[11px] font-medium truncate text-white drop-shadow">
                          {preset.name}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Reset Wallpaper Button */}
              <button
                onClick={handleResetWallpaper}
                className="w-full py-2.5 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white text-xs font-medium rounded-lg flex items-center justify-center gap-2 transition"
              >
                <RotateCcw size={14} />
                Reset to Default Wallpaper
              </button>
            </div>
          )}

          {/* TAB: GLASS & BLUR STYLING */}
          {normalizedTab === 'glass' && (
            <GlassThemeControls uid={effectiveUid} />
          )}

          {/* TAB 2: WIDGETS & LAYOUT */}
          {normalizedTab === 'settings' && (
            <div className="space-y-5">
              <ClockSettings />
              {/* Drag & Resize Toggle */}
              <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Move size={16} className="text-blue-400" />
                      Widget Drag & Resize
                    </h4>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                      {isDragEnabled
                        ? "Drag and resize is enabled. Hover widgets to see move handles and drag borders to resize."
                        : "Widgets are locked in place. Turn this ON to move or resize widgets on your screen."}
                    </p>
                  </div>
                  {/* Switch */}
                  <button
                    onClick={() => {
                      if (onToggleDrag) onToggleDrag(!isDragEnabled);
                      showNotice(isDragEnabled ? 'Widgets locked in place' : 'Drag & resize enabled!');
                    }}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isDragEnabled ? 'bg-blue-600' : 'bg-white/20'
                    }`}
                    role="switch"
                    aria-checked={isDragEnabled}
                    title={isDragEnabled ? "Click to lock widgets" : "Click to unlock widgets for dragging"}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        isDragEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className={`text-xs rounded-lg p-2.5 flex items-center gap-2 ${
                  isDragEnabled
                    ? 'text-blue-300 bg-blue-500/10 border border-blue-500/20'
                    : 'text-gray-400 bg-white/5 border border-white/10'
                }`}>
                  <Check size={14} className={isDragEnabled ? "text-blue-400 shrink-0" : "text-gray-500 shrink-0"} />
                  <span>
                    {isDragEnabled
                      ? 'Move handles & resize borders are active on all widgets.'
                      : 'Widgets are locked to prevent accidental movement.'}
                  </span>
                </div>
              </div>

              {/* Reset Layout Section */}
              <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-3">
                <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                  <RotateCcw size={16} className="text-amber-400" />
                  Reset Widget Layout
                </h4>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Restore all widgets (Clock, Weather, Search, Speed Dials, Favorites) back to their default balanced layout.
                </p>
                <button
                  onClick={() => {
                    if (onResetLayout) onResetLayout();
                    showNotice('Layout reset to defaults!');
                  }}
                  className="w-full py-2.5 px-4 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-lg transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RotateCcw size={14} />
                  Reset to Defaults
                </button>
              </div>

              {/* Custom Widgets Management */}
              <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Layers size={16} className="text-indigo-400" />
                    Custom Widgets ({customWidgets.length})
                  </h4>
                  {onOpenWidgetStudio && (
                    <button
                      type="button"
                      onClick={onOpenWidgetStudio}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg flex items-center gap-1 transition cursor-pointer"
                    >
                      <Plus size={13} />
                      <span>Widget Store</span>
                    </button>
                  )}
                </div>
                {customWidgets.length > 0 ? (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {customWidgets.map((cw) => (
                      <div
                        key={cw.id}
                        className="flex items-center justify-between p-2 bg-black/30 border border-white/10 rounded-lg text-xs"
                      >
                        <span title={cw.storeDescription || cw.name} className="truncate font-medium text-gray-200">{cw.name}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          {onEditWidget && (
                            <button
                              type="button"
                              onClick={() => onEditWidget(cw)}
                              className="p-1 text-gray-400 hover:text-blue-400 rounded cursor-pointer"
                              title="Edit code"
                            >
                              <Pencil size={12} />
                            </button>
                          )}
                          {onDeleteWidget && (
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteWidget(cw.id);
                                showNotice('Custom widget removed');
                              }}
                              className="p-1 text-gray-400 hover:text-red-400 rounded cursor-pointer"
                              title="Remove widget"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">
                    Create live scoreboards, tickers, timers, or dashboards using pasted code or AI prompts.
                  </p>
                )}
              </div>

              {/* Built-in Gemini AI Key for Custom Widgets */}
              <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-3">
                <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                  <KeyRound size={16} className="text-indigo-400" />
                  Gemini AI API Key (Widget Builder)
                </h4>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Optional: Save a free Google AI Studio key to generate custom widgets in 1 click and power AI Studio. Synced securely to your account with AES-256 encryption.
                </p>
                {geminiApiKey && (
                  <div className="flex items-center justify-between text-[11px] text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 rounded-lg">
                    <span>🔒 {maskApiKey(geminiApiKey)}</span>
                    <span className="text-[10px] text-emerald-300 font-sans font-semibold">
                      {effectiveUid !== 'local_guest' ? 'AES-256 Synced' : 'Saved Locally'}
                    </span>
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="AIza..."
                    aria-label="Gemini widget API key"
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-black/40 border border-white/15 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-400 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      saveGeminiApiKey(geminiApiKey, effectiveUid);
                      showNotice(
                        geminiApiKey.trim()
                          ? effectiveUid !== 'local_guest'
                            ? '🔒 Key encrypted with AES-256 & synced!'
                            : 'Gemini API Key saved!'
                          : 'Gemini API Key cleared'
                      );
                    }}
                    className="px-3 py-1.5 bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-medium rounded-lg transition cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SHORTCUTS & SPEED DIALS */}
          {(normalizedTab === 'favorites' || normalizedTab === 'shortcuts') && (
            <div className="space-y-4">
              {/* Segmented Sub-Tab Switcher: Speed Dials vs Favorites */}
              <div className="grid grid-cols-2 p-1 bg-black/40 border border-white/10 rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => setShortcutsSubTab('speedDials')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                    shortcutsSubTab === 'speedDials'
                      ? 'bg-blue-600/80 text-white shadow-md border border-blue-400/40'
                      : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <Grid size={14} className={shortcutsSubTab === 'speedDials' ? 'text-cyan-300' : ''} />
                  <span>Speed Dials</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                    shortcutsSubTab === 'speedDials' ? 'bg-cyan-500/30 text-cyan-200' : 'bg-white/10 text-white/50'
                  }`}>
                    {speedDials.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setShortcutsSubTab('favorites')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                    shortcutsSubTab === 'favorites'
                      ? 'bg-blue-600/80 text-white shadow-md border border-blue-400/40'
                      : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <Heart size={14} className={shortcutsSubTab === 'favorites' ? 'text-red-400' : ''} />
                  <span>Favorites</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                    shortcutsSubTab === 'favorites' ? 'bg-red-500/30 text-red-200' : 'bg-white/10 text-white/50'
                  }`}>
                    {favorites.length}
                  </span>
                </button>
              </div>

              {/* 1. SPEED DIALS SUB-TAB */}
              {shortcutsSubTab === 'speedDials' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-white">Speed Dials (Dock Shortcuts)</h4>
                      <p className="text-[11px] text-gray-400">Quick launcher apps displayed in the bottom dock</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (showAddSpeedDialForm) {
                          resetSpeedDialForm();
                        } else {
                          setShowAddSpeedDialForm(true);
                        }
                      }}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition cursor-pointer shrink-0"
                    >
                      <Plus size={14} />
                      <span>{showAddSpeedDialForm ? 'Close' : 'Add Speed Dial'}</span>
                    </button>
                  </div>

                  {/* Add Speed Dial Form */}
                  {showAddSpeedDialForm && (
                    <form onSubmit={handleAddSpeedDial} className="p-3.5 bg-white/[0.04] border border-white/15 rounded-xl space-y-3 shadow-md">
                      <div>
                        <label className="text-[11px] text-gray-300 block mb-1 font-medium">Website / App Name</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. YouTube, Spotify, GitHub"
                          aria-label="Speed dial name"
                          value={newSpeedDial.name}
                          onChange={handleSpeedDialNameChange}
                          className="w-full px-3 py-1.5 bg-black/40 border border-white/15 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-400"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-300 block mb-1 font-medium">URL</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. youtube.com"
                          aria-label="Speed dial URL"
                          value={newSpeedDial.url}
                          onChange={handleSpeedDialUrlChange}
                          className="w-full px-3 py-1.5 bg-black/40 border border-white/15 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-400"
                        />
                        {speedDialUrlSuggestions.length > 0 && (
                          <UrlSuggestions
                            suggestions={speedDialUrlSuggestions}
                            onSelect={handleSelectSpeedDialSuggestion}
                            currentUrl={newSpeedDial.url}
                          />
                        )}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          type="submit"
                          className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow transition cursor-pointer"
                        >
                          Save Speed Dial
                        </button>
                        <button
                          type="button"
                          onClick={resetSpeedDialForm}
                          className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-gray-300 text-xs rounded-lg transition cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Speed Dials List */}
                  <div className="space-y-2">
                    {speedDials.map((dial) => (
                      <div
                        key={dial.id}
                        className="flex items-center justify-between p-2.5 bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 rounded-xl transition group"
                      >
                        <div className="flex items-center gap-3 overflow-hidden min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                            <SiteThumbnail
                              logo={dial.logo}
                              name={dial.name}
                              url={dial.url}
                              className="w-5 h-5"
                              fallbackClassName="text-[10px]"
                            />
                          </div>
                          <div className="truncate">
                            <div className="text-xs font-semibold text-white truncate">{dial.name}</div>
                            <div className="text-[11px] text-gray-400 truncate">{dial.url}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteSpeedDial(dial.id)}
                          className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition cursor-pointer shrink-0 ml-2"
                          title="Delete Speed Dial"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}

                    {speedDials.length === 0 && (
                      <div className="text-center py-8 text-gray-500 text-xs">
                        No speed dials saved. Click &quot;Add Speed Dial&quot; to add one to your bottom dock!
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 2. FAVORITES SUB-TAB */}
              {shortcutsSubTab === 'favorites' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-white">Favorites (Quick Links)</h4>
                      <p className="text-[11px] text-gray-400">Website links saved in your Favorites bar</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (showAddForm) {
                          resetFavForm();
                        } else {
                          setShowAddForm(true);
                        }
                      }}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition cursor-pointer shrink-0"
                    >
                      <Plus size={14} />
                      <span>{showAddForm ? 'Close' : 'Add Favorite'}</span>
                    </button>
                  </div>

                  {/* Add Favorite Form */}
                  {showAddForm && (
                    <form onSubmit={handleAddFavorite} className="p-3.5 bg-white/[0.04] border border-white/15 rounded-xl space-y-3 shadow-md">
                      <div>
                        <label className="text-[11px] text-gray-300 block mb-1 font-medium">Website Name</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. GitHub"
                          aria-label="Favorite name"
                          value={newItem.name}
                          onChange={handleFavNameChange}
                          className="w-full px-3 py-1.5 bg-black/40 border border-white/15 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-400"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-300 block mb-1 font-medium">URL</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. github.com"
                          aria-label="Favorite URL"
                          value={newItem.url}
                          onChange={handleFavUrlChange}
                          className="w-full px-3 py-1.5 bg-black/40 border border-white/15 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-400"
                        />
                        {favUrlSuggestions.length > 0 && (
                          <UrlSuggestions
                            suggestions={favUrlSuggestions}
                            onSelect={handleSelectFavSuggestion}
                            currentUrl={newItem.url}
                          />
                        )}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          type="submit"
                          className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow transition cursor-pointer"
                        >
                          Save Favorite
                        </button>
                        <button
                          type="button"
                          onClick={resetFavForm}
                          className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-gray-300 text-xs rounded-lg transition cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Favorites List */}
                  <div className="space-y-2">
                    {favorites.map((fav) => (
                      <div
                        key={fav.id}
                        className="flex items-center justify-between p-2.5 bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 rounded-xl transition group"
                      >
                        <div className="flex items-center gap-3 overflow-hidden min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                            <SiteThumbnail
                              logo={fav.icon || fav.logo}
                              name={fav.name}
                              url={fav.url}
                              className="w-5 h-5"
                              fallbackClassName="text-[10px]"
                            />
                          </div>
                          <div className="truncate">
                            <div className="text-xs font-semibold text-white truncate">{fav.name}</div>
                            <div className="text-[11px] text-gray-400 truncate">{fav.url}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteFavorite(fav.id)}
                          className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition cursor-pointer shrink-0 ml-2"
                          title="Delete Favorite"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}

                    {favorites.length === 0 && (
                      <div className="text-center py-8 text-gray-500 text-xs">
                        No favorites saved yet. Click &quot;Add Favorite&quot; to create one!
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: PERFORMANCE & MODES */}
          {normalizedTab === 'performance' && (
            <div className="space-y-5">
              {/* DISPLAY & PERFORMANCE MODES */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Performance &amp; Display Modes
                </h3>

                {/* 1. Lite Mode for Low Spec PC */}
                <div
                  className={`p-4 rounded-xl border transition-all ${
                    features.liteMode
                      ? 'bg-amber-500/10 border-amber-500/40 shadow-lg shadow-amber-500/5'
                      : 'bg-white/5 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          features.liteMode ? 'bg-amber-500/20 text-amber-300' : 'bg-white/10 text-gray-300'
                        }`}
                      >
                        <Zap size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-semibold text-white">Lite Mode (Low-Spec PC)</h4>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-400/20 text-amber-300 border border-amber-400/30">
                            Recommended for Budget Hardware
                          </span>
                        </div>
                        <p className="text-xs text-gray-300/80 mt-1 leading-relaxed">
                          Reduces background effects, pauses video wallpapers, and uses solid surfaces to reduce work on your device.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleFeature('liteMode')}
                      role="switch"
                      aria-checked={features.liteMode}
                      aria-label="Lite mode"
                      className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                        features.liteMode ? 'bg-amber-500 justify-end' : 'bg-white/20 justify-start'
                      }`}
                      title={features.liteMode ? 'Disable Lite Mode' : 'Enable Lite Mode'}
                    >
                      <div className="w-4 h-4 rounded-full bg-white shadow-md transform transition-transform" />
                    </button>
                  </div>
                </div>

                {/* 2. Reading & Standby Mode (Zen Mode) */}
                <div
                  className={`p-4 rounded-xl border transition-all ${
                    features.standbyMode
                      ? 'bg-indigo-500/10 border-indigo-500/40 shadow-lg shadow-indigo-500/5'
                      : 'bg-white/5 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          features.standbyMode ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/10 text-gray-300'
                        }`}
                      >
                        <BookOpen size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-semibold text-white">Reading &amp; Standby Mode</h4>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-400/20 text-indigo-300 border border-indigo-400/30">
                            Alt+Z or Esc to Toggle
                          </span>
                        </div>
                        <p className="text-xs text-gray-300/80 mt-1 leading-relaxed">
                          Ultra-clean ambient reading view. Keeps strictly your Wallpaper, Clock, Search Box, and Weather Widget while instantly hiding Speed Dials, Favorites, Notes, and AI Studio capsule.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleFeature('standbyMode')}
                      role="switch"
                      aria-checked={features.standbyMode}
                      aria-label="Reading mode"
                      className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                        features.standbyMode ? 'bg-indigo-500 justify-end' : 'bg-white/20 justify-start'
                      }`}
                      title={features.standbyMode ? 'Exit Reading Mode' : 'Enter Reading Mode'}
                    >
                      <div className="w-4 h-4 rounded-full bg-white shadow-md transform transition-transform" />
                    </button>
                  </div>
                </div>
              </div>

              {/* MODULAR FEATURE TOGGLES */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Modular Feature Toggles
                    </h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Turn off unused features to unmount timers, stop network requests, and free memory.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetFeatures}
                    className="text-[11px] text-blue-300 hover:text-blue-200 hover:underline flex items-center gap-1 cursor-pointer shrink-0"
                    title="Reset all toggles to defaults"
                  >
                    <RotateCcw size={12} />
                    <span>Reset</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {FEATURE_ITEMS.map((item) => {
                    const isEnabled = Boolean(features[item.key]);
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.key}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                          isEnabled ? 'bg-white/5 border-white/10' : 'bg-black/30 border-white/5 opacity-70'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              isEnabled ? 'bg-white/10 text-white' : 'bg-white/5 text-gray-500'
                            }`}
                          >
                            <Icon size={16} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-white truncate">{item.name}</span>
                              <span className="text-[10px] text-gray-400 font-mono px-1.5 py-0.2 rounded bg-white/5 border border-white/10">
                                {item.perfBadge}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-400 truncate">{item.desc}</p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleFeature(item.key)}
                          role="switch"
                          aria-checked={isEnabled}
                          aria-label={item.name}
                          className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${
                            isEnabled ? 'bg-blue-600 justify-end' : 'bg-white/15 justify-start'
                          }`}
                          title={`Toggle ${item.name}`}
                        >
                          <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ACCOUNT, MEDIA & SYNC */}
          {normalizedTab === 'account' && (
            <div className="space-y-4">
              <button type="button" className="rounded-xl border border-sky-400/30 bg-sky-500/10 px-4 py-2 text-sm text-sky-200" onClick={() => {
                onClose();
                requestAnimationFrame(() => window.dispatchEvent(new Event('glasstab_show_welcome')));
              }}>Dashboard quick start</button>
              <section className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-3">
                <h4 className="text-sm font-semibold">Extension updates</h4>
                <p className="text-xs text-gray-400">Choose your installed GlassTab folder in the updater, then reload GlassTab from the Extensions page.</p>
                <a href={UPDATER_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-sky-500/15 border border-sky-400/30 px-3 py-2 text-xs font-semibold text-sky-200 hover:bg-sky-500/25">
                  <CloudDownload size={15} /> Update to latest version
                </a>
              </section>
              <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <ShieldCheck size={22} />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold">Local Storage Mode</h4>
                    <p className="text-xs text-emerald-400">Active & 100% Offline</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  All your shortcuts, speed dials, notes, and wallpapers are securely stored in your local Edge browser storage. No account required!
                </p>
              </div>

              {/* Cloud Sync Account + Timestamp Manual Sync */}
              {(() => {
                const badge = SYNC_STATUS_BADGE[syncInfo.status] || SYNC_STATUS_BADGE.unknown;
                return (
                  <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                        <Cloud size={15} className="text-blue-400" />
                        Cloud Sync &amp; Account
                      </h4>
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-medium ${badge.cls}`}>
                          {badge.label}
                        </span>
                        {currentUser && !isGuest && (
                          <button
                            type="button"
                            disabled={Boolean(syncBusy)}
                            onClick={() => refreshSyncTimestamps(true)}
                            className="p-1 text-gray-300 hover:text-white hover:bg-white/10 rounded cursor-pointer disabled:opacity-50"
                            title="Check Firebase timestamp"
                          >
                            <RefreshCw size={12} className={syncBusy === 'check' ? 'animate-spin' : ''} />
                          </button>
                        )}
                      </div>
                    </div>

                    {currentUser && !isGuest ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          {currentUser.photoURL ? (
                            <img
                              src={currentUser.photoURL}
                              alt="Avatar"
                              className="w-10 h-10 rounded-full border border-white/20"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
                              <User size={18} />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold truncate">{currentUser.displayName || 'Signed In User'}</div>
                            <div className="text-[11px] text-gray-400 truncate">{currentUser.email}</div>
                          </div>
                        </div>

                        <p className="text-[11px] text-gray-400 leading-relaxed">
                          Edits stay local until you <strong className="text-gray-200">Pull</strong> from Firebase or <strong className="text-gray-200">Push</strong> this browser&apos;s snapshot.
                        </p>

                        <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-black/30 border border-white/10 text-[10px]">
                          <div>
                            <span className="text-gray-400 block">Local modified</span>
                            <span className="text-gray-200 font-medium">{formatSyncTimestamp(syncInfo.localUpdatedAt)}</span>
                          </div>
                          <div>
                            <span className="text-gray-400 block">Cloud snapshot</span>
                            <span className="text-gray-200 font-medium">{formatSyncTimestamp(syncInfo.remoteUpdatedAt)}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={Boolean(syncBusy)}
                            onClick={handlePullFromCloud}
                            className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
                            title="Fetch cloud snapshot & apply locally"
                          >
                            <CloudDownload size={13} className={syncBusy === 'pull' ? 'animate-pulse' : ''} />
                            <span>{syncBusy === 'pull' ? 'Pulling...' : 'Pull to Local'}</span>
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(syncBusy)}
                            onClick={handlePushToCloud}
                            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
                            title="Push local changes to Firebase"
                          >
                            <CloudUpload size={13} className={syncBusy === 'push' ? 'animate-pulse' : ''} />
                            <span>{syncBusy === 'push' ? 'Pushing...' : 'Push Local'}</span>
                          </button>
                          <button
                            onClick={handleLogout}
                            className="px-3 py-2 bg-red-600/80 hover:bg-red-600 text-white text-xs font-medium rounded-lg transition cursor-pointer"
                          >
                            Sign Out
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={handleGoogleLogin}
                          disabled={isGoogleLoggingIn}
                          className="w-full py-2.5 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg shadow transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                        >
                          {isGoogleLoggingIn ? (
                            <>
                              <Loader2 size={14} className="animate-spin text-white" />
                              <span>Connecting to Google...</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                              </svg>
                              <span>Sign in with Google</span>
                            </>
                          )}
                        </button>

                        <div className="text-center pt-1">
                          <button
                            type="button"
                            onClick={() => setShowEmailAuth(!showEmailAuth)}
                            className="text-xs text-blue-400 hover:text-blue-300 underline cursor-pointer"
                          >
                            {showEmailAuth ? 'Hide Email Sign-in' : 'Or Sign in with Email & Password'}
                          </button>
                        </div>

                        {showEmailAuth && (
                          <form onSubmit={handleEmailAuth} className="p-3 bg-white/5 border border-white/10 rounded-xl space-y-2 text-left">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-semibold text-white">{isRegistering ? 'Create Account' : 'Email Sign In'}</span>
                              <button
                                type="button"
                                onClick={() => setIsRegistering(!isRegistering)}
                                className="text-blue-400 hover:text-blue-300 text-[11px] underline cursor-pointer"
                              >
                                {isRegistering ? 'Have an account? Sign In' : 'Sign Up'}
                              </button>
                            </div>
                            <input
                              type="email"
                              required
                              placeholder="Email address"
                              aria-label="Email address"
                              value={emailInput}
                              onChange={(e) => setEmailInput(e.target.value)}
                              className="w-full px-3 py-1.5 bg-black/40 border border-white/15 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-400"
                            />
                            <input
                              type="password"
                              required
                              minLength={6}
                              placeholder="Password (min 6 chars)"
                              aria-label="Password, at least 6 characters"
                              value={passwordInput}
                              onChange={(e) => setPasswordInput(e.target.value)}
                              className="w-full px-3 py-1.5 bg-black/40 border border-white/15 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-400"
                            />
                            <button
                              type="submit"
                              disabled={isEmailLoggingIn}
                              className="w-full py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white rounded-lg text-xs font-semibold shadow transition cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              {isEmailLoggingIn && <Loader2 size={12} className="animate-spin text-white" />}
                              <span>{isEmailLoggingIn ? 'Please wait...' : (isRegistering ? 'Create Account' : 'Sign In')}</span>
                            </button>
                          </form>
                        )}
                        {loginMessage && (
                          <div className="text-[11px] text-amber-200 bg-amber-500/15 border border-amber-500/30 px-3 py-2.5 rounded-xl flex items-center gap-2 animate-fadeIn">
                            <AlertCircle size={15} className="text-amber-400 shrink-0" />
                            <span className="leading-snug">{loginMessage}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Cloud Media Fallback (Optional Cloudinary for Videos & Large Media) */}
              <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Cloud size={16} className="text-purple-400" />
                    Cloud Media Storage (Cloudinary)
                  </h4>
                  {!cloudinaryCfg.cloudName && DEFAULT_CLOUDINARY_FALLBACK.cloudName && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Fallback Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Add your free Cloudinary unsigned preset below to store custom videos &amp; large wallpapers (up to 25 MB) privately when pushing to Cloud.
                </p>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Cloudinary Cloud Name (optional)"
                    aria-label="Cloudinary cloud name, optional"
                    value={cloudinaryCfg.cloudName}
                    onChange={(e) => setCloudinaryCfg({ ...cloudinaryCfg, cloudName: e.target.value })}
                    className="w-full px-3 py-1.5 bg-black/40 border border-white/15 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-400"
                  />
                  <input
                    type="text"
                    placeholder="Unsigned Upload Preset"
                    aria-label="Cloudinary unsigned upload preset"
                    value={cloudinaryCfg.uploadPreset}
                    onChange={(e) => setCloudinaryCfg({ ...cloudinaryCfg, uploadPreset: e.target.value })}
                    className="w-full px-3 py-1.5 bg-black/40 border border-white/15 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-400"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      saveCloudinaryConfig(cloudinaryCfg.cloudName, cloudinaryCfg.uploadPreset);
                      showNotice(
                        cloudinaryCfg.cloudName
                          ? 'Cloudinary media sync configured!'
                          : 'Cloudinary config cleared (using Firebase)'
                      );
                    }}
                    className="w-full py-2 bg-purple-600/80 hover:bg-purple-600 text-white text-xs font-medium rounded-lg transition cursor-pointer"
                  >
                    Save Media Storage Config
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Sidebar;
