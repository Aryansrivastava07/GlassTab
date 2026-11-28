import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import useDialogFocus from '../hooks/useDialogFocus';
import {
  X,
  Sparkles,
  Copy,
  Check,
  Code2,
  Maximize2,
  Play,
  KeyRound,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Store,
  UploadCloud,
  Download,
  Search,
  Eye,
  Trash2,
  LogIn,
  Pencil,
} from 'lucide-react';
import CustomWidgetFrame from './CustomWidgetFrame';
import { useAuth } from '../context/AuthContext';
import { signInWithGoogle } from '../services/authService';
import {
  WIDGET_SIZE_PRESETS,
  CONFIRMED_DATA_SOURCES,
  buildWidgetMasterPrompt,
  generateWidgetWithGemini,
  getGeminiApiKey,
  saveGeminiApiKey,
  validatePromptCapabilities,
  parseAIUnsupportedResponse,
  synthesizeWidgetDescription,
} from '../services/aiWidgetService';
import {
  isGoogleSignedIn,
  getCachedStoreWidgets,
  subscribeToStoreWidgets,
  publishWidgetToStore,
  deleteStoreWidget,
  recordStoreInstall,
} from '../services/widgetStoreService';

const OFFICIAL_STARTER_ITEMS = CONFIRMED_DATA_SOURCES.filter((s) => s.id !== 'diagnostics').map((s) => ({
  id: `official_${s.id}`,
  name: s.defaultName,
  summary: synthesizeWidgetDescription({ name: s.defaultName, sourceId: s.id }),
  sourceId: s.id,
  width: s.width,
  height: s.height,
  code: s.defaultCode,
  authorName: 'Official Starter',
  isOfficial: true,
  installs: null,
}));

const SOURCE_BADGE_MAP = Object.fromEntries(
  CONFIRMED_DATA_SOURCES.map((s) => [s.id, s.label])
);

