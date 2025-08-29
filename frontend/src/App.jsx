import { useState, useEffect, useRef } from "react";
import axios from "axios";

function App() {
  const [area, setArea] = useState("");
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [agentConfig, setAgentConfig] = useState(null);
  const [prompt, setPrompt] = useState("");
  //const [response, setResponse] = useState("");
  const [darkMode, setDarkMode] = useState(true);
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const chatRef = useRef();


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
    if (!prompt.trim()) return;
    setLoading(true);
    const userMessage = { sender: "user", text: prompt };
    setChatHistory([...chatHistory, userMessage]);
    setPrompt("");

    try {
      const res = await axios.post("http://localhost:3001/api/chat", {
        area,
        prompt,
      });
      const botMessage = { sender: "bot", text: res.data.response };
      setChatHistory((prev) => [...prev, botMessage]);
    } catch (err) {
      const errorMessage = { sender: "bot", text: "Error llamando al modelo." };
      setChatHistory((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [chatHistory, loading]);


  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col items-center justify-center px-4 py-10 transition-all duration-300">
        <div className="absolute top-4 right-4">
          <button
            onClick={() => {
              document.documentElement.classList.toggle("dark");
              setDarkMode(!darkMode);
            }}
            className="px-3 py-1 rounded bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 transition-all text-sm font-medium"
          >
            {darkMode ? "☀️ Modo claro" : "🌙 Modo oscuro"}
          </button>
        </div>

        {!loggedIn ? (
          <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg w-full max-w-md border dark:border-gray-700">
            <h2 className="text-2xl font-bold mb-6 text-center">🔐 Login por Área</h2>
            <input
              type="text"
              placeholder="Área (Ej: informatica)"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="w-full border dark:border-gray-600 bg-gray-100 dark:bg-gray-700 px-4 py-2 mb-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-600"
            />
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border dark:border-gray-600 bg-gray-100 dark:bg-gray-700 px-4 py-2 mb-6 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-600"
            />
            <button
              onClick={handleLogin}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-md transition-colors"
            >
              Ingresar
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg w-full max-w-2xl border dark:border-gray-700">
            <h2 className="text-2xl font-bold mb-6 text-center">💼 Área: {area}</h2>
            <textarea
              rows="4"
              className="w-full border dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 p-4 mb-4 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-green-400 dark:focus:ring-green-600"
              placeholder="Escribí tu consulta aquí..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            ></textarea>
            <button
              onClick={handleSendPrompt}
              className="bg-green-600 hover:bg-green-700 transition text-white px-5 py-2 rounded-md font-semibold mb-6"
            >
              Enviar
            </button>

            <div
              ref={chatRef}
              className="h-[400px] overflow-y-auto mb-6 px-2 py-2 border dark:border-gray-600 bg-gray-50 dark:bg-gray-700 rounded-md space-y-4 scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600"
            >
              {chatHistory.map((msg, index) => (
                <div
                  key={index}
                  className={`max-w-[75%] px-4 py-2 rounded-lg text-sm whitespace-pre-wrap break-words ${msg.sender === "user"
                    ? "bg-blue-600 text-white self-end ml-auto rounded-br-none"
                    : "bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-100 rounded-bl-none"
                    }`}
                >
                  {msg.text}
                </div>
              ))}
              {loading && (
                <div className="bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-4 py-2 rounded-lg text-sm w-fit animate-pulse">
                  Pensando...
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

export default App;
