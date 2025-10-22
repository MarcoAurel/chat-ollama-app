// services/initialization.js
const winston = require('winston');

class InitializationService {
  constructor() {
    this.initialized = {
      database: false,
      supabase: false,
      embeddings: false,
      config: false
    };
    this.services = {};
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.colorize(),
        winston.format.simple()
      ),
      transports: [new winston.transports.Console()]
    });
  }

  async initializeDatabase() {
    if (this.initialized.database) return this.services.database;
    
    try {
      this.logger.info('🗄️ Initializing database...');
      const database = require('../database/database');
      await database.initialize(this.logger);
      
      this.services.database = database;
      this.initialized.database = true;
      this.logger.info('✅ Database initialized successfully');
      
      return database;
    } catch (error) {
      this.logger.error('❌ Database initialization failed:', error.message);
      throw error;
    }
  }

  async loadConfiguration() {
    if (this.initialized.config) return this.services.areas;
    
    try {
      this.logger.info('⚙️ Loading configuration...');
      const fs = require('fs');
      const path = require('path');
      
      const configPath = path.resolve(process.env.AREA_CONFIG_PATH);
      const data = fs.readFileSync(configPath, 'utf-8');
      const areas = JSON.parse(data);
      
      this.services.areas = areas;
      this.initialized.config = true;
      this.logger.info('✅ Configuration loaded successfully', { 
        areasCount: Object.keys(areas).length,
        areas: Object.keys(areas) 
      });
      
      return areas;
    } catch (error) {
      this.logger.error('❌ Configuration loading failed:', error.message);
      throw error;
    }
  }

  async initializeSupabase() {
    if (this.initialized.supabase) return this.services.supabase;
    
    try {
      this.logger.info('🔍 Initializing Supabase (async)...');
      
      // Use setTimeout to make it truly async and non-blocking
      const supabase = await new Promise((resolve, reject) => {
        setTimeout(async () => {
          try {
            const supabaseService = require('../config/supabase');
            await supabaseService.initialize();
            resolve(supabaseService);
          } catch (error) {
            // Don't fail the whole app if Supabase is not available
            this.logger.warn('⚠️ Supabase initialization failed (continuing without RAG):', error.message);
            resolve(null);
          }
        }, 100); // Small delay to allow event loop to continue
      });
      
      this.services.supabase = supabase;
      this.initialized.supabase = true;
      
      if (supabase) {
        this.logger.info('✅ Supabase initialized successfully');
      } else {
        this.logger.warn('⚠️ Supabase not available - RAG features disabled');
      }
      
      return supabase;
    } catch (error) {
      this.logger.warn('⚠️ Supabase initialization failed:', error.message);
      this.services.supabase = null;
      this.initialized.supabase = true;
      return null;
    }
  }

  async initializeEmbeddings() {
    if (this.initialized.embeddings) return this.services.embeddings;
    
    try {
      this.logger.info('🧠 Initializing embedding model (background)...');
      
      // Use setTimeout to make embedding loading truly async and non-blocking
      const embeddingService = await new Promise((resolve, reject) => {
        setTimeout(async () => {
          try {
            const embeddings = require('./embeddings');
            
            // Initialize in background with progress reporting
            const initPromise = embeddings.initialize();
            
            // Add timeout to prevent hanging
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Embedding initialization timeout')), 60000); // 1 minute
            });
            
            await Promise.race([initPromise, timeoutPromise]);
            resolve(embeddings);
          } catch (error) {
            // Don't fail the whole app if embeddings fail
            this.logger.warn('⚠️ Embedding model initialization failed (continuing without embeddings):', error.message);
            resolve(null);
          }
        }, 500); // Delay to allow server to start first
      });
      
      this.services.embeddings = embeddingService;
      this.initialized.embeddings = true;
      
      if (embeddingService && embeddingService.initialized) {
        this.logger.info('✅ Embedding model initialized successfully');
      } else {
        this.logger.warn('⚠️ Embedding model not available - semantic search limited');
      }
      
      return embeddingService;
    } catch (error) {
      this.logger.warn('⚠️ Embedding initialization failed:', error.message);
      this.services.embeddings = null;
      this.initialized.embeddings = true;
      return null;
    }
  }

  async initializeAll() {
    try {
      this.logger.info('🚀 Starting progressive initialization...');
      
      // Phase 1: Critical services (required)
      await this.initializeDatabase();
      await this.loadConfiguration();
      
      this.logger.info('✅ Critical services ready - server can start');
      
      // Phase 2: Optional services (background, non-blocking)
      setTimeout(async () => {
        try {
          this.logger.info('🔄 Starting background services...');
          await this.initializeSupabase();
          await this.initializeEmbeddings();
          this.logger.info('✅ All services initialization complete');
        } catch (error) {
          this.logger.warn('⚠️ Some background services failed:', error.message);
        }
      }, 2000); // 2 second delay
      
      return {
        database: this.services.database,
        areas: this.services.areas
      };
    } catch (error) {
      this.logger.error('❌ Critical service initialization failed:', error.message);
      throw error;
    }
  }

  getService(serviceName) {
    return this.services[serviceName];
  }

  isInitialized(serviceName) {
    return this.initialized[serviceName];
  }

  getStatus() {
    return {
      initialized: { ...this.initialized },
      services: {
        database: !!this.services.database,
        areas: !!this.services.areas,
        supabase: !!this.services.supabase,
        embeddings: !!this.services.embeddings && this.services.embeddings.initialized
      }
    };
  }
}

module.exports = new InitializationService();