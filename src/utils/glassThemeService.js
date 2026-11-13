/**
 * Glass Theme Service
 * Manages independent blur levels, background RGB colors, opacities, and text color/contrast
 * for each prebuilt UI component: Search Box, Shortcuts (Speed Dial), and Favorites (Fav).
 */

export const DEFAULT_GLASS_THEME = {
  search: {
    blur: 12,
    color: '#000000',
    opacity: 55,
    textColor: '#ffffff',
    textShadow: false,
  },
  speedDial: {
    blur: 16,
    color: '#0a0c12',
    opacity: 55,
    textColor: '#ffffff',
    textShadow: true,
  },
  favorites: {
    blur: 16,
    color: '#0a0c12',
    opacity: 55,
    textColor: '#ffffff',
    textShadow: false,
  },
  widgets: {
    blur: 10,
    color: '#0a0c12',
    opacity: 45,
    textColor: '#ffffff',
    textShadow: false,
  },
  // Backward compatibility alias
  shortcuts: {
    blur: 16,
    color: '#0a0c12',
    opacity: 55,
    textColor: '#ffffff',
    textShadow: false,
  },
};

export const hexToRgb = (hex) => {
  if (!hex || typeof hex !== 'string') return { r: 0, g: 0, b: 0 };
  let c = hex.replace('#', '').trim();
  if (c.length === 3) {
    c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  }
  const num = parseInt(c, 16);
  if (Number.isNaN(num)) return { r: 0, g: 0, b: 0 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
};

export const rgbToHex = (r, g, b) => {
  const clamp = (val) => Math.max(0, Math.min(255, Math.round(Number(val) || 0)));
  const toHex = (n) => clamp(n).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

export const hexToRgba = (hex, opacity = 50) => {
  const { r, g, b } = hexToRgb(hex);
  const alpha = Math.max(0, Math.min(100, Number(opacity) ?? 50)) / 100;
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
};

export const getLuminance = (hex) => {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};

const THEME_STORAGE_KEY = (uid) => `landing_glass_theme_${uid || 'local_guest'}`;

export const getGlassTheme = (uid = 'local_guest') => {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY(uid));
    if (raw) {
      const parsed = JSON.parse(raw);
      const favConfig = parsed.favorites || parsed.shortcuts || DEFAULT_GLASS_THEME.favorites;
      const widgetsConfig = parsed.widgets || DEFAULT_GLASS_THEME.widgets;
      return {
        search: { ...DEFAULT_GLASS_THEME.search, ...parsed.search },
        speedDial: { ...DEFAULT_GLASS_THEME.speedDial, ...parsed.speedDial },
        favorites: { ...DEFAULT_GLASS_THEME.favorites, ...favConfig },
        shortcuts: { ...DEFAULT_GLASS_THEME.favorites, ...favConfig },
        widgets: { ...DEFAULT_GLASS_THEME.widgets, ...widgetsConfig },
      };
    }
  } catch (err) {
    console.warn('Failed to parse glass theme from storage:', err);
  }
  return { ...DEFAULT_GLASS_THEME };
};

export const applyCssVariables = (theme) => {
  if (typeof document === 'undefined' || !document.documentElement) return;
  const root = document.documentElement;

  const parts = ['search', 'speedDial', 'favorites', 'widgets'];
  parts.forEach((part) => {
    const p = theme[part] || DEFAULT_GLASS_THEME[part];
    const bg = hexToRgba(p.color, p.opacity);
    const textColor = p.textColor || '#ffffff';
    const textMuted = hexToRgba(textColor, 65);
    const isLightText = getLuminance(textColor) > 0.5;
    const shadowVal = p.textShadow
      ? (isLightText
          ? '0 1px 3px rgba(0, 0, 0, 0.9), 0 0 6px rgba(0, 0, 0, 0.6)'
          : '0 1px 2px rgba(255, 255, 255, 0.8), 0 0 4px rgba(255, 255, 255, 0.5)')
      : 'none';

    root.style.setProperty(`--glass-${part.toLowerCase()}-blur`, `${p.blur}px`);
    root.style.setProperty(`--glass-${part.toLowerCase()}-bg`, bg);
    root.style.setProperty(`--glass-${part.toLowerCase()}-text`, textColor);
    root.style.setProperty(`--glass-${part.toLowerCase()}-text-muted`, textMuted);
    root.style.setProperty(`--glass-${part.toLowerCase()}-text-shadow`, shadowVal);

    // Dynamic contrast adaptation for analog clock face markings
    if (part === 'widgets') {
      const clockFaceFilter = isLightText ? 'invert(1)' : 'none';
      root.style.setProperty('--clock-face-filter', clockFaceFilter);
    }

    // Keep shortcuts alias synchronized for CSS variables
    if (part === 'favorites') {
      root.style.setProperty('--glass-shortcuts-blur', `${p.blur}px`);
      root.style.setProperty('--glass-shortcuts-bg', bg);
      root.style.setProperty('--glass-shortcuts-text', textColor);
      root.style.setProperty('--glass-shortcuts-text-muted', textMuted);
      root.style.setProperty('--glass-shortcuts-text-shadow', shadowVal);
    }
  });
};

