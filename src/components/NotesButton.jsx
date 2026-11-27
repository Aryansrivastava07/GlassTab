import { useState, useEffect, lazy, Suspense } from 'react';
import { Edit3, StickyNote } from 'lucide-react';
import { useDailyFocus } from './DailyFocus';
const NotesModal = lazy(() => import('./NotesModal'));

const NotesButton = () => {
  const { goal } = useDailyFocus();
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const handleOpen = () => setIsModalOpen(true);
    window.addEventListener('openNotesModal', handleOpen);
    return () => window.removeEventListener('openNotesModal', handleOpen);
  }, []);

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        style={{ zIndex: 40 }}
        className={'fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-full shadow-2xl hover:shadow-blue-500/30 transition-all duration-200 flex items-center justify-center group cursor-pointer border border-white/20 hover:scale-105 pointer-events-auto ' + (goal?.text ? 'md:w-auto md:max-w-[25vw] md:gap-2 md:px-4' : '')}
        title="Quick Notes & Todos"
      >
        <Edit3 size={22} />
        {goal?.text && <span className="hidden min-w-0 text-left md:block"><small className="block text-blue-100">Today’s focus</small>
          <span className={'block truncate text-sm ' + (goal.done ? 'line-through' : '')}>{goal.text}</span></span>}
        <div className="absolute bottom-full mb-2 right-0 bg-black/85 text-white text-xs px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none border border-white/10 shadow-lg backdrop-blur-xs">
          <div className="flex items-center space-x-1.5">
            <StickyNote size={13} className="text-yellow-400" />
            <span>Notes & Todos</span>
          </div>
        </div>
      </button>

      {isModalOpen && <Suspense fallback={<div className="loading-panel" role="status">Loading notes…</div>}><NotesModal isOpen onClose={() => setIsModalOpen(false)} /></Suspense>}
    </>
  );
};

export default NotesButton;
