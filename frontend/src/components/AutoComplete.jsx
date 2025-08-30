import React, { useState, useEffect } from 'react';

const AutoComplete = ({ value, onChange, onSuggestionSelect, darkMode = false }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);

  // Prompts comunes para informática
  const commonPrompts = [
    "¿Cómo puedo resolver un problema de red?",
    "¿Cuál es la diferencia entre SSD y HDD?",
    "Explícame qué es un firewall y cómo funciona",
    "¿Cómo optimizar el rendimiento de Windows?",
    "¿Qué es la virtualización y para qué sirve?",
    "¿Cómo hacer backup de datos importantes?",
    "¿Cuáles son las mejores prácticas de ciberseguridad?",
    "¿Cómo configurar una VPN?",
    "¿Qué es el DNS y cómo funciona?",
    "¿Cómo solucionar problemas de conexión a Internet?",
    "Explícame los tipos de malware más comunes",
    "¿Cómo elegir un buen antivirus?",
    "¿Qué es la computación en la nube?",
    "¿Cómo funciona el protocolo TCP/IP?",
    "¿Cuál es la diferencia entre RAM y almacenamiento?",
    "¿Cómo hacer una instalación limpia de Windows?",
    "¿Qué es un servidor y para qué sirve?",
    "¿Cómo configurar un router WiFi?",
    "¿Qué son los drivers y por qué son importantes?",
    "¿Cómo monitorear el rendimiento del sistema?"
  ];

  useEffect(() => {
    // Debounce para evitar demasiadas actualizaciones
    const timeoutId = setTimeout(() => {
      if (value.length > 2) {
        const filteredSuggestions = commonPrompts.filter(prompt =>
          prompt.toLowerCase().includes(value.toLowerCase())
        );
        setSuggestions(filteredSuggestions.slice(0, 5)); // Mostrar máximo 5 sugerencias
        setShowSuggestions(filteredSuggestions.length > 0);
      } else {
        setShowSuggestions(false);
        setSuggestions([]);
      }
      setActiveSuggestion(-1);
    }, 150); // Debounce de 150ms

    return () => clearTimeout(timeoutId);
  }, [value]);

  const handleSuggestionClick = (suggestion) => {
    onSuggestionSelect(suggestion);
    setShowSuggestions(false);
    setActiveSuggestion(-1);
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestion(prev => 
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestion(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Enter' && activeSuggestion >= 0) {
      e.preventDefault();
      handleSuggestionClick(suggestions[activeSuggestion]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setActiveSuggestion(-1);
    }
  };

  return (
    <div className="relative">
      <textarea
        rows="1"
        className="w-full border-0 bg-gray-100/80 dark:bg-gray-700/80 px-4 py-3 pr-12 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 transition-all duration-200 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-gray-100 max-h-32"
        placeholder="Escribe tu mensaje aquí... (prueba con '¿Cómo' para ver sugerencias)"
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
      />
      
      {/* Sugerencias */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto z-50">
          <div className="p-2">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 px-2 font-medium">
              💡 Sugerencias:
            </div>
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionClick(suggestion)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  index === activeSuggestion
                    ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-900 dark:text-orange-100'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                <span className="text-orange-500 dark:text-orange-400 mr-2">→</span>
                {suggestion}
              </button>
            ))}
          </div>
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400">
            💡 Usa ↑↓ para navegar, Enter para seleccionar, Esc para cerrar
          </div>
        </div>
      )}
    </div>
  );
};

export default AutoComplete;