const express = require('express');
const jwt = require('jsonwebtoken');
const multer = require('multer');

const router = express.Router();

// Configuración de multer para archivos
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  }
});

// Importar el servicio de inicialización
const initService = require('../services/initialization');

// Función para obtener servicios opcionales - debe coincidir con index.js
function getOptionalService(serviceName) {
  const service = initService.getService(serviceName);
  const isInitialized = initService.isInitialized(serviceName);

  if (!isInitialized) {
    console.warn(`⚠️ Service ${serviceName} not yet initialized`);
    return null;
  }

  return service;
}

// Middleware de autenticación para admin
const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, process.env.SESSION_SECRET || 'luckia-chat-super-secret-key-change-in-production-2025');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Test endpoint - sin autenticación
router.get('/test', (req, res) => {
  res.json({
    message: 'Admin routes working!',
    timestamp: new Date().toISOString(),
    routes: ['/test', '/qdrant/status', '/documents/stats', '/documents/upload']
  });
});

// Endpoint para probar conexión de Qdrant
router.get('/qdrant/status', requireAuth, async (req, res) => {
  try {
    const qdrant = getOptionalService('qdrant');

    if (!qdrant) {
      return res.json({
        status: 'not_configured',
        message: 'Qdrant service not configured'
      });
    }

    const connectionTest = await qdrant.testConnection();
    res.json(connectionTest);

  } catch (error) {
    console.error('Error testing Qdrant connection', { error: error.message });
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

// Endpoint para obtener estadísticas de documentos
router.get('/documents/stats', requireAuth, async (req, res) => {
  try {
    const qdrant = getOptionalService('qdrant');

    if (!qdrant || !qdrant.initialized) {
      return res.json({
        qdrant_status: 'disconnected',
        documents_count: 0,
        collections: {},
        message: 'Qdrant not available'
      });
    }

    // Obtener estadísticas de Qdrant
    const collectionInfo = await qdrant.getCollectionInfo();
    const stats = await qdrant.getStats();

    res.json({
      qdrant_status: 'connected',
      documents_count: collectionInfo.points_count || 0,
      collections: stats,
      message: 'Connected to Qdrant successfully'
    });

  } catch (error) {
    console.error('Error getting admin stats', { error: error.message });
    res.status(500).json({
      error: 'Failed to get stats',
      qdrant_status: 'error',
      documents_count: 0,
      collections: {}
    });
  }
});

// Endpoint para subir documentos
router.post('/documents/upload', requireAuth, upload.array('documents'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const qdrant = getOptionalService('qdrant');
    const docProcessor = getOptionalService('documentProcessor');

    if (!qdrant || !qdrant.initialized) {
      return res.status(503).json({ error: 'Qdrant not available' });
    }

    if (!docProcessor) {
      return res.status(503).json({ error: 'Document processor not available' });
    }

    const results = [];

    for (const file of req.files) {
      try {
        // Procesar el documento
        const processedDoc = await docProcessor.processDocument(file, req.user.area);

        // Agregar a Qdrant
        await qdrant.addDocument(
          processedDoc.id,
          processedDoc.content,
          processedDoc.metadata,
          req.user.area
        );

        results.push({
          filename: file.originalname,
          status: 'success',
          id: processedDoc.id
        });

      } catch (error) {
        console.error('Error processing document', {
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
      message: 'Upload completed',
      results
    });

  } catch (error) {
    console.error('Error in document upload', { error: error.message });
    res.status(500).json({ error: 'Upload failed' });
  }
});

module.exports = router;