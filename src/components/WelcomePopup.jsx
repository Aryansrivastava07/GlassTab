import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Compass, FolderOpen, Sparkles, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import useDialogFocus from '../hooks/useDialogFocus';
import { WallpaperChoices } from './DailyWallpaper';
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
  return createPortal(<div className="fixed inset-0 z-[100005] grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
    <div ref={ref} role="dialog" aria-modal="true" aria-label="GlassTab quick start" tabIndex={-1}
      className="max-h-[92dvh] w-full max-w-md overflow-auto rounded-3xl border border-sky-200/20 bg-[#101722] p-6 text-white shadow-2xl">
      <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-sm font-semibold text-sky-200"><Compass size={18}/> GlassTab quick start</span>
        <button aria-label="Skip quick start" onClick={() => finish()} className="rounded-lg p-2 hover:bg-white/10"><X size={18}/></button></div>
      <nav aria-label="Quick start steps" className="my-5 flex gap-2">
        {steps.map((label, i) => <button key={label} onClick={() => setStep(i)} aria-current={step === i ? 'step' : undefined}
          className={'flex-1 border-b-2 pb-2 text-xs ' + (step === i ? 'border-sky-300 text-white' : 'border-white/10 text-slate-400')}>{label}</button>)}
      </nav>
      {step === 0 && <>
        <h2 className="text-2xl font-semibold">Give your everyday sites a home</h2>
        <p className="my-3 text-sm leading-relaxed text-slate-300">Open a tile to visit a site. Drag one shortcut onto another to name a folder, or use Organize to group several at once.</p>
        {shortcutsEnabled && <button className="flex items-center gap-2 rounded-xl bg-white/10 p-3 text-sm" onClick={() => finish(() => window.dispatchEvent(new Event('glasstab_organize_dials')))}><FolderOpen size={17}/> Organize my shortcuts</button>}
        <p className="mt-4 text-xs text-slate-400">Search from the dashboard with /, or type “y ” before a search to find a video.</p>
      </>}
      {step === 1 && <>
        <h2 className="text-2xl font-semibold">Choose what you open tomorrow</h2>
        <p className="my-3 text-sm leading-relaxed text-slate-300">Keep your wallpaper, rotate through Unsplash landscapes, or add slow camera movement and drifting light. Daily scenes change at local midnight.</p>
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
        <button onClick={() => step === 2 ? finish() : setStep(step + 1)} className="rounded-full bg-sky-300 px-5 py-2 text-sm font-semibold text-slate-950">{step === 2 ? 'Open dashboard' : 'Continue'}</button>
      </div>
    </div>
  </div>, document.body);
}
