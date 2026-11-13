import { updateUserData } from '../services/databaseService';
import { getCachedUserData } from './cacheService';

export const getDefaultLayout = () => {
  const width = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const height = typeof window !== 'undefined' ? window.innerHeight : 800;

  return {
    weather: {
      x: 28,
      y: 28,
      width: 230,
      height: 125,
      minWidth: 180,
      minHeight: 100,
    },
    clock: {
      x: Math.max(28, width - 175),
      y: 28,
      width: 145,
      height: 145,
      minWidth: 100,
      minHeight: 100,
    },
    search: {
      x: Math.max(20, Math.round((width - 640) / 2)),
      y: Math.max(60, Math.round(height * 0.22)),
      width: 640,
      height: 56,
      minWidth: 300,
      minHeight: 50,
    },
    speedDials: {
      x: Math.max(20, Math.round((width - 720) / 2)),
      y: Math.max(140, Math.round(height * 0.36)),
      width: 720,
      height: 125,
      minWidth: 260,
      minHeight: 100,
    },
    favorites: {
      x: Math.max(20, Math.round((width - 800) / 2)),
      y: Math.max(260, Math.round(height * 0.58)),
      width: 800,
      height: 250,
      minWidth: 320,
      minHeight: 150,
    },
  };
};

const mergeWithDefaults = (defaults, stored) => {
  const merged = { ...stored };
  for (const key of Object.keys(defaults)) {
    merged[key] = {
      ...defaults[key],
      ...(stored?.[key] || {}),
    };
  }
  return merged;
};

export const getStoredLayout = (effectiveUid) => {
  const defaults = getDefaultLayout();

  try {
    const raw = localStorage.getItem(`landing_widget_layout_${effectiveUid}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return mergeWithDefaults(defaults, parsed);
      }
    }

    // Try user cache
    const cached = getCachedUserData(effectiveUid);
    if (cached && cached.widgetLayout && typeof cached.widgetLayout === 'object') {
      return mergeWithDefaults(defaults, cached.widgetLayout);
    }
  } catch (err) {
    console.error('Failed to parse stored widget layout:', err);
  }

  return defaults;
};

export const saveStoredLayout = async (effectiveUid, layout) => {
  try {
    localStorage.setItem(
      `landing_widget_layout_${effectiveUid}`,
      JSON.stringify(layout)
    );

    await updateUserData(effectiveUid, { widgetLayout: layout });
  } catch (err) {
    console.error('Failed to save widget layout:', err);
  }
};

export const resetStoredLayout = async (effectiveUid) => {
  try {
    localStorage.removeItem(`landing_widget_layout_${effectiveUid}`);
    await updateUserData(effectiveUid, { widgetLayout: null });
  } catch (err) {
    console.error('Failed to reset widget layout:', err);
  }
  return getDefaultLayout();
};
