import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Check, X, StickyNote, CheckSquare, GripVertical } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  initializeUserData,
  subscribeToUserData
} from '../services/databaseService';
import { getCachedUserData, setCachedData } from '../utils/cacheService';

const NotesWidget = () => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('todos');
  const [todos, setTodos] = useState([]);
  const [notes, setNotes] = useState([]);
  const [newTodo, setNewTodo] = useState('');
  const [newNote, setNewNote] = useState({ title: '', content: '' });
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 20 });

  useEffect(() => {
    if (!currentUser) return;

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
  }, [currentUser]);

  const saveToFirebase = async (updatedData) => {
    if (!currentUser) return;

    try {
      // Update cache first for immediate UI feedback
      setCachedData(`landing_page_cache_user_data_${currentUser.uid}`, updatedData);

      // Then update in Firebase (you'll need to implement this in databaseService)
      // For now, we'll just use the cache
    } catch (error) {
      console.error('Error saving to Firebase:', error);
    }
  };

  const addTodo = () => {
    if (!newTodo.trim()) return;

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
    saveToFirebase({ todos: updatedTodos, notes });
    setNewTodo('');
  };

  const toggleTodo = (id) => {
    const updatedTodos = todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    );
    setTodos(updatedTodos);
    saveToFirebase({ todos: updatedTodos, notes });
  };

  const deleteTodo = (id) => {
    const updatedTodos = todos.filter(todo => todo.id !== id);
    setTodos(updatedTodos);
    saveToFirebase({ todos: updatedTodos, notes });
  };

  const addNote = () => {
    if (!newNote.title.trim() || !newNote.content.trim()) return;

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
    saveToFirebase({ todos, notes: updatedNotes });
    setNewNote({ title: '', content: '' });
  };

  const deleteNote = (id) => {
    const updatedNotes = notes.filter(note => note.id !== id);
    setNotes(updatedNotes);
    saveToFirebase({ todos, notes: updatedNotes });
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    const startX = e.clientX - position.x;
    const startY = e.clientY - position.y;

    const handleMouseMove = (e) => {
      if (!isDragging) return;

      const newX = e.clientX - startX;
      const newY = e.clientY - startY;

      // Snap to edges with magnetic effect
      const snapDistance = 20;
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;

      let finalX = newX;
      let finalY = newY;

      // Snap to left edge
      if (newX < snapDistance) finalX = 0;
      // Snap to right edge
      if (newX > windowWidth - 320 - snapDistance) finalX = windowWidth - 320;

      // Snap to top edge
      if (newY < snapDistance) finalY = 0;
      // Snap to bottom edge
      if (newY > windowHeight - 400 - snapDistance) finalY = windowHeight - 400;

      setPosition({ x: finalX, y: finalY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  if (!currentUser) return null;

  return (
    <div className="w-full max-w-4xl mb-8">
      <div className="dark-glass rounded-2xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <h3 className="text-white font-semibold text-sm">Quick Notes</h3>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-white/60 hover:text-white transition-colors"
          >
            {isExpanded ? <X size={16} /> : <Plus size={16} />}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          <button
            onClick={() => setActiveTab('todos')}
            className={`flex-1 py-2 px-3 text-xs font-medium transition-all duration-200 ${activeTab === 'todos'
                ? 'text-white bg-white/10 border-b-2 border-blue-400'
                : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
          >
            <CheckSquare size={14} className="inline mr-1" />
            Todos
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`flex-1 py-2 px-3 text-xs font-medium transition-all duration-200 ${activeTab === 'notes'
                ? 'text-white bg-white/10 border-b-2 border-purple-400'
                : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
          >
            <StickyNote size={14} className="inline mr-1" />
            Notes
          </button>
        </div>

        {/* Content */}
        <div className={`${isExpanded ? 'max-h-96' : 'max-h-64'} overflow-y-auto mt-4`}>
          {activeTab === 'todos' ? (
            <div>
              {/* Add Todo */}
              <div className="flex space-x-2 mb-3">
                <input
                  type="text"
                  value={newTodo}
                  onChange={(e) => setNewTodo(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addTodo()}
                  placeholder="Add a todo..."
                  className="flex-1 px-2 py-1 bg-white/10 border border-white/20 rounded text-white placeholder-white/50 text-sm focus:outline-none focus:border-white/40"
                />
                <button
                  onClick={addTodo}
                  className="p-1 bg-blue-500/80 hover:bg-blue-500 text-white rounded transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>

              {/* Todo List */}
              <div className="space-y-1">
                {todos.map(todo => (
                  <div
                    key={todo.id}
                    className="flex items-center space-x-2 p-2 bg-white/5 rounded-lg group hover:bg-white/10 transition-colors"
                  >
                    <button
                      onClick={() => toggleTodo(todo.id)}
                      className={`shrink-0 w-4 h-4 rounded border-2 transition-colors ${todo.completed
                          ? 'bg-blue-500 border-blue-500'
                          : 'border-white/30 hover:border-white/50'
                        }`}
                    >
                      {todo.completed && <Check size={12} className="text-white" />}
                    </button>
                    <span
                      className={`flex-1 text-sm ${todo.completed ? 'text-white/50 line-through' : 'text-white'
                        }`}
                    >
                      {todo.text}
                    </span>
                    <button
                      onClick={() => deleteTodo(todo.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:bg-red-500/20 rounded transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                {todos.length === 0 && (
                  <p className="text-center text-white/40 text-sm py-4">No todos yet</p>
                )}
              </div>
            </div>
          ) : (
            <div>
              {/* Add Note */}
              {isExpanded && (
                <div className="mb-3 p-2 bg-white/5 rounded-lg">
                  <input
                    type="text"
                    value={newNote.title}
                    onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                    placeholder="Note title..."
                    className="w-full mb-2 px-2 py-1 bg-white/10 border border-white/20 rounded text-white placeholder-white/50 text-sm focus:outline-none focus:border-white/40"
                  />
                  <textarea
                    value={newNote.content}
                    onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                    placeholder="Note content..."
                    className="w-full mb-2 px-2 py-1 bg-white/10 border border-white/20 rounded text-white placeholder-white/50 text-sm focus:outline-none focus:border-white/40 resize-none"
                    rows={2}
                  />
                  <button
                    onClick={addNote}
                    className="w-full py-1 bg-purple-500/80 hover:bg-purple-500 text-white rounded text-sm transition-colors"
                  >
                    Add Note
                  </button>
                </div>
              )}

              {/* Notes List */}
              <div className="space-y-2">
                {notes.map(note => (
                  <div
                    key={note.id}
                    className="p-2 rounded-lg border border-white/10 hover:border-white/20 transition-all duration-200 group"
                    style={{ backgroundColor: note.color || 'rgba(255,255,255,0.05)' }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-medium text-sm truncate">{note.title}</h4>
                        <p className="text-white/70 text-xs mt-1 line-clamp-2">{note.content}</p>
                      </div>
                      <button
                        onClick={() => deleteNote(note.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:bg-red-500/20 rounded transition-all shrink-0 ml-2"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
                {notes.length === 0 && (
                  <p className="text-center text-white/40 text-sm py-4">
                    {isExpanded ? 'No notes yet. Create your first note!' : 'Expand to add notes'}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotesWidget;
