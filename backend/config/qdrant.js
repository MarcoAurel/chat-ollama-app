const { QdrantClient } = require('@qdrant/js-client-rest');
const winston = require('winston');

// Configure logger for Qdrant
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

class QdrantManager {
  constructor() {
    this.client = new QdrantClient({
      host: process.env.QDRANT_HOST || '192.168.1.206',
      port: process.env.QDRANT_PORT || 6333,
    });
    
    this.collections = {
      documents: 'luckia_documents',
      conversations: 'luckia_conversations'
    };
    
    this.initialized = false;
  }

  async initialize() {
    try {
      logger.info('🔍 Initializing Qdrant connection...');
      
      // Test connection
      await this.client.getCollections();
      logger.info('✅ Qdrant connection successful');
      
      // Create collections if they don't exist
      await this.createCollectionsIfNeeded();
      
      this.initialized = true;
      logger.info('🚀 Qdrant initialized successfully');
      
      return true;
    } catch (error) {
      logger.error('❌ Failed to initialize Qdrant', { 
        error: error.message,
        stack: error.stack,
        host: process.env.QDRANT_HOST || '192.168.1.206',
        port: process.env.QDRANT_PORT || 6333
      });
      return false;
    }
  }

  async createCollectionsIfNeeded() {
    try {
      const collections = await this.client.getCollections();
      const existingNames = collections.collections.map(c => c.name);
      
      // Create documents collection
      if (!existingNames.includes(this.collections.documents)) {
        await this.client.createCollection(this.collections.documents, {
          vectors: {
            size: 384, // all-MiniLM-L6-v2 embedding size
            distance: 'Cosine'
          },
          optimizers_config: {
            default_segment_number: 2
          }
        });
        logger.info(`📚 Created collection: ${this.collections.documents}`);
      }
      
      // Create conversations collection  
      if (!existingNames.includes(this.collections.conversations)) {
        await this.client.createCollection(this.collections.conversations, {
          vectors: {
            size: 384,
            distance: 'Cosine'
          },
          optimizers_config: {
            default_segment_number: 2
          }
        });
        logger.info(`💬 Created collection: ${this.collections.conversations}`);
      }
      
    } catch (error) {
      logger.error('Failed to create collections', { error: error.message });
      throw error;
    }
  }

  async testConnection() {
    try {
      const collections = await this.client.getCollections();
      
      return {
        status: 'connected',
        collections: collections.collections.length,
        qdrant_host: process.env.QDRANT_HOST || '192.168.1.206',
        qdrant_port: process.env.QDRANT_PORT || 6333,
        collections_list: collections.collections.map(c => ({
          name: c.name,
          vectors_count: c.vectors_count || 0,
          points_count: c.points_count || 0
        }))
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  async addDocument(id, content, metadata = {}, area = 'general') {
    if (!this.initialized) {
      throw new Error('Qdrant not initialized');
    }
    
    try {
      // Generate embedding for content (we'll implement this next)
      const embedding = await this.generateEmbedding(content);
      
      const point = {
        id: id,
        vector: embedding,
        payload: {
          content,
          area,
          type: 'document',
          timestamp: new Date().toISOString(),
          ...metadata
        }
      };
      
      await this.client.upsert(this.collections.documents, {
        wait: true,
        points: [point]
      });
      
      logger.info('📄 Document added to vector DB', { 
        id, 
        area, 
        contentLength: content.length,
        metadata: Object.keys(metadata)
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to add document', { error: error.message, id });
      throw error;
    }
  }

  async searchDocuments(query, area = null, limit = 5) {
    if (!this.initialized) {
      throw new Error('Qdrant not initialized');
    }
    
    try {
      const queryEmbedding = await this.generateEmbedding(query);
      
      const searchParams = {
        vector: queryEmbedding,
        limit,
        with_payload: true,
        with_vector: false,
        score_threshold: 0.15  // Lower threshold for better recall
      };
      
      // Add area filter if specified
      if (area) {
        searchParams.filter = {
          must: [
            {
              key: 'area',
              match: { value: area }
            }
          ]
        };
      }
      
      const results = await this.client.search(this.collections.documents, searchParams);
      
      return results.map(result => ({
        id: result.id,
        score: result.score,
        content: result.payload.content,
        area: result.payload.area,
        type: result.payload.type,
        metadata: {
          filename: result.payload.filename,
          upload_date: result.payload.timestamp,
          file_type: result.payload.file_type
        }
      }));
      
    } catch (error) {
      logger.error('Failed to search documents', { error: error.message, query });
      throw error;
    }
  }

  async generateEmbedding(text) {
    const embeddingService = require('../services/embeddings');
    
    if (!embeddingService.initialized) {
      await embeddingService.initialize();
    }
    
    return await embeddingService.generateEmbedding(text);
  }

  async getStats() {
    try {
      const collections = await this.client.getCollections();
      const stats = {};
      
      for (const collection of collections.collections) {
        const info = await this.client.getCollection(collection.name);
        stats[collection.name] = {
          vectors_count: info.vectors_count || 0,
          points_count: info.points_count || 0,
          status: info.status
        };
      }
      
      return stats;
    } catch (error) {
      logger.error('Failed to get Qdrant stats', { error: error.message });
      return {};
    }
  }
}

module.exports = new QdrantManager();