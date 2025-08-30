const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const axios = require('axios');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const winston = require('winston');
const { body, validationResult } = require('express-validator');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const database = require('./database/database');

dotenv.config();

// Configurar logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

const app = express();
const port = 3001;
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL;
const AREA_CONFIG_PATH = process.env.AREA_CONFIG_PATH;

// Rate limiting - MUY generoso para no afectar UX
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 100, // 100 requests por minuto (muy generoso)
  message: {
    error: 'Demasiadas solicitudes, intenta en un minuto'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting específico para login (más restrictivo)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // 10 intentos de login por 15 minutos
  message: {
    error: 'Demasiados intentos de login, intenta en 15 minutos'
  },
  skipSuccessfulRequests: true,
});

// Middlewares de seguridad
app.use(helmet({
  contentSecurityPolicy: false, // Deshabilitado para no romper el frontend
}));
app.use(limiter);

// CORS más específico pero permisivo
app.use(cors({
  origin: function (origin, callback) {
    // Permitir requests sin origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    // Permitir localhost en cualquier puerto para desarrollo
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    
    // Agregar aquí dominios de producción cuando sea necesario
    callback(null, true); // Por ahora, muy permisivo
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(bodyParser.json({ limit: '1mb' })); // Límite de 1MB para requests

// Session configuration
app.use(session({
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: './database',
    table: 'sessions',
    concurrentDB: true
  }),
  secret: process.env.SESSION_SECRET || 'luckia-chat-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  },
  name: 'luckia.sid' // Custom session name
}));

// Validaciones de input - MUY permisivas para no romper funcionalidad
const validateLogin = [
  body('area')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Área debe ser un texto entre 1 y 100 caracteres'),
  body('password')
    .isString()
    .isLength({ min: 1, max: 200 })
    .withMessage('Contraseña es requerida')
];

const validateChat = [
  body('area')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Área debe ser un texto válido'),
  body('prompt')
    .isString()
    .trim()
    .isLength({ min: 1, max: 10000 }) // 10k caracteres - muy generoso
    .withMessage('El prompt debe tener entre 1 y 10000 caracteres'),
  body('sessionId')
    .optional()
    .isString()
    .isLength({ min: 36, max: 36 })
    .withMessage('SessionId debe ser un UUID válido')
];

// Middleware para manejar errores de validación
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Validation failed', { 
      errors: errors.array(), 
      ip: req.ip,
      path: req.path 
    });
    return res.status(400).json({
      message: 'Datos inválidos',
      errors: errors.array()
    });
  }
  next();
};

let areas = {};

// Initialize database first
async function initializeApp() {
  try {
    // Initialize database
    await database.initialize(logger);
    logger.info('Database initialized successfully');
    
    // Load areas configuration
    const configPath = path.resolve(AREA_CONFIG_PATH);
    const data = fs.readFileSync(configPath, 'utf-8');
    areas = JSON.parse(data);
    logger.info('Configuration loaded successfully', { 
      areasCount: Object.keys(areas).length,
      areas: Object.keys(areas) 
    });
    
    return true;
  } catch (err) {
    logger.error('Failed to initialize application', { error: err.message, stack: err.stack });
    console.error('❌ Error inicializando aplicación:', err);
    process.exit(1);
  }
}

// Initialize app before starting server
initializeApp();

app.post('/api/login', loginLimiter, validateLogin, handleValidationErrors, async (req, res) => {
  const { area, password } = req.body;
  
  logger.info('Login attempt', { area, ip: req.ip });
  
  const areaData = areas[area];
  if (!areaData) {
    logger.warn('Login failed - area not found', { area, ip: req.ip });
    return res.status(401).json({ message: 'Área no encontrada' });
  }

  const match = await bcrypt.compare(password, areaData.password_hash);
  if (!match) {
    logger.warn('Login failed - incorrect password', { area, ip: req.ip });
    return res.status(403).json({ message: 'Contraseña incorrecta' });
  }

  logger.info('Login successful', { area, ip: req.ip });
  
  // Store area in session
  req.session.area = area;
  req.session.agent_config = areaData.agent_config;
  
  // Don't create session automatically - wait for first message
  return res.json({ 
    message: 'Acceso concedido', 
    agent_config: areaData.agent_config
  });
});

