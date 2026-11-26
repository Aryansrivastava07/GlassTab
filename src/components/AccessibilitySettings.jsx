import { getStoredFeatures, toggleFeature } from '../utils/featureToggleService';
import { useEffect, useState } from 'react';

const OPTIONS = [
  ['highContrast', 'Higher contrast', 'Solid dark surfaces, brighter text, and clearer borders.'],
  ['largeText', 'Larger text', 'Increase text size and use a stacked layout so widgets have room to grow.'],
  ['simpleLayout', 'Simple layout', 'Stack widgets in a predictable reading order at any screen size. Your custom positions stay saved.'],
  ['reducedMotion', 'Reduce motion', 'Stop decorative animation and use still wallpaper. Your system motion preference is always respected.'],
  ['autoFocusSearch', 'Focus search on opening', 'Move focus to search when you open a new tab. Turn off to start navigation from the page.'],
  ['typeToSearch', 'Type anywhere to search', 'Single character shortcuts send typing to search. Turn off when using screen reader navigation.'],
];

export default function AccessibilitySettings() {
  const [features, setFeatures] = useState(getStoredFeatures);
  useEffect(() => {
    const update = () => setFeatures(getStoredFeatures());
    window.addEventListener('landing_features_updated', update);
    return () => window.removeEventListener('landing_features_updated', update);
  }, []);
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-300">Choose what makes this dashboard easier to read and navigate. Preferences are saved on this browser.</p>
      {OPTIONS.map(([key, title, description]) => (
        <label key={key} className="flex items-start gap-3 p-3 rounded-xl border border-white/20 bg-black/30 cursor-pointer">
          <input type="checkbox" checked={Boolean(features[key])} onChange={() => toggleFeature(key)} className="mt-1 w-5 h-5 shrink-0 accent-blue-500" />
          <span><span className="block text-sm font-semibold text-white">{title}</span><span className="block text-xs text-gray-300 mt-1 leading-relaxed">{description}</span></span>
        </label>
      ))}
      <div className="rounded-xl border border-white/20 p-4 space-y-2 text-sm text-gray-200">
        <h3 className="font-semibold text-white">Keyboard guide</h3>
        <p><kbd>Tab</kbd> / <kbd>Shift + Tab</kbd> move between controls. <kbd>Esc</kbd> closes the active panel.</p>
        <p><kbd>Alt + Z</kbd> toggles reading mode. Search suggestions use <kbd>↑</kbd> / <kbd>↓</kbd> and <kbd>Enter</kbd>; <kbd>Shift + Delete</kbd> removes a selected recent search.</p>
        <p>Enable widget movement in Widgets. Focus a Move control and use arrow keys to move, or <kbd>Shift + Arrow</kbd> to resize.</p>
        <p>Browser zoom remains available with <kbd>Ctrl/Cmd + +</kbd> and <kbd>Ctrl/Cmd + −</kbd>.</p>
      </div>
    </div>
  );
}
