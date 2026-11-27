import { useState, useSyncExternalStore } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocalDay } from './DailyWallpaper';

function subscribe(update) {
  window.addEventListener('storage', update);
  window.addEventListener('glasstab_focus_changed', update);
  return () => { window.removeEventListener('storage', update); window.removeEventListener('glasstab_focus_changed', update); };
}
export function useDailyFocus() {
  const { currentUser } = useAuth();
  const day = useLocalDay();
  const key = 'glasstab_focus_' + (currentUser?.uid || 'local_guest');
  const raw = useSyncExternalStore(subscribe, () => localStorage.getItem(key));
  let saved;
  try { saved = JSON.parse(raw); } catch { /* Start with an empty focus. */ }
  function save(value) {
    localStorage.setItem(key, JSON.stringify({ day, ...value }));
    window.dispatchEvent(new Event('glasstab_focus_changed'));
  }
  return { goal: saved?.day === day ? saved : null, save };
}
export default function DailyFocus() {
  const { goal, save } = useDailyFocus();
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  return <section className="rounded-xl border border-sky-300/20 bg-sky-400/5 p-3 text-sm text-white">
    <h3 className="mb-2 font-semibold">Today’s focus</h3>
    {goal?.text && !editing ? <div className="flex items-center gap-3">
      <label className="flex flex-1 items-center gap-2 break-all"><input type="checkbox" checked={goal.done} onChange={e => save({ ...goal, done: e.target.checked })} />
        <span className={goal.done ? 'line-through opacity-60' : ''}>{goal.text}</span></label>
      <button type="button" className="text-sky-300" onClick={() => { setDraft(goal.text); setEditing(true); }}>Edit</button>
    </div> : <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (draft.trim()) { save({ text: draft.trim(), done: false }); setDraft(''); setEditing(false); } }}>
      <input aria-label="Today's focus" maxLength={120} placeholder="One thing you want to finish" value={draft} onChange={e => setDraft(e.target.value)} className="min-w-0 flex-1 rounded-lg bg-black/30 px-2 py-2" />
      <button disabled={!draft.trim()} className="text-sky-300 disabled:opacity-40">Save</button>
    </form>}
  </section>;
}
