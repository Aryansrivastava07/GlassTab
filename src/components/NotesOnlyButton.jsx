import React, { useState } from 'react';
import { StickyNote } from 'lucide-react';
import NotesOnlyModal from './NotesOnlyModal';

const NotesOnlyButton = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-6 right-24 w-14 h-14 bg-purple-500 hover:bg-purple-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group"
      >
        <StickyNote size={24} />
        <div className="absolute bottom-full mb-2 right-0 bg-black/80 text-white text-sm px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
          Notes
        </div>
      </button>

      <NotesOnlyModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};

export default NotesOnlyButton;
