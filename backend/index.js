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
const multer = require('multer');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// NUEVO: Servicio de inicialización progresiva
const initService = require('./services/initialization');

dotenv.config();

// ===== MANEJO GLOBAL DE ERRORES =====
process.on('uncaughtException', (err) => {
  console.error('❌ UNCAUGHT EXCEPTION:', err.message);
  console.error(err.stack);
  // No exit, just log the error
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ UNHANDLED REJECTION:', reason);
  console.error('At promise:', promise);
  // No exit, just log the error
});

// ===== ENHANCED PROCESS MONITORING =====
process.on('beforeExit', (code) => {
  console.log('🔍 Process beforeExit event with code:', code);
  console.log('🔍 Process still alive, checking event loop...');
});

process.on('exit', (code) => {
  console.log('🔍 Process exit event with code:', code);
});

// Process monitoring and heartbeat detection
let serverStartTime = Date.now();
let heartbeatInterval;

function startProcessMonitoring() {
  heartbeatInterval = setInterval(() => {
    const memUsage = process.memoryUsage();
    const uptime = Date.now() - serverStartTime;
    
    console.log('💓 Server heartbeat:', {
      timestamp: new Date().toISOString(),
      uptime: `${Math.floor(uptime / 1000)}s`,
      memory: {
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        external: `${Math.round(memUsage.external / 1024 / 1024)}MB`
      },
      eventLoopDelay: process.hrtime.bigint ? 'available' : 'not available'
    });
    
    // Memory leak detection
    if (memUsage.heapUsed > 200 * 1024 * 1024) { // 200MB threshold
      console.warn('⚠️ High memory usage detected:', Math.round(memUsage.heapUsed / 1024 / 1024), 'MB');
    }
    
  }, 10000); // Every 10 seconds
}

// Enhanced error detection
process.on('warning', (warning) => {
  console.warn('⚠️ Node.js Warning:', warning.name, warning.message);
  if (warning.stack) console.warn(warning.stack);
});

// ===== CIRCUIT BREAKER FOR OLLAMA REQUESTS =====
class CircuitBreaker {
  constructor(threshold = 3, timeout = 30000, resetTime = 60000) {
    this.threshold = threshold;
    this.timeout = timeout;
    this.resetTime = resetTime;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
  }
  
  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTime) {
        this.state = 'HALF_OPEN';
        console.log('🔧 Circuit breaker: Half-open state, trying again...');
      } else {
        throw new Error('Circuit breaker is OPEN - Ollama service temporarily unavailable');
      }
    }
    
    try {
      const result = await Promise.race([
        fn(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Operation timeout')), this.timeout)
        )
      ]);
      
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
    console.log('✅ Circuit breaker: Success, state reset to CLOSED');
  }
  
  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      console.error(`❌ Circuit breaker: OPENED after ${this.failureCount} failures`);
    }
    
    console.error(`⚠️ Circuit breaker: Failure ${this.failureCount}/${this.threshold}, state: ${this.state}`);
  }
}

const ollamaCircuitBreaker = new CircuitBreaker(3, 30000, 60000);

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
const JWT_SECRET = process.env.SESSION_SECRET || 'luckia-chat-super-secret-key-change-in-production-2025';

// Variables globales para servicios (se inicializan de manera asíncrona)
let areas = {};
let database = null;
let qdrantService = null;
let embeddingService = null;

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

