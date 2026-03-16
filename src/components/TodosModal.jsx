import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Check, X, CheckSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  initializeUserData,
  subscribeToUserData,
  updateUserData
} from '../services/databaseService';
import { getCachedUserData } from '../utils/cacheService';

const TodosModal = ({ isOpen, onClose }) => {
  const { currentUser } = useAuth();
  const [todos, setTodos] = useState([]);
  const [newTodo, setNewTodo] = useState('');

  const persistTodos = async (nextTodos) => {
    if (!currentUser) return;
    try {
      await updateUserData(currentUser.uid, { todos: nextTodos });
    } catch (e) {
      console.error('Failed to update todos:', e);
    }
  };

  useEffect(() => {
    if (!currentUser || !isOpen) return;

    // Load cached data immediately
    const cachedData = getCachedUserData(currentUser.uid);
    if (cachedData) {
      setTodos(cachedData.todos || []);
    }

    // Subscribe to real-time updates
    initializeUserData(currentUser.uid);
    const unsubscribe = subscribeToUserData(currentUser.uid, (userData) => {
      if (userData) {
        setTodos(userData.todos || []);
      }
    });

    return () => unsubscribe();
  }, [currentUser, isOpen]);

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
    persistTodos(updatedTodos);
    setNewTodo('');
  };

  const toggleTodo = (id) => {
    if (!currentUser) return;
    const updatedTodos = todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    );
    setTodos(updatedTodos);
    persistTodos(updatedTodos);
  };

  const deleteTodo = (id) => {
    if (!currentUser) return;
    const updatedTodos = todos.filter(todo => todo.id !== id);
    setTodos(updatedTodos);
    persistTodos(updatedTodos);
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
      <div className="relative w-full max-w-lg dark-glass rounded-2xl overflow-hidden border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-2xl font-bold text-white flex items-center">
            <CheckSquare size={24} className="mr-3 text-blue-400" />
            Todos
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Add Todo */}
          <div className="flex space-x-3 mb-6">
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
                className="flex items-center space-x-3 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors group"
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
      </div>
    </div>
  );
};

export default TodosModal;
