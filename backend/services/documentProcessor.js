const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const winston = require('winston');
const crypto = require('crypto');

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

class DocumentProcessor {
  constructor() {
    this.supportedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown',
      'application/json'
    ];
  }

  async processDocument(filePathOrBuffer, filename, area = 'general', metadata = {}) {
    try {
      logger.info('📄 Processing document', { filename, area });
      
      // Read file - handle both file path and buffer
      let buffer;
      if (Buffer.isBuffer(filePathOrBuffer)) {
        buffer = filePathOrBuffer;
      } else if (typeof filePathOrBuffer === 'string') {
        buffer = fs.readFileSync(filePathOrBuffer);
      } else {
        throw new Error('Invalid input: expected file path string or buffer');
      }
      
      const fileType = this.detectFileType(filename, buffer);
      
      if (!this.supportedTypes.includes(fileType)) {
        throw new Error(`Unsupported file type: ${fileType}`);
      }

      // Extract content based on file type
      const content = await this.extractContent(buffer, fileType, filename);
      
      // Validate final content before processing
      if (!content || content.trim().length < 10) {
        logger.warn('❌ Document content too short or empty, skipping processing', {
          filename,
          contentLength: content?.length || 0
        });
        return []; // Return empty array instead of invalid documents
      }
      
      // Create chunks for better RAG performance
      const chunks = this.createChunks(content, filename);
      
      if (chunks.length === 0) {
        logger.warn('❌ No valid chunks created, skipping document', { filename });
        return [];
      }
      
      // Prepare documents for Qdrant
      const documents = chunks.map((chunk, index) => ({
        id: this.generateDocumentId(filename, index),
        content: chunk,
        metadata: {
          filename,
          file_type: fileType,
          chunk_index: index,
          total_chunks: chunks.length,
          area,
          upload_date: new Date().toISOString(),
          file_size: buffer.length,
          ...metadata
        }
      }));
      
      logger.info('✅ Document processed successfully', {
        filename,
        fileType,
        contentLength: content.length,
        chunks: chunks.length
      });
      
      return documents;
    } catch (error) {
      logger.error('❌ Document processing failed', {
        filename,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  async extractContent(buffer, fileType, filename) {
    switch (fileType) {
      case 'application/pdf':
        return await this.extractPdfContent(buffer);
        
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return await this.extractDocxContent(buffer);
        
      case 'text/plain':
      case 'text/markdown':
        return buffer.toString('utf-8');
        
      case 'application/json':
        return this.extractJsonContent(buffer);
        
      default:
        throw new Error(`Content extraction not implemented for ${fileType}`);
    }
  }

  async extractPdfContent(buffer) {
    try {
      const data = await pdfParse(buffer);
      const extractedText = data.text;
      
      // Validate extracted content quality
      if (this.isContentValid(extractedText)) {
        logger.info('📄 PDF text extraction successful', { 
          contentLength: extractedText.length,
          method: 'text-based'
        });
        return extractedText;
      } else {
        logger.warn('⚠️ PDF text extraction poor quality, attempting OCR', {
          extractedLength: extractedText.length,
          preview: extractedText.substring(0, 200)
        });
        
        // Attempt OCR extraction
        return await this.extractPdfWithOCR(buffer);
      }
    } catch (error) {
      logger.error('PDF extraction failed', { error: error.message });
      throw new Error(`PDF extraction failed: ${error.message}`);
    }
  }

  isContentValid(text) {
    if (!text || text.trim().length < 50) {
      return false;
    }
    
    // Check for repetitive content (like URLs)
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    if (lines.length > 5) {
      const uniqueLines = new Set(lines);
      const repetitionRatio = uniqueLines.size / lines.length;
      if (repetitionRatio < 0.3) {
        return false; // Too repetitive
      }
    }
    
    // Check for meaningful content (letters vs symbols)
    const letterCount = (text.match(/[a-zA-ZáéíóúñüÁÉÍÓÚÑÜ]/g) || []).length;
    const letterRatio = letterCount / text.length;
    
    return letterRatio > 0.6; // At least 60% letters
  }

  async extractPdfWithOCR(buffer) {
    logger.info('🔍 OCR extraction attempted for image-based PDF');
    logger.warn('📸 OCR requires additional system dependencies (ImageMagick/GraphicsMagick)');
    logger.info('💡 Alternative: Convert PDF to text manually or use different PDF format');
    
    // For now, return empty string to avoid storing invalid content
    // This can be extended when proper OCR dependencies are installed
    return '';
  }

  async extractDocxContent(buffer) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      logger.error('DOCX extraction failed', { error: error.message });
      throw new Error(`DOCX extraction failed: ${error.message}`);
    }
  }

  extractJsonContent(buffer) {
    try {
      const json = JSON.parse(buffer.toString('utf-8'));
      // Convert JSON to readable text
      return JSON.stringify(json, null, 2);
    } catch (error) {
      logger.error('JSON extraction failed', { error: error.message });
      throw new Error(`JSON extraction failed: ${error.message}`);
    }
  }

  createChunks(content, filename, maxChunkSize = 1000, overlap = 200) {
    if (!content || content.length === 0) {
      return [];
    }

    const chunks = [];
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    let currentChunk = '';
    let currentSize = 0;
    
    for (const sentence of sentences) {
      const sentenceSize = sentence.trim().length;
      
      // If adding this sentence would exceed max size, save current chunk
      if (currentSize + sentenceSize > maxChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        
        // Start new chunk with overlap
        const words = currentChunk.split(' ');
        const overlapWords = words.slice(-Math.floor(overlap / 5)); // Approximate overlap
        currentChunk = overlapWords.join(' ') + ' ' + sentence.trim();
        currentSize = currentChunk.length;
      } else {
        currentChunk += ' ' + sentence.trim();
        currentSize += sentenceSize;
      }
    }
    
    // Add final chunk
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }
    
    // Ensure we have at least one chunk
    if (chunks.length === 0) {
      chunks.push(content.substring(0, maxChunkSize));
    }
    
    logger.info('📝 Created chunks', {
      filename,
      totalChunks: chunks.length,
      avgChunkSize: Math.round(chunks.reduce((sum, chunk) => sum + chunk.length, 0) / chunks.length)
    });
    
    return chunks;
  }

  detectFileType(filename, buffer) {
    const extension = path.extname(filename).toLowerCase();
    
    // Magic number detection for PDFs
    if (buffer.slice(0, 4).toString() === '%PDF') {
      return 'application/pdf';
    }
    
    // Magic number detection for DOCX (ZIP signature)
    if (buffer.slice(0, 2).toString('hex') === '504b') {
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }
    
    // Extension-based fallback
    const typeMap = {
      '.pdf': 'application/pdf',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.json': 'application/json'
    };
    
    return typeMap[extension] || 'text/plain';
  }

  generateDocumentId(filename, chunkIndex) {
    const hash = crypto.createHash('md5').update(`${filename}-${chunkIndex}`).digest('hex');
    // Convert first 8 hex chars to integer for Qdrant compatibility
    return parseInt(hash.substring(0, 8), 16);
  }

  async validateDocument(filePathOrBuffer, filename) {
    try {
      let fileSize;
      let buffer;
      
      if (Buffer.isBuffer(filePathOrBuffer)) {
        // Handle buffer input
        buffer = filePathOrBuffer.slice(0, 1024); // First 1KB for type detection
        fileSize = filePathOrBuffer.length;
      } else if (typeof filePathOrBuffer === 'string') {
        // Handle file path input
        const stats = fs.statSync(filePathOrBuffer);
        fileSize = stats.size;
        buffer = fs.readFileSync(filePathOrBuffer, { start: 0, end: 1023 });
      } else {
        throw new Error('Invalid input: expected file path string or buffer');
      }
      
      // Size limits (10MB max)
      if (fileSize > 10 * 1024 * 1024) {
        throw new Error('File too large (max 10MB)');
      }
      
      const fileType = this.detectFileType(filename, buffer);
      
      if (!this.supportedTypes.includes(fileType)) {
        throw new Error(`Unsupported file type: ${fileType}`);
      }
      
      return {
        valid: true,
        fileSize,
        fileType,
        filename
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message,
        filename
      };
    }
  }

  getSupportedTypes() {
    return this.supportedTypes;
  }

  getStats() {
    return {
      supportedTypes: this.supportedTypes,
      maxFileSize: '10MB',
      chunkSize: 1000,
      chunkOverlap: 200
    };
  }
}

module.exports = new DocumentProcessor();