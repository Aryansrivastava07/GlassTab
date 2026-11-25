import { updateUserData } from '../services/databaseService';
import { getCachedUserData } from './cacheService';

export const getViewportSize = () => ({
  width: typeof window !== 'undefined' ? window.innerWidth : 1280,
  height: typeof window !== 'undefined' ? window.innerHeight : 800,
});

// Positions and sizes are fractions of the viewport. Minimum content sizes stay in pixels.
export const getDefaultLayout = () => ({
    weather: {
      x: 28 / 1280,
      y: 28 / 800,
      width: 230 / 1280,
      height: 125 / 800,
      minWidth: 180,
      minHeight: 100,
    },
    clock: {
      x: 1105 / 1280,
      y: 28 / 800,
      width: 145 / 1280,
      height: 145 / 800,
      minWidth: 100,
      minHeight: 100,
    },
    search: {
      x: 0.25,
      y: 0.22,
      width: 0.5,
      height: 56 / 800,
      minWidth: 300,
      minHeight: 50,
    },
    speedDials: {
      x: 0.21875,
      y: 0.36,
      width: 0.5625,
      height: 125 / 800,
      minWidth: 260,
      minHeight: 100,
    },
    favorites: {
      x: 0.1875,
      y: 0.58,
      width: 0.625,
      height: 250 / 800,
      minWidth: 320,
      minHeight: 150,
    },
});

export const toViewportLayout = (layout, viewport = getViewportSize()) => {
  if (!layout || typeof layout !== 'object') return layout;
  // Older layouts stored pixels. Convert them at the first viewport where they are read.
  if (Number(layout.width) <= 1 && Number(layout.height) <= 1) return layout;
  return {
    ...layout,
    x: (Number(layout.x) || 0) / viewport.width,
    y: (Number(layout.y) || 0) / viewport.height,
    width: (Number(layout.width) || 0) / viewport.width,
    height: (Number(layout.height) || 0) / viewport.height,
  };
};

export const toPixelLayout = (layout, viewport = getViewportSize()) => ({
  ...layout,
  x: layout.x * viewport.width,
  y: layout.y * viewport.height,
  width: layout.width * viewport.width,
  height: layout.height * viewport.height,
});

export const mergeWithDefaults = (defaults, stored, viewport = getViewportSize()) => {
  const merged = {};
  for (const [key, value] of Object.entries(stored || {})) {
    merged[key] = toViewportLayout(value, viewport);
  }
  for (const key of Object.keys(defaults)) {
    merged[key] = {
      ...defaults[key],
      ...(merged[key] || {}),
    };
  }
  return merged;
};

export const getStoredLayout = (effectiveUid) => {
  const defaults = getDefaultLayout();
  const storageKey = `landing_widget_layout_${effectiveUid}`;

  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const merged = mergeWithDefaults(defaults, parsed);
        if (Object.values(parsed).some((item) => item && Number(item.width) > 1)) {
          localStorage.setItem(storageKey, JSON.stringify(merged));
        }
        return merged;
      }
    }

    // Try user cache
    const cached = getCachedUserData(effectiveUid);
    if (cached && cached.widgetLayout && typeof cached.widgetLayout === 'object') {
      const merged = mergeWithDefaults(defaults, cached.widgetLayout);
      localStorage.setItem(storageKey, JSON.stringify(merged));
      return merged;
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
