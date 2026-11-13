import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Sliders,
  Palette,
  RotateCcw,
  Search,
  Grid,
  Heart,
  LayoutGrid,
  CloudSun,
  Sparkles,
  Eye,
  Type,
  SunMedium,
  ShieldCheck,
  Check,
  Plus,
  ExternalLink,
} from 'lucide-react';
import {
  getGlassTheme,
  saveGlassTheme,
  DEFAULT_GLASS_THEME,
  hexToRgb,
  rgbToHex,
  hexToRgba,
  getLuminance,
  getGlassStyleForPart,
  getTextStyleForPart,
  getMutedTextStyleForPart,
} from '../utils/glassThemeService';

const PRESET_BG_COLORS = [
  { name: 'Onyx Dark', hex: '#000000' },
  { name: 'Deep Space', hex: '#0a0e1a' },
  { name: 'Cyber Blue', hex: '#0f172a' },
  { name: 'Midnight Purple', hex: '#1e112a' },
  { name: 'Emerald Night', hex: '#06201a' },
  { name: 'Ruby Dark', hex: '#260c14' },
  { name: 'Frosted White', hex: '#ffffff' },
];

const PRESET_TEXT_COLORS = [
  { name: 'Pure White (Dark glass)', hex: '#ffffff' },
  { name: 'Deep Charcoal (Light glass)', hex: '#111827' },
  { name: 'Silver Mist', hex: '#e2e8f0' },
  { name: 'Warm Gold', hex: '#fde047' },
  { name: 'Cyber Cyan', hex: '#38bdf8' },
  { name: 'Neon Emerald', hex: '#4ade80' },
  { name: 'Rose Bloom', hex: '#f472b6' },
];

