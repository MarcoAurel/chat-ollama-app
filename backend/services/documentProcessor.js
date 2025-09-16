const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const xlsx = require('xlsx');
const csv = require('csv-parser');
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
      'application/json',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
      // Image types for OCR
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/gif',
      'image/bmp',
      'image/tiff'
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
        
      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      case 'application/vnd.ms-excel':
        return this.extractExcelContent(buffer, filename);
        
      case 'text/csv':
        return await this.extractCsvContent(buffer);
        
      case 'image/png':
      case 'image/jpeg':  
      case 'image/jpg':
      case 'image/gif':
      case 'image/bmp':
      case 'image/tiff':
        return await this.extractImageContent(buffer, filename);
        
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
    try {
      logger.info('🔍 Attempting OCR extraction via remote service for image-based PDF');
      
      // Check if OCR service is enabled
      const ocrServiceUrl = process.env.OCR_SERVICE_URL;
      const ocrEnabled = process.env.OCR_ENABLED === 'true';
      
      if (!ocrEnabled || !ocrServiceUrl) {
        logger.info('📸 OCR service disabled or not configured');
        logger.info('💡 Set OCR_ENABLED=true and OCR_SERVICE_URL in .env to enable');
        return '';
      }

      logger.info('🌐 Sending document to OCR service', { serviceUrl: ocrServiceUrl });
      
      const axios = require('axios');
      const FormData = require('form-data');
      
      // Create form data with the PDF buffer
      const formData = new FormData();
      formData.append('file', buffer, {
        filename: 'document.pdf',
        contentType: 'application/pdf'
      });
      
      const timeout = parseInt(process.env.OCR_SERVICE_TIMEOUT) || 180000; // 3 minutes default
      
      try {
        const response = await axios.post(`${ocrServiceUrl}/process`, formData, {
          headers: {
            ...formData.getHeaders(),
          },
          timeout: timeout,
          maxContentLength: 50 * 1024 * 1024, // 50MB
          maxBodyLength: 50 * 1024 * 1024
        });
        
        if (response.data && response.data.success) {
          const extractedText = response.data.extractedText;
          
          logger.info('✅ OCR service extraction successful', { 
            contentLength: extractedText?.length || 0,
            serviceResponse: response.data.filename
          });
          
          return extractedText || '';
        } else {
          logger.warn('⚠️ OCR service returned unsuccessful result', { 
            response: response.data 
          });
          return '';
        }
        
      } catch (serviceError) {
        if (serviceError.code === 'ECONNREFUSED') {
          logger.error('❌ OCR service connection refused', { 
            serviceUrl: ocrServiceUrl,
            error: 'Service may be down' 
          });
        } else if (serviceError.code === 'ETIMEDOUT') {
          logger.error('⏰ OCR service timeout', { 
            serviceUrl: ocrServiceUrl,
            timeout: timeout 
          });
        } else {
          logger.error('❌ OCR service error', { 
            serviceUrl: ocrServiceUrl,
            error: serviceError.message 
          });
        }
        
        return '';
      }
      
    } catch (ocrError) {
      logger.error('❌ OCR extraction failed', { 
        error: ocrError.message,
        stack: ocrError.stack 
      });
      
      logger.info('💡 Troubleshooting:');
      logger.info('  - Check OCR service status: http://172.19.5.212:3002/health');
      logger.info('  - Verify OCR_SERVICE_URL in .env');
      logger.info('  - Ensure network connectivity to OCR service');
      
      return '';
    }
  }

  async extractImageContent(buffer, filename) {
    try {
      logger.info('🖼️ Processing image file via OCR service', { filename });
      
      // Check if OCR service is enabled
      const ocrServiceUrl = process.env.OCR_SERVICE_URL;
      const ocrEnabled = process.env.OCR_ENABLED === 'true';
      
      if (!ocrEnabled || !ocrServiceUrl) {
        logger.warn('📸 OCR service disabled for image processing', { filename });
        return 'Imagen procesada - contenido no disponible (OCR deshabilitado)';
      }

      const axios = require('axios');
      const FormData = require('form-data');
      
      // Create form data with the image buffer
      const formData = new FormData();
      formData.append('file', buffer, {
        filename: filename,
        contentType: this.getImageContentType(filename)
      });
      
      const timeout = parseInt(process.env.OCR_SERVICE_TIMEOUT) || 180000;
      
      try {
        const response = await axios.post(`${ocrServiceUrl}/process`, formData, {
          headers: {
            ...formData.getHeaders(),
          },
          timeout: timeout,
          maxContentLength: 50 * 1024 * 1024, // 50MB
          maxBodyLength: 50 * 1024 * 1024
        });
        
        if (response.data && response.data.success) {
          const extractedText = response.data.extractedText;
          
          if (extractedText && extractedText.trim().length > 0) {
            logger.info('✅ Image OCR extraction successful', { 
              filename,
              contentLength: extractedText.length
            });
            
            return `=== CONTENIDO EXTRAÍDO DE IMAGEN: ${filename} ===\n${extractedText}`;
          } else {
            logger.info('📷 Image processed but no text detected', { filename });
            return `Imagen procesada: ${filename} - No se detectó texto`;
          }
        } else {
          logger.warn('⚠️ OCR service returned unsuccessful result for image', { 
            filename,
            response: response.data 
          });
          return `Imagen procesada: ${filename} - Error en OCR`;
        }
        
      } catch (serviceError) {
        logger.error('❌ OCR service error for image', { 
          filename,
          serviceUrl: ocrServiceUrl,
          error: serviceError.message 
        });
        
        return `Imagen procesada: ${filename} - Servicio OCR no disponible`;
      }
      
    } catch (error) {
      logger.error('❌ Image processing failed', { 
        filename,
        error: error.message 
      });
      
      return `Imagen procesada: ${filename} - Error de procesamiento`;
    }
  }

  getImageContentType(filename) {
    const extension = path.extname(filename).toLowerCase();
    const typeMap = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.tiff': 'image/tiff'
    };
    return typeMap[extension] || 'image/png';
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

  extractExcelContent(buffer, filename) {
    try {
      logger.info('📊 Processing Excel file', { filename });
      
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      let extractedContent = '';
      
      // Process all sheets
      workbook.SheetNames.forEach((sheetName, index) => {
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert sheet to JSON for better structure
        const jsonData = xlsx.utils.sheet_to_json(worksheet, { 
          header: 1, // Use array of arrays format
          defval: '' // Default value for empty cells
        });
        
        extractedContent += `\n=== HOJA ${index + 1}: ${sheetName} ===\n`;
        
        if (jsonData.length > 0) {
          // Process as table with headers
          jsonData.forEach((row, rowIndex) => {
            if (row.length > 0) {
              const rowText = row.join(' | ');
              extractedContent += `${rowText}\n`;
              
              // Add separator after header row
              if (rowIndex === 0) {
                extractedContent += `${'-'.repeat(rowText.length)}\n`;
              }
            }
          });
        } else {
          extractedContent += '(Hoja vacía)\n';
        }
        
        extractedContent += '\n';
      });
      
      logger.info('✅ Excel extraction successful', { 
        filename,
        sheets: workbook.SheetNames.length,
        contentLength: extractedContent.length
      });
      
      return extractedContent;
    } catch (error) {
      logger.error('Excel extraction failed', { filename, error: error.message });
      throw new Error(`Excel extraction failed: ${error.message}`);
    }
  }

  async extractCsvContent(buffer) {
    try {
      logger.info('📄 Processing CSV file');
      
      const csvContent = buffer.toString('utf-8');
      const results = [];
      
      return new Promise((resolve, reject) => {
        const stream = require('stream');
        const readable = new stream.Readable();
        readable._read = () => {}; // _read is required but you can noop it
        readable.push(csvContent);
        readable.push(null);
        
        readable
          .pipe(csv({
            skipEmptyLines: true,
            trim: true
          }))
          .on('data', (data) => results.push(data))
          .on('end', () => {
            try {
              let extractedContent = '';
              
              if (results.length > 0) {
                // Get headers
                const headers = Object.keys(results[0]);
                extractedContent += `=== ARCHIVO CSV ===\n`;
                extractedContent += `${headers.join(' | ')}\n`;
                extractedContent += `${'-'.repeat(headers.join(' | ').length)}\n`;
                
                // Add data rows
                results.forEach(row => {
                  const rowValues = headers.map(header => row[header] || '');
                  extractedContent += `${rowValues.join(' | ')}\n`;
                });
              } else {
                extractedContent = '(Archivo CSV vacío)';
              }
              
              logger.info('✅ CSV extraction successful', { 
                rows: results.length,
                contentLength: extractedContent.length
              });
              
              resolve(extractedContent);
            } catch (error) {
              logger.error('CSV processing failed', { error: error.message });
              reject(new Error(`CSV processing failed: ${error.message}`));
            }
          })
          .on('error', (error) => {
            logger.error('CSV parsing failed', { error: error.message });
            reject(new Error(`CSV parsing failed: ${error.message}`));
          });
      });
    } catch (error) {
      logger.error('CSV extraction failed', { error: error.message });
      throw new Error(`CSV extraction failed: ${error.message}`);
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
      '.json': 'application/json',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.xls': 'application/vnd.ms-excel',
      '.csv': 'text/csv',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.tiff': 'image/tiff'
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