const { pipeline } = require('@xenova/transformers');
const winston = require('winston');

// Configure logger
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

class EmbeddingService {
  constructor() {
    this.pipeline = null;
    this.model = 'Xenova/all-MiniLM-L6-v2'; // 384 dimensions, perfect for Qdrant
    this.initialized = false;
  }

  async initialize() {
    try {
      logger.info('🧠 Initializing embedding model...');
      
      // Initialize the feature extraction pipeline
      this.pipeline = await pipeline('feature-extraction', this.model);
      
      this.initialized = true;
      logger.info('✅ Embedding model initialized successfully', { 
        model: this.model,
        dimensions: 384
      });
      
      return true;
    } catch (error) {
      logger.error('❌ Failed to initialize embedding model', { 
        error: error.message,
        stack: error.stack
      });
      return false;
    }
  }

  async generateEmbedding(text) {
    if (!this.initialized) {
      throw new Error('Embedding service not initialized');
    }

    try {
      // Clean and truncate text if too long
      const cleanText = this.cleanText(text);
      
      // Generate embedding
      const output = await this.pipeline(cleanText, { 
        pooling: 'mean', 
        normalize: true 
      });
      
      // Convert to array
      const embedding = Array.from(output.data);
      
      logger.info('📊 Generated embedding', { 
        textLength: cleanText.length,
        dimensions: embedding.length
      });
      
      return embedding;
    } catch (error) {
      logger.error('Failed to generate embedding', { 
        error: error.message,
        textLength: text?.length 
      });
      throw error;
    }
  }

  async generateBatchEmbeddings(texts) {
    if (!this.initialized) {
      throw new Error('Embedding service not initialized');
    }

    try {
      const embeddings = [];
      
      logger.info('🔄 Processing batch embeddings', { batchSize: texts.length });
      
      for (let i = 0; i < texts.length; i++) {
        const embedding = await this.generateEmbedding(texts[i]);
        embeddings.push(embedding);
        
        // Progress logging for large batches
        if ((i + 1) % 10 === 0) {
          logger.info(`📊 Batch progress: ${i + 1}/${texts.length}`);
        }
      }
      
      return embeddings;
    } catch (error) {
      logger.error('Failed to generate batch embeddings', { error: error.message });
      throw error;
    }
  }

  cleanText(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    // Clean and normalize text
    let cleaned = text
      .replace(/\s+/g, ' ') // Multiple spaces to single space
      .replace(/\n+/g, ' ') // Multiple newlines to single space
      .trim();
    
    // Truncate if too long (BERT models typically handle ~512 tokens)
    if (cleaned.length > 2000) {
      cleaned = cleaned.substring(0, 2000) + '...';
    }
    
    return cleaned;
  }

  async testEmbedding() {
    try {
      const testText = "This is a test document for the RAG system.";
      const embedding = await this.generateEmbedding(testText);
      
      return {
        success: true,
        dimensions: embedding.length,
        sample: embedding.slice(0, 5), // First 5 dimensions
        text: testText
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  getStats() {
    return {
      initialized: this.initialized,
      model: this.model,
      dimensions: 384
    };
  }
}

module.exports = new EmbeddingService();