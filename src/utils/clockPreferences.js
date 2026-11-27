import { useSyncExternalStore } from 'react';

const key = 'glasstab_clock_v1';
export const faces = { classic: 'Classic glass', station: 'Railway', roman: 'Roman', digital: 'Digital' };
const defaults = { face: 'classic', zone: '', seconds: true, date: false, hour24: false };
let cachedRaw, cachedValue = defaults;

function read() {
  let raw;
  try { raw = localStorage.getItem(key); } catch { return cachedValue; }
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  try {
    const stored = JSON.parse(raw) || {};
    let zone = typeof stored.zone === 'string' ? stored.zone : '';
    try { if (zone) new Intl.DateTimeFormat('en', { timeZone: zone }); } catch { zone = ''; }
    cachedValue = {
      face: Object.hasOwn(faces, stored.face) ? stored.face : defaults.face,
      zone, seconds: stored.seconds !== false, date: stored.date === true, hour24: stored.hour24 === true,
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