export const GlassThemeControls = ({ uid = 'local_guest', defaultActivePart = null }) => {
  const [theme, setTheme] = useState(() => getGlassTheme(uid));
  const [activePart, setActivePart] = useState(defaultActivePart || 'speedDial'); // 'search' | 'speedDial' | 'favorites'
  const [savedNotice, setSavedNotice] = useState('');

  useEffect(() => {
    const handleUpdate = (e) => {
      if (e.detail) {
        setTheme(e.detail);
      }
    };
    window.addEventListener('glassThemeUpdate', handleUpdate);
    return () => window.removeEventListener('glassThemeUpdate', handleUpdate);
  }, []);

  const showNotice = (msg) => {
    setSavedNotice(msg);
    setTimeout(() => setSavedNotice(''), 2200);
  };

  const handleBlurChange = (part, blurValue) => {
    const val = Math.max(0, Math.min(50, Number(blurValue) || 0));
    const nextTheme = {
      ...theme,
      [part]: {
        ...theme[part],
        blur: val,
      },
    };
    setTheme(nextTheme);
    saveGlassTheme(uid, nextTheme);
  };

  const handleOpacityChange = (part, opacityValue) => {
    const val = Math.max(0, Math.min(100, Number(opacityValue) || 0));
    const nextTheme = {
      ...theme,
      [part]: {
        ...theme[part],
        opacity: val,
      },
    };
    setTheme(nextTheme);
    saveGlassTheme(uid, nextTheme);
  };

  const handleBgColorChange = (part, hexValue) => {
    const nextTheme = {
      ...theme,
      [part]: {
        ...theme[part],
        color: hexValue,
      },
    };
    setTheme(nextTheme);
    saveGlassTheme(uid, nextTheme);
  };

  const handleBgRgbChannelChange = (part, channel, val) => {
    const current = hexToRgb(theme[part]?.color || '#000000');
    const clamped = Math.max(0, Math.min(255, Number(val) || 0));
    const updated = { ...current, [channel]: clamped };
    const nextHex = rgbToHex(updated.r, updated.g, updated.b);
    handleBgColorChange(part, nextHex);
  };

  const handleTextColorChange = (part, hexValue) => {
    const nextTheme = {
      ...theme,
      [part]: {
        ...theme[part],
        textColor: hexValue,
      },
    };
    setTheme(nextTheme);
    saveGlassTheme(uid, nextTheme);
  };

  const handleTextRgbChannelChange = (part, channel, val) => {
    const current = hexToRgb(theme[part]?.textColor || '#ffffff');
    const clamped = Math.max(0, Math.min(255, Number(val) || 0));
    const updated = { ...current, [channel]: clamped };
    const nextHex = rgbToHex(updated.r, updated.g, updated.b);
    handleTextColorChange(part, nextHex);
  };

  const handleTextShadowToggle = (part) => {
    const current = Boolean(theme[part]?.textShadow);
    const nextTheme = {
      ...theme,
      [part]: {
        ...theme[part],
        textShadow: !current,
      },
    };
    setTheme(nextTheme);
    saveGlassTheme(uid, nextTheme);
    showNotice(
      !current
        ? `Text shadow enabled on ${PART_METADATA[part]?.label}!`
        : `Text shadow disabled on ${PART_METADATA[part]?.label}.`
    );
  };

  const handleAutoContrast = (part) => {
    const currentBg = theme[part]?.color || '#000000';
    const lum = getLuminance(currentBg);
    // If background is bright, pick dark text; otherwise pure white
    const recommendedTextColor = lum > 0.55 ? '#111827' : '#ffffff';
    const recommendedShadow = lum <= 0.55;

    const nextTheme = {
      ...theme,
      [part]: {
        ...theme[part],
        textColor: recommendedTextColor,
        textShadow: recommendedShadow,
      },
    };
    setTheme(nextTheme);
    saveGlassTheme(uid, nextTheme);
    showNotice(
      lum > 0.55
        ? `Auto Contrast: Dark text applied for ${PART_METADATA[part]?.label}`
        : `Auto Contrast: White text + contrast shadow applied for ${PART_METADATA[part]?.label}`
    );
  };

  const handleResetPart = (part) => {
    const nextTheme = {
      ...theme,
      [part]: { ...DEFAULT_GLASS_THEME[part] },
    };
    setTheme(nextTheme);
    saveGlassTheme(uid, nextTheme);
    showNotice(`Reset ${PART_METADATA[part]?.label} to default glass style!`);
  };

  const handleResetAll = () => {
    setTheme({ ...DEFAULT_GLASS_THEME });
    saveGlassTheme(uid, DEFAULT_GLASS_THEME);
    showNotice('All components reset to default glass style!');
  };

  const PART_METADATA = {
    search: {
      label: 'Search Box',
      badge: 'Search',
      desc: 'Controls blur, background tint, and text contrast for the central search bar and dropdown',
      icon: Search,
    },
    speedDial: {
      label: 'Shortcuts (Speed Dial)',
      badge: 'Shortcuts',
      desc: 'Controls blur, background tint, and text contrast for the bottom app launcher dock',
      icon: Grid,
    },
    favorites: {
      label: 'Favorites (Fav Bar)',
      badge: 'Favorites',
      desc: 'Controls blur, background tint, and text contrast for the saved favorites panel',
      icon: Heart,
    },
    widgets: {
      label: 'Widgets (Weather, Clock & Custom)',
      badge: 'Widgets',
      desc: 'Controls blur, background RGB tint, opacity, and text contrast for Weather, Clock, and dashboard widgets',
      icon: LayoutGrid,
    },
  };

  const currentPartConfig = theme[activePart] || DEFAULT_GLASS_THEME[activePart];
  const currentBgRgb = hexToRgb(currentPartConfig.color || '#000000');
  const currentTextRgb = hexToRgb(currentPartConfig.textColor || '#ffffff');
  const currentPreviewStyle = getGlassStyleForPart(currentPartConfig);
  const currentTextStyle = getTextStyleForPart(currentPartConfig);
  const currentMutedStyle = getMutedTextStyleForPart(currentPartConfig, 70);

  const isLightTextActive = (currentPartConfig.textColor || '#ffffff').toLowerCase() === '#ffffff';
  const isDarkTextActive = (currentPartConfig.textColor || '').toLowerCase() === '#111827';

  return (
    <div className="space-y-4">
      {/* Notice Banner */}
      {savedNotice && (
        <div className="p-2.5 rounded-lg bg-blue-500/15 border border-blue-400/30 text-blue-200 text-xs font-medium flex items-center gap-2 animate-fadeIn">
          <Sparkles size={14} className="text-amber-400 shrink-0" />
          <span>{savedNotice}</span>
        </div>
      )}

      {/* Part Switcher Pills: 4 Distinct Independent Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-black/40 border border-white/10 rounded-xl">
        {Object.entries(PART_METADATA).map(([key, meta]) => {
          const Icon = meta.icon;
          const isActive = activePart === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActivePart(key)}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-blue-600/80 text-white shadow-md border border-blue-400/40'
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon size={13} className={isActive ? 'text-blue-200' : 'text-gray-400'} />
              <span className="truncate">{meta.badge}</span>
            </button>
          );
        })}
      </div>

      {/* Main Glass Controls for Active Part */}
      <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-4">
        {/* Header & Reset Part */}
        <div className="flex items-start justify-between gap-2 pb-2 border-b border-white/10">
          <div>
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sliders size={16} className="text-indigo-400" />
              {PART_METADATA[activePart]?.label}
            </h4>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {PART_METADATA[activePart]?.desc}
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleResetPart(activePart)}
            className="px-2.5 py-1 text-[11px] bg-white/10 hover:bg-white/15 text-gray-300 hover:text-white rounded-md transition flex items-center gap-1 cursor-pointer"
            title="Reset this component"
          >
            <RotateCcw size={11} />
            <span>Reset</span>
          </button>
        </div>

        {/* 1. Blur Level Slider */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs text-gray-200 font-medium">Blur Level</label>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-black/40 border border-white/15 text-indigo-300">
              {currentPartConfig.blur}px
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="40"
            step="1"
            value={currentPartConfig.blur}
            onChange={(e) => handleBlurChange(activePart, e.target.value)}
            className="w-full h-1.5 bg-black/50 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
          <div className="flex justify-between text-[10px] text-gray-400 select-none">
            <span>0px (Transparent / Sharp)</span>
            <span>20px (Frost)</span>
            <span>40px (Ultra Frosted)</span>
          </div>
        </div>

        {/* 2. Background Color & RGB Selector */}
        <div className="space-y-2.5 pt-1 border-t border-white/5">
          <div className="flex items-center justify-between">
            <label className="text-xs text-gray-200 font-medium flex items-center gap-1.5">
              <Palette size={13} className="text-amber-400" />
              Background RGB Tint
            </label>
            <span className="text-xs font-mono text-gray-300">
              {currentPartConfig.color.toUpperCase()}
            </span>
          </div>

          {/* Color Picker + Hex Input */}
          <div className="flex items-center gap-2.5">
            <div className="relative w-9 h-9 rounded-lg overflow-hidden border border-white/20 shrink-0 shadow-sm cursor-pointer">
              <input
                type="color"
                value={currentPartConfig.color}
                onChange={(e) => handleBgColorChange(activePart, e.target.value)}
                className="absolute inset-0 w-[150%] h-[150%] -top-1/4 -left-1/4 cursor-pointer opacity-100"
              />
            </div>
            <div className="grid grid-cols-3 gap-2 flex-1">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-red-400 font-mono font-bold">R</span>
                <input
                  type="number"
                  min="0"
                  max="255"
                  value={currentBgRgb.r}
                  onChange={(e) => handleBgRgbChannelChange(activePart, 'r', e.target.value)}
                  className="w-full px-2 py-1 bg-black/40 border border-white/15 rounded-md text-xs text-white font-mono focus:outline-none focus:border-red-400"
                />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-green-400 font-mono font-bold">G</span>
                <input
                  type="number"
                  min="0"
                  max="255"
                  value={currentBgRgb.g}
                  onChange={(e) => handleBgRgbChannelChange(activePart, 'g', e.target.value)}
                  className="w-full px-2 py-1 bg-black/40 border border-white/15 rounded-md text-xs text-white font-mono focus:outline-none focus:border-green-400"
                />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-blue-400 font-mono font-bold">B</span>
                <input
                  type="number"
                  min="0"
                  max="255"
                  value={currentBgRgb.b}
                  onChange={(e) => handleBgRgbChannelChange(activePart, 'b', e.target.value)}
                  className="w-full px-2 py-1 bg-black/40 border border-white/15 rounded-md text-xs text-white font-mono focus:outline-none focus:border-blue-400"
                />
              </div>
            </div>
          </div>

          {/* Quick Palette Swatches */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[10px] text-gray-400 mr-1">Presets:</span>
            {PRESET_BG_COLORS.map((preset) => (
              <button
                key={preset.hex}
                type="button"
                onClick={() => handleBgColorChange(activePart, preset.hex)}
                className={`w-5 h-5 rounded-md border transition-all cursor-pointer ${
                  currentPartConfig.color.toLowerCase() === preset.hex.toLowerCase()
                    ? 'scale-110 border-blue-400 shadow-sm ring-1 ring-blue-400'
                    : 'border-white/20 hover:scale-105'
                }`}
                style={{ backgroundColor: preset.hex }}
                title={preset.name}
              />
            ))}
          </div>
        </div>

        {/* 3. Background Opacity Slider */}
        <div className="space-y-1.5 pt-1 border-t border-white/5">
          <div className="flex items-center justify-between">
            <label className="text-xs text-gray-200 font-medium">Background Opacity</label>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-black/40 border border-white/15 text-indigo-300">
              {currentPartConfig.opacity}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={currentPartConfig.opacity}
            onChange={(e) => handleOpacityChange(activePart, e.target.value)}
            className="w-full h-1.5 bg-black/50 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
        </div>

        {/* 4. Text Color & Contrast Control */}
        <div className="space-y-3 pt-3 border-t border-white/10">
          <div className="flex items-center justify-between">
            <label className="text-xs text-gray-100 font-semibold flex items-center gap-1.5">
              <Type size={14} className="text-cyan-400" />
              Text Color & Contrast ({PART_METADATA[activePart]?.badge})
            </label>
            <button
              type="button"
              onClick={() => handleAutoContrast(activePart)}
              className="px-2.5 py-1 text-[11px] bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-400/30 rounded-lg transition flex items-center gap-1 cursor-pointer font-medium"
              title="Auto-select optimal text color based on your background tint"
            >
              <SunMedium size={12} className="text-amber-300" />
              Auto Contrast
            </button>
          </div>

          {/* Quick One-Click Contrast Mode Switch (Light vs Dark Text) */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleTextColorChange(activePart, '#ffffff')}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition cursor-pointer ${
                isLightTextActive
                  ? 'bg-white text-black border-white shadow-md'
                  : 'bg-white/10 hover:bg-white/15 text-white border-white/15'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-white border border-gray-400 inline-block" />
              <span>Light Text (#FFF)</span>
              {isLightTextActive && <Check size={12} className="text-black" />}
            </button>
            <button
              type="button"
              onClick={() => handleTextColorChange(activePart, '#111827')}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition cursor-pointer ${
                isDarkTextActive
                  ? 'bg-gray-900 text-white border-cyan-400 shadow-md ring-1 ring-cyan-400'
                  : 'bg-white/10 hover:bg-white/15 text-white border-white/15'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-gray-900 border border-white/40 inline-block" />
              <span>Dark Text (#111)</span>
              {isDarkTextActive && <Check size={12} className="text-cyan-300" />}
            </button>
          </div>

          {/* Text Color Picker & RGB Inputs */}
          <div className="flex items-center gap-2.5">
            <div className="relative w-9 h-9 rounded-lg overflow-hidden border border-white/20 shrink-0 shadow-sm cursor-pointer">
              <input
                type="color"
                value={currentPartConfig.textColor || '#ffffff'}
                onChange={(e) => handleTextColorChange(activePart, e.target.value)}
                className="absolute inset-0 w-[150%] h-[150%] -top-1/4 -left-1/4 cursor-pointer opacity-100"
              />
            </div>
            <div className="grid grid-cols-3 gap-2 flex-1">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-red-400 font-mono font-bold">R</span>
                <input
                  type="number"
                  min="0"
                  max="255"
                  value={currentTextRgb.r}
                  onChange={(e) => handleTextRgbChannelChange(activePart, 'r', e.target.value)}
                  className="w-full px-2 py-1 bg-black/40 border border-white/15 rounded-md text-xs text-white font-mono focus:outline-none focus:border-red-400"
                />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-green-400 font-mono font-bold">G</span>
                <input
                  type="number"
                  min="0"
                  max="255"
                  value={currentTextRgb.g}
                  onChange={(e) => handleTextRgbChannelChange(activePart, 'g', e.target.value)}
                  className="w-full px-2 py-1 bg-black/40 border border-white/15 rounded-md text-xs text-white font-mono focus:outline-none focus:border-green-400"
                />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-blue-400 font-mono font-bold">B</span>
                <input
                  type="number"
                  min="0"
                  max="255"
                  value={currentTextRgb.b}
                  onChange={(e) => handleTextRgbChannelChange(activePart, 'b', e.target.value)}
                  className="w-full px-2 py-1 bg-black/40 border border-white/15 rounded-md text-xs text-white font-mono focus:outline-none focus:border-blue-400"
                />
              </div>
            </div>
          </div>

          {/* Quick Text Color Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-gray-400 mr-1">Presets:</span>
            {PRESET_TEXT_COLORS.map((preset) => (
              <button
                key={preset.hex}
                type="button"
                onClick={() => handleTextColorChange(activePart, preset.hex)}
                className={`w-5 h-5 rounded-md border transition-all cursor-pointer ${
                  (currentPartConfig.textColor || '#ffffff').toLowerCase() === preset.hex.toLowerCase()
                    ? 'scale-110 border-cyan-400 shadow-sm ring-1 ring-cyan-400'
                    : 'border-white/20 hover:scale-105'
                }`}
                style={{ backgroundColor: preset.hex }}
                title={preset.name}
              />
            ))}
          </div>

          {/* High Contrast Text Shadow Toggle */}
          <div className="flex items-center justify-between p-2.5 bg-black/35 border border-white/10 rounded-xl">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className={currentPartConfig.textShadow ? "text-emerald-400 shrink-0" : "text-gray-500 shrink-0"} />
              <div>
                <p className="text-xs text-white font-medium">Text Drop Shadow / Outline</p>
                <p className="text-[10px] text-gray-400 leading-tight">Adds halo outline for high contrast over complex or white backgrounds</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleTextShadowToggle(activePart)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                currentPartConfig.textShadow
                  ? 'bg-emerald-600/90 text-white border border-emerald-400/50 shadow-md'
                  : 'bg-white/10 text-gray-400 hover:text-white border border-white/10'
              }`}
            >
              {currentPartConfig.textShadow ? 'Active' : 'Off'}
            </button>
          </div>
        </div>

        {/* 5. Live Contrast Test in Each Tab ("ttest in each tab") */}
        <div className="pt-2 border-t border-white/10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-gray-300 font-semibold flex items-center gap-1.5">
              <Eye size={13} className="text-blue-300" />
              Live Contrast Test ({PART_METADATA[activePart]?.badge})
            </span>
            <span className="text-[10px] text-gray-400 font-mono">
              Text: {currentPartConfig.textColor || '#ffffff'}
            </span>
          </div>

          {/* Component-Specific Mock Test Block */}
          <div
            className="rounded-2xl p-3 border border-white/20 shadow-xl transition-all"
            style={currentPreviewStyle}
          >
            {activePart === 'speedDial' && (
              <div className="flex items-center justify-center gap-4 py-1">
                {/* Mock Shortcut 1 */}
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-xl bg-red-600/90 flex items-center justify-center text-white font-bold text-xs shadow-md">
                    YT
                  </div>
                  <span className="text-xs font-semibold mt-1" style={currentTextStyle}>
                    YouTube
                  </span>
                </div>
                {/* Mock Shortcut 2 */}
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600/90 flex items-center justify-center text-white font-bold text-xs shadow-md">
                    SP
                  </div>
                  <span className="text-xs font-semibold mt-1" style={currentTextStyle}>
                    Spotify
                  </span>
                </div>
                {/* Mock Empty Slot */}
                <div className="flex flex-col items-center">
                  <div
                    className="w-10 h-10 rounded-xl border-2 border-dashed flex items-center justify-center shadow-inner"
                    style={{
                      borderColor: currentMutedStyle.color,
                      color: currentMutedStyle.color,
                    }}
                  >
                    <Plus size={16} />
                  </div>
                  <span className="text-xs font-medium mt-1" style={currentMutedStyle}>
                    Add
                  </span>
                </div>
              </div>
            )}

            {activePart === 'favorites' && (
              <div className="space-y-2 py-1">
                <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                  <span className="text-xs font-bold flex items-center gap-1.5" style={currentTextStyle}>
                    <Heart size={14} className="text-red-400" />
                    Favorites Test
                  </span>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded border font-medium"
                    style={{
                      borderColor: currentMutedStyle.color,
                      color: currentTextStyle.color,
                    }}
                  >
                    + Add Favorite
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-black/20 border border-white/10">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
                      GH
                    </div>
                    <div>
                      <p className="text-xs font-semibold" style={currentTextStyle}>GitHub</p>
                      <p className="text-[10px]" style={currentMutedStyle}>github.com</p>
                    </div>
                  </div>
                  <ExternalLink size={12} style={{ color: currentMutedStyle.color }} />
                </div>
              </div>
            )}

            {activePart === 'search' && (
              <div className="py-1">
                <div
                  className="rounded-full px-4 py-2 border flex items-center justify-between"
                  style={{
                    borderColor: currentMutedStyle.color,
                    background: 'rgba(0,0,0,0.2)',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Search size={14} style={{ color: currentMutedStyle.color }} />
                    <span className="text-xs font-medium" style={currentTextStyle}>
                      Search query contrast test...
                    </span>
                  </div>
                  <span
                    className="text-[10px] px-2.5 py-1 rounded-full font-semibold border"
                    style={{
                      color: currentTextStyle.color,
                      borderColor: currentMutedStyle.color,
                    }}
                  >
                    Search
                  </span>
                </div>
              </div>
            )}

            {activePart === 'widgets' && (
              <div className="space-y-2 py-1">
                <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <CloudSun size={15} className="text-amber-400" />
                    <span className="text-xs font-bold" style={currentTextStyle}>
                      Weather &amp; Clock Preview
                    </span>
                  </div>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full border font-medium"
                    style={{
                      borderColor: currentMutedStyle.color,
                      color: currentTextStyle.color,
                    }}
                  >
                    24°C • Sunny
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-black/20 border border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🌤️</span>
                    <div>
                      <p className="text-xs font-semibold" style={currentTextStyle}>New Delhi</p>
                      <p className="text-[10px]" style={currentMutedStyle}>Humidity 58% • Wind 12 km/h</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono font-bold" style={currentTextStyle}>10:45 AM</p>
                    <p className="text-[9px]" style={currentMutedStyle}>Analog Clock Face</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Master Reset All Button */}
      <button
        type="button"
        onClick={handleResetAll}
        className="w-full py-2.5 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white text-xs font-medium rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
      >
        <RotateCcw size={13} />
        Reset All Glass Styling to Default
      </button>
    </div>
  );
};

GlassThemeControls.propTypes = {
  uid: PropTypes.string,
  defaultActivePart: PropTypes.string,
};

export default GlassThemeControls;