// Configuración de multer para archivos
const storage = multer.memoryStorage(); // Almacenar en memoria
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB máximo por archivo
    files: 5 // Máximo 5 archivos
  },
  fileFilter: (req, file, cb) => {
    // Tipos de archivo permitidos
    const allowedTypes = [
      'text/plain',
      'text/markdown', 
      'text/csv',
      'application/json',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/octet-stream', // DOCX sometimes detected as this
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/webp'
    ];
    
    // Additional check by file extension for problematic MIME types
    const ext = file.originalname.toLowerCase().split('.').pop();
    const allowedExtensions = ['txt', 'md', 'csv', 'json', 'pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg', 'gif', 'webp'];
    
    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de archivo no permitido: ${file.mimetype} (extensión: ${ext})`), false);
    }
  }
});

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
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null || value === undefined) return true;
      if (typeof value !== 'string' || value.length !== 36) {
        throw new Error('SessionId debe ser un UUID válido');
      }
      return true;
    }),
  body('stream')
    .optional()
    .isBoolean()
    .withMessage('Stream debe ser un valor booleano')
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

// ===== FUNCIÓN DE INICIALIZACIÓN ASÍNCRONA =====
async function initializeApp() {
  try {
    logger.info('🚀 Starting Luckia Chat Server...');
    
    // Inicializar servicios críticos (sincronos, requeridos para funcionar)
    const criticalServices = await initService.initializeAll();
    
    // Asignar servicios críticos
    database = criticalServices.database;
    areas = criticalServices.areas;
    
    logger.info('✅ Critical services ready - server starting');
    
    // Los servicios opcionales (Qdrant, Embeddings) se inicializan en background
    // El servidor puede funcionar sin ellos
    
    return true;
  } catch (err) {
    logger.error('❌ Failed to initialize critical services', { error: err.message, stack: err.stack });
    console.error('❌ Error inicializando aplicación:', err);
    process.exit(1);
  }
}

// Función helper para obtener servicios opcionales
function getOptionalService(serviceName) {
  const service = initService.getService(serviceName);
  const isInitialized = initService.isInitialized(serviceName);
  
  if (!isInitialized) {
    logger.warn(`⚠️ Service ${serviceName} not yet initialized`);
    return null;
  }
  
  return service;
}

// ===== ENDPOINTS =====

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
  
  // Generate JWT token for admin operations
  const token = jwt.sign(
    { 
      area: area, 
      username: area, // Using area as username for now
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
    }, 
    JWT_SECRET
  );
  
  // Don't create session automatically - wait for first message
  return res.json({ 
    message: 'Acceso concedido', 
    agent_config: areaData.agent_config,
    token: token,
    username: area
  });
});

// Chat endpoint con manejo de servicios opcionales
app.post('/api/chat', validateChat, handleValidationErrors, async (req, res) => {
  const { area, prompt, sessionId, stream = false } = req.body;
  
  logger.info('Chat request', { 
    area, 
    promptLength: prompt?.length, 
    sessionId, 
    stream: stream,
    ip: req.ip 
  });
  
  const areaData = areas[area];
  if (!areaData) {
    logger.warn('Chat failed - invalid area', { area, ip: req.ip });
    return res.status(401).json({ message: 'Área inválida' });
  }

  const config = areaData.agent_config;
  
  // Use sessionId from request or session
  let currentSessionId = sessionId || req.session.currentChatSession;
  
  // Create new session if none exists (only if database is available)
  if (!currentSessionId && database) {
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
    
    if (stream) {
      // Handle streaming response
      logger.info('🚀 ENTERING STREAMING MODE', { area, sessionId, ip: req.ip });
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin || 'http://localhost:5174');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      
      let fullResponse = '';
      
      // Send session ID immediately
      res.write(`data: ${JSON.stringify({ type: 'session', sessionId: currentSessionId })}\n\n`);
      
      // 🧠 RAG: Search for relevant documents (optional)
      let ragContext = '';
      try {
        const qdrant = getOptionalService('qdrant');
        if (qdrant) {
          const searchResults = await qdrant.searchDocuments(prompt, area, 3);
          
          if (searchResults && searchResults.length > 0) {
            logger.info('📚 RAG: Found relevant documents', { 
              count: searchResults.length, 
              query: prompt.substring(0, 100) + '...' 
            });
            
            ragContext = '\n📄 CONTEXTO RELEVANTE DE DOCUMENTOS:\n';
            ragContext += '='.repeat(50) + '\n';
            
            searchResults.forEach((doc, index) => {
              ragContext += `📄 DOCUMENTO ${index + 1} (relevancia: ${(doc.score * 100).toFixed(1)}%):\n`;
              ragContext += `${doc.content.substring(0, 800)}${doc.content.length > 800 ? '...' : ''}\n\n`;
            });
            
            ragContext += '='.repeat(50) + '\n';
            ragContext += '✨ INSTRUCCIÓN: Responde basándote principalmente en el contexto proporcionado. Si la información no está disponible en el contexto, indícalo claramente.\n\n';
          }
        } else {
          logger.info('📚 RAG: Qdrant not available, continuing without context search');
        }
      } catch (ragError) {
        logger.error('RAG search failed', { error: ragError.message });
        // Continue without RAG if search fails
      }
      
      // Combine original prompt with RAG context
      const enhancedPrompt = prompt + ragContext;
      
      const response = await ollamaCircuitBreaker.execute(async () => {
        console.log('🤖 Making Ollama request with circuit breaker protection');
        return axios({
          method: 'POST',
          url: `${OLLAMA_BASE_URL}/api/generate`,
          data: {
            model: config.model,
            prompt: enhancedPrompt,
            system: config.system_prompt,
            options: {
              temperature: config.temperature,
              num_predict: config.max_tokens
            },
            stream: true
          },
          responseType: 'stream',
          timeout: 30000 // Reduced from 120s to 30s for better failure detection
        });
      });

      response.data.on('data', async (chunk) => {
        const lines = chunk.toString().split('\n');
        
        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              if (data.response) {
                fullResponse += data.response;
                res.write(`data: ${JSON.stringify({ 
                  type: 'chunk', 
                  content: data.response 
                })}\n\n`);
              }
              
              if (data.done) {
                const responseTime = Date.now() - startTime;
                
                logger.info('Chat stream successful', { 
                  area, 
                  promptLength: prompt?.length, 
                  responseLength: fullResponse?.length,
                  responseTime: `${responseTime}ms`,
                  sessionId: currentSessionId,
                  ip: req.ip 
                });

                // Save to database (only if available)
                if (currentSessionId && fullResponse && database) {
                  try {
                    await database.saveMessage(currentSessionId, area, prompt, fullResponse);
                    logger.info('Streamed message saved to database', { sessionId: currentSessionId });
                  } catch (dbErr) {
                    logger.error('Failed to save streamed message', { 
                      sessionId: currentSessionId, 
                      error: dbErr.message 
                    });
                  }
                }
                
                res.write(`data: ${JSON.stringify({ 
                  type: 'done', 
                  sessionId: currentSessionId,
                  fullResponse
                })}\n\n`);
                res.end();
                return;
              }
            } catch (parseErr) {
              // Skip invalid JSON
              continue;
            }
          }
        }
      });

      response.data.on('error', (error) => {
        logger.error('Stream error', { error: error.message, area, ip: req.ip });
        res.write(`data: ${JSON.stringify({ 
          type: 'error', 
          message: 'Error en el streaming' 
        })}\n\n`);
        res.end();
      });
      
      // Handle client disconnect
      req.on('close', () => {
        logger.info('Client disconnected from stream', { area, sessionId: currentSessionId });
      });
      
      return; // Exit early for streaming
    }
    
    // Non-streaming response (original behavior)
    // 🧠 RAG: Search for relevant documents (non-streaming)
    let ragContext = '';
    try {
      const qdrant = getOptionalService('qdrant');
      if (qdrant) {
        const searchResults = await qdrant.searchDocuments(prompt, area, 3);
        
        if (searchResults && searchResults.length > 0) {
          logger.info('📚 RAG: Found relevant documents (non-streaming)', { 
            count: searchResults.length, 
            query: prompt.substring(0, 100) + '...' 
          });
          
          ragContext = '\n📄 CONTEXTO RELEVANTE DE DOCUMENTOS:\n';
          ragContext += '='.repeat(50) + '\n';
          
          searchResults.forEach((doc, index) => {
            ragContext += `📄 DOCUMENTO ${index + 1} (relevancia: ${(doc.score * 100).toFixed(1)}%):\n`;
            ragContext += `${doc.content.substring(0, 800)}${doc.content.length > 800 ? '...' : ''}\n\n`;
          });
          
          ragContext += '='.repeat(50) + '\n';
          ragContext += '✨ INSTRUCCIÓN: Responde basándote principalmente en el contexto proporcionado. Si la información no está disponible en el contexto, indícalo claramente.\n\n';
        }
      }
    } catch (ragError) {
      logger.error('RAG search failed (non-streaming)', { error: ragError.message });
      // Continue without RAG if search fails
    }
    
    // Combine original prompt with RAG context
    const enhancedPrompt = prompt + ragContext;
    
    const ollamaRes = await ollamaCircuitBreaker.execute(async () => {
      console.log('🤖 Making non-streaming Ollama request with circuit breaker protection');
      return axios.post(
        `${OLLAMA_BASE_URL}/api/generate`,
        {
          model: config.model,
          prompt: enhancedPrompt,
          system: config.system_prompt,
          options: {
            temperature: config.temperature,
            num_predict: config.max_tokens
          },
          stream: false
        },
        { timeout: 30000 } // Reduced from 120s to 30s for better failure detection
      );
    });

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

    // Save conversation to database (only if available)
    if (currentSessionId && database) {
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

// ===== HEALTH CHECK MEJORADO =====
app.get('/health', (req, res) => {
  const status = initService.getStatus();
  
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: status,
    version: '2.0.0-fixed'
  });
});

// Status endpoint detallado
app.get('/api/status', (req, res) => {
  const status = initService.getStatus();
  
  res.json({
    server: {
      status: 'running',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version
    },
    services: status,
    environment: {
      nodeEnv: process.env.NODE_ENV || 'development',
      ollamaUrl: OLLAMA_BASE_URL,
      port: port
    }
  });
});

// Endpoint para obtener configuración de branding
app.get('/api/branding', (req, res) => {
  try {
    const brandingConfig = require('./config/branding');
    const config = brandingConfig.getAll();
    res.json(config);
  } catch (error) {
    console.error('Error obteniendo configuración de branding:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
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

// ===== INICIALIZACIÓN Y STARTUP =====
async function startServer() {
  try {
    // Inicializar servicios críticos primero
    await initializeApp();
    
    // Iniciar servidor
    const server = app.listen(port, () => {
      const message = `🚀 Luckia Chat Server running on http://localhost:${port}`;
      console.log(message);
      logger.info('Server started successfully', { 
        port, 
        ollamaUrl: OLLAMA_BASE_URL,
        nodeEnv: process.env.NODE_ENV || 'development',
        areasConfigured: Object.keys(areas).length 
      });
      
      // Start process monitoring after server is running
      startProcessMonitoring();
      console.log('🔍 Process monitoring started');
    });
    
    // Graceful shutdown
    const gracefulShutdown = (signal) => {
      logger.info(`🛑 Received ${signal}, shutting down gracefully`);
      server.close(() => {
        logger.info('✅ Server closed successfully');
        process.exit(0);
      });
    };
    
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
  } catch (error) {
    logger.error('❌ Failed to start server', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

// Iniciar servidor
startServer();