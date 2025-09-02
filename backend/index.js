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
    
    // Initialize Qdrant
    const qdrant = require('./config/qdrant');
    await qdrant.initialize();
    
    // Initialize Embedding Service
    const embeddingService = require('./services/embeddings');
    await embeddingService.initialize();
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

// Chat con archivos adjuntos
app.post('/api/chat-with-files', upload.array('files', 5), async (req, res) => {
  const { area, prompt, sessionId } = req.body;
  
  logger.info('Chat with files request', { 
    area, 
    promptLength: prompt?.length, 
    sessionId,
    fileCount: req.files?.length || 0,
    ip: req.ip 
  });
  
  const areaData = areas[area];
  if (!areaData) {
    logger.warn('Chat with files failed - invalid area', { area, ip: req.ip });
    return res.status(401).json({ message: 'Área inválida' });
  }

  const config = areaData.agent_config;
  let currentSessionId = sessionId || req.session.currentChatSession;
  
  try {
    // Procesar archivos adjuntos
    let contextFromFiles = '';
    
    if (req.files && req.files.length > 0) {
      logger.info('Processing attached files', { fileCount: req.files.length });
      
      const fileContents = [];
      for (const file of req.files) {
        try {
          let content = '';
          
          if (file.mimetype.startsWith('image/')) {
            // Para imágenes, agregar descripción básica
            content = `[IMAGEN: ${file.originalname} - ${file.mimetype} - ${Math.round(file.size/1024)}KB]\n(Nota: Esta es una imagen que no puede ser procesada directamente por el modelo de texto)`;
          } else if (file.mimetype === 'application/pdf') {
            // Procesar PDF con pdf-parse
            try {
              const pdfData = await pdfParse(file.buffer);
              content = pdfData.text.trim();
              if (!content) {
                content = '[PDF sin contenido de texto extraíble o PDF con imágenes/escaneos]';
              }
            } catch (pdfError) {
              logger.error('Error parsing PDF', { filename: file.originalname, error: pdfError.message });
              content = `[Error procesando PDF: ${file.originalname}]`;
            }
          } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            // Procesar DOCX con mammoth
            try {
              const docxData = await mammoth.extractRawText({ buffer: file.buffer });
              content = docxData.value.trim();
              if (!content) {
                content = '[Documento DOCX sin contenido de texto extraíble]';
              }
            } catch (docxError) {
              logger.error('Error parsing DOCX', { filename: file.originalname, error: docxError.message });
              content = `[Error procesando DOCX: ${file.originalname}]`;
            }
          } else if (file.mimetype === 'application/msword') {
            // Para DOC legacy, solo indicamos que no se puede procesar
            content = `[DOCUMENTO DOC: ${file.originalname} - Formato DOC legacy no soportado. Convierte a DOCX para procesamiento completo]`;
          } else {
            // Para archivos de texto
            try {
              content = file.buffer.toString('utf8');
              if (!content.trim()) {
                content = '[Archivo vacío o sin contenido de texto]';
              }
            } catch (textError) {
              content = `[Error leyendo archivo de texto: ${file.originalname}]`;
            }
          }
          
          fileContents.push({
            name: file.originalname,
            type: file.mimetype,
            size: file.size,
            content: content
          });
          
          logger.info('File processed successfully', { 
            filename: file.originalname, 
            contentLength: content.length,
            type: file.mimetype
          });
          
        } catch (fileError) {
          logger.error('Error processing file', { 
            filename: file.originalname, 
            error: fileError.message 
          });
          
          // Agregar archivo con error para que el usuario sepa que falló
          fileContents.push({
            name: file.originalname,
            type: file.mimetype,
            size: file.size,
            content: `[Error procesando archivo: ${file.originalname} - ${fileError.message}]`
          });
        }
      }
      
      // Construir contexto para el prompt
      if (fileContents.length > 0) {
        contextFromFiles = '\n\n=== DOCUMENTOS ADJUNTOS ===\n';
        fileContents.forEach((file, index) => {
          contextFromFiles += `\n📄 DOCUMENTO ${index + 1}: ${file.name}\n`;
          contextFromFiles += `📝 Tipo: ${file.type}\n`;
          contextFromFiles += `💾 Tamaño: ${Math.round(file.size/1024)}KB\n\n`;
          contextFromFiles += `CONTENIDO:\n${file.content}\n`;
          contextFromFiles += '\n' + '='.repeat(50) + '\n';
        });
        contextFromFiles += '\n✨ INSTRUCCIÓN: Analiza el contenido de estos documentos y responde la pregunta basándote en la información proporcionada. Si no encuentras información relevante en los documentos, indícalo claramente.\n';
      }
    }
    
    // Combinar prompt original con contexto de archivos
    const enhancedPrompt = prompt + contextFromFiles;
    
    // Verificar que el prompt no sea demasiado largo (límite de ~8000 tokens aprox)
    const maxPromptLength = 25000; // caracteres aproximados
    let finalPrompt = enhancedPrompt;
    
    if (enhancedPrompt.length > maxPromptLength) {
      logger.warn('Prompt too long, truncating context', { 
        originalLength: enhancedPrompt.length,
        maxLength: maxPromptLength
      });
      
      // Truncar el contexto pero mantener el prompt original
      const truncatedContext = contextFromFiles.substring(0, maxPromptLength - prompt.length - 1000) + '\n[... contenido truncado ...]';
      finalPrompt = prompt + truncatedContext;
    }
    
    // Construir la request correcta para Ollama
    const ollamaRequest = {
      model: config.model,
      prompt: finalPrompt,
      system: config.system_prompt,
      stream: false,
      options: {
        temperature: 0.7,
        top_p: 0.9,
        top_k: 40
      }
    };
    
    logger.info('Sending request to Ollama', {
      model: config.model,
      promptLength: finalPrompt.length,
      hasSystemPrompt: !!config.system_prompt
    });
    
    const response = await axios.post(`${OLLAMA_BASE_URL}/api/generate`, ollamaRequest, { 
      timeout: 180000, // 3 minutos para archivos grandes
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Guardar en base de datos si hay sesión activa
    if (currentSessionId) {
      try {
        await database.saveConversation(
          currentSessionId, 
          area, 
          prompt + (req.files?.length > 0 ? ` [+${req.files.length} archivo(s)]` : ''), 
          response.data.response
        );
      } catch (dbError) {
        logger.error('Error saving chat with files to database', { 
          error: dbError.message, 
          sessionId: currentSessionId 
        });
      }
    }
    
    logger.info('Chat with files completed successfully', { 
      area, 
      sessionId: currentSessionId,
      fileCount: req.files?.length || 0,
      responseLength: response.data.response?.length 
    });
    
    res.json({ 
      response: response.data.response,
      sessionId: currentSessionId,
      filesProcessed: req.files?.length || 0
    });
    
  } catch (error) {
    logger.error('Chat with files error', { 
      error: error.message, 
      area, 
      sessionId: currentSessionId,
      fileCount: req.files?.length || 0
    });
    
    if (error.code === 'ECONNREFUSED') {
      res.status(503).json({ 
        message: 'Modelo de IA no disponible. Intenta más tarde.' 
      });
    } else if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ 
        message: 'Archivo demasiado grande. Máximo: 10MB por archivo.' 
      });
    } else if (error.code === 'LIMIT_FILE_COUNT') {
      res.status(413).json({ 
        message: 'Demasiados archivos. Máximo: 5 archivos.' 
      });
    } else if (error.code === 'ECONNABORTED') {
      res.status(408).json({ 
        message: 'Timeout en la consulta. Intenta con archivos más pequeños.' 
      });
    } else {
      res.status(500).json({ 
        message: 'Error interno del servidor' 
      });
    }
  }
});

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
      
      // 🧠 RAG: Search for relevant documents
      let ragContext = '';
      try {
        const qdrant = require('./config/qdrant');
        const searchResults = await qdrant.searchDocuments(prompt, area, 3);
        
        if (searchResults && searchResults.length > 0) {
          logger.info('📚 RAG: Found relevant documents', { 
            count: searchResults.length, 
            query: prompt.substring(0, 100) + '...' 
          });
          
          ragContext = '\n🔍 CONTEXTO RELEVANTE DE DOCUMENTOS:\n';
          ragContext += '='.repeat(50) + '\n';
          
          searchResults.forEach((doc, index) => {
            ragContext += `📄 DOCUMENTO ${index + 1} (relevancia: ${(doc.score * 100).toFixed(1)}%):\n`;
            ragContext += `${doc.content.substring(0, 800)}${doc.content.length > 800 ? '...' : ''}\n\n`;
          });
          
          ragContext += '='.repeat(50) + '\n';
          ragContext += '✨ INSTRUCCIÓN: Responde basándote principalmente en el contexto proporcionado. Si la información no está disponible en el contexto, indícalo claramente.\n\n';
        }
      } catch (ragError) {
        logger.error('RAG search failed', { error: ragError.message });
        // Continue without RAG if search fails
      }
      
      // Combine original prompt with RAG context
      const enhancedPrompt = prompt + ragContext;
      
      const response = await axios({
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
        timeout: 120000
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

                // Save to database
                if (currentSessionId && fullResponse) {
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
      const qdrant = require('./config/qdrant');
      const searchResults = await qdrant.searchDocuments(prompt, area, 3);
      
      if (searchResults && searchResults.length > 0) {
        logger.info('📚 RAG: Found relevant documents (non-streaming)', { 
          count: searchResults.length, 
          query: prompt.substring(0, 100) + '...' 
        });
        
        ragContext = '\n🔍 CONTEXTO RELEVANTE DE DOCUMENTOS:\n';
        ragContext += '='.repeat(50) + '\n';
        
        searchResults.forEach((doc, index) => {
          ragContext += `📄 DOCUMENTO ${index + 1} (relevancia: ${(doc.score * 100).toFixed(1)}%):\n`;
          ragContext += `${doc.content.substring(0, 800)}${doc.content.length > 800 ? '...' : ''}\n\n`;
        });
        
        ragContext += '='.repeat(50) + '\n';
        ragContext += '✨ INSTRUCCIÓN: Responde basándote principalmente en el contexto proporcionado. Si la información no está disponible en el contexto, indícalo claramente.\n\n';
      }
    } catch (ragError) {
      logger.error('RAG search failed (non-streaming)', { error: ragError.message });
      // Continue without RAG if search fails
    }
    
    // Combine original prompt with RAG context
    const enhancedPrompt = prompt + ragContext;
    
    const ollamaRes = await axios.post(
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
      { timeout: 120000 }
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

// Streaming chat endpoint using Server-Sent Events (SSE)
app.post('/api/chat-stream', validateChat, handleValidationErrors, async (req, res) => {
  const { area, prompt, sessionId } = req.body;
  
  logger.info('Chat stream request', { area, promptLength: prompt?.length, sessionId, ip: req.ip });
  
  const areaData = areas[area];
  if (!areaData) {
    logger.warn('Chat stream failed - invalid area', { area, ip: req.ip });
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

  // Set headers for Server-Sent Events
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

  const startTime = Date.now();
  let fullResponse = '';

  try {
    // Send session ID immediately
    res.write(`data: ${JSON.stringify({ type: 'session', sessionId: currentSessionId })}\n\n`);
    
    // 🧠 RAG: Search for relevant documents
    let ragContext = '';
    try {
      const qdrant = require('./config/qdrant');
      const searchResults = await qdrant.searchDocuments(prompt, area, 3);
      
      if (searchResults && searchResults.length > 0) {
        logger.info('📚 RAG: Found relevant documents', { 
          count: searchResults.length, 
          query: prompt.substring(0, 100) + '...' 
        });
        
        ragContext = '\n🔍 CONTEXTO RELEVANTE DE DOCUMENTOS:\n';
        ragContext += '='.repeat(50) + '\n';
        
        searchResults.forEach((doc, index) => {
          ragContext += `📄 DOCUMENTO ${index + 1} (relevancia: ${(doc.score * 100).toFixed(1)}%):\n`;
          ragContext += `${doc.content.substring(0, 800)}${doc.content.length > 800 ? '...' : ''}\n\n`;
        });
        
        ragContext += '='.repeat(50) + '\n';
        ragContext += '✨ INSTRUCCIÓN: Responde basándote principalmente en el contexto proporcionado. Si la información no está disponible en el contexto, indícalo claramente.\n\n';
      }
    } catch (ragError) {
      logger.error('RAG search failed', { error: ragError.message });
      // Continue without RAG if search fails
    }
    
    // Combine original prompt with RAG context
    const enhancedPrompt = prompt + ragContext;
    
    const response = await axios({
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
      timeout: 120000
    });

    response.data.on('data', async (chunk) => {
      const lines = chunk.toString().split('\n');
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const data = JSON.parse(line);
            if (data.response) {
              fullResponse += data.response;
              // Send the streaming chunk to frontend
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

              // Save conversation to database
              if (currentSessionId && fullResponse) {
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
              
              // Send completion signal
              res.write(`data: ${JSON.stringify({ 
                type: 'done', 
                sessionId: currentSessionId,
                fullResponse
              })}\n\n`);
              res.end();
            }
          } catch (parseErr) {
            // Skip invalid JSON chunks
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

  } catch (err) {
    logger.error('Chat stream error', { 
      area, 
      error: err.message, 
      stack: err.stack,
      ip: req.ip 
    });
    
    const errorMessage = err.code === 'ECONNREFUSED' 
      ? 'El servicio de IA no está disponible temporalmente'
      : err.code === 'ENOTFOUND' 
      ? 'No se puede conectar al servicio de IA'
      : err.code === 'ETIMEDOUT' || err.message.includes('timeout')
      ? 'Timeout en la consulta. El modelo está procesando tu solicitud.'
      : 'Error interno del servidor';

    res.write(`data: ${JSON.stringify({ 
      type: 'error', 
      message: errorMessage 
    })}\n\n`);
    res.end();
  }

  // Handle client disconnect
  req.on('close', () => {
    logger.info('Client disconnected from stream', { area, sessionId: currentSessionId });
  });
});

// Test streaming endpoint
app.post('/api/test-stream', (req, res) => {
  res.json({ message: 'Streaming test endpoint works!' });
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

// Qdrant endpoints
app.get('/api/qdrant/status', async (req, res) => {
  try {
    const qdrant = require('./config/qdrant');
    const status = await qdrant.testConnection();
    res.json(status);
  } catch (error) {
    logger.error('Qdrant status check failed', { error: error.message });
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

app.get('/api/qdrant/stats', async (req, res) => {
  try {
    const qdrant = require('./config/qdrant');
    const stats = await qdrant.getStats();
    res.json(stats);
  } catch (error) {
    logger.error('Qdrant stats failed', { error: error.message });
    res.status(500).json({
      status: 'error', 
      error: error.message
    });
  }
});

// Document management endpoints
app.post('/api/documents/upload', upload.array('documents', 10), async (req, res) => {
  try {
    const { area = 'general' } = req.body;
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    logger.info('📄 Processing document upload', { 
      fileCount: req.files.length,
      area,
      ip: req.ip
    });

    const results = [];
    const documentProcessor = require('./services/documentProcessor');
    const qdrant = require('./config/qdrant');

    for (const file of req.files) {
      try {
        // Process document
        const documents = await documentProcessor.processDocument(
          file.buffer,
          file.originalname,
          area,
          { uploader_ip: req.ip }
        );

        // Add to Qdrant
        for (const doc of documents) {
          await qdrant.addDocument(doc.id, doc.content, doc.metadata, area);
        }

        results.push({
          filename: file.originalname,
          status: 'success',
          chunks: documents.length,
          size: file.size
        });

      } catch (error) {
        logger.error('Document processing failed', {
          filename: file.originalname,
          error: error.message
        });
        
        results.push({
          filename: file.originalname,
          status: 'error',
          error: error.message
        });
      }
    }

    res.json({
      message: 'Document processing completed',
      results,
      processed: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'error').length
    });

  } catch (error) {
    logger.error('Document upload failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/documents/search', async (req, res) => {
  try {
    const { query, area, limit = 5 } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter required' });
    }

    const qdrant = require('./config/qdrant');
    const results = await qdrant.searchDocuments(query, area, parseInt(limit));

    res.json({
      query,
      area: area || 'all',
      results,
      count: results.length
    });

  } catch (error) {
    logger.error('Document search failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/embeddings/test', async (req, res) => {
  try {
    const embeddingService = require('./services/embeddings');
    const result = await embeddingService.testEmbedding();
    res.json(result);
  } catch (error) {
    logger.error('Embedding test failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
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
