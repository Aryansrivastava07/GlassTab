import { useState, useRef, lazy, Suspense } from 'react';
import useDialogFocus from '../hooks/useDialogFocus';
import {
  RotateCcw,
  Layers,
  Sparkles,
  User,
  Image as ImageIcon,
  Palette,
  LayoutGrid,
  Heart,
  Cloud,
  Zap,
  BookOpen,
  Accessibility,
  Download,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import useExtensionUpdate, { UPDATER_URL } from '../hooks/useExtensionUpdate';
const Sidebar = lazy(() => import('./Sidebar'));

const NAV_CATEGORIES = [
  { id: 'appearance', label: 'Wallpaper', icon: ImageIcon, title: 'Appearance & Wallpapers' },
  { id: 'glass', label: 'Glass Style', icon: Palette, title: 'Glass Blur & RGB Colors' },
  { id: 'widgets', label: 'Widgets', icon: LayoutGrid, title: 'Widgets, Layout & AI' },
  { id: 'shortcuts', label: 'Shortcuts', icon: Heart, title: 'Saved Shortcuts' },
  { id: 'performance', label: 'Performance', icon: Zap, title: 'Lite Mode, Standby Mode & Feature Toggles' },
  { id: 'accessibility', label: 'Accessibility', icon: Accessibility, title: 'Reading, Motion & Keyboard Settings' },
  { id: 'account', label: 'Sync', icon: Cloud, title: 'Account, Sync & Media' },
];

const Navbar = ({
  onResetLayout,
  isDragEnabled,
  onToggleDrag,
  onOpenWidgetStudio,
  onOpenAiStudio,
  customWidgets = [],
  onEditWidget,
  onDeleteWidget,
  standbyMode = false,
  onToggleStandby,
}) => {
  const { currentUser, isGuest } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('appearance');
  const update = useExtensionUpdate();

  const dialogRef = useRef(null);
  const triggerRef = useRef(null);
  const closeMenu = () => {
    setIsMenuOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };
  useDialogFocus(dialogRef, isMenuOpen, closeMenu);

  const isSignedIn = !isGuest && Boolean(currentUser?.uid);

  const renderProfileAvatar = () => {
    if (isSignedIn && currentUser?.photoURL) {
      return (
        <img
          src={currentUser.photoURL}
          alt={currentUser.displayName || 'Profile'}
          className="w-7 h-7 rounded-full object-cover"
        />
      );
    }
    if (isSignedIn) {
      const initial = (currentUser?.displayName || currentUser?.email || 'U')[0].toUpperCase();
      return (
        <span className="w-7 h-7 rounded-full bg-indigo-500/35 text-indigo-100 border border-indigo-400/40 flex items-center justify-center text-xs font-bold">
          {initial}
        </span>
      );
    }
    // Stale / guest profile icon when not signed in
    return (
      <span className="w-7 h-7 rounded-full bg-white/5 text-white/45 border border-white/10 flex items-center justify-center">
        <User size={15} />
      </span>
    );
  };

  return (
    <div ref={dialogRef} role={isMenuOpen ? 'dialog' : undefined} aria-modal={isMenuOpen ? 'true' : undefined} aria-label="Dashboard settings" tabIndex={-1}>
      {/* Subtle click-outside backdrop when expanded */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px] transition-opacity"
          onClick={closeMenu}
        />
      )}

      <nav aria-label="Dashboard controls" className="relative z-50 pointer-events-auto flex flex-col items-end gap-1.5">
        {!isMenuOpen ? (
          /* Homepage Collapsed State: Standby Mode 1-click button + Profile icon */
          <div className="flex items-center gap-1.5">
            {update && (
              <a
                href={UPDATER_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GlassTab update available; open updater"
                title={`Update available: ${update.version || update.buildId.slice(0, 8)}`}
                className="flex items-center gap-1 rounded-full border border-sky-300/60 bg-sky-950/90 px-2 py-1 text-xs font-semibold text-sky-100 hover:bg-sky-800"
              >
                <Download size={14} /> Update
              </a>
            )}
            {onToggleStandby && (
              <button
                type="button"
                onClick={onToggleStandby}
                className={`p-1.5 rounded-full backdrop-blur-md border transition-all cursor-pointer shadow-lg ${
                  standbyMode
                    ? 'bg-indigo-600/90 border-indigo-400 text-white shadow-indigo-500/30 ring-2 ring-indigo-400/30'
                    : 'bg-black/50 border-white/20 hover:border-white/40 text-white/70 hover:text-white'
                }`}
                title={standbyMode ? 'Exit Reading / Standby Mode (Alt+Z or Esc)' : 'Enter Reading / Standby Mode (Alt+Z)'}
              >
                <BookOpen size={14} />
              </button>
            )}

            <button
              ref={triggerRef}
              type="button"
              aria-label="Open dashboard settings"
              aria-haspopup="dialog"
              aria-expanded={isMenuOpen}
              onClick={() => setIsMenuOpen(true)}
              className={`p-1 rounded-full backdrop-blur-md border transition-all cursor-pointer shadow-lg ${
                isSignedIn
                  ? 'bg-black/50 border-white/25 hover:border-white/55 hover:scale-105'
                  : 'bg-black/40 border-white/15 hover:border-white/35 text-white/50 hover:text-white/80'
              }`}
              title={
                isSignedIn
                  ? `${currentUser?.displayName || currentUser?.email} — Open Quick Controls & Settings`
                  : 'Guest Profile — Open Quick Controls & Settings'
              }
            >
              {renderProfileAvatar()}
            </button>
          </div>
        ) : (
          /* Expanded Pill Bar: Quick Workspace Actions + Categorized Settings Navs + Profile Toggle */
          <div className="flex items-center gap-1 bg-black/75 backdrop-blur-xl px-2.5 py-1.5 rounded-full border border-white/15 shadow-2xl max-w-[calc(100vw-2.5rem)] overflow-x-auto">
            {/* Quick Workspace Actions */}
            {onToggleStandby && (
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onToggleStandby();
                }}
                className={`p-1.5 rounded-full transition-all cursor-pointer shrink-0 ${
                  standbyMode
                    ? 'text-indigo-300 bg-indigo-500/20'
                    : 'text-white/75 hover:text-white hover:bg-white/10'
                }`}
                title={standbyMode ? 'Exit Reading / Standby Mode (Alt+Z)' : 'Reading / Standby Mode (Alt+Z)'}
              >
                <BookOpen size={15} />
              </button>
            )}

            {onOpenAiStudio && (
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenAiStudio();
                }}
                className="p-1.5 text-sky-300 hover:text-white hover:bg-sky-500/20 rounded-full transition-all cursor-pointer shrink-0"
                title="Open AI Studio"
              >
                <Sparkles size={15} />
              </button>
            )}

            {onOpenWidgetStudio && (
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenWidgetStudio();
                }}
                className="p-1.5 text-indigo-300 hover:text-white hover:bg-indigo-500/20 rounded-full transition-all cursor-pointer shrink-0"
                title="Widget Store & Studio"
              >
                <Layers size={15} />
              </button>
            )}

            {onResetLayout && (
              <button
                type="button"
                onClick={onResetLayout}
                className="p-1.5 text-white/75 hover:text-white hover:bg-white/10 rounded-full transition-all cursor-pointer shrink-0"
                title="Reset Widget Positions"
              >
                <RotateCcw size={15} />
              </button>
            )}

            <div className="w-px h-4 bg-white/15 mx-0.5 shrink-0" />

            {/* Settings Category Nav Pills */}
            <div className="flex items-center gap-0.5 shrink-0">
              {NAV_CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const active = activeTab === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveTab(cat.id)}
                    title={cat.title}
                    aria-pressed={active}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                      active
                        ? 'bg-white/18 text-white border border-white/25 shadow-sm'
                        : 'text-gray-300/80 hover:text-white hover:bg-white/10 border border-transparent'
                    }`}
                  >
                    <Icon size={13} className={active ? 'text-blue-300' : ''} />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="w-px h-4 bg-white/15 mx-0.5 shrink-0" />

            {/* Right-anchored Profile Toggle (collapses pill & floating bar) */}
            <button
              type="button"
              onClick={closeMenu}
              className={`p-0.5 rounded-full border transition-all cursor-pointer shrink-0 ${
                isSignedIn
                  ? 'border-blue-400/70 ring-2 ring-blue-400/20'
                  : 'border-white/30 ring-2 ring-white/10'
              }`}
              title="Collapse menu"
            >
              {renderProfileAvatar()}
            </button>
          </div>
        )}
      </nav>

      {/* Categorized Floating Settings Bar opened below the expanded pill */}
      {isMenuOpen && <Suspense fallback={<div className="loading-panel" role="status">Loading settings…</div>}><Sidebar
        isOpen={isMenuOpen}
        activeTab={activeTab}
        onClose={closeMenu}
        isDragEnabled={isDragEnabled}
        onToggleDrag={onToggleDrag}
        onResetLayout={onResetLayout}
        onOpenWidgetStudio={() => {
          setIsMenuOpen(false);
          if (onOpenWidgetStudio) onOpenWidgetStudio();
        }}
        customWidgets={customWidgets}
        onEditWidget={(w) => {
          setIsMenuOpen(false);
          if (onEditWidget) onEditWidget(w);
        }}
        onDeleteWidget={onDeleteWidget}
      /></Suspense>}
    </div>
  );
};

export default Navbar;
