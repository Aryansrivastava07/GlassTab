import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { signInWithGoogle, logout } from '../services/authService';
import Sidebar from './Sidebar';

const Navbar = () => {
  const { currentUser } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <>
      <nav className="z-50 p-4">
        <div className="flex items-center justify-end">
          {currentUser ? (
            <button
              onClick={toggleSidebar}
              className="relative group"
            >
              <img
                src={currentUser.photoURL}
                alt="User avatar"
                className="w-12 h-12 rounded-full border-2 border-white shadow-lg transition-transform duration-200 group-hover:scale-110"
              />
              <div className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-20 transition-opacity duration-200"></div>
            </button>
          ) : (
            <button
              onClick={handleLogin}
              className="bg-linear-to-r from-purple-500 to-indigo-600 text-white px-6 py-2 rounded-full font-medium hover:from-purple-600 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Login with Google
            </button>
          )}
        </div>
      </nav>

      <Sidebar
        isOpen={isSidebarOpen}
        onClose={toggleSidebar}
        currentUser={currentUser}
        onLogout={handleLogout}
      />
    </>
  );
};

export default Navbar;
