// Network status monitoring utility
import { useState, useEffect } from 'react';

class NetworkMonitor {
    constructor() {
        this.isOnline = navigator.onLine;
        this.listeners = [];
        this.setupEventListeners();
    }

    setupEventListeners() {
        window.addEventListener('online', this.handleOnline.bind(this));
        window.addEventListener('offline', this.handleOffline.bind(this));
    }

    handleOnline() {
        this.isOnline = true;
        console.log('🌐 Network connection restored');
        this.notifyListeners();
    }

    handleOffline() {
        this.isOnline = false;
        console.log('📱 Network connection lost');
        this.notifyListeners();
    }

    addListener(callback) {
        this.listeners.push(callback);
        // Call immediately with current status
        callback(this.isOnline);
    }

    removeListener(callback) {
        this.listeners = this.listeners.filter(listener => listener !== callback);
    }

    notifyListeners() {
        this.listeners.forEach(callback => callback(this.isOnline));
    }

    getStatus() {
        return this.isOnline;
    }

    // Firebase-specific network monitoring
    monitorFirebaseConnection(db) {
        if (db && typeof db._uninitialized === 'undefined') {
            // Monitor Firestore connection state
            const unsubscribe = db.onSnapshot(() => { }, (error) => {
                if (error.code === 'unavailable') {
                    console.log('🔥 Firestore connection lost');
                    this.isOnline = false;
                    this.notifyListeners();
                }
            });

            return unsubscribe;
        }
    }

    cleanup() {
        window.removeEventListener('online', this.handleOnline.bind(this));
        window.removeEventListener('offline', this.handleOffline.bind(this));
        this.listeners = [];
    }
}

// Create singleton instance
const networkMonitor = new NetworkMonitor();

// Export for use in components
export default networkMonitor;

// Hook for React components
export const useNetworkStatus = () => {
    const [isOnline, setIsOnline] = useState(networkMonitor.getStatus());

    useEffect(() => {
        const handleNetworkChange = (online) => {
            setIsOnline(online);
        };

        networkMonitor.addListener(handleNetworkChange);

        return () => {
            networkMonitor.removeListener(handleNetworkChange);
        };
    }, []);

    return isOnline;
};
