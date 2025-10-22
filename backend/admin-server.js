const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = 3002;

// Middleware básico
app.use(cors());
app.use(express.json());

// Configuración de multer
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Importar servicios directamente
const supabaseManager = require('./config/supabase');
const documentProcessor = require('./services/documentProcessor');

// Función para obtener servicios
function getOptionalService(serviceName) {
  switch(serviceName) {
    case 'supabase':
      return supabaseManager.initialized ? supabaseManager : null;
    case 'documentProcessor':
      return documentProcessor;
    default:
      return null;
  }
}

// Middleware de autenticación
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

// Test endpoint
app.get('/test', (req, res) => {
  res.json({
    message: 'Admin server working!',
    timestamp: new Date().toISOString(),
    services: {
      supabase: supabaseManager.initialized,
      documentProcessor: true
    }
  });
});

// Endpoint para obtener estadísticas
app.get('/documents/stats', requireAuth, async (req, res) => {
  try {
    const supabase = getOptionalService('supabase');

    if (!supabase || !supabase.initialized) {
      return res.json({
        supabase_status: 'disconnected',
        documents_count: 0,
        collections: {},
        message: 'Supabase not available'
      });
    }

    const collectionInfo = await supabase.getCollectionInfo();
    const stats = await supabase.getStats();

    res.json({
      supabase_status: 'connected',
      documents_count: collectionInfo.points_count || 0,
      collections: stats.by_area || {},
      total_documents: stats.total_documents || 0,
      message: 'Connected to Supabase successfully'
    });

  } catch (error) {
    console.error('Error getting admin stats:', error.message);
    res.status(500).json({
      error: 'Failed to get stats',
      supabase_status: 'error',
      documents_count: 0,
      collections: {}
    });
  }
});

// Endpoint para subir documentos
app.post('/documents/upload', requireAuth, upload.array('documents'), async (req, res) => {
  try {
    console.log('📤 Upload request received:', {
      files: req.files?.length || 0,
      user: req.user?.area
    });

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const supabase = getOptionalService('supabase');
    const docProcessor = getOptionalService('documentProcessor');

    console.log('🔍 Services status:', {
      supabase: supabase ? 'available' : 'not available',
      supabaseInitialized: supabase?.initialized || false,
      docProcessor: docProcessor ? 'available' : 'not available'
    });

    if (!supabase || !supabase.initialized) {
      return res.status(503).json({ error: 'Supabase not available' });
    }

    if (!docProcessor) {
      return res.status(503).json({ error: 'Document processor not available' });
    }

    const results = [];

    for (const file of req.files) {
      try {
        console.log(`📄 Processing file: ${file.originalname}`);

        // Procesar el documento
        const processedDoc = await docProcessor.processDocument(file.buffer, req.user.area, file.originalname);
        console.log(`✅ Document processed: ${processedDoc.id}`);

        // Agregar a Supabase
        await supabase.addDocument(
          processedDoc.id,
          processedDoc.content,
          processedDoc.metadata,
          req.user.area
        );
        console.log(`✅ Document added to Supabase: ${processedDoc.id}`);

        results.push({
          filename: file.originalname,
          status: 'success',
          id: processedDoc.id
        });

      } catch (error) {
        console.error(`❌ Error processing ${file.originalname}:`, error.message);

        results.push({
          filename: file.originalname,
          status: 'error',
          error: error.message
        });
      }
    }

    console.log('✅ Upload completed:', results);
    res.json({
      message: 'Upload completed',
      results
    });

  } catch (error) {
    console.error('❌ Upload error:', error.message);
    res.status(500).json({ error: 'Upload failed', details: error.message });
  }
});

// Inicializar servicios y arrancar servidor
async function startAdminServer() {
  try {
    console.log('🔧 Initializing admin server...');

    // Inicializar Supabase
    console.log('🔍 Initializing Supabase...');
    await supabaseManager.initialize();

    app.listen(port, () => {
      console.log(`🚀 Admin Server running on http://localhost:${port}`);
      console.log('Available endpoints:');
      console.log('  GET  /test');
      console.log('  GET  /documents/stats');
      console.log('  POST /documents/upload');
      console.log(`🔍 Supabase status: ${supabaseManager.initialized ? 'Connected' : 'Disconnected'}`);
    });

  } catch (error) {
    console.error('❌ Failed to start admin server:', error);
  }
}

startAdminServer();