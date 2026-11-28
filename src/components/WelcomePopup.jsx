import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Compass, FolderOpen, Sparkles, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import useDialogFocus from '../hooks/useDialogFocus';
import { WallpaperChoices } from './DailyWallpaper';
import './StudioEntry.css';
import DailyFocus from './DailyFocus';

const steps = ['Shortcuts', 'Wallpaper', 'Daily focus'];

export default function WelcomePopup({ openAi, shortcutsEnabled }) {
  const [open, setOpen] = useState(() => !localStorage.getItem('hasVisited'));
  const [step, setStep] = useState(0);
  const ref = useRef(null);
  function finish(action) {
    localStorage.setItem('hasVisited', 'true');
    setOpen(false);
    if (action) requestAnimationFrame(action);
  }
  useDialogFocus(ref, open, () => finish());
  useEffect(() => {
    const replay = () => { setStep(0); setOpen(true); };
    window.addEventListener('glasstab_show_welcome', replay);
    return () => window.removeEventListener('glasstab_show_welcome', replay);
  }, []);
  if (!open) return null;
  return createPortal(<div className="fixed inset-0 z-[100005] grid place-items-center bg-black/55 p-3 backdrop-blur-md">
    <div ref={ref} role="dialog" aria-modal="true" aria-label="GlassTab quick start" tabIndex={-1}
      className="entry-panel">
      <header className="entry-cover">
        <div className="entry-brand"><Compass size={18}/>GlassTab</div>
        <button className="entry-dismiss" aria-label="Skip quick start" onClick={() => finish()}><X size={17}/></button>
        <h1>Make this tab yours</h1>
      </header>
      <div className="entry-body">
      <nav aria-label="Quick start steps" className="entry-steps">
        {steps.map((label, i) => <button key={label} onClick={() => setStep(i)} aria-current={step === i ? 'step' : undefined}
          className="entry-step">{label}</button>)}
      </nav>
      {step === 0 && <>
        <h2 className="text-2xl font-semibold">Group your shortcuts</h2>
        <p className="mt-2 mb-4 text-sm leading-relaxed text-slate-300">Open a tile to visit a site. Drag one shortcut onto another to name a folder, or use Organize to group several at once.</p>
        {shortcutsEnabled && <button className="flex items-center gap-2 rounded-xl bg-white/10 p-3 text-sm" onClick={() => finish(() => window.dispatchEvent(new Event('glasstab_organize_dials')))}><FolderOpen size={17}/> Organize my shortcuts</button>}
        <p className="mt-4 text-xs text-slate-400">Search from the dashboard with /, or type “y ” before a search to find a video.</p>
      </>}
      {step === 1 && <>
        <h2 className="text-2xl font-semibold">Choose a wallpaper</h2>
        <p className="mt-2 mb-4 text-sm leading-relaxed text-slate-300">Keep your wallpaper, choose a daily landscape photo, or watch waves roll through an animated seascape. Daily scenes change at local midnight.</p>
        <WallpaperChoices />
        <p className="mt-4 text-xs text-slate-400">Change this in Settings → Wallpaper. Move and resize widgets in Settings → Widgets.</p>
      </>}
      {step === 2 && <>
        <h2 className="text-2xl font-semibold">What matters today?</h2>
        <p className="my-3 text-sm text-slate-300">Pick one priority. Find it again in Quick Notes &amp; Todos → Todos.</p>
        <DailyFocus />
        {openAi && <button onClick={() => finish(openAi)} className="mt-3 flex items-center gap-2 text-sm text-sky-300"><Sparkles size={15}/> Explore AI Studio</button>}
      </>}
      <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4">
        {step ? <button className="flex items-center gap-1 text-sm text-slate-300" onClick={() => setStep(step - 1)}><ArrowLeft size={14}/> Back</button>
          : <button className="text-sm text-slate-300" onClick={() => finish()}>Skip setup</button>}
        <button onClick={() => step === 2 ? finish() : setStep(step + 1)} className="entry-primary">{step === 2 ? 'Open dashboard' : 'Continue'}</button>
      </div>
      </div>
    </div>
  </div>, document.body);
}
