import { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from "react";
import { Sparkles, ChevronDown, ChevronUp, LayoutDashboard } from "lucide-react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import SearchBar from "./components/SearchBar";
import SpeedDials from "./components/SpeedDials";
import WelcomePopup from "./components/WelcomePopup";
import WallpaperManager from "./components/WallpaperManager";
import FavoritesBar from "./components/FavoritesBar";
import NotesButton from "./components/NotesButton";
import Navbar from "./components/Navbar";
import WeatherWidget from "./components/WeatherWidget";
import AnalogClock from "./components/AnalogClock";
import DraggableWidget from "./components/DraggableWidget";
import CustomWidgetFrame from "./components/CustomWidgetFrame";
import useDialogFocus from './hooks/useDialogFocus';
import {
  getDefaultLayout,
  getStoredLayout,
  saveStoredLayout,
  resetStoredLayout,
  getViewportSize,
  toViewportLayout,
  toPixelLayout,
  mergeWithDefaults,
} from "./utils/layoutService";
import {
  getStoredFeatures,
  applyLiteModeCss,
  applyAccessibilityCss,
  toggleStandbyMode,
} from "./utils/featureToggleService";
import { subscribeToUserData, updateUserData } from "./services/databaseService";
import { getCachedUserData } from "./utils/cacheService";
import { applyCssVariables, getGlassTheme } from "./utils/glassThemeService";
import "./App.css";

// Lazy-load GlassAIStudio for instant dashboard initial load
const GlassAIStudio = lazy(() => import("./components/GlassAIStudio"));
const CustomWidgetStudio = lazy(() => import('./components/CustomWidgetStudio'));

const isAnyModalOpen = () => {
  try {
    const modalCandidates = document.querySelectorAll(
      '[role="dialog"], [aria-modal="true"], .modal-backdrop, [data-modal="true"]'
    );
    for (const el of modalCandidates) {
      if (el.offsetParent !== null || window.getComputedStyle(el).display !== 'none') {
        return true;
      }
    }
    const overlayCandidates = document.querySelectorAll(
      'div.fixed.inset-0:not(#ai-studio-overlay):not(.wallpaper-container):not(.pointer-events-none)'
    );
    for (const el of overlayCandidates) {
      const comp = window.getComputedStyle(el);
      if (
        comp.display !== 'none' &&
        comp.visibility !== 'hidden' &&
        comp.pointerEvents !== 'none' &&
        parseFloat(comp.opacity || '1') > 0
      ) {
        return true;
      }
    }
  } catch {
    // fallback
  }
  return false;
};

function AppContent() {
  const { currentUser, isGuest } = useAuth();
  const effectiveUid = currentUser?.uid || "local_guest";

  const defaultLayout = useMemo(() => getDefaultLayout(), []);
  const [layout, setLayout] = useState(() => getStoredLayout(effectiveUid));

  // Count of stored speed dials to dynamically enforce minWidth
  const [speedDialsCount, setSpeedDialsCount] = useState(() => {
    const cached = getCachedUserData(effectiveUid);
    return cached?.speedDials?.length || 6;
  });

  // Custom User Widgets (loaded synchronously from local DB)
  const [customWidgets, setCustomWidgets] = useState(() => {
    const cached = getCachedUserData(effectiveUid);
    return Array.isArray(cached?.customWidgets) ? cached.customWidgets : [];
  });
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState(null);

  const [viewport, setViewport] = useState(getViewportSize);

  useEffect(() => {
    let frame;
    const handleResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setViewport(getViewportSize()));
    };
    window.addEventListener('resize', handleResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    applyCssVariables(getGlassTheme(effectiveUid));
  }, [effectiveUid]);

  // Feature Toggles and Performance / Standby Mode state
  const [features, setFeatures] = useState(() => {
    const init = getStoredFeatures();
    applyLiteModeCss(init.liteMode);
    applyAccessibilityCss(init);
    return init;
  });

  const isCompact = viewport.width < 1024 || features.simpleLayout || features.largeText;

  useEffect(() => {
    const handleFeaturesUpdate = (e) => {
      const updated = e.detail || getStoredFeatures();
      setFeatures(updated);
      applyLiteModeCss(updated.liteMode);
      applyAccessibilityCss(updated);
    };
    window.addEventListener("landing_features_updated", handleFeaturesUpdate);
    return () => window.removeEventListener("landing_features_updated", handleFeaturesUpdate);
  }, []);

  // Calculate dynamic content-aware minWidth for SpeedDials
  const speedDialsHeight = (layout.speedDials?.height || defaultLayout.speedDials.height) * viewport.height;
  const speedDialsRows = Math.max(1, Math.floor((speedDialsHeight - 20) / 92));
  const speedDialsColsNeeded = Math.max(1, Math.ceil(speedDialsCount / speedDialsRows));
  // Each column needs 92px (80px card + 12px gap) + 28px container padding
  const speedDialsMinWidth = speedDialsColsNeeded * 92 + 28;

  // Sync layout from local storage and explicit manual Pull snapshots
  useEffect(() => {
    const loaded = getStoredLayout(effectiveUid);
    setLayout(loaded);

    const applyRemoteOrLocalData = (userData, isExplicitPull = false) => {
      if (!userData) return;
      if (userData.widgetLayout && typeof userData.widgetLayout === "object") {
        if (isExplicitPull) {
          const pulledLayout = mergeWithDefaults(getDefaultLayout(), userData.widgetLayout);
          localStorage.setItem(`landing_widget_layout_${effectiveUid}`, JSON.stringify(pulledLayout));
          setLayout(pulledLayout);
        } else {
          setLayout(getStoredLayout(effectiveUid));
        }
      } else if (isExplicitPull) {
        setLayout(getDefaultLayout());
      }
      if (Array.isArray(userData.speedDials)) {
        setSpeedDialsCount(userData.speedDials.length);
      }
      if (Array.isArray(userData.customWidgets)) {
        setCustomWidgets(userData.customWidgets);
      }
    };

    const unsubscribe = subscribeToUserData(effectiveUid, (userData) => {
      applyRemoteOrLocalData(userData, false);
    });

    const handleForceAccountSync = (e) => {
      if (e.detail?.userId === effectiveUid && e.detail?.userData) {
        applyRemoteOrLocalData(e.detail.userData, true);
      }
    };

    const handleResetEvent = async () => {
      const freshDefaults = await resetStoredLayout(effectiveUid, isGuest);
      setLayout(freshDefaults);
    };

    window.addEventListener("resetWidgetLayout", handleResetEvent);
    window.addEventListener("landing_force_account_sync", handleForceAccountSync);

    return () => {
      unsubscribe();
      window.removeEventListener("resetWidgetLayout", handleResetEvent);
      window.removeEventListener("landing_force_account_sync", handleForceAccountSync);
    };
  }, [effectiveUid, isGuest]);

  const handleLayoutChange = useCallback(
    (widgetId, newWidgetLayout) => {
      setLayout((prev) => {
        const next = { ...prev, [widgetId]: newWidgetLayout };
        saveStoredLayout(effectiveUid, next, isGuest);
        return next;
      });
    },
    [effectiveUid, isGuest]
  );

  const [isDragEnabled, setIsDragEnabled] = useState(() => {
    try {
      const stored = localStorage.getItem("landing_widget_drag_enabled");
      return stored !== null ? JSON.parse(stored) : false;
    } catch {
      return false;
    }
  });

  const handleToggleDrag = useCallback((val) => {
    setIsDragEnabled((prev) => {
      const next = typeof val === "boolean" ? val : !prev;
      try {
        localStorage.setItem("landing_widget_drag_enabled", JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  }, []);

  const handleResetLayout = useCallback(async () => {
    const freshDefaults = await resetStoredLayout(effectiveUid, isGuest);
    setLayout(freshDefaults);
  }, [effectiveUid, isGuest]);

  const handleSaveCustomWidget = useCallback(
    (widgetObj) => {
      setCustomWidgets((prev) => {
        const exists = prev.some((w) => w.id === widgetObj.id);
        const updated = exists
          ? prev.map((w) => (w.id === widgetObj.id ? widgetObj : w))
          : [...prev, widgetObj];
        updateUserData(effectiveUid, { customWidgets: updated });
        return updated;
      });

      const layoutKey = `custom_${widgetObj.id}`;
      setLayout((prev) => {
        const existing = prev[layoutKey];
        const nextWidgetLayout = existing
          ? {
              ...existing,
              width: widgetObj.width / viewport.width,
              height: widgetObj.height / viewport.height,
            }
          : toViewportLayout({
              x: 40,
              y: 185,
              width: widgetObj.width,
              height: widgetObj.height,
              minWidth: 160,
              minHeight: 100,
            }, viewport);
        const next = { ...prev, [layoutKey]: nextWidgetLayout };
        saveStoredLayout(effectiveUid, next, isGuest);
        return next;
      });
    },
    [effectiveUid, isGuest, viewport]
  );

  const handleDeleteCustomWidget = useCallback(
    (widgetId) => {
      setCustomWidgets((prev) => {
        const updated = prev.filter((w) => w.id !== widgetId);
        updateUserData(effectiveUid, { customWidgets: updated });
        return updated;
      });
      try {
        localStorage.removeItem(`landing_widget_store_${widgetId}`);
      } catch {
        // ignore
      }
      const layoutKey = `custom_${widgetId}`;
      setLayout((prev) => {
        const next = { ...prev };
        delete next[layoutKey];
        saveStoredLayout(effectiveUid, next, isGuest);
        return next;
      });
    },
    [effectiveUid, isGuest]
  );

  // Ensure the page always starts cleanly at the top (Screen 1 Dashboard) on load / refresh
  const [activeView, setActiveView] = useState('dashboard');
  const [hasOpenedAI, setHasOpenedAI] = useState(false);
  const aiDialogRef = useRef(null);
  const isTransitioningRef = useRef(false);

  const transitionTo = useCallback((view) => {
    if (view === 'ai-studio') setHasOpenedAI(true);
    setActiveView((current) => {
      if (current === view) return current;
      isTransitioningRef.current = true;
      setTimeout(() => {
        isTransitioningRef.current = false;
      }, 550);
      return view;
    });
  }, []);

  useDialogFocus(aiDialogRef, activeView === 'ai-studio', () => transitionTo('dashboard'));

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);
  }, []);

  // Keyboard navigation: Escape returns to dashboard or exits standby mode; Z toggles standby mode; PageDown/PageUp toggles AI Studio
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.defaultPrevented || isAnyModalOpen()) return;
      const isInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target?.isContentEditable;

      if (e.key === 'Escape') {
        if (activeView === 'ai-studio') {
          transitionTo('dashboard');
        } else if (features.standbyMode && !isAnyModalOpen()) {
          toggleStandbyMode();
        }
      } else if (!isInput && !isAnyModalOpen()) {
        if (e.altKey && (e.key === 'z' || e.key === 'Z') && activeView === 'dashboard') {
          e.preventDefault();
          toggleStandbyMode();
        } else if (e.altKey && e.key === 'PageDown' && activeView === 'dashboard' && features.aiStudio) {
          e.preventDefault();
          transitionTo('ai-studio');
        } else if (e.altKey && e.key === 'PageUp' && activeView === 'ai-studio') {
          e.preventDefault();
          transitionTo('dashboard');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeView, transitionTo, features.standbyMode, features.aiStudio]);

  return (
    <div
      id="root-viewport"
      className="h-screen w-screen relative overflow-hidden select-none bg-[#070a0f]"
    >
      <a className="skip-link" href="#dashboard-screen">Skip to dashboard</a>
      {/* Background Wallpaper */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <WallpaperManager />
      </div>

      {/* ================= FIXED DASHBOARD IN BACK ================= */}
      <main
        id="dashboard-screen"
        aria-label="Dashboard"
        tabIndex={-1}
        className="fixed inset-0 z-10 overflow-y-auto overflow-x-hidden"
        style={{
          transform: activeView === 'dashboard' ? 'scale(1)' : 'scale(0.97)',
          opacity: activeView === 'dashboard' ? 1 : 0.45,
          filter: activeView === 'dashboard' ? 'none' : 'blur(4px)',
          transition: 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease, filter 0.4s ease',
          pointerEvents: activeView === 'dashboard' ? 'auto' : 'none',
        }}
      >
        <div className={isCompact ? 'relative z-50 flex justify-end px-3 pt-3' : 'absolute top-4 right-5 z-50'}>
          <Navbar
            onResetLayout={handleResetLayout}
            isDragEnabled={isDragEnabled}
            onToggleDrag={handleToggleDrag}
            onOpenWidgetStudio={() => { setEditingWidget(null); setIsStudioOpen(true); }}
            onOpenAiStudio={() => transitionTo('ai-studio')}
            customWidgets={customWidgets}
            onEditWidget={(widget) => { setEditingWidget(widget); setIsStudioOpen(true); }}
            onDeleteWidget={handleDeleteCustomWidget}
            standbyMode={features.standbyMode}
            onToggleStandby={toggleStandbyMode}
          />
        </div>
        {isCompact ? (
          /* ================= RESPONSIVE COMPACT FLOW LAYOUT ================= */
          <div className="simple-dashboard w-full max-w-4xl mx-auto flex flex-col items-center px-3 sm:px-6 pt-3 pb-24 gap-3 sm:gap-4 select-text">
            {/* Responsive Top Header: Weather + Clock on Left, Navbar Controls on Right */}
            <div className="w-full flex flex-wrap items-center justify-between gap-2.5 min-h-[52px]">
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                {features.weather && (
                  <div className="h-24 sm:h-28 w-44 sm:w-56 shrink-0">
                    <WeatherWidget />
                  </div>
                )}
                {features.clock && (
                  <div className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 flex items-center justify-center">
                    <AnalogClock />
                  </div>
                )}
              </div>

            </div>

            {/* 1. Search Bar */}
            {features.search && (
              <div className="w-full max-w-2xl h-13 sm:h-14 my-1">
                <SearchBar isDashboardActive={activeView === 'dashboard'} />
              </div>
            )}

            {/* 2. Speed Dials Dock */}
            {!features.standbyMode && features.speedDials && (
              <div className="w-full max-w-2xl min-h-[110px] my-1">
                <SpeedDials onCountChange={setSpeedDialsCount} />
              </div>
            )}

            {/* 3. Favorites Bar */}
            {!features.standbyMode && features.favorites && (
              <div className="w-full max-w-3xl min-h-[180px] max-h-[380px] my-1">
                <FavoritesBar />
              </div>
            )}

            {/* 4. Custom User Widgets */}
            {!features.standbyMode &&
              features.customWidgets &&
              customWidgets.map((cw) => (
                <div key={cw.id} className="w-full max-w-xl min-h-[120px] my-1 rounded-2xl overflow-hidden">
                  <CustomWidgetFrame
                    widget={cw}
                    width={360}
                    height={210}
                    showControls={isDragEnabled}
                    onEdit={(target) => {
                      setEditingWidget(target);
                      setIsStudioOpen(true);
                    }}
                    onDelete={handleDeleteCustomWidget}
                  />
                </div>
              ))}
          </div>
        ) : (
          /* ================= DESKTOP DRAGGABLE & RESIZABLE LAYOUT ================= */
          <>
            {/* 1. Draggable & Resizable Weather Widget */}
            {features.weather && (
              <DraggableWidget
                id="weather"
                title="Weather"
                layout={layout.weather}
                defaultLayout={defaultLayout.weather}
                viewport={viewport}
                onLayoutChange={handleLayoutChange}
                minWidth={210}
                minHeight={115}
                className="rounded-2xl"
                draggable={isDragEnabled}
                resizable={isDragEnabled}
              >
                <WeatherWidget />
              </DraggableWidget>
            )}

            {/* 2. Draggable & Resizable Analog Clock */}
            {features.clock && (
              <DraggableWidget
                id="clock"
                title="Clock"
                layout={layout.clock}
                defaultLayout={defaultLayout.clock}
                viewport={viewport}
                onLayoutChange={handleLayoutChange}
                minWidth={100}
                minHeight={100}
                className="rounded-full"
                draggable={isDragEnabled}
                resizable={isDragEnabled}
              >
                <AnalogClock />
              </DraggableWidget>
            )}

            {/* 3. Draggable & Resizable Search Bar */}
            {features.search && (
              <DraggableWidget
                id="search"
                title="Search"
                layout={layout.search}
                defaultLayout={defaultLayout.search}
                viewport={viewport}
                onLayoutChange={handleLayoutChange}
                minWidth={340}
                minHeight={50}
                className="rounded-full"
                draggable={isDragEnabled}
                resizable={isDragEnabled}
              >
                <SearchBar isDashboardActive={activeView === 'dashboard'} />
              </DraggableWidget>
            )}

            {/* 4. Draggable & Resizable Speed Dials Dock */}
            {!features.standbyMode && features.speedDials && (
              <DraggableWidget
                id="speedDials"
                title="Speed Dials"
                layout={layout.speedDials}
                defaultLayout={defaultLayout.speedDials}
                viewport={viewport}
                onLayoutChange={handleLayoutChange}
                minWidth={speedDialsMinWidth}
                minHeight={115}
                className="rounded-2xl"
                draggable={isDragEnabled}
                resizable={isDragEnabled}
              >
                <SpeedDials onCountChange={setSpeedDialsCount} />
              </DraggableWidget>
            )}

            {/* 5. Draggable & Resizable Favorites Bar */}
            {!features.standbyMode && features.favorites && (
              <DraggableWidget
                id="favorites"
                title="Favorites"
                layout={layout.favorites}
                defaultLayout={defaultLayout.favorites}
                viewport={viewport}
                onLayoutChange={handleLayoutChange}
                minWidth={320}
                minHeight={150}
                className="rounded-2xl"
                draggable={isDragEnabled}
                resizable={isDragEnabled}
              >
                <FavoritesBar />
              </DraggableWidget>
            )}

            {/* 6+. User Custom Sandboxed Widgets */}
            {!features.standbyMode &&
              features.customWidgets &&
              customWidgets.map((cw) => {
                const key = `custom_${cw.id}`;
                const widgetDefaultLayout = {
                  x: 40 / 1280,
                  y: 185 / 800,
                  width: (cw.width || 360) / 1280,
                  height: (cw.height || 210) / 800,
                  minWidth: 160,
                  minHeight: 100,
                };
                const activeLayout = layout[key] || widgetDefaultLayout;
                const activePixelLayout = toPixelLayout(activeLayout, viewport);

                return (
                  <DraggableWidget
                    key={cw.id}
                    id={key}
                    title={cw.name}
                    layout={activeLayout}
                    defaultLayout={widgetDefaultLayout}
                    viewport={viewport}
                    onLayoutChange={handleLayoutChange}
                    minWidth={160}
                    minHeight={100}
                    className="rounded-2xl"
                    draggable={isDragEnabled}
                    resizable={isDragEnabled}
                  >
                    <CustomWidgetFrame
                      widget={cw}
                      width={activePixelLayout.width}
                      height={activePixelLayout.height}
                      showControls={isDragEnabled}
                      onEdit={(target) => {
                        setEditingWidget(target);
                        setIsStudioOpen(true);
                      }}
                      onDelete={handleDeleteCustomWidget}
                    />
                  </DraggableWidget>
                );
              })}
          </>
        )}

        {/* Floating Notes & Todos Action Button */}
        {!features.standbyMode && features.notesButton && <NotesButton />}

      {/* First-time Welcome Popup */}
      <WelcomePopup />

      {/* Custom Widget Studio Modal */}
      {isStudioOpen && <Suspense fallback={<div role="status" className="loading-panel">Loading widget studio…</div>}><CustomWidgetStudio
        isOpen={isStudioOpen}
        onClose={() => {
          setIsStudioOpen(false);
          setEditingWidget(null);
        }}
        onSaveWidget={handleSaveCustomWidget}
        editingWidget={editingWidget}
      /></Suspense>}

    </main>

    {/* ================= SNAPPING CHAT SHEET OVERLAY ================= */}
    <div
      id="ai-studio-overlay"
      ref={aiDialogRef}
      role={activeView === 'ai-studio' ? 'dialog' : undefined}
      aria-modal={activeView === 'ai-studio' ? 'true' : undefined}
      aria-label="AI Studio"
      aria-hidden={activeView !== 'ai-studio'}
      tabIndex={-1}
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 pb-16 sm:p-6 sm:pb-16 ${
        activeView === 'ai-studio' ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
      style={{
        transform: `translate3d(0, ${activeView === 'ai-studio' ? '0%' : '100%'}, 0)`,
        opacity: activeView === 'ai-studio' ? 1 : 0,
        pointerEvents: activeView === 'ai-studio' ? 'auto' : 'none',
        visibility: activeView === 'ai-studio' ? 'visible' : 'hidden',
        transition: 'transform 0.42s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease, visibility 0.42s',
      }}
    >
      {/* Dark backdrop overlay that dims the fixed dashboard */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-xs -z-10"
        onClick={() => transitionTo('dashboard')}
        title="Click backdrop to return to Dashboard"
      />

      {hasOpenedAI && <Suspense
        fallback={
          <div className="w-full max-w-6xl h-[88vh] rounded-3xl bg-[#0c1017]/90 backdrop-blur-xl border border-white/15 flex flex-col items-center justify-center gap-3 shadow-2xl">
            <Sparkles className="animate-spin text-sky-400" size={28} />
            <span className="text-sm font-medium text-white/80 tracking-wide">Loading AI Studio...</span>
          </div>
        }
      >
        <GlassAIStudio
          onScrollToDashboard={() => transitionTo('dashboard')}
          isActive={activeView === 'ai-studio'}
        />
      </Suspense>}
    </div>

    {/* ================= STANDBY / READING MODE INDICATOR & QUICK EXIT ================= */}
    {features.standbyMode && (
      <button
        type="button"
        onClick={toggleStandbyMode}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] px-4 py-1.5 rounded-full bg-black/75 hover:bg-black/90 border border-indigo-400/50 hover:border-indigo-400 text-white backdrop-blur-xl shadow-2xl transition-all flex items-center gap-2.5 text-xs font-medium cursor-pointer group animate-fadeIn select-none"
        title="Exit Reading / Standby Mode (Alt+Z or Esc)"
      >
        <span className="w-2 h-2 rounded-full bg-indigo-400 group-hover:scale-125 transition-transform animate-pulse" />
        <span className="tracking-wide">Reading Mode Active</span>
        <span className="text-white/45 text-[11px] font-mono">(Alt+Z or Esc to Exit)</span>
      </button>
    )}

    {/* ================= PERMANENT BOTTOM CAPSULE TOGGLE (DASHBOARD <-> AI STUDIO) ================= */}
    {!features.standbyMode && features.aiStudio && (
      <button
        type="button"
        onClick={() => transitionTo(activeView === 'ai-studio' ? 'dashboard' : 'ai-studio')}
        className={`fixed bottom-3.5 left-1/2 -translate-x-1/2 z-[60] px-4 py-1.5 rounded-full border shadow-2xl transition-all duration-300 flex items-center gap-2 backdrop-blur-xl cursor-pointer active:scale-95 select-none ${
          activeView === 'ai-studio'
            ? 'bg-blue-600/85 hover:bg-blue-600 border-blue-400/40 text-white shadow-blue-500/25 ring-2 ring-blue-500/20'
            : 'bg-black/65 hover:bg-black/85 border-white/15 hover:border-white/30 text-white/85 hover:text-white shadow-black/50'
        }`}
        title={activeView === 'ai-studio' ? 'Return to Dashboard (Esc)' : 'Open AI Studio (Ginnie & Companions)'}
      >
        {activeView === 'ai-studio' ? (
          <>
            <LayoutDashboard size={13} className="text-blue-200" />
            <span className="font-semibold text-xs tracking-wide">Back to Dashboard</span>
            <ChevronDown size={14} className="text-white/70" />
          </>
        ) : (
          <>
            <Sparkles size={13} className="text-sky-400 animate-pulse" />
            <span className="font-medium text-xs">AI Studio (Ginnie &amp; Companions)</span>
            <ChevronUp size={14} className="text-white/50" />
          </>
        )}
      </button>
    )}
  </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
