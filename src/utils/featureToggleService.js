/**
 * Feature Toggle & Performance Service
 * Manages Lite Mode (low-spec PC optimizations), Standby/Reading Mode,
 * and individual module toggles (Clock, Weather, Search, Dials, Favorites, AI, etc.)
 */

const FEATURES_STORAGE_KEY = 'landing_features_config_v1';

export const DEFAULT_FEATURES = {
  // Individual feature toggles
  search: true,
  autoFocusSearch: true,
  typeToSearch: true,
  highContrast: false,
  largeText: false,
  simpleLayout: false,
  reducedMotion: false,
  clock: true,
  weather: true,
  speedDials: true,
  favorites: true,
  customWidgets: true,
  notesButton: true,
  aiStudio: true,
  videoWallpapers: true,
  searchSuggestions: true,

  // Performance Modes
  liteMode: false,
  standbyMode: false,
};

/**
 * Apply or remove .lite-mode class on the document root
 */
export const applyLiteModeCss = (isLite) => {
  try {
    if (typeof document !== 'undefined') {
      if (isLite) {
        document.documentElement.classList.add('lite-mode');
      } else {
        document.documentElement.classList.remove('lite-mode');
      }
    }
  } catch {
    // ignore
  }
};

export const applyAccessibilityCss = (features) => {
  if (typeof document === 'undefined') return;
  for (const [key, className] of Object.entries({ highContrast: 'high-contrast', largeText: 'large-text', reducedMotion: 'reduce-motion' })) {
    document.documentElement.classList.toggle(className, Boolean(features[key]));
  }
};

/**
 * Retrieve current feature configuration from localStorage
 */
export const getStoredFeatures = () => {
  try {
    const raw = localStorage.getItem(FEATURES_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_FEATURES };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_FEATURES,
      ...parsed,
    };
  } catch {
    return { ...DEFAULT_FEATURES };
  }
};

/**
 * Save updated features to localStorage, apply DOM classes, and dispatch global event
 */
export const saveStoredFeatures = (newFeatures) => {
  try {
    const merged = {
      ...DEFAULT_FEATURES,
      ...newFeatures,
    };
    localStorage.setItem(FEATURES_STORAGE_KEY, JSON.stringify(merged));
    applyLiteModeCss(Boolean(merged.liteMode));
    applyAccessibilityCss(merged);
    window.dispatchEvent(new CustomEvent('landing_features_updated', { detail: merged }));
    return merged;
  } catch (err) {
    console.error('Failed to save features config:', err);
    return newFeatures;
  }
};

/**
 * One-click helper to toggle a single feature
 */
export const toggleFeature = (featureKey) => {
  const current = getStoredFeatures();
  const nextValue = !current[featureKey];
  return saveStoredFeatures({
    ...current,
    [featureKey]: nextValue,
  });
};

/**
 * Quick toggle for Lite Mode
 */
export const toggleLiteMode = () => {
  return toggleFeature('liteMode');
};

/**
 * Quick toggle for Standby / Reading Mode
 */
export const toggleStandbyMode = () => {
  return toggleFeature('standbyMode');
};