const CustomWidgetStudio = ({
  isOpen,
  onClose,
  onSaveWidget,
  editingWidget = null,
}) => {
  const dialogRef = useRef(null);
  useDialogFocus(dialogRef, isOpen, onClose);
  const { firebaseUser, isGuest, googleUser } = useAuth();
  const googleAuthed = !isGuest && isGoogleSignedIn(firebaseUser);

  // Store is the default page when opening Layers; editing a widget opens Dev Mode directly
  const [devMode, setDevMode] = useState(false);

  // Store state
  const [storeWidgets, setStoreWidgets] = useState(() => getCachedStoreWidgets());
  const [storeSearch, setStoreSearch] = useState('');
  const [storeCategory, setStoreCategory] = useState('all');
  const [previewStoreItem, setPreviewStoreItem] = useState(null);
  const [deletingStoreId, setDeletingStoreId] = useState(null);

  // Dev Mode (Customize Widget Panel) state
  const [activeWidgetId, setActiveWidgetId] = useState('');
  const [activeStoreId, setActiveStoreId] = useState('');
  const [name, setName] = useState('');
  const [sourceId, setSourceId] = useState('scores');
  const [width, setWidth] = useState(360);
  const [height, setHeight] = useState(210);
  const [description, setDescription] = useState(''); // AI Prompt
  const [storeDescription, setStoreDescription] = useState(''); // What this widget does
  const [dataSourceUrl, setDataSourceUrl] = useState('');
  const [code, setCode] = useState(CONFIRMED_DATA_SOURCES[0].defaultCode);
  const [previewKey, setPreviewKey] = useState(1);

  const [geminiKey, setGeminiKey] = useState(() => getGeminiApiKey());
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [sandboxLogs, setSandboxLogs] = useState([]);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  const showToast = (type, title, message) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ id: Date.now(), type, title, message });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 5500);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Subscribe to Firebase Widget Store while modal is open
  useEffect(() => {
    if (!isOpen) return undefined;
    const unsubscribe = subscribeToStoreWidgets((items) => {
      setStoreWidgets(items);
    });
    return () => unsubscribe();
  }, [isOpen]);

  // Initialize Store vs Dev Mode state on open
  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg('');
    setSandboxLogs([]);
    setPreviewStoreItem(null);

    if (editingWidget) {
      setDevMode(true);
      setActiveWidgetId(editingWidget.id || `cw_${Date.now()}`);
      setActiveStoreId(editingWidget.storeId || '');
      setName(editingWidget.name || 'Custom Widget');
      setSourceId(editingWidget.sourceId || 'scores');
      setWidth(editingWidget.width || 360);
      setHeight(editingWidget.height || 210);
      setCode(editingWidget.code || '');
      setDescription(editingWidget.description || '');
      setStoreDescription(
        editingWidget.storeDescription ||
          synthesizeWidgetDescription({
            name: editingWidget.name,
            sourceId: editingWidget.sourceId,
            prompt: editingWidget.description,
          })
      );
    } else {
      setDevMode(false);
      setStoreSearch('');
      setStoreCategory('all');
      const def = CONFIRMED_DATA_SOURCES[0];
      setActiveWidgetId(`cw_${Date.now()}`);
      setActiveStoreId('');
      setSourceId(def.id);
      setName(def.defaultName);
      setWidth(def.width);
      setHeight(def.height);
      setCode(def.defaultCode);
      setDescription('');
      setStoreDescription(synthesizeWidgetDescription({ name: def.defaultName, sourceId: def.id }));
      setDataSourceUrl('');
    }
    setPreviewKey((k) => k + 1);
  }, [isOpen, editingWidget]);

  const combinedStoreItems = useMemo(() => {
    const community = storeWidgets.map((item) => ({
      ...item,
      isOfficial: false,
    }));
    return [...community, ...OFFICIAL_STARTER_ITEMS];
  }, [storeWidgets]);

  const filteredStoreItems = useMemo(() => {
    const q = storeSearch.trim().toLowerCase();
    return combinedStoreItems.filter((item) => {
      if (storeCategory === 'community' && item.isOfficial) return false;
      if (
        storeCategory !== 'all' &&
        storeCategory !== 'community' &&
        item.sourceId !== storeCategory
      ) {
        return false;
      }
      if (!q) return true;
      return (
        String(item.name || '').toLowerCase().includes(q) ||
        String(item.summary || '').toLowerCase().includes(q) ||
        String(item.authorName || '').toLowerCase().includes(q)
      );
    });
  }, [combinedStoreItems, storeSearch, storeCategory]);

  if (!isOpen) return null;

  const handleSelectSource = (src) => {
    if (src === 'custom') {
      setSourceId('custom');
      return;
    }
    setSourceId(src.id);
    setName(src.defaultName);
    setWidth(src.width);
    setHeight(src.height);
    setCode(src.defaultCode);
    setStoreDescription(
      synthesizeWidgetDescription({
        name: src.defaultName,
        sourceId: src.id,
        prompt: description,
      })
    );
    setSandboxLogs([]);
    setErrorMsg('');
    setPreviewKey((k) => k + 1);
  };

  const handleCopyPrompt = () => {
    setErrorMsg('');
    const check = validatePromptCapabilities(sourceId, description);
    if (!check.ok) {
      showToast('error', 'Cannot Be Done With This API', check.error);
      return;
    }

    const prompt = buildWidgetMasterPrompt({
      description: description.trim() || 'Sleek modern dark glass UI',
      sourceId,
      dataSourceUrl,
      width,
      height,
    });
    navigator.clipboard.writeText(prompt);
    setCopiedPrompt(true);
    showToast('success', 'Prompt Copied', 'Paste into any AI chat, then paste the returned code below.');
    setTimeout(() => setCopiedPrompt(false), 2200);
  };

  const handleGenerateAI = async () => {
    if (!googleUser) { await handleGoogleSignIn(); return; }
    const check = validatePromptCapabilities(sourceId, description);
    if (!check.ok) {
      showToast('error', 'Cannot Be Done With This API', check.error);
      return;
    }

    if (!geminiKey.trim()) {
      setShowKeyInput(true);
      showToast('error', 'Gemini API Key Required', 'Add your Gemini key below or use "Copy Prompt" with any AI chat.');
      return;
    }

    setErrorMsg('');
    setSandboxLogs([]);
    setIsGenerating(true);
    try {
      saveGeminiApiKey(geminiKey);
      const generated = await generateWidgetWithGemini({
        apiKey: geminiKey,
        description: description.trim() || 'Sleek modern dark glass UI',
        sourceId,
        dataSourceUrl,
        width,
        height,
      });
      setCode(generated);
      setStoreDescription(
        synthesizeWidgetDescription({
          name,
          sourceId,
          prompt: description,
        })
      );
      setPreviewKey((k) => k + 1);
      showToast('success', 'Widget Generated', 'Review the description below and add or publish to Store.');
    } catch (err) {
      if (err.isUnsupported) {
        showToast('error', 'Cannot Be Done With This API', err.message);
      } else {
        setErrorMsg(err.message || 'AI generation failed');
        showToast('error', 'Generation Failed', err.message || 'AI generation failed');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCodeChange = (nextCode) => {
    const rejected = parseAIUnsupportedResponse(nextCode);
    if (rejected) {
      showToast('error', 'Cannot Be Done With This API', rejected.reason);
      return;
    }
    setCode(nextCode);
    if (!storeDescription.trim() && nextCode.trim()) {
      setStoreDescription(
        synthesizeWidgetDescription({
          name,
          sourceId,
          prompt: description,
        })
      );
    }
  };

  const buildCurrentWidgetObject = () => ({
    id: activeWidgetId || `cw_${Date.now()}`,
    storeId: activeStoreId || undefined,
    name: name.trim() || 'Custom Widget',
    sourceId,
    width: Math.max(160, Number(width) || 360),
    height: Math.max(100, Number(height) || 210),
    code,
    description: description.trim(),
    storeDescription:
      storeDescription.trim() ||
      synthesizeWidgetDescription({ name, sourceId, prompt: description }),
  });

  const handleSave = (e) => {
    e.preventDefault();
    const rejected = parseAIUnsupportedResponse(code);
    if (rejected) {
      showToast('error', 'Cannot Be Done With This API', rejected.reason);
      return;
    }
    if (!code.trim()) {
      setErrorMsg('Widget code cannot be empty.');
      return;
    }
    onSaveWidget(buildCurrentWidgetObject());
    onClose();
  };

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
      showToast('success', 'Signed in with Google', 'You can now generate and publish widgets.');
    } catch (err) {
      showToast('error', 'Google Sign-In Failed', err?.message || 'Sign-in was cancelled.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handlePublishToStore = async () => {
    const rejected = parseAIUnsupportedResponse(code);
    if (rejected) {
      showToast('error', 'Cannot Be Done With This API', rejected.reason);
      return;
    }
    if (!code.trim()) {
      showToast('error', 'Widget Empty', 'Create or paste widget code before publishing.');
      return;
    }
    if (!googleAuthed) {
      showToast('error', 'Google Sign-In Required', 'Sign in with Google first to publish to the Firebase Store.');
      return;
    }
    const finalSummary = storeDescription.trim();
    if (!finalSummary) {
      showToast('error', 'Description Required', 'Add a short description of what this widget does before publishing.');
      return;
    }

    setIsPublishing(true);
    try {
      const widgetObj = buildCurrentWidgetObject();
      const published = await publishWidgetToStore({
        widget: widgetObj,
        description: finalSummary,
        firebaseUser,
      });
      setActiveStoreId(published.storeId);
      onSaveWidget({ ...widgetObj, storeId: published.storeId });
      showToast('success', 'Published to Widget Store!', `"${published.name}" is now live in the Firebase Store.`);
    } catch (err) {
      showToast('error', 'Publish Failed', err?.message || 'Could not publish widget.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleInstallFromStore = (item) => {
    const newWidget = {
      id: `cw_${Date.now()}`,
      name: item.name || 'Store Widget',
      sourceId: item.sourceId || 'custom',
      width: Math.max(160, Number(item.width) || 360),
      height: Math.max(100, Number(item.height) || 210),
      code: item.code || '',
      description: item.prompt || '',
      storeDescription: item.summary || '',
      installedFromStoreId: item.isOfficial ? null : item.id,
    };
    onSaveWidget(newWidget);
    if (!item.isOfficial) {
      recordStoreInstall(item.id);
    }
    showToast('success', 'Added to Dashboard', `"${newWidget.name}" was added to your new tab.`);
  };

  const handleEditStoreItemInDev = (item) => {
    setActiveWidgetId(`cw_${Date.now()}`);
    setActiveStoreId(!item.isOfficial && item.authorUid === firebaseUser?.uid ? item.id : '');
    setName(item.name || 'Custom Widget');
    setSourceId(item.sourceId || 'custom');
    setWidth(item.width || 360);
    setHeight(item.height || 210);
    setCode(item.code || '');
    setDescription(item.prompt || '');
    setStoreDescription(item.summary || '');
    setPreviewStoreItem(null);
    setDevMode(true);
    setPreviewKey((k) => k + 1);
  };

  const handleDeleteFromStore = async (item) => {
    setDeletingStoreId(item.id);
    try {
      await deleteStoreWidget(item.id, firebaseUser);
      if (previewStoreItem?.id === item.id) setPreviewStoreItem(null);
      showToast('success', 'Removed from Store', `"${item.name}" was unpublished from Firebase.`);
    } catch (err) {
      showToast('error', 'Delete Failed', err?.message || 'Could not delete from Store.');
    } finally {
      setDeletingStoreId(null);
    }
  };

  const previewWidget = {
    id: activeWidgetId || 'studio_preview_widget',
    name: name || 'Preview',
    code,
  };

  const hasWidgetCode = Boolean(code.trim());

  return createPortal(
    <>
      {/* Floating Toaster Notification */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-[100001] max-w-md w-[92vw] sm:w-auto rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-xl flex items-start gap-3 text-xs transition-all ${
            toast.type === 'error'
              ? 'bg-red-950/90 border-red-400/50 text-red-100'
              : toast.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-400/50 text-emerald-100'
              : 'bg-indigo-950/90 border-indigo-400/50 text-indigo-100'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[12px]">{toast.title}</div>
            <div className="text-[11px] opacity-90 mt-0.5 break-words leading-relaxed">{toast.message}</div>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-white/60 hover:text-white p-0.5 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Widget store and studio" tabIndex={-1} className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/80 backdrop-blur-xs" onClick={onClose} />

        {/* Modal Shell */}
        <div className="relative w-full max-w-5xl max-h-[90vh] dark-glass rounded-2xl border border-white/15 flex flex-col shadow-2xl overflow-hidden text-white">
          {/* Header with Store vs Dev Mode Toggle */}
          <div className="px-5 py-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 bg-black/30 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                {devMode ? <Code2 size={18} /> : <Store size={18} />}
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold leading-tight">
                  {devMode
                    ? editingWidget
                      ? 'Edit Custom Widget (Dev Mode)'
                      : 'Customize Widget (Dev Mode)'
                    : 'Widget Store'}
                </h2>
                <p className="text-[11px] text-gray-400">
                  {devMode
                    ? 'Build widgets from prompt & confirmed APIs, describe what they do, and publish to Store.'
                    : 'Browse and install live community & starter widgets in 1 click.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Dev Mode Toggle Switch */}
              <button
                type="button"
                onClick={() => setDevMode((prev) => !prev)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition cursor-pointer ${
                  devMode
                    ? 'bg-indigo-500/25 border-indigo-400/60 text-indigo-100'
                    : 'bg-white/5 hover:bg-white/10 border-white/15 text-gray-200'
                }`}
                title="Toggle Dev Mode to open the Customize Widget panel"
              >
                <Code2 size={13} className={devMode ? 'text-indigo-300' : 'text-gray-400'} />
                <span>Dev Mode</span>
                <span
                  className={`w-7 h-4 rounded-full p-0.5 transition-colors flex items-center ${
                    devMode ? 'bg-indigo-500 justify-end' : 'bg-white/20 justify-start'
                  }`}
                >
                  <span className="w-3 h-3 rounded-full bg-white shadow" />
                </span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* BODY: Store View (default) OR Dev Mode (Customize Widget Panel) */}
          {!devMode ? (
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Store Search & Category Filters */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={storeSearch}
                    onChange={(e) => setStoreSearch(e.target.value)}
                    placeholder="Search store widgets, topics, or creators..."
                    className="w-full pl-8 pr-3 py-2 bg-black/40 border border-white/15 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-400"
                  />
                </div>
                <div className="flex items-center gap-2 text-[11px] text-gray-400">
                  <span>{storeWidgets.length} community</span>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => setDevMode(true)}
                    className="text-indigo-300 hover:text-indigo-200 underline cursor-pointer flex items-center gap-1"
                  >
                    <Layers size={12} />
                    Create & Publish in Dev Mode
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'community', label: `✨ Community (${storeWidgets.length})` },
                  ...CONFIRMED_DATA_SOURCES.filter((s) => s.id !== 'diagnostics').map((s) => ({
                    id: s.id,
                    label: s.label,
                  })),
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStoreCategory(tab.id)}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition cursor-pointer ${
                      storeCategory === tab.id
                        ? 'bg-indigo-500/25 border-indigo-400/60 text-white'
                        : 'bg-white/5 hover:bg-white/10 border-white/10 text-gray-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Optional Live Store Preview Drawer */}
              {previewStoreItem && (
                <div className="p-4 rounded-xl bg-black/55 border border-indigo-400/35 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <span>Live Preview: {previewStoreItem.name}</span>
                        <span className="text-[10px] font-mono text-gray-400">
                          {previewStoreItem.width}×{previewStoreItem.height}px
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-300 mt-0.5">{previewStoreItem.summary}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleInstallFromStore(previewStoreItem)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Download size={12} />
                        Add to Dashboard
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewStoreItem(null)}
                        className="p-1 text-gray-400 hover:text-white cursor-pointer"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-center p-3 rounded-lg bg-black/40 border border-white/10 overflow-auto">
                    <div
                      className="glass rounded-2xl shrink-0 overflow-hidden shadow-xl"
                      style={{
                        width: `${Math.min(previewStoreItem.width || 360, 560)}px`,
                        height: `${Math.min(previewStoreItem.height || 210, 260)}px`,
                      }}
                    >
                      <CustomWidgetFrame
                        key={previewStoreItem.id}
                        widget={previewStoreItem}
                        width={previewStoreItem.width || 360}
                        height={previewStoreItem.height || 210}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Store Grid */}
              {filteredStoreItems.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-400 border border-dashed border-white/15 rounded-2xl">
                  No widgets match your filter. Toggle <strong className="text-indigo-300">Dev Mode</strong> above to build and publish one!
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {filteredStoreItems.map((item) => {
                    const isOwner = !item.isOfficial && firebaseUser?.uid && item.authorUid === firebaseUser.uid;
                    return (
                      <div
                        key={item.id}
                        className="p-4 rounded-xl bg-white/5 hover:bg-white/[0.07] border border-white/10 hover:border-indigo-400/40 flex flex-col justify-between gap-3 transition"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-sm font-bold text-white leading-snug line-clamp-1">
                              {item.name}
                            </h3>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 border ${
                                item.isOfficial
                                  ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300'
                                  : 'bg-indigo-500/15 border-indigo-400/30 text-indigo-300'
                              }`}
                            >
                              {item.isOfficial ? 'Starter' : 'Community'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[10px] text-gray-400">
                            <span>{SOURCE_BADGE_MAP[item.sourceId] || '✨ Custom'}</span>
                            <span>•</span>
                            <span className="font-mono">{item.width}×{item.height}</span>
                            {typeof item.installs === 'number' && (
                              <>
                                <span>•</span>
                                <span>⬇ {item.installs}</span>
                              </>
                            )}
                          </div>

                          <p className="text-xs text-gray-300 leading-relaxed line-clamp-3">
                            {item.summary || 'Live custom dashboard widget.'}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {item.authorPhoto ? (
                              <img
                                src={item.authorPhoto}
                                alt={item.authorName}
                                className="w-4 h-4 rounded-full object-cover shrink-0"
                              />
                            ) : null}
                            <span className="text-[10px] text-gray-400 truncate">
                              {item.authorName || 'Creator'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => setPreviewStoreItem(item)}
                              className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-gray-200 transition cursor-pointer"
                              title="Live preview"
                            >
                              <Eye size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditStoreItemInDev(item)}
                              className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-gray-200 transition cursor-pointer"
                              title="Fork / customize in Dev Mode"
                            >
                              <Pencil size={13} />
                            </button>
                            {isOwner && (
                              <button
                                type="button"
                                disabled={deletingStoreId === item.id}
                                onClick={() => handleDeleteFromStore(item)}
                                className="p-1.5 bg-red-500/15 hover:bg-red-500/30 rounded-lg text-red-300 transition cursor-pointer disabled:opacity-50"
                                title="Unpublish from Store"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleInstallFromStore(item)}
                              className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-[11px] font-semibold text-white flex items-center gap-1 transition cursor-pointer"
                            >
                              <Download size={12} />
                              <span>Add</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* DEV MODE: Customize Widget Panel */
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* LEFT COLUMN: Title + Size + Data Source + Prompt + Store Description */}
              <div className="lg:col-span-5 space-y-4">
                {/* Widget Title */}
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">Widget Title</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Katrina Kaif News"
                    className="w-full px-3 py-2 bg-black/40 border border-white/15 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-400"
                  />
                </div>

                {/* Area Size Presets */}
                <div className="p-3.5 bg-white/5 border border-white/10 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                      <Maximize2 size={13} className="text-blue-400" />
                      Widget Area Size
                    </span>
                    <span className="text-[11px] font-mono text-gray-400">
                      {width} × {height}px
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {WIDGET_SIZE_PRESETS.map((preset) => {
                      const selected = Number(width) === preset.width && Number(height) === preset.height;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            setWidth(preset.width);
                            setHeight(preset.height);
                          }}
                          className={`p-2 rounded-lg border text-left transition cursor-pointer ${
                            selected
                              ? 'bg-indigo-500/20 border-indigo-400/60 text-white'
                              : 'bg-black/30 border-white/10 text-gray-300 hover:border-white/25'
                          }`}
                        >
                          <div className="text-[11px] font-semibold">{preset.label}</div>
                          <div className="text-[10px] text-gray-400">{preset.width}×{preset.height} • {preset.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="text-[10px] text-gray-400 block mb-0.5">Width (px)</label>
                      <input
                        type="number"
                        min={160}
                        max={1200}
                        value={width}
                        onChange={(e) => setWidth(Number(e.target.value))}
                        className="w-full px-2.5 py-1 bg-black/40 border border-white/15 rounded text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 block mb-0.5">Height (px)</label>
                      <input
                        type="number"
                        min={100}
                        max={800}
                        value={height}
                        onChange={(e) => setHeight(Number(e.target.value))}
                        className="w-full px-2.5 py-1 bg-black/40 border border-white/15 rounded text-xs text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Confirmed Live Data Connectors */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    1. Pick Confirmed Live Data Source
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {CONFIRMED_DATA_SOURCES.map((src) => {
                      const active = sourceId === src.id;
                      return (
                        <button
                          key={src.id}
                          type="button"
                          onClick={() => handleSelectSource(src)}
                          className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition cursor-pointer ${
                            active
                              ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
                              : 'bg-white/5 hover:bg-white/15 border-white/10 text-gray-200'
                          }`}
                        >
                          {src.label}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => handleSelectSource('custom')}
                      className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition cursor-pointer ${
                        sourceId === 'custom'
                          ? 'bg-indigo-500/20 border-indigo-400/60 text-indigo-200'
                          : 'bg-white/5 hover:bg-white/15 border-white/10 text-gray-300'
                      }`}
                    >
                      ✨ Custom URL
                    </button>
                  </div>
                </div>

                {/* Prompt Builder (API query & customization extracted from prompt only) */}
                <div className="p-3.5 bg-indigo-500/10 border border-indigo-400/25 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-indigo-200 flex items-center gap-1.5">
                      <Sparkles size={14} className="text-indigo-400" />
                      2. Prompt (Topic Query + Styling)
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowKeyInput(!showKeyInput)}
                      className="text-[10px] text-indigo-300 hover:text-indigo-200 flex items-center gap-1 underline cursor-pointer"
                    >
                      <KeyRound size={10} />
                      {geminiKey ? 'Gemini Key Saved' : 'Set Gemini API Key'}
                    </button>
                  </div>

                  {showKeyInput && (
                    <div className="flex gap-1.5">
                      <input
                        type="password"
                        placeholder="Paste Gemini API Key (aistudio.google.com)"
                        value={geminiKey}
                        onChange={(e) => setGeminiKey(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 bg-black/50 border border-white/20 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-400"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          saveGeminiApiKey(geminiKey);
                          setShowKeyInput(false);
                          showToast('success', 'API Key Saved', 'Gemini API Key saved locally.');
                        }}
                        className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-medium cursor-pointer"
                      >
                        Save
                      </button>
                    </div>
                  )}

                  <textarea
                    rows={2}
                    placeholder="e.g. Katrina Kaif news in sleek rose glass card (AI extracts accepted API queries from your prompt)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-black/40 border border-white/15 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-400 resize-none"
                  />
                  {sourceId === 'custom' && (
                    <input
                      type="text"
                      placeholder="Custom JSON / RSS / API URL"
                      value={dataSourceUrl}
                      onChange={(e) => setDataSourceUrl(e.target.value)}
                      className="w-full px-3 py-1.5 bg-black/40 border border-white/15 rounded-lg text-[11px] text-white placeholder-gray-500 focus:outline-none focus:border-indigo-400"
                    />
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={handleCopyPrompt}
                      className="py-2 px-3 bg-white/10 hover:bg-white/20 border border-white/15 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      {copiedPrompt ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                      <span>{copiedPrompt ? 'Prompt Copied!' : 'Copy Prompt'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={isGenerating}
                      onClick={handleGenerateAI}
                      className="py-2 px-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow transition cursor-pointer"
                    >
                      <Sparkles size={13} />
                      <span>{isGenerating ? 'Generating...' : googleUser ? 'Generate with AI' : 'Sign in with Google to generate'}</span>
                    </button>
                  </div>
                </div>

                {/* Store Description (shown once widget code is ready) */}
                {hasWidgetCode && (
                  <div className="p-3.5 bg-emerald-500/10 border border-emerald-400/25 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-emerald-200">
                        3. Description (What This Widget Does)
                      </label>
                      {!googleAuthed && (
                        <button
                          type="button"
                          disabled={isSigningIn}
                          onClick={handleGoogleSignIn}
                          className="text-[10px] text-amber-300 hover:text-amber-200 underline flex items-center gap-1 cursor-pointer"
                        >
                          <LogIn size={10} />
                          <span>{isSigningIn ? 'Signing in...' : 'Google Sign-In to Publish'}</span>
                        </button>
                      )}
                    </div>
                    <textarea
                      rows={2}
                      value={storeDescription}
                      onChange={(e) => setStoreDescription(e.target.value)}
                      placeholder="Briefly describe what this widget shows or does for the Store..."
                      className="w-full px-3 py-2 bg-black/40 border border-white/15 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-400 resize-none"
                    />
                  </div>
                )}

                {errorMsg && (
                  <div className="p-2.5 bg-red-500/15 border border-red-500/30 rounded-lg text-xs text-red-300 flex items-start gap-2">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN: Live Sandboxed Preview + Code Editor */}
              <div className="lg:col-span-7 flex flex-col space-y-3">
                {/* Live Preview */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-300">Live Sandbox Preview</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSandboxLogs([]);
                        setPreviewKey((k) => k + 1);
                      }}
                      className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Play size={11} />
                      Re-run Preview
                    </button>
                  </div>
                  <div className="p-4 rounded-xl bg-black/50 border border-white/10 flex items-center justify-center overflow-auto min-h-[170px] max-h-[260px]">
                    <div
                      className="glass rounded-2xl shrink-0 overflow-hidden shadow-xl"
                      style={{
                        width: `${Math.min(width, 540)}px`,
                        height: `${Math.min(height, 225)}px`,
                      }}
                    >
                      <CustomWidgetFrame
                        key={previewKey}
                        widget={previewWidget}
                        width={width}
                        height={height}
                        onLog={(log) => setSandboxLogs((prev) => [...prev.slice(-3), log.message])}
                      />
                    </div>
                  </div>
                  {sandboxLogs.length > 0 && (
                    <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-[11px] font-mono text-amber-200">
                      Sandbox error: {sandboxLogs[sandboxLogs.length - 1]}
                    </div>
                  )}
                </div>

                {/* Code Editor */}
                <div className="flex-1 flex flex-col space-y-1.5 min-h-[190px]">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                      <Code2 size={14} className="text-purple-400" />
                      Paste / Edit Widget Code (HTML + CSS + JS)
                    </label>
                    <span className="text-[10px] text-gray-400 font-mono">
                      window.WidgetAPI.fetch() ready
                    </span>
                  </div>
                  <textarea
                    required
                    spellCheck={false}
                    value={code}
                    onChange={(e) => handleCodeChange(e.target.value)}
                    placeholder="<style>...</style><div>...</div><script>...</script>"
                    className="flex-1 min-h-[180px] w-full p-3 bg-black/60 border border-white/15 rounded-xl font-mono text-[11px] text-emerald-200 placeholder-gray-600 focus:outline-none focus:border-purple-400 resize-y"
                  />
                </div>
              </div>
            </form>
          )}

          {/* Footer */}
          <div className="px-5 py-3.5 border-t border-white/10 bg-black/30 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
            {!devMode ? (
              <>
                <span className="text-[11px] text-gray-400">
                  {googleAuthed
                    ? `Signed in as ${firebaseUser?.displayName || firebaseUser?.email} — switch on Dev Mode to publish widgets.`
                    : 'Toggle Dev Mode ON to build custom widgets and publish with Google Sign-In.'}
                </span>
                <div className="flex items-center gap-2">
                  {!googleAuthed && (
                    <button
                      type="button"
                      disabled={isSigningIn}
                      onClick={handleGoogleSignIn}
                      className="px-3.5 py-2 bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <LogIn size={13} />
                      <span>{isSigningIn ? 'Signing in...' : 'Google Sign-In'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white text-xs font-medium rounded-lg transition cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  {hasWidgetCode && (
                    googleAuthed ? (
                      <button
                        type="button"
                        disabled={isPublishing}
                        onClick={handlePublishToStore}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow transition cursor-pointer"
                      >
                        <UploadCloud size={14} />
                        <span>
                          {isPublishing
                            ? 'Publishing...'
                            : activeStoreId
                            ? 'Update in Store'
                            : 'Publish to Store'}
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isSigningIn}
                        onClick={handleGoogleSignIn}
                        className="px-4 py-2 bg-amber-600/80 hover:bg-amber-500 disabled:opacity-60 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow transition cursor-pointer"
                        title="Google Sign-In is required to publish widgets to the Firebase Store"
                      >
                        <LogIn size={14} />
                        <span>{isSigningIn ? 'Signing in...' : 'Sign in with Google to Publish'}</span>
                      </button>
                    )
                  )}
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white text-xs font-medium rounded-lg transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-lg transition cursor-pointer"
                  >
                    {editingWidget ? 'Update Widget' : 'Add Widget to Dashboard'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};

export default CustomWidgetStudio;
