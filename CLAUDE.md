# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a chat application ("Luckia Chat") that integrates Ollama LLM models with a React frontend and Express backend. The system supports multi-area authentication, RAG (Retrieval-Augmented Generation) capabilities via Supabase, streaming responses, and document processing.

## Architecture

### Backend (Node.js/Express)
- **Main Server** (`backend/index.js` on port 3001): Handles chat API, authentication, document upload, and RAG integration
- **Admin Server** (`backend/admin-server.js` on port 3002): Dedicated server for administrative panel operations
- **Progressive Initialization**: Critical services (database, config) load synchronously; optional services (Supabase, embeddings) load asynchronously to prevent blocking

### Frontend (React + Vite)
- **Port**: 5173 (development)
- **Framework**: React 19 with React Router
- **Styling**: Tailwind CSS
- **Key Features**: Streaming chat UI, markdown rendering, file upload, admin panel, dark mode

### Key Services
1. **Database Service** (`backend/database/database.js`): SQLite database for chat sessions and conversations
2. **Supabase Service** (`backend/config/supabase.js`): Vector storage and document search for RAG
3. **Document Processor** (`backend/services/documentProcessor.js`): Processes PDFs, DOCX, images, text files
4. **Embedding Service** (`backend/services/embeddings.js`): Generates vector embeddings for semantic search
5. **Initialization Service** (`backend/services/initialization.js`): Manages progressive service startup

### RAG Implementation
- Documents are uploaded through the admin panel (requires admin area: "informatica" or "sistemas")
- Content is chunked, embedded, and stored in Supabase
- During chat, relevant documents are retrieved and injected into the prompt context
- Falls back gracefully if Supabase is unavailable

### Circuit Breaker Pattern
- Protects against Ollama service failures
- 3 failure threshold before circuit opens
- 60 second reset time for recovery attempts

## Development Commands

### Backend
```bash
cd backend
npm install              # Install dependencies
npm run dev              # Development mode with nodemon (auto-restart)
npm start                # Production mode
npm test                 # Run tests with Jest
npm run test:watch       # Watch mode for tests
npm run test:coverage    # Generate coverage report
node admin-server.js     # Start admin server on port 3002
```

### Frontend
```bash
cd frontend
npm install              # Install dependencies
npm run dev              # Development server (Vite)
npm run build            # Production build
npm run preview          # Preview production build
npm test                 # Run tests with Vitest
npm run test:ui          # Vitest UI
npm run test:coverage    # Coverage report
npm run lint             # ESLint
```

### Startup Order
1. Backend server (port 3001) - **must start first**
2. Admin server (port 3002) - optional, for admin panel
3. Frontend (port 5173)
4. Access: http://localhost:5173

## Environment Configuration

Copy `backend/.env.example` to `backend/.env` and configure:

**Required**:
- `OLLAMA_BASE_URL`: Ollama server URL (default: http://172.19.5.212:11434)
- `AREA_CONFIG_PATH`: Path to area configuration JSON (default: ./backend/config/area_config.json)
- `SESSION_SECRET`: Session encryption key

**Optional** (for RAG features):
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anonymous key

## Area Configuration

Areas are defined in `backend/config/area_config.json`:
```json
{
  "area_name": {
    "password_hash": "bcrypt_hash",
    "agent_config": {
      "model": "llama3.2:3b",
      "system_prompt": "...",
      "temperature": 0.7,
      "max_tokens": 2000
    }
  }
}
```

Each area gets its own:
- Authentication credentials
- LLM model configuration
- System prompt
- Chat history isolation

## Key API Endpoints

### Authentication
- `POST /api/login` - Area-based login, returns JWT token
- `POST /api/logout` - Session destruction

### Chat
- `POST /api/chat` - Main chat endpoint
  - Supports `stream: true` for Server-Sent Events
  - Automatic RAG context injection if documents available
  - Creates session automatically on first message

### Admin (requires JWT token in `Authorization: Bearer <token>`)
- `POST /api/admin/documents/upload` - Upload documents for RAG (multipart/form-data)
- `GET /api/admin/documents/stats` - Get document statistics

### Health
- `GET /health` - Health check with service status
- `GET /api/status` - Detailed server and service status

## Database Schema

SQLite database at `backend/database/luckia_chat.db`:

**Tables**:
- `chat_sessions`: Session metadata (id, area, title, timestamps)
- `conversations`: Messages (id, session_id, area, user_message, bot_response, message_order)

See `backend/database/schema.sql` for full schema.

## File Upload Support

**Allowed Types**:
- Documents: TXT, MD, CSV, JSON, PDF, DOC, DOCX
- Images: PNG, JPG, JPEG, GIF, WEBP

**Limits**:
- Max file size: 10MB per file
- Max files per upload: 5
- Total request size: 1MB (for non-file requests)

**Processing**:
- Text extraction from PDFs (pdf-parse)
- DOCX parsing (mammoth)
- OCR for images (tesseract.js)

## Important Patterns

### Service Availability Check
Always check if optional services are initialized before use:
```javascript
const supabase = getOptionalService('supabase');
if (supabase && supabase.initialized) {
  // Use Supabase
}
```

### Error Handling
- Circuit breaker protects Ollama requests
- Graceful degradation: app works without Supabase/embeddings
- Logging via Winston to `logs/error.log` and `logs/compiled.log`

### Session Management
- Sessions stored in SQLite (`backend/database/sessions.db`)
- 7-day cookie expiration
- Session created automatically on first chat message

## Testing

Backend tests use Jest, frontend uses Vitest. Both support watch mode and coverage reporting.

## Security Features

- Helmet.js for security headers
- Rate limiting (100 req/min general, 10 login attempts per 15 min)
- CORS configured for localhost development
- bcrypt password hashing
- JWT tokens for admin operations
- Input validation with express-validator

## Branding Configuration

Branding settings in `backend/config/branding.js` - fetched via `GET /api/branding`

## Logging

Winston logger with:
- Console output (colorized)
- File output: `logs/error.log` (errors only), `logs/combined.log` (all)
- Structured JSON format with timestamps

## Known Patterns

- **Streaming**: SSE (Server-Sent Events) for real-time chat responses
- **RAG Context**: Injected as additional prompt content with document metadata
- **Admin Access**: Only "informatica" and "sistemas" areas have admin panel access
- **Dark Mode**: Persisted in localStorage, respects system preference as default