export const saveGlassTheme = (uid = 'local_guest', newTheme) => {
  try {
    const favConfig = newTheme.favorites || newTheme.shortcuts || DEFAULT_GLASS_THEME.favorites;
    const widgetsConfig = newTheme.widgets || DEFAULT_GLASS_THEME.widgets;
    const themeToSave = {
      search: { ...DEFAULT_GLASS_THEME.search, ...newTheme.search },
      speedDial: { ...DEFAULT_GLASS_THEME.speedDial, ...newTheme.speedDial },
      favorites: { ...DEFAULT_GLASS_THEME.favorites, ...favConfig },
      shortcuts: { ...DEFAULT_GLASS_THEME.favorites, ...favConfig },
      widgets: { ...DEFAULT_GLASS_THEME.widgets, ...widgetsConfig },
    };
    localStorage.setItem(THEME_STORAGE_KEY(uid), JSON.stringify(themeToSave));
    applyCssVariables(themeToSave);
    window.dispatchEvent(new CustomEvent('glassThemeUpdate', { detail: themeToSave }));
  } catch (err) {
    console.error('Failed to save glass theme:', err);
  }
};

export const getGlassStyleForPart = (partConfig) => {
  if (!partConfig) return {};
  const blurPx = Math.max(0, Math.min(60, Number(partConfig.blur) ?? 16));
  const bg = hexToRgba(partConfig.color, partConfig.opacity);
  return {
    backdropFilter: `blur(${blurPx}px)`,
    WebkitBackdropFilter: `blur(${blurPx}px)`,
    backgroundColor: bg,
  };
};

export const getTextStyleForPart = (partConfig) => {
  if (!partConfig) return {};
  const isBrightBg = getLuminance(partConfig.color || '#000000') > 0.55;
  let textColor = partConfig.textColor || (isBrightBg ? '#111827' : '#ffffff');
  // If background is bright and textColor was left as white, automatically use dark charcoal #111827 for readability
  if (isBrightBg && textColor.toLowerCase() === '#ffffff') {
    textColor = '#111827';
  }
  const hasShadow = Boolean(partConfig.textShadow);
  const isLightText = getLuminance(textColor) > 0.5;
  return {
    color: textColor,
    textShadow: hasShadow
      ? (isLightText
          ? '0 1px 3px rgba(0, 0, 0, 0.9), 0 0 6px rgba(0, 0, 0, 0.6)'
          : '0 1px 2px rgba(255, 255, 255, 0.8), 0 0 4px rgba(255, 255, 255, 0.5)')
      : 'none',
  };
};

export const getMutedTextStyleForPart = (partConfig, opacity = 65) => {
  if (!partConfig) return {};
  const isBrightBg = getLuminance(partConfig.color || '#000000') > 0.55;
  let textColor = partConfig.textColor || (isBrightBg ? '#111827' : '#ffffff');
  if (isBrightBg && textColor.toLowerCase() === '#ffffff') {
    textColor = '#111827';
  }
  const hasShadow = Boolean(partConfig.textShadow);
  const isLightText = getLuminance(textColor) > 0.5;
  return {
    color: hexToRgba(textColor, opacity),
    textShadow: hasShadow
      ? (isLightText
          ? '0 1px 2px rgba(0, 0, 0, 0.85)'
          : '0 1px 2px rgba(255, 255, 255, 0.85)')
      : 'none',
  };
};
