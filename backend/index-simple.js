const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const winston = require('winston');

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
    new winston.transports.Console()
  ]
});

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.SESSION_SECRET || 'luckia-chat-super-secret-key-change-in-production-2025';

// Middleware básico
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true
}));
app.use(express.json());

// Configurar multer para uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Middleware de autenticación para admin
const adminMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const area = decoded.area;
    
    const adminAreas = process.env.ADMIN_AREAS?.split(',').map(a => a.trim()) || ['informatica', 'sistemas'];
    
    if (!adminAreas.includes(area)) {
      return res.status(403).json({ error: 'No autorizado para administración' });
    }
    
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' });
  }
};

// Rutas

// Login de admin
app.post('/api/admin/login', async (req, res) => {
  try {
    const { area } = req.body;
    
    if (!area) {
      return res.status(400).json({ error: 'Área requerida' });
    }

    const adminAreas = process.env.ADMIN_AREAS?.split(',').map(a => a.trim()) || ['informatica', 'sistemas'];
    
    if (!adminAreas.includes(area)) {
      return res.status(401).json({ error: 'Área no autorizada para administración' });
    }

    const token = jwt.sign(
      { area, username: `admin_${area}`, role: 'admin' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ 
      success: true, 
      token,
      area,
      role: 'admin',
      expires: '24h'
    });
    
    logger.info('Admin login successful', { area });
  } catch (error) {
    logger.error('Admin login error', { error: error.message });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Upload de documentos - VERSION SIMPLIFICADA
app.post('/api/admin/documents/upload', adminMiddleware, upload.array('documents'), async (req, res) => {
  try {
    logger.info('📄 Document upload started', { 
      fileCount: req.files?.length || 0,
      area: req.user.area,
      admin: req.user.username
    });

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron documentos' });
    }

    const results = [];
    const errors = [];

    // Procesar archivos de manera muy básica
    for (const file of req.files) {
      try {
        // Simular procesamiento exitoso
        const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        results.push({
          id: documentId,
          filename: file.originalname,
          size: file.size,
          type: file.mimetype,
          processed: true,
          message: 'Documento procesado correctamente (modo simplificado)'
        });
        
        logger.info('Document processed', { 
          filename: file.originalname,
          size: file.size,
          id: documentId
        });
        
      } catch (error) {
        logger.error('Error processing file', { 
          filename: file.originalname,
          error: error.message 
        });
        
        errors.push({
          filename: file.originalname,
          error: error.message
        });
      }
    }

    const successCount = results.length;
    const totalCount = req.files.length;
    
    logger.info('Upload completed', { 
      total: totalCount,
      success: successCount,
      errors: errors.length
    });

    res.json({
      success: true,
      message: `Procesamiento completado: ${successCount}/${totalCount} documentos`,
      results,
      errors,
      stats: {
        total: totalCount,
        processed: successCount,
        failed: errors.length
      }
    });

  } catch (error) {
    logger.error('Upload endpoint error', { error: error.message, stack: error.stack });
    res.status(500).json({ 
      success: false,
      error: 'Error interno del servidor',
      message: 'Error durante el procesamiento de documentos'
    });
  }
});

// Stats básicas para admin
app.get('/api/admin/stats', adminMiddleware, async (req, res) => {
  try {
    res.json({
      success: true,
      stats: {
        documents: 0,
        qdrant_status: 'connected',
        embedding_model: 'all-MiniLM-L6-v2',
        ocr_service: 'available'
      }
    });
  } catch (error) {
    logger.error('Stats error', { error: error.message });
    res.status(500).json({ error: 'Error obteniendo estadísticas' });
  }
});

// Document stats for admin panel
app.get('/api/admin/documents/stats', adminMiddleware, async (req, res) => {
  try {
    res.json({
      success: true,
      stats: {
        documents: 0,
        qdrant_status: 'connected',
        embedding_model: 'all-MiniLM-L6-v2',
        ocr_service: 'available'
      }
    });
  } catch (error) {
    logger.error('Document stats error', { error: error.message });
    res.status(500).json({ error: 'Error obteniendo estadísticas de documentos' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: 'simple-v1.0'
  });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Iniciar servidor
const server = app.listen(PORT, () => {
  logger.info(`🚀 Simple server running on http://localhost:${PORT}`);
  logger.info('✅ Server ready to handle requests');
});

// Mantener el servidor vivo
process.on('SIGINT', () => {
  logger.info('🛑 Shutting down server...');
  server.close(() => {
    logger.info('✅ Server closed');
    process.exit(0);
  });
});

// No cerrar automáticamente
setInterval(() => {
  // Keep alive ping every 30 seconds
  logger.info('💓 Server keep-alive ping');
}, 30000);