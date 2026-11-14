import React, { useState, useEffect } from 'react';
import { Edit3, StickyNote } from 'lucide-react';
import NotesModal from './NotesModal';

const NotesButton = () => {
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
        style={{ zIndex: 90 }}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-full shadow-2xl hover:shadow-blue-500/30 transition-all duration-200 flex items-center justify-center group cursor-pointer border border-white/20 hover:scale-105 pointer-events-auto"
        title="Quick Notes & Todos"
      >
        <Edit3 size={22} />
        <div className="absolute bottom-full mb-2 right-0 bg-black/85 text-white text-xs px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none border border-white/10 shadow-lg backdrop-blur-xs">
          <div className="flex items-center space-x-1.5">
            <StickyNote size={13} className="text-yellow-400" />
            <span>Notes & Todos</span>
          </div>
        </div>
      </button>

      <NotesModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};

export default NotesButton;
