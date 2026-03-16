import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Check, X, StickyNote, CheckSquare, Edit3 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  initializeUserData,
  subscribeToUserData,
  updateUserData
} from '../services/databaseService';
import { getCachedUserData } from '../utils/cacheService';

const NotesModal = ({ isOpen, onClose }) => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('todos');
  const [todos, setTodos] = useState([]);
  const [notes, setNotes] = useState([]);
  const [newTodo, setNewTodo] = useState('');
  const [newNote, setNewNote] = useState({ title: '', content: '' });

  useEffect(() => {
    if (!currentUser || !isOpen) return;

    // Load cached data immediately
    const cachedData = getCachedUserData(currentUser.uid);
    if (cachedData) {
      setTodos(cachedData.todos || []);
      setNotes(cachedData.notes || []);
    }

    // Subscribe to real-time updates
    initializeUserData(currentUser.uid);
    const unsubscribe = subscribeToUserData(currentUser.uid, (userData) => {
      if (userData) {
        setTodos(userData.todos || []);
        setNotes(userData.notes || []);
      }
    });

    return () => unsubscribe();
  }, [currentUser, isOpen]);

  const persist = async (partial) => {
    if (!currentUser) return;
    try {
      await updateUserData(currentUser.uid, partial);
    } catch (e) {
      console.error('Failed to update notes/todos:', e);
    }
  };

  const addTodo = () => {
    if (!currentUser || !newTodo.trim()) return;

    const updatedTodos = [
      ...todos,
      {
        id: Date.now(),
        text: newTodo,
        completed: false,
        createdAt: new Date().toISOString()
      }
    ];

    setTodos(updatedTodos);
    persist({ todos: updatedTodos });
    setNewTodo('');
  };

  const toggleTodo = (id) => {
    if (!currentUser) return;
    const updatedTodos = todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    );
    setTodos(updatedTodos);
    persist({ todos: updatedTodos });
  };

  const deleteTodo = (id) => {
    if (!currentUser) return;
    const updatedTodos = todos.filter(todo => todo.id !== id);
    setTodos(updatedTodos);
    persist({ todos: updatedTodos });
  };

  const addNote = () => {
    if (!currentUser || !newNote.title.trim() || !newNote.content.trim()) return;

    const updatedNotes = [
      ...notes,
      {
        id: Date.now(),
        title: newNote.title,
        content: newNote.content,
        createdAt: new Date().toISOString(),
        color: `hsl(${Math.random() * 360}, 70%, 95%)`
      }
    ];

    setNotes(updatedNotes);
    persist({ notes: updatedNotes });
    setNewNote({ title: '', content: '' });
  };

  const deleteNote = (id) => {
    if (!currentUser) return;
    const updatedNotes = notes.filter(note => note.id !== id);
    setNotes(updatedNotes);
    persist({ notes: updatedNotes });
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
      <div className="relative w-full max-w-2xl max-h-[80vh] dark-glass rounded-2xl overflow-hidden border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-2xl font-bold text-white flex items-center">
            <Edit3 size={24} className="mr-3 text-blue-400" />
            Quick Notes
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          <button
            onClick={() => setActiveTab('todos')}
            className={`flex-1 py-3 px-4 font-medium transition-all duration-200 ${activeTab === 'todos'
                ? 'text-white bg-white/10 border-b-2 border-blue-400'
                : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
          >
            <CheckSquare size={18} className="inline mr-2" />
            Todos ({todos.length})
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`flex-1 py-3 px-4 font-medium transition-all duration-200 ${activeTab === 'notes'
                ? 'text-white bg-white/10 border-b-2 border-purple-400'
                : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
          >
            <StickyNote size={18} className="inline mr-2" />
            Notes ({notes.length})
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[50vh]">
          {activeTab === 'todos' ? (
            <div className="space-y-4">
              {/* Add Todo */}
              <div className="flex space-x-3">
                <input
                  type="text"
                  value={newTodo}
                  onChange={(e) => setNewTodo(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addTodo()}
                  placeholder="Add a new todo..."
                  className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-white/40"
                />
                <button
                  onClick={addTodo}
                  className="px-4 py-3 bg-blue-500/80 hover:bg-blue-500 text-white rounded-lg transition-colors"
                >
                  <Plus size={20} />
                </button>
              </div>

              {/* Todo List */}
              <div className="space-y-2">
                {todos.map(todo => (
                  <div
                    key={todo.id}
                    className="flex items-center space-x-3 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <button
                      onClick={() => toggleTodo(todo.id)}
                      className={`shrink-0 w-5 h-5 rounded border-2 transition-colors ${todo.completed
                          ? 'bg-blue-500 border-blue-500'
                          : 'border-white/30 hover:border-white/50'
                        }`}
                    >
                      {todo.completed && <Check size={14} className="text-white" />}
                    </button>
                    <span
                      className={`flex-1 text-base ${todo.completed ? 'text-white/50 line-through' : 'text-white'
                        }`}
                    >
                      {todo.text}
                    </span>
                    <button
                      onClick={() => deleteTodo(todo.id)}
                      className="opacity-0 group-hover:opacity-100 p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {todos.length === 0 && (
                  <div className="text-center py-8 text-white/40">
                    <CheckSquare size={48} className="mx-auto mb-4 opacity-30" />
                    <p className="text-lg">No todos yet</p>
                    <p className="text-sm mt-1">Add your first todo to get started</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Add Note */}
              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <input
                  type="text"
                  value={newNote.title}
                  onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                  placeholder="Note title..."
                  className="w-full mb-3 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-white/40"
                />
                <textarea
                  value={newNote.content}
                  onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                  placeholder="Note content..."
                  className="w-full mb-3 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-white/40 resize-none"
                  rows={3}
                />
                <button
                  onClick={addNote}
                  className="w-full py-2 bg-purple-500/80 hover:bg-purple-500 text-white rounded-lg transition-colors"
                >
                  <Plus size={16} className="inline mr-2" />
                  Add Note
                </button>
              </div>

              {/* Notes List */}
              <div className="space-y-3">
                {notes.map(note => (
                  <div
                    key={note.id}
                    className="p-4 rounded-lg border border-white/10 hover:border-white/20 transition-all duration-200 group"
                    style={{ backgroundColor: note.color || 'rgba(255,255,255,0.05)' }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-semibold text-lg mb-2">{note.title}</h4>
                        <p className="text-white/80 text-sm whitespace-pre-wrap">{note.content}</p>
                      </div>
                      <button
                        onClick={() => deleteNote(note.id)}
                        className="opacity-0 group-hover:opacity-100 p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-all shrink-0 ml-3"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                {notes.length === 0 && (
                  <div className="text-center py-8 text-white/40">
                    <StickyNote size={48} className="mx-auto mb-4 opacity-30" />
                    <p className="text-lg">No notes yet</p>
                    <p className="text-sm mt-1">Create your first note to get started</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotesModal;
