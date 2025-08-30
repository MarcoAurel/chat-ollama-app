import { useState, useEffect, useRef, useMemo } from "react";
import axios from "./utils/axios";
import MarkdownMessage from "./components/MarkdownMessage";
import CopyButton from "./components/CopyButton";
import AutoComplete from "./components/AutoComplete";
import MessageReactions from "./components/MessageReactions";
import ToastNotification from "./components/ToastNotification";

function App() {
  const [area, setArea] = useState("");
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [agentConfig, setAgentConfig] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [darkMode, setDarkMode] = useState(() => {
    // Verificar si hay una preferencia guardada en localStorage
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme === 'dark';
    }
    // Si no hay preferencia, usar la preferencia del sistema
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [toasts, setToasts] = useState([]);
  const chatRef = useRef();
  const inputRef = useRef();

  // Función para obtener timestamp formateado
  const getTimestamp = () => {
    return new Date().toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Toast notification system
  const showToast = (message, type = 'info', duration = 3000) => {
    const id = Date.now();
    const toast = { id, message, type, duration };
    setToasts(prev => [...prev, toast]);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };


  const handleLogin = async () => {
    try {
      const res = await axios.post("/api/login", {
        area,
        password,
      });
      
      setAgentConfig(res.data.agent_config);
      setLoggedIn(true);
      
      // Load sessions after login
      loadSessions();
      showToast("¡Bienvenido! Sesión iniciada correctamente", "success");
    } catch (err) {
      showToast("Error en el login. Verifica tus credenciales", "error");
    }
  };

  const handleSendPrompt = async () => {
    if (!prompt.trim() || loading) return;
    
    const currentPrompt = prompt;
    setPrompt("");
    setLoading(true);
    setIsTyping(true);
    
    const userMessage = { 
      sender: "user", 
      text: currentPrompt, 
      timestamp: getTimestamp(),
      id: Date.now() + Math.random()
    };
    setChatHistory(prev => [...prev, userMessage]);

    try {
      const res = await axios.post("/api/chat", {
        area,
        prompt: currentPrompt,
        sessionId: currentSessionId
      });
      
      // Simular delay de escritura para mejor UX
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const botMessage = { 
        sender: "bot", 
        text: res.data.response,
        timestamp: getTimestamp(),
        id: Date.now() + Math.random()
      };
      setChatHistory(prev => [...prev, botMessage]);
    } catch (err) {
      const errorMessage = { 
        sender: "bot", 
        text: "❌ Error al conectar con el modelo. Intenta nuevamente.",
        timestamp: getTimestamp(),
        id: Date.now() + Math.random(),
        isError: true
      };
      setChatHistory(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      setIsTyping(false);
      inputRef.current?.focus();
    }
  };

  // Manejar Enter para enviar
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendPrompt();
    }
  };

  // Limpiar chat
  const clearChat = () => {
    setChatHistory([]);
  };

  // === HISTORY FUNCTIONS ===
  
  // Load sessions from backend
  const loadSessions = async () => {
    try {
      const res = await axios.get("/api/history/sessions");
      setSessions(res.data.sessions);
    } catch (err) {
      console.error("Failed to load sessions:", err);
    }
  };

  // Load specific session history
  const loadSessionHistory = async (sessionId) => {
    try {
      const res = await axios.get(`/api/history/session/${sessionId}`);
      
      // Convert history to chat format
      const convertedHistory = [];
      res.data.history.forEach(msg => {
        convertedHistory.push({
          sender: "user",
          text: msg.user_message,
          timestamp: new Date(msg.timestamp).toLocaleTimeString('es-ES', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          id: `${msg.id}-user`
        });
        convertedHistory.push({
          sender: "bot",
          text: msg.bot_response,
          timestamp: new Date(msg.timestamp).toLocaleTimeString('es-ES', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          id: `${msg.id}-bot`
        });
      });
      
      setChatHistory(convertedHistory);
      setCurrentSessionId(sessionId);
      setShowHistory(false);
    } catch (err) {
      console.error("Failed to load session history:", err);
      alert("Error cargando conversación");
    }
  };

  // Create new session
  const createNewSession = async () => {
    try {
      const res = await axios.post("/api/history/new-session");
      setCurrentSessionId(res.data.sessionId);
      setChatHistory([]);
      loadSessions(); // Refresh sessions list
      setShowHistory(false);
    } catch (err) {
      console.error("Failed to create new session:", err);
      alert("Error creando nueva conversación");
    }
  };

  // Search conversations
  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    
    try {
      const res = await axios.get(`/api/history/search?q=${encodeURIComponent(searchTerm)}`);
      setSearchResults(res.data.results);
    } catch (err) {
      console.error("Search failed:", err);
      alert("Error en búsqueda");
    }
  };

  // Export conversation
  const exportConversation = async (sessionId, format = 'json') => {
    try {
      const response = await axios.get(
        `/api/history/export/${sessionId}?format=${format}`, 
        { 
          responseType: format === 'json' ? 'json' : 'blob'
        }
      );
      
      if (format === 'json') {
        const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat-${sessionId}.json`;
        a.click();
      } else {
        const url = window.URL.createObjectURL(response.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat-${sessionId}.txt`;
        a.click();
      }
    } catch (err) {
      console.error("Export failed:", err);
      alert("Error exportando conversación");
    }
  };

  // Delete individual session
  const deleteSession = async (sessionId) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta conversación?')) {
      return;
    }
    
    try {
      await axios.delete(`/api/history/session/${sessionId}`);
      
      // If deleting current session, clear chat
      if (sessionId === currentSessionId) {
        setChatHistory([]);
        setCurrentSessionId(null);
      }
      
      // Refresh sessions list
      loadSessions();
    } catch (err) {
      console.error("Failed to delete session:", err);
      alert("Error eliminando conversación");
    }
  };

  // Delete all sessions
  const deleteAllSessions = async () => {
    if (!confirm(`¿Estás seguro de que quieres eliminar TODAS las ${sessions.length} conversaciones? Esta acción no se puede deshacer.`)) {
      return;
    }
    
    try {
      // Delete all sessions one by one
      for (const session of sessions) {
        await axios.delete(`/api/history/session/${session.id}`);
      }
      
      // Clear current state
      setChatHistory([]);
      setCurrentSessionId(null);
      setSessions([]);
      setShowHistory(false);
      
      alert('Todas las conversaciones han sido eliminadas');
    } catch (err) {
      console.error("Failed to delete all sessions:", err);
      alert("Error eliminando conversaciones");
      // Refresh to see current state
      loadSessions();
    }
  };

  // Handle message reactions
  const handleReaction = (messageId, reaction) => {
    console.log(`Reaction ${reaction} for message ${messageId}`);
    // TODO: Send reaction to backend for analytics
  };

  // Logout function
  const handleLogout = () => {
    setLoggedIn(false);
    setArea("");
    setPassword("");
    setAgentConfig(null);
    setCurrentSessionId(null);
    setSessions([]);
    setChatHistory([]);
    setShowHistory(false);
    setSearchTerm("");
    setSearchResults([]);
    
    // Clear any potential session data
    axios.post("/api/logout").catch(() => {
      // Ignore logout errors, we're logging out anyway
    });
  };

  // Función para alternar modo oscuro/claro
  const toggleTheme = () => {
    const newTheme = !darkMode;
    setDarkMode(newTheme);
    
    // Guardar en localStorage
    localStorage.setItem('theme', newTheme ? 'dark' : 'light');
    
    // Aplicar clase al documento
    if (newTheme) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    // Forzar re-render para actualizar el gradient de fondo
    setTimeout(() => {
      // Este timeout asegura que el estado se actualice correctamente
    }, 0);
  };

  // useEffect para aplicar el tema inicial
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [chatHistory, loading]);



  return (
    <div className={darkMode ? "dark" : ""}>
      <div 
        className="min-h-screen text-gray-900 dark:text-gray-100 transition-all duration-500"
        style={{
          background: darkMode 
            ? 'linear-gradient(135deg, #1a1a1a 0%, #2d1b2d 50%, #8E3B96 100%)'
            : 'linear-gradient(135deg, #F36F21 0%, #8E3B96 100%)'
        }}
      >
        
        {/* Header */}
        <div className="sticky top-0 z-10 backdrop-blur-sm bg-black/10 dark:bg-black/20 border-b border-white/20 dark:border-white/10 px-4 py-3">
          <div className="max-w-4xl mx-auto flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center p-1">
                <img src="/Logo_Luckia.svg" alt="Luckia" className="w-full h-full object-contain" />
              </div>
              <h1 className="text-lg font-semibold text-white drop-shadow-lg">
                {loggedIn ? `Luckia Chat - Informática` : 'Luckia Chat - Login'}
              </h1>
            </div>
            <div className="flex items-center space-x-2">
              {loggedIn && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="flex items-center space-x-2 p-2 rounded-lg bg-white/20 hover:bg-white/30 dark:bg-white/10 dark:hover:bg-white/20 backdrop-blur-sm transition-all duration-200 text-sm font-medium text-white"
                  >
                    <span className="text-base">📜</span>
                    <span className="hidden sm:inline text-xs">Historial</span>
                  </button>
                  <button
                    onClick={createNewSession}
                    className="flex items-center space-x-2 p-2 rounded-lg bg-white/20 hover:bg-white/30 dark:bg-white/10 dark:hover:bg-white/20 backdrop-blur-sm transition-all duration-200 text-sm font-medium text-white"
                  >
                    <span className="text-base">➕</span>
                    <span className="hidden sm:inline text-xs">Nuevo</span>
                  </button>
                  <button
                    onClick={clearChat}
                    className="flex items-center space-x-2 p-2 rounded-lg bg-white/20 hover:bg-white/30 dark:bg-white/10 dark:hover:bg-white/20 backdrop-blur-sm transition-all duration-200 text-sm font-medium text-white"
                  >
                    <span className="text-base">🗑️</span>
                    <span className="hidden sm:inline text-xs">Limpiar</span>
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-2 p-2 rounded-lg bg-red-500/30 hover:bg-red-500/40 dark:bg-red-500/20 dark:hover:bg-red-500/30 backdrop-blur-sm transition-all duration-200 text-sm font-medium text-white"
                  >
                    <span className="text-base">🚪</span>
                    <span className="hidden sm:inline text-xs">Salir</span>
                  </button>
                </div>
              )}
              <button
                onClick={toggleTheme}
                className="flex items-center space-x-2 p-2 rounded-lg bg-white/20 hover:bg-white/30 dark:bg-white/10 dark:hover:bg-white/20 backdrop-blur-sm transition-all duration-200 text-sm font-medium text-white"
              >
                <span className="text-base">{darkMode ? "☀️" : "🌙"}</span>
                <span className="hidden sm:inline text-xs">{darkMode ? "Claro" : "Oscuro"}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center px-4 py-6 min-h-[calc(100vh-80px)]">
          {!loggedIn ? (
            <div className="bg-white/95 dark:bg-gray-900/90 backdrop-blur-sm p-8 rounded-2xl shadow-xl w-full max-w-md border border-white/30 dark:border-gray-600/50 animate-in slide-in-from-bottom duration-500">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 p-2 shadow-lg">
                  <img src="/Logo_Luckia.svg" alt="Luckia" className="w-full h-full object-contain" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Acceso por Área</h2>
                <p className="text-gray-600 dark:text-gray-400 mt-2">Ingresa tus credenciales para continuar</p>
              </div>
              
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Área (Ej: informatica)"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className="w-full border-0 bg-gray-100 dark:bg-gray-700 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 transition-all duration-200 placeholder-gray-500"
                />
                <input
                  type="password"
                  placeholder="Contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                  className="w-full border-0 bg-gray-100 dark:bg-gray-700 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 transition-all duration-200 placeholder-gray-500"
                />
                <button
                  onClick={handleLogin}
                  className="w-full text-white font-semibold py-3 rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
                  style={{background: 'linear-gradient(135deg, #F36F21 0%, #8E3B96 100%)'}}
                >
                  Ingresar
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-4xl h-[calc(100vh-120px)] bg-white/95 dark:bg-gray-900/90 backdrop-blur-sm rounded-2xl shadow-xl border border-white/30 dark:border-gray-600/50 flex flex-col animate-in slide-in-from-bottom duration-500">
              
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-200/50 dark:border-gray-600/50 flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Conectado al agente</span>
                </div>
                <button
                  onClick={clearChat}
                  className="text-xs px-3 py-1 rounded-full bg-gray-100/80 dark:bg-gray-700/80 hover:bg-gray-200/80 dark:hover:bg-gray-600/80 transition-all duration-200 text-gray-600 dark:text-gray-300"
                >
                  Limpiar chat
                </button>
              </div>

              {/* Chat Messages */}
              <div
                ref={chatRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
              >
                {chatHistory.length === 0 && (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 opacity-20 p-2">
                      <img src="/Logo_Luckia.svg" alt="Luckia" className="w-full h-full object-contain" />
                    </div>
                    <p className="text-gray-500 dark:text-gray-400">¡Bienvenido al Chat de Luckia! Tu asistente de informática está aquí para ayudarte. ¿En qué puedo asistirte hoy?</p>
                  </div>
                )}
                
                {chatHistory.map((msg, index) => (
                  <div
                    key={msg.id || index}
                    className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"} animate-in slide-in-from-bottom duration-300`}
                  >
                    <div className={`max-w-[80%] ${msg.sender === "user" ? "order-2" : "order-1"} group`}>
                      {msg.sender === "bot" && (
                        <div className="flex items-center space-x-2 mb-1">
                          <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center p-1">
                            <img src="/Logo_Luckia.svg" alt="Luckia" className="w-full h-full object-contain" />
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">Luckia Chat</span>
                        </div>
                      )}
                      <div className="relative">
                        <div
                          className={`px-4 py-3 rounded-2xl shadow-sm ${
                            msg.sender === "user"
                              ? "text-white rounded-br-md"
                              : msg.isError
                              ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800 rounded-bl-md"
                              : "bg-gray-100/80 dark:bg-gray-700/80 text-gray-800 dark:text-gray-100 rounded-bl-md"
                          }`}
                          style={msg.sender === "user" ? {background: 'linear-gradient(135deg, #F36F21 0%, #8E3B96 100%)'} : {}}
                        >
                          {/* Copy Button */}
                          <div className="absolute top-2 right-2 z-10">
                            <CopyButton 
                              text={msg.text} 
                              onCopySuccess={() => showToast("Mensaje copiado al portapapeles", "success", 2000)}
                              onCopyError={() => showToast("Error al copiar el mensaje", "error", 2000)}
                            />
                          </div>
                        {msg.sender === "bot" ? (
                          <MarkdownMessage content={msg.text} darkMode={darkMode} />
                        ) : (
                          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.text}</p>
                        )}
                        
                        {/* Message reactions for bot messages */}
                        {msg.sender === "bot" && !msg.isError && (
                          <MessageReactions 
                            messageId={msg.id}
                            darkMode={darkMode}
                            onReaction={handleReaction}
                          />
                        )}
                        
                        {msg.timestamp && (
                          <span className={`text-xs block mt-2 ${
                            msg.sender === "user" ? "text-white/70" : "text-gray-500 dark:text-gray-400"
                          }`}>
                            {msg.timestamp}
                          </span>
                        )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {isTyping && (
                  <div className="flex justify-start animate-in slide-in-from-bottom duration-300">
                    <div className="max-w-[80%]">
                      <div className="flex items-center space-x-2 mb-1">
                        <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center p-1">
                          <img src="/Logo_Luckia.svg" alt="Luckia" className="w-full h-full object-contain" />
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">Anyelita</span>
                      </div>
                      <div className="bg-gray-100/80 dark:bg-gray-700/80 px-4 py-3 rounded-2xl rounded-bl-md">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <div className="p-4 border-t border-gray-200/50 dark:border-gray-600/50">
                <div className="flex space-x-3">
                  <div className="flex-1 relative">
                    <AutoComplete
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      onSuggestionSelect={(suggestion) => setPrompt(suggestion)}
                      darkMode={darkMode}
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-400 dark:text-gray-500 z-10">
                      Enter
                    </div>
                  </div>
                  <button
                    onClick={handleSendPrompt}
                    disabled={!prompt.trim() || loading}
                    className="px-6 py-3 text-white rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95 disabled:scale-100 disabled:cursor-not-allowed font-medium disabled:opacity-50 disabled:bg-gray-400"
                    style={!prompt.trim() || loading ? {backgroundColor: '#9CA3AF'} : {background: 'linear-gradient(135deg, #F36F21 0%, #8E3B96 100%)'}}
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      "Enviar"
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* History Panel */}
          {loggedIn && showHistory && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/30 dark:border-gray-600/50 w-full max-w-4xl max-h-[80vh] overflow-hidden">
                
                {/* History Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">Historial de Conversaciones</h3>
                  <div className="flex items-center space-x-2">
                    {sessions.length > 0 && (
                      <button
                        onClick={deleteAllSessions}
                        className="px-3 py-1 text-sm rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 transition-colors font-medium"
                        title="Eliminar todas las conversaciones"
                      >
                        🗑️ Eliminar Todo
                      </button>
                    )}
                    <button
                      onClick={() => setShowHistory(false)}
                      className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
                    >
                      <span className="text-gray-600 dark:text-gray-300">✕</span>
                    </button>
                  </div>
                </div>

                {/* Search Bar */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex space-x-3">
                    <input
                      type="text"
                      placeholder="Buscar en conversaciones..."
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <button
                      onClick={handleSearch}
                      className="px-4 py-2 text-white rounded-lg font-medium transition-all duration-200"
                      style={{background: 'linear-gradient(135deg, #F36F21 0%, #8E3B96 100%)'}}
                    >
                      🔍 Buscar
                    </button>
                  </div>
                </div>

                {/* History Content */}
                <div className="p-4 overflow-y-auto max-h-96">
                  {searchResults.length > 0 ? (
                    // Search Results
                    <div>
                      <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
                        Resultados de búsqueda ({searchResults.length})
                      </h4>
                      <div className="space-y-3">
                        {searchResults.map((result) => (
                          <div
                            key={result.id}
                            className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            onClick={() => loadSessionHistory(result.session_id)}
                          >
                            <div className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">
                              {result.title}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                              {new Date(result.timestamp).toLocaleString()}
                            </div>
                            <div className="text-sm text-gray-700 dark:text-gray-300">
                              <strong>Usuario:</strong> {result.user_message.substring(0, 100)}...
                            </div>
                            <div className="text-sm text-gray-700 dark:text-gray-300">
                              <strong>Respuesta:</strong> {result.bot_response.substring(0, 100)}...
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    // Session List
                    <div>
                      <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
                        Conversaciones Recientes ({sessions.length})
                      </h4>
                      <div className="space-y-2">
                        {sessions.map((session) => (
                          <div
                            key={session.id}
                            className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            onClick={() => loadSessionHistory(session.id)}
                          >
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                {session.title}
                              </div>
                              <div className="text-xs text-gray-600 dark:text-gray-400">
                                {new Date(session.updated_at).toLocaleString()} • {session.message_count} mensajes
                              </div>
                            </div>
                            <div className="flex space-x-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  exportConversation(session.id, 'json');
                                }}
                                className="p-1 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
                                title="Exportar JSON"
                              >
                                💾
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  exportConversation(session.id, 'txt');
                                }}
                                className="p-1 text-gray-500 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400 transition-colors"
                                title="Exportar TXT"
                              >
                                📄
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteSession(session.id);
                                }}
                                className="p-1 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
                                title="Eliminar conversación"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        ))}
                        {sessions.length === 0 && (
                          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                            No hay conversaciones guardadas aún
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Toast Notifications */}
      {useMemo(() => 
        toasts.map((toast) => (
          <ToastNotification
            key={toast.id}
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            onClose={() => removeToast(toast.id)}
          />
        )), [toasts]
      )}
    </div>
  );
}

export default App;
