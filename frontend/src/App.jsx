import { useState, useEffect, useRef } from "react";
import axios from "axios";

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
  const chatRef = useRef();
  const inputRef = useRef();

  // Función para obtener timestamp formateado
  const getTimestamp = () => {
    return new Date().toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };


  const handleLogin = async () => {
    try {
      const res = await axios.post("http://localhost:3001/api/login", {
        area,
        password,
      });
      setAgentConfig(res.data.agent_config);
      setLoggedIn(true);
    } catch (err) {
      alert("Login fallido");
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
      const res = await axios.post("http://localhost:3001/api/chat", {
        area,
        prompt: currentPrompt,
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

  // useEffect para asegurar que los cambios de tema se apliquen
  useEffect(() => {
    // Este efecto se ejecuta cada vez que cambia darkMode
    // y asegura que la interfaz se actualice correctamente
  }, [darkMode]);


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
            <button
              onClick={toggleTheme}
              className="flex items-center space-x-2 p-2 rounded-lg bg-white/20 hover:bg-white/30 dark:bg-white/10 dark:hover:bg-white/20 backdrop-blur-sm transition-all duration-200 text-sm font-medium text-white"
            >
              <span className="text-base">{darkMode ? "☀️" : "🌙"}</span>
              <span className="hidden sm:inline text-xs">{darkMode ? "Claro" : "Oscuro"}</span>
            </button>
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
                    <div className={`max-w-[80%] ${msg.sender === "user" ? "order-2" : "order-1"}`}>
                      {msg.sender === "bot" && (
                        <div className="flex items-center space-x-2 mb-1">
                          <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center p-1">
                            <img src="/Logo_Luckia.svg" alt="Luckia" className="w-full h-full object-contain" />
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">Luckia Chat</span>
                        </div>
                      )}
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
                        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.text}</p>
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
                    <textarea
                      ref={inputRef}
                      rows="1"
                      className="w-full border-0 bg-gray-100/80 dark:bg-gray-700/80 px-4 py-3 pr-12 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 transition-all duration-200 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-gray-100 max-h-32"
                      placeholder="Escribe tu mensaje aquí..."
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      onKeyPress={handleKeyPress}
                      disabled={loading}
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-400 dark:text-gray-500">
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
        </div>
      </div>
    </div>
  );
}

export default App;
