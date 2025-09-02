import { useEffect } from 'react';

const useKeyboardShortcuts = (shortcuts) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Construir la combinación de teclas
      const combination = [];
      
      if (e.ctrlKey) combination.push('ctrl');
      if (e.altKey) combination.push('alt');  
      if (e.shiftKey) combination.push('shift');
      if (e.metaKey) combination.push('meta');
      
      combination.push(e.key.toLowerCase());
      
      const keyCombo = combination.join('+');
      
      // Buscar y ejecutar el shortcut correspondiente
      const shortcut = shortcuts.find(s => s.keys === keyCombo);
      
      if (shortcut) {
        // Verificar si debemos prevenir el comportamiento por defecto
        if (shortcut.preventDefault !== false) {
          e.preventDefault();
        }
        
        // Verificar si debemos saltarnos campos de input/textarea
        if (shortcut.skipInputs !== false) {
          const activeElement = document.activeElement;
          const isInput = activeElement.tagName === 'INPUT' || 
                         activeElement.tagName === 'TEXTAREA' ||
                         activeElement.contentEditable === 'true';
          
          if (isInput && shortcut.allowInInputs !== true) {
            return;
          }
        }
        
        shortcut.action(e);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [shortcuts]);
};

export default useKeyboardShortcuts;