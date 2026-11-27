import { useEffect, useState, useSyncExternalStore } from 'react';
import localWallpaper from '../assets/wallpaper-default.webp';

const key = 'glasstab_daily_wallpaper';
const modes = { personal: 'My wallpaper', photo: 'Daily photo', motion: 'Daily motion' };
const landscapes = [
  ['Alpine peaks', '1464822759023-fed622ff2c3b'],
  ['Forest light', '1448375240586-882707db888b'],
  ['Mountain lake', '1470770841072-f978cf4d019e'],
  ['Open water', '1507525428034-b723cf961d3e'],
  ['Woodland', '1473448912268-2022ce9509d8'],
  ['Night sky', '1462331940025-496dfbfc7564'],
  ['Highlands', '1472396961693-142e6e269027'],
];
function subscribe(update) {
  window.addEventListener('storage', update);
  window.addEventListener(key, update);
  return () => { window.removeEventListener('storage', update); window.removeEventListener(key, update); };
}
export function setWallpaperMode(mode) {
  localStorage.setItem(key, mode);
  window.dispatchEvent(new Event(key));
}
export function useWallpaperMode() {
  return useSyncExternalStore(subscribe, () => {
    const mode = localStorage.getItem(key);
    return Object.hasOwn(modes, mode) ? mode : 'personal';
  });
}
export function WallpaperChoices() {
  const mode = useWallpaperMode();
  return <div role="group" aria-label="Wallpaper rotation" className="grid grid-cols-3 gap-2">
    {Object.entries(modes).map(([id, label]) => <button type="button" key={id} aria-pressed={mode === id}
      onClick={() => setWallpaperMode(id)}
      className={'rounded-xl border p-2 text-sm ' + (mode === id ? 'bg-sky-400/15 border-sky-400 text-sky-100' : 'border-white/15 text-slate-300 hover:bg-white/10')}>{label}</button>)}
  </div>;
}
export function localDay(date = new Date()) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
}
export function useLocalDay() {
  const [day, setDay] = useState(localDay);
  useEffect(() => {
    let timer;
    function update() {
      clearTimeout(timer);
      const now = new Date();
      setDay(localDay(now));
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      timer = setTimeout(update, midnight - now + 50);
    }
    update();
    document.addEventListener('visibilitychange', update);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', update); };
  }, []);
  return day;
}
export function DailyWallpaper({ mode, still }) {
  const day = useLocalDay();
  const [name, photo] = landscapes[day % landscapes.length];
  const [visible, setVisible] = useState(!document.hidden);
  useEffect(() => {
    const change = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', change);
    return () => document.removeEventListener('visibilitychange', change);
  }, []);
  return <div className="wallpaper-container daily-landscape" aria-hidden="true" data-scene={name}
    data-motion={mode === 'motion' && !still} style={{ backgroundImage: 'url(' + localWallpaper + ')', '--play': visible ? 'running' : 'paused' }}>
    <img key={photo} alt="" src={'https://images.unsplash.com/photo-' + photo + '?auto=format&fit=crop&w=1920&q=80'}
      onError={event => { event.currentTarget.hidden = true; }} />
    {mode === 'motion' && !still && <div className="landscape-light" style={{ '--hue': (day * 47) % 360 }} />}
  </div>;
}
