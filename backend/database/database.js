const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class Database {
  constructor() {
    this.db = null;
    this.logger = null;
  }

  // Initialize database with logger
  initialize(logger) {
    this.logger = logger;
    return new Promise((resolve, reject) => {
      try {
        // Ensure database directory exists
        const dbDir = path.join(__dirname);
        if (!fs.existsSync(dbDir)) {
          fs.mkdirSync(dbDir, { recursive: true });
        }

        const dbPath = path.join(dbDir, 'luckia_chat.db');
        
        this.db = new sqlite3.Database(dbPath, (err) => {
          if (err) {
            this.logger.error('Database connection failed', { error: err.message });
            reject(err);
            return;
          }

          this.logger.info('Database connected successfully', { path: dbPath });
          this.initializeSchema()
            .then(() => {
              this.logger.info('Database schema initialized');
              resolve();
            })
            .catch(reject);
        });
      } catch (error) {
        this.logger.error('Database initialization failed', { error: error.message });
        reject(error);
      }
    });
  }

  // Initialize database schema
  initializeSchema() {
    return new Promise((resolve, reject) => {
      const schemaPath = path.join(__dirname, 'schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');
      
      this.db.exec(schema, (err) => {
        if (err) {
          this.logger.error('Schema initialization failed', { error: err.message });
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  // Create new chat session
  createSession(area) {
    return new Promise((resolve, reject) => {
      const sessionId = uuidv4();
      const title = `Chat ${new Date().toLocaleString()}`;
      
      const query = `
        INSERT INTO chat_sessions (id, area, title, created_at, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;
      
      this.db.run(query, [sessionId, area, title], function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(sessionId);
      });
    });
  }

  // Save conversation message
  saveMessage(sessionId, area, userMessage, botResponse) {
    return new Promise((resolve, reject) => {
      const messageId = uuidv4();
      
      // First, get message order
      this.db.get(
        'SELECT COALESCE(MAX(message_order), 0) + 1 as next_order FROM conversations WHERE session_id = ?',
        [sessionId],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }

          const messageOrder = row.next_order;
          
          // Insert conversation message
          const query = `
            INSERT INTO conversations (id, session_id, area, user_message, bot_response, timestamp, message_order)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
          `;
          
          this.db.run(query, [messageId, sessionId, area, userMessage, botResponse, messageOrder], (err) => {
            if (err) {
              reject(err);
              return;
            }

            // Update session message count and updated_at
            this.db.run(
              'UPDATE chat_sessions SET message_count = message_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
              [sessionId],
              (err) => {
                if (err) {
                  this.logger.warn('Failed to update session count', { error: err.message });
                }
                resolve(messageId);
              }
            );
          });
        }
      );
    });
  }

  // Get conversation history for a session
  getSessionHistory(sessionId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT id, user_message, bot_response, timestamp, message_order
        FROM conversations 
        WHERE session_id = ? 
        ORDER BY message_order ASC
      `;
      
      this.db.all(query, [sessionId], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  // Get all sessions for an area
  getAreaSessions(area, limit = 50) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT id, title, created_at, updated_at, message_count
        FROM chat_sessions 
        WHERE area = ? 
        ORDER BY updated_at DESC 
        LIMIT ?
      `;
      
      this.db.all(query, [area, limit], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  // Search conversations
  searchConversations(area, searchTerm, limit = 20) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT c.id, c.session_id, c.user_message, c.bot_response, c.timestamp, s.title
        FROM conversations c
        JOIN chat_sessions s ON c.session_id = s.id
        WHERE c.area = ? AND (c.user_message LIKE ? OR c.bot_response LIKE ?)
        ORDER BY c.timestamp DESC
        LIMIT ?
      `;
      
      const searchPattern = `%${searchTerm}%`;
      
      this.db.all(query, [area, searchPattern, searchPattern, limit], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  // Update session title
  updateSessionTitle(sessionId, title) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE chat_sessions 
        SET title = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `;
      
      this.db.run(query, [title, sessionId], function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(this.changes > 0);
      });
    });
  }

  // Delete session and all its messages
  deleteSession(sessionId) {
    return new Promise((resolve, reject) => {
      // Delete conversations first (due to foreign key)
      this.db.run('DELETE FROM conversations WHERE session_id = ?', [sessionId], (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Then delete session
        this.db.run('DELETE FROM chat_sessions WHERE id = ?', [sessionId], function(err) {
          if (err) {
            reject(err);
            return;
          }
          resolve(this.changes > 0);
        });
      });
    });
  }

  // Get database instance for session store
  getDb() {
    return this.db;
  }

  // Close database connection
  close() {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            this.logger.error('Error closing database', { error: err.message });
          } else {
            this.logger.info('Database connection closed');
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

// Export singleton instance
module.exports = new Database();