import React, { useState, useEffect } from 'react';

const ToastNotification = ({ message, type = 'info', duration = 3000, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for animation to complete
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      default: return 'ℹ️';
    }
  };

  const getColors = () => {
    switch (type) {
      case 'success': 
        return 'bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200';
      case 'error': 
        return 'bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200';
      case 'warning': 
        return 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200';
      default: 
        return 'bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200';
    }
  };

  return (
    <div className={`
      fixed top-4 right-4 z-50 max-w-sm p-4 border rounded-lg shadow-lg backdrop-blur-sm
      transition-all duration-300 transform
      ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      ${getColors()}
    `}>
      <div className="flex items-center space-x-3">
        <span className="text-lg">{getIcon()}</span>
        <p className="text-sm font-medium">{message}</p>
        <button
          onClick={() => {
            setIsVisible(false);
            setTimeout(onClose, 300);
          }}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default ToastNotification;