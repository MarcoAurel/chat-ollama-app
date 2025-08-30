-- Schema compatible SQLite -> PostgreSQL
-- Designed for easy migration to Supabase/PostgreSQL

-- Table: conversations
-- Stores individual messages in conversations
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    area TEXT NOT NULL,
    user_message TEXT NOT NULL,
    bot_response TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    message_order INTEGER NOT NULL,
    
    -- Indexes for performance
    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

-- Table: chat_sessions  
-- Groups conversations by session
CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY,
    area TEXT NOT NULL,
    title TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    message_count INTEGER DEFAULT 0,
    
    -- For PostgreSQL compatibility
    CONSTRAINT area_not_empty CHECK (length(area) > 0)
);

-- Table: user_sessions (for express-session)
-- Session management compatible with connect-sqlite3
CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    sess TEXT NOT NULL,
    expire INTEGER NOT NULL
);

-- Indexes for performance (compatible with PostgreSQL)
CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_area ON conversations(area);
CREATE INDEX IF NOT EXISTS idx_conversations_timestamp ON conversations(timestamp);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_area ON chat_sessions(area);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at ON chat_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire);

-- Migration notes for PostgreSQL:
-- 1. Change TEXT to VARCHAR(255) for limited fields
-- 2. Change DATETIME to TIMESTAMP WITH TIME ZONE
-- 3. Add UUID extension: CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- 4. Change TEXT PRIMARY KEY to UUID DEFAULT uuid_generate_v4()