app.post('/api/chat', validateChat, handleValidationErrors, async (req, res) => {
  const { area, prompt, sessionId } = req.body;
  
  logger.info('Chat request', { area, promptLength: prompt?.length, sessionId, ip: req.ip });
  
  const areaData = areas[area];
  if (!areaData) {
    logger.warn('Chat failed - invalid area', { area, ip: req.ip });
    return res.status(401).json({ message: 'Área inválida' });
  }

  const config = areaData.agent_config;
  
  // Use sessionId from request or session
  let currentSessionId = sessionId || req.session.currentChatSession;
  
  // Create new session if none exists
  if (!currentSessionId) {
    try {
      currentSessionId = await database.createSession(area);
      req.session.currentChatSession = currentSessionId;
    } catch (err) {
      logger.error('Failed to create chat session', { area, error: err.message });
      // Continue without session - don't break chat
    }
  }

  try {
    const startTime = Date.now();
    
    const ollamaRes = await axios.post(
      `${OLLAMA_BASE_URL}/api/generate`,
      {
        model: config.model,
        prompt,
        system: config.system_prompt,
        options: {
          temperature: config.temperature,
          num_predict: config.max_tokens
        },
        stream: false
      },
      { timeout: 120000 } // 2 minutos timeout - más generoso
    );

    const responseTime = Date.now() - startTime;
    const botResponse = ollamaRes.data.response;
    
    logger.info('Chat successful', { 
      area, 
      promptLength: prompt?.length, 
      responseLength: botResponse?.length,
      responseTime: `${responseTime}ms`,
      sessionId: currentSessionId,
      ip: req.ip 
    });

    // Save conversation to database
    if (currentSessionId) {
      try {
        await database.saveMessage(currentSessionId, area, prompt, botResponse);
        logger.info('Message saved to database', { sessionId: currentSessionId });
      } catch (dbErr) {
        logger.error('Failed to save message', { 
          sessionId: currentSessionId, 
          error: dbErr.message 
        });
        // Continue - don't break chat if database save fails
      }
    }

    res.json({ 
      response: botResponse,
      sessionId: currentSessionId
    });

  } catch (err) {
    logger.error('Chat error', { 
      area, 
      error: err.message, 
      stack: err.stack,
      ip: req.ip 
    });
    
    if (err.code === 'ECONNREFUSED') {
      res.status(503).json({ message: 'El servicio de IA no está disponible temporalmente' });
    } else if (err.code === 'ENOTFOUND') {
      res.status(503).json({ message: 'No se puede conectar al servicio de IA' });
    } else if (err.code === 'ETIMEDOUT' || err.message.includes('timeout')) {
      res.status(504).json({ message: 'El modelo está procesando tu solicitud. Por favor, intenta con un mensaje más corto o espera unos momentos.' });
    } else if (err.response?.status >= 400) {
      res.status(err.response.status).json({ message: 'Error en el servicio de IA' });
    } else {
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }
});

// Logout endpoint
app.post('/api/logout', async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        logger.error('Session destruction failed', { error: err.message, ip: req.ip });
        return res.status(500).json({ message: 'Error cerrando sesión' });
      }
      
      res.clearCookie('luckia.sid');
      logger.info('User logged out successfully', { ip: req.ip });
      res.json({ message: 'Sesión cerrada correctamente' });
    });
  } catch (err) {
    logger.error('Logout error', { error: err.message, ip: req.ip });
    res.status(500).json({ message: 'Error cerrando sesión' });
  }
});

// === HISTORY ENDPOINTS ===

// Get chat sessions for current area
app.get('/api/history/sessions', async (req, res) => {
  try {
    const area = req.session.area;
    if (!area) {
      return res.status(401).json({ message: 'No hay sesión activa' });
    }
    
    const sessions = await database.getAreaSessions(area, 50);
    logger.info('Sessions retrieved', { area, count: sessions.length, ip: req.ip });
    
    res.json({ sessions });
  } catch (err) {
    logger.error('Failed to get sessions', { error: err.message, ip: req.ip });
    res.status(500).json({ message: 'Error obteniendo historial' });
  }
});

// Get conversation history for a session
app.get('/api/history/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const area = req.session.area;
    
    if (!area) {
      return res.status(401).json({ message: 'No hay sesión activa' });
    }
    
    const history = await database.getSessionHistory(sessionId);
    logger.info('Session history retrieved', { 
      sessionId, 
      messageCount: history.length,
      ip: req.ip 
    });
    
    res.json({ history });
  } catch (err) {
    logger.error('Failed to get session history', { 
      sessionId: req.params.sessionId,
      error: err.message,
      ip: req.ip 
    });
    res.status(500).json({ message: 'Error obteniendo conversación' });
  }
});

// Search conversations
app.get('/api/history/search', async (req, res) => {
  try {
    const { q: searchTerm, limit = 20 } = req.query;
    const area = req.session.area;
    
    if (!area) {
      return res.status(401).json({ message: 'No hay sesión activa' });
    }
    
    if (!searchTerm) {
      return res.status(400).json({ message: 'Término de búsqueda requerido' });
    }
    
    const results = await database.searchConversations(area, searchTerm, parseInt(limit));
    logger.info('Search completed', { 
      area,
      searchTerm,
      resultCount: results.length,
      ip: req.ip 
    });
    
    res.json({ results });
  } catch (err) {
    logger.error('Search failed', { 
      searchTerm: req.query.q,
      error: err.message,
      ip: req.ip 
    });
    res.status(500).json({ message: 'Error en búsqueda' });
  }
});

// Create new chat session
app.post('/api/history/new-session', async (req, res) => {
  try {
    const area = req.session.area;
    if (!area) {
      return res.status(401).json({ message: 'No hay sesión activa' });
    }
    
    const sessionId = await database.createSession(area);
    req.session.currentChatSession = sessionId;
    
    logger.info('New session created', { area, sessionId, ip: req.ip });
    
    res.json({ sessionId });
  } catch (err) {
    logger.error('Failed to create new session', { 
      area: req.session.area,
      error: err.message,
      ip: req.ip 
    });
    res.status(500).json({ message: 'Error creando nueva conversación' });
  }
});

// Update session title
app.put('/api/history/session/:sessionId/title', [
  body('title')
    .isString()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Título debe tener entre 1 y 200 caracteres')
], handleValidationErrors, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { title } = req.body;
    const area = req.session.area;
    
    if (!area) {
      return res.status(401).json({ message: 'No hay sesión activa' });
    }
    
    const updated = await database.updateSessionTitle(sessionId, title);
    
    if (updated) {
      logger.info('Session title updated', { sessionId, title, ip: req.ip });
      res.json({ message: 'Título actualizado' });
    } else {
      res.status(404).json({ message: 'Conversación no encontrada' });
    }
  } catch (err) {
    logger.error('Failed to update session title', {
      sessionId: req.params.sessionId,
      error: err.message,
      ip: req.ip
    });
    res.status(500).json({ message: 'Error actualizando título' });
  }
});

// Delete session
app.delete('/api/history/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const area = req.session.area;
    
    if (!area) {
      return res.status(401).json({ message: 'No hay sesión activa' });
    }
    
    const deleted = await database.deleteSession(sessionId);
    
    if (deleted) {
      // If deleting current session, clear it (don't create new one automatically)
      if (req.session.currentChatSession === sessionId) {
        req.session.currentChatSession = null;
      }
      
      logger.info('Session deleted', { sessionId, ip: req.ip });
      res.json({ message: 'Conversación eliminada' });
    } else {
      res.status(404).json({ message: 'Conversación no encontrada' });
    }
  } catch (err) {
    logger.error('Failed to delete session', {
      sessionId: req.params.sessionId,
      error: err.message,
      ip: req.ip
    });
    res.status(500).json({ message: 'Error eliminando conversación' });
  }
});

// Export conversation as JSON
app.get('/api/history/export/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { format = 'json' } = req.query;
    const area = req.session.area;
    
    if (!area) {
      return res.status(401).json({ message: 'No hay sesión activa' });
    }
    
    const history = await database.getSessionHistory(sessionId);
    
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="chat-${sessionId}.json"`);
      res.json({
        sessionId,
        area,
        exportDate: new Date().toISOString(),
        messageCount: history.length,
        messages: history
      });
    } else if (format === 'txt') {
      let content = `Chat Export - ${area}\n`;
      content += `Session ID: ${sessionId}\n`;
      content += `Export Date: ${new Date().toLocaleString()}\n`;
      content += `Messages: ${history.length}\n\n`;
      content += '='.repeat(50) + '\n\n';
      
      history.forEach((msg, index) => {
        content += `[${new Date(msg.timestamp).toLocaleString()}] Usuario:\n${msg.user_message}\n\n`;
        content += `[${new Date(msg.timestamp).toLocaleString()}] Luckia Chat:\n${msg.bot_response}\n\n`;
        content += '-'.repeat(30) + '\n\n';
      });
      
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="chat-${sessionId}.txt"`);
      res.send(content);
    } else {
      res.status(400).json({ message: 'Formato no soportado. Usa: json, txt' });
    }
    
    logger.info('Export completed', { sessionId, format, messageCount: history.length, ip: req.ip });
  } catch (err) {
    logger.error('Export failed', {
      sessionId: req.params.sessionId,
      error: err.message,
      ip: req.ip
    });
    res.status(500).json({ message: 'Error exportando conversación' });
  }
});

// Middleware de manejo de errores global
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    ip: req.ip
  });
  
  res.status(500).json({
    message: 'Error interno del servidor'
  });
});

// Ruta para health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.listen(port, () => {
  const message = `🚀 Backend corriendo en http://localhost:${port}`;
  console.log(message);
  logger.info('Server started successfully', { 
    port, 
    ollamaUrl: OLLAMA_BASE_URL,
    nodeEnv: process.env.NODE_ENV || 'development',
    areasConfigured: Object.keys(areas).length 
  });
});
