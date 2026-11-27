import { useSyncExternalStore } from 'react';

const key = 'glasstab_clock_v1';
export const faces = { classic: 'Classic glass', station: 'Railway', roman: 'Roman', digital: 'Digital' };
const defaults = { face: 'classic', zone: '', comparison: '', seconds: true, date: false, hour24: false };
function validZone(zone) {
  if (!zone || typeof zone !== 'string') return '';
  try { new Intl.DateTimeFormat('en', { timeZone: zone }); return zone; } catch { return ''; }
}
let cachedRaw, cachedValue = defaults;

function read() {
  let raw;
  try { raw = localStorage.getItem(key); } catch { return cachedValue; }
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  try {
    const stored = JSON.parse(raw) || {};
    cachedValue = {
      face: Object.hasOwn(faces, stored.face) ? stored.face : defaults.face,
      zone: validZone(stored.zone), comparison: validZone(stored.comparison),
      seconds: stored.seconds !== false, date: stored.date === true, hour24: stored.hour24 === true,
    };
  } catch { cachedValue = defaults; }
  return cachedValue;
}

function subscribe(update) {
  const onStorage = event => { if (!event.key || event.key === key) update(); };
  window.addEventListener('storage', onStorage);
  window.addEventListener(key, update);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(key, update);
  };
}

export function useClockPreferences() { return useSyncExternalStore(subscribe, read); }
export function setClockPreference(name, value) {
  localStorage.setItem(key, JSON.stringify({ ...read(), [name]: value }));
  window.dispatchEvent(new Event(key));
}
