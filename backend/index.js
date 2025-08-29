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
    .withMessage('El prompt debe tener entre 1 y 10000 caracteres')
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

try {
  const configPath = path.resolve(AREA_CONFIG_PATH);
  const data = fs.readFileSync(configPath, 'utf-8');
  areas = JSON.parse(data);
  logger.info('Configuration loaded successfully', { 
    areasCount: Object.keys(areas).length,
    areas: Object.keys(areas) 
  });
} catch (err) {
  logger.error('Failed to load area configuration', { error: err.message, stack: err.stack });
  console.error('❌ Error cargando configuración de áreas:', err);
  process.exit(1);
}

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
  return res.json({ message: 'Acceso concedido', agent_config: areaData.agent_config });
});

app.post('/api/chat', validateChat, handleValidationErrors, async (req, res) => {
  const { area, prompt } = req.body;
  
  logger.info('Chat request', { area, promptLength: prompt?.length, ip: req.ip });
  
  const areaData = areas[area];
  if (!areaData) {
    logger.warn('Chat failed - invalid area', { area, ip: req.ip });
    return res.status(401).json({ message: 'Área inválida' });
  }

  const config = areaData.agent_config;

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
    logger.info('Chat successful', { 
      area, 
      promptLength: prompt?.length, 
      responseLength: ollamaRes.data.response?.length,
      responseTime: `${responseTime}ms`,
      ip: req.ip 
    });

    res.json({ response: ollamaRes.data.response });

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
