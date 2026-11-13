import React, { useState, useEffect } from 'react';
import { Plus, Trash2, X, StickyNote, MapPin } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  initializeUserData,
  subscribeToUserData,
  updateUserData
} from '../services/databaseService';
import { getCachedUserData } from '../utils/cacheService';

const NotesOnlyModal = ({ isOpen, onClose }) => {
  const { currentUser } = useAuth();
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState({ title: '', content: '' });

  const persistNotes = async (nextNotes) => {
    if (!currentUser) return;
    try {
      await updateUserData(currentUser.uid, { notes: nextNotes });
    } catch (e) {
      console.error('Failed to update notes:', e);
    }
  };

  useEffect(() => {
    if (!currentUser || !isOpen) return;

    // Load cached data immediately
    const cachedData = getCachedUserData(currentUser.uid);
    if (cachedData) {
      setNotes(cachedData.notes || []);
    }

    // Subscribe to real-time updates
    initializeUserData(currentUser.uid);
    const unsubscribe = subscribeToUserData(currentUser.uid, (userData) => {
      if (userData) {
        setNotes(userData.notes || []);
      }
    });

    return () => unsubscribe();
  }, [currentUser, isOpen]);

  const addNote = () => {
    if (!currentUser || !newNote.title.trim() || !newNote.content.trim()) return;

    const updatedNotes = [
      ...notes,
      {
        id: Date.now(),
        title: newNote.title,
        content: newNote.content,
        createdAt: new Date().toISOString(),
        color: getRandomColor()
      }
    ];

    setNotes(updatedNotes);
    persistNotes(updatedNotes);
    setNewNote({ title: '', content: '' });
  };

  const deleteNote = async (id) => {
    if (!currentUser) return;
    const updatedNotes = notes.filter(note => note.id !== id);
    setNotes(updatedNotes);
    await persistNotes(updatedNotes);
  };

  const getRandomColor = () => {
    const colors = ['#38bdf8', '#34d399', '#a78bfa', '#fbbf24', '#fb7185', '#94a3b8'];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  if (!isOpen || !currentUser) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-6xl max-h-[90vh] bg-gray-800 rounded-lg overflow-hidden border border-gray-600">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-gray-700 border-b border-gray-600">
          <h2 className="text-xl font-bold text-white flex items-center">
            <StickyNote size={20} className="mr-2 text-yellow-400" />
            Sticky Notes
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-300 hover:text-white hover:bg-gray-600 rounded transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[70vh] bg-gray-800">
          {/* Add Note Section */}
          <div className="mb-6 p-4 bg-gray-700 rounded-lg border border-gray-600">
            <h3 className="text-white font-semibold mb-3">Create New Note</h3>
            <input
              type="text"
              value={newNote.title}
              onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
              placeholder="Note title..."
              className="w-full mb-3 px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
            <textarea
              value={newNote.content}
              onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
              placeholder="Note content..."
              className="w-full mb-3 px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-none"
              rows={3}
            />
            <button
              onClick={addNote}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
            >
              <Plus size={16} className="inline mr-2" />
              Add Note
            </button>
          </div>

          {/* Sticky Notes Grid */}
          {notes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {notes.map(note => (
                <div
                  key={note.id}
                  className="relative group"
                  style={{ minHeight: '200px' }}
                >
                  {/* Modern Glass Note */}
                  <div
                    className="w-full h-full p-4 rounded-xl shadow-lg border border-white/10 transition-all duration-200 hover:shadow-xl bg-slate-900/90 backdrop-blur-md relative overflow-hidden"
                    style={{
                      borderLeftWidth: '4px',
                      borderLeftColor: note.color || '#38bdf8',
                      backgroundImage: `linear-gradient(135deg, ${note.color ? `${note.color}15` : 'rgba(56, 189, 248, 0.1)'} 0%, rgba(15, 23, 42, 0.7) 100%)`
                    }}
                  >
                    {/* Delete Button */}
                    <button
                      onClick={() => deleteNote(note.id)}
                      className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 p-1.5 text-white/50 hover:text-red-400 hover:bg-red-500/15 rounded-lg transition-all cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>

                    {/* Content */}
                    <div>
                      <h4 className="font-semibold text-white text-sm mb-2 pr-6">
                        {note.title}
                      </h4>
                      <p className="text-slate-200/90 text-xs whitespace-pre-wrap leading-relaxed">
                        {note.content}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <StickyNote size={48} className="mx-auto mb-4 opacity-50" />
              <p className="text-lg">No sticky notes yet</p>
              <p className="text-sm mt-1">Create your first sticky note to get started</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotesOnlyModal;
