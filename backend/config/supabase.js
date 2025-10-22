const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

class SupabaseManager {
  constructor() {
    this.client = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      logger.info('🔍 Initializing Supabase connection...');

      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase credentials in environment variables');
      }

      this.client = createClient(supabaseUrl, supabaseKey);

      // Test connection
      const { error } = await this.client.from('documents').select('count', { count: 'exact', head: true });

      if (error && error.code !== 'PGRST116') { // PGRST116 = table doesn't exist yet, which is OK
        throw error;
      }

      this.initialized = true;
      logger.info('✅ Supabase connection successful');
      logger.info('🚀 Supabase initialized successfully');

      return true;
    } catch (error) {
      logger.error('❌ Failed to initialize Supabase', { error: error.message });
      this.initialized = false;
      throw error;
    }
  }

  async ensureTablesExist() {
    if (!this.initialized) {
      throw new Error('Supabase not initialized');
    }

    try {
      // Create documents table if it doesn't exist
      const { error: tableError } = await this.client.rpc('create_documents_table_if_not_exists');

      if (tableError && !tableError.message.includes('already exists')) {
        logger.warn('Documents table creation info:', tableError.message);
      }

      // Enable vector extension and create vector column if needed
      const { error: vectorError } = await this.client.rpc('enable_vector_extension');

      if (vectorError && !vectorError.message.includes('already exists')) {
        logger.warn('Vector extension info:', vectorError.message);
      }

      logger.info('✅ Database tables verified/created');
    } catch (error) {
      logger.error('Error ensuring tables exist:', error.message);
      // Don't throw - tables might already exist
    }
  }

  async addDocument(documentId, content, metadata, area) {
    if (!this.initialized) {
      throw new Error('Supabase not initialized');
    }

    try {
      // Generate embedding - for now we'll use a simple placeholder
      // In production, you'd call an embedding API here
      const embedding = this.generatePlaceholderEmbedding(content);

      const documentData = {
        id: documentId,
        content: content,
        metadata: {
          ...metadata,
          area: area,
          uploaded_at: new Date().toISOString()
        },
        embedding: embedding,
        area: area
      };

      const { data, error } = await this.client
        .from('documents')
        .upsert(documentData);

      if (error) {
        throw error;
      }

      logger.info('✅ Document added to Supabase', {
        documentId,
        area,
        contentLength: content.length
      });

      return data;
    } catch (error) {
      logger.error('❌ Error adding document to Supabase', {
        documentId,
        area,
        error: error.message
      });
      throw error;
    }
  }

  async searchDocuments(query, area = null, limit = 5) {
    if (!this.initialized) {
      throw new Error('Supabase not initialized');
    }

    try {
      let queryBuilder = this.client
        .from('documents')
        .select('*');

      if (area) {
        queryBuilder = queryBuilder.eq('area', area);
      }

      // For now, simple text search - in production you'd use vector similarity
      queryBuilder = queryBuilder.textSearch('content', query);
      queryBuilder = queryBuilder.limit(limit);

      const { data, error } = await queryBuilder;

      if (error) {
        throw error;
      }

      logger.info('🔍 Document search completed', {
        query,
        area,
        resultsCount: data?.length || 0
      });

      return data || [];
    } catch (error) {
      logger.error('❌ Error searching documents', {
        query,
        area,
        error: error.message
      });
      throw error;
    }
  }

  async getStats() {
    if (!this.initialized) {
      throw new Error('Supabase not initialized');
    }

    try {
      const { data, error, count } = await this.client
        .from('documents')
        .select('area', { count: 'exact' });

      if (error) {
        throw error;
      }

      // Group by area
      const stats = {};
      if (data) {
        data.forEach(doc => {
          const area = doc.area || 'general';
          stats[area] = (stats[area] || 0) + 1;
        });
      }

      return {
        total_documents: count || 0,
        by_area: stats,
        status: 'connected'
      };
    } catch (error) {
      logger.error('❌ Error getting Supabase stats', { error: error.message });
      throw error;
    }
  }

  async getCollectionInfo() {
    const stats = await this.getStats();
    return {
      points_count: stats.total_documents,
      status: 'green'
    };
  }

  async testConnection() {
    try {
      if (!this.initialized) {
        return {
          status: 'not_initialized',
          message: 'Supabase not initialized'
        };
      }

      const { data, error } = await this.client
        .from('documents')
        .select('count', { count: 'exact', head: true });

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return {
        status: 'connected',
        message: 'Supabase connection successful',
        documents_count: data || 0
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message
      };
    }
  }

  // Placeholder embedding generator - replace with real embedding service
  generatePlaceholderEmbedding(text) {
    // Generate a simple hash-based vector for demonstration
    // In production, use OpenAI embeddings, Sentence Transformers, etc.
    const vector = new Array(384).fill(0);
    for (let i = 0; i < text.length && i < 384; i++) {
      vector[i % 384] += text.charCodeAt(i) / 1000;
    }
    return vector;
  }
}

// Create singleton instance
const supabaseManager = new SupabaseManager();

module.exports = supabaseManager;