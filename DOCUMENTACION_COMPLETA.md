# 📖 Documentación Completa - Luckia Chat

## 🎯 Descripción del Proyecto

**Luckia Chat** es una aplicación de chat corporativo inteligente que integra modelos de IA locales a través de **Ollama** con capacidades avanzadas de búsqueda semántica usando **Qdrant**. El sistema está diseñado para entornos empresariales que requieren privacidad, control total de datos y personalización completa.

## 🏗️ Arquitectura del Sistema

### **Stack Tecnológico**
- **Backend**: Node.js + Express.js
- **Frontend**: React.js + Vite + Tailwind CSS
- **Base de Datos**: SQLite (sesiones y historial)
- **IA/LLM**: Ollama (modelos locales)
- **Vector DB**: Qdrant (búsqueda semántica)
- **Autenticación**: Basada en sesiones + bcrypt

### **Estructura de Directorios**
```
chat-ollama-app/
├── backend/
│   ├── config/
│   │   ├── area_config.json         # Configuración de áreas/usuarios
│   │   ├── branding-config.json     # Personalización visual
│   │   ├── branding.js              # Lógica de branding
│   │   ├── qdrant.js                # Cliente Qdrant
│   ├── database/
│   │   ├── database.js              # Conexión SQLite
│   │   ├── schema.sql               # Esquema DB
│   │   ├── luckia_chat.db           # Base de datos principal
│   │   ├── sessions.db              # Sesiones de usuario
│   ├── logs/                        # Logs del sistema
│   ├── services/
│   │   ├── embeddings.js            # Servicio de embeddings
│   ├── index.js                     # Servidor principal
│   ├── package.json
├── frontend/
│   ├── public/
│   │   ├── Logo_Luckia.svg         # Logo corporativo
│   ├── src/
│   │   ├── components/             # Componentes React
│   │   ├── hooks/                  # Custom hooks
│   │   ├── utils/                  # Utilidades
│   │   ├── App.jsx                 # Componente principal
│   │   ├── main.jsx                # Punto de entrada
│   ├── package.json
├── docker-compose.yml              # Orquestación servicios
├── Dockerfile.backend             # Imagen backend
├── Dockerfile.frontend            # Imagen frontend
├── .env                          # Variables de entorno
├── PERSONALIZACION.md            # Guía personalización
└── DOCUMENTACION_COMPLETA.md     # Este documento
```

## 🔧 Configuración y Variables

### **Variables de Entorno (.env)**
```bash
# Ollama Configuration
OLLAMA_BASE_URL=http://192.168.1.206:11434

# Qdrant Configuration  
QDRANT_HOST=192.168.1.206
QDRANT_PORT=6333

# Security
SESSION_SECRET=luckia-chat-secret-key-change-in-production

# Paths
AREA_CONFIG_PATH=./config/area_config.json

# Environment
NODE_ENV=development
```

### **Configuración de Áreas (area_config.json)**
Sistema multi-usuario basado en áreas corporativas:
```json
{
  "informatica": {
    "password_hash": "$2b$10$...",
    "agent_config": {
      "model": "phi3:3.8b",
      "system_prompt": "Eres un especialista de soporte técnico...",
      "temperature": 0.1,
      "max_tokens": 2000
    }
  }
}
```

### **Configuración de Branding (branding-config.json)**
Personalización visual completa:
```json
{
  "branding": {
    "company": {
      "name": "Luckia",
      "logo": "/Logo_Luckia.svg"
    },
    "app": {
      "name": "Luckia Chat",
      "agent_name": "Asistente Luckia",
      "description": "Sistema de chat inteligente con IA"
    },
    "theme": {
      "primary_color": "#1f2937",
      "accent_color": "#3b82f6",
      "background_color": "#f9fafb",
      "text_color": "#111827"
    }
  }
}
```

## 🗄️ Base de Datos

### **Esquema SQLite**
```sql
-- Sesiones de chat
CREATE TABLE chat_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL,
    area TEXT NOT NULL,
    title TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Mensajes del chat
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES chat_sessions(session_id)
);
```

## 🔌 API Endpoints

### **Autenticación**
```bash
POST /api/login
Body: { "area": "informatica", "password": "..." }
Response: { "message": "Login exitoso", "agent_config": {...} }

POST /api/logout
Response: { "message": "Logout exitoso" }
```

### **Chat Principal**
```bash
POST /api/chat
Body: { 
  "area": "informatica", 
  "prompt": "pregunta", 
  "sessionId": "uuid",
  "stream": false 
}
Response: { "response": "respuesta del AI", "sessionId": "uuid" }

POST /api/chat-stream  # Streaming de respuestas
POST /api/chat-with-files  # Chat con archivos adjuntos
```

### **Gestión de Sesiones**
```bash
GET /api/history/sessions
Response: [{ "session_id": "...", "title": "...", "created_at": "..." }]

GET /api/history/session/:sessionId
Response: [{ "role": "user", "content": "...", "timestamp": "..." }]

POST /api/history/new-session
PUT /api/history/session/:sessionId/title
DELETE /api/history/session/:sessionId
```

### **Búsqueda y Documentos**
```bash
GET /api/history/search?q=termino&limit=20
POST /api/documents/upload  # Subir documentos a Qdrant
GET /api/documents/search?query=busqueda&area=informatica&limit=5
```

### **Sistema RAG (Qdrant)**
```bash
GET /api/qdrant/status      # Estado del servicio
GET /api/qdrant/stats       # Estadísticas de colecciones
GET /api/embeddings/test    # Test de embeddings
```

### **Configuración**
```bash
GET /api/branding           # Obtener configuración de branding
```

### **Salud del Sistema**
```bash
GET /health                 # Health check
```

## 🤖 Integración con IA

### **Ollama**
- **Modelos soportados**: phi3:3.8b, llama3.2:latest, qwen2.5:7b, etc.
- **Streaming**: Soporte completo para respuestas en tiempo real
- **Configuración por área**: Cada área puede tener su modelo y configuración específica

### **Qdrant (RAG)**
- **Búsqueda semántica**: Vectorización de documentos corporativos
- **Colecciones por área**: Separación de documentos por departamento
- **Formatos soportados**: PDF, DOC, DOCX, TXT, MD, CSV, JSON
- **Embeddings**: Procesamiento automático con modelos de Ollama

## 🎨 Sistema de Personalización

### **Características**
- **Sin reinicio**: Cambios aplicados automáticamente al recargar
- **Temas predefinidos**: 5 esquemas de colores listos
- **Branding completo**: Logos, nombres, colores corporativos
- **CSS dinámico**: Variables CSS aplicadas en tiempo real

### **Temas Disponibles**
1. Azul Corporativo (default)
2. Verde Luckia
3. Rojo Elegante  
4. Púrpura
5. Naranja

## 🔐 Seguridad

### **Autenticación**
- **Hash bcrypt**: Contraseñas hasheadas con salt
- **Sesiones**: SQLite + express-session con expiración
- **Rate limiting**: Protección contra ataques de fuerza bruta
- **Helmet.js**: Headers de seguridad

### **Validación**
- **express-validator**: Validación de inputs
- **Sanitización**: Limpieza de datos de entrada
- **CORS**: Configuración específica para entornos

## 📁 Gestión de Archivos

### **Subida de Archivos**
- **Límite**: 10MB por archivo, máximo 5 archivos
- **Tipos permitidos**: PDF, DOC, DOCX, TXT, MD, CSV, JSON, imágenes
- **Procesamiento**: OCR para imágenes, extracción de texto automática
- **Almacenamiento**: En memoria durante procesamiento, vectorización en Qdrant

## 🚀 Deployment

### **Docker Compose**
```yaml
version: '3.8'
services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    ports:
      - "3001:3001"
    environment:
      - OLLAMA_BASE_URL=http://192.168.1.206:11434
      - QDRANT_HOST=192.168.1.206
      - QDRANT_PORT=6333

  frontend:
    build:
      context: .  
      dockerfile: Dockerfile.frontend
    ports:
      - "5173:5173"
```

### **Scripts Disponibles**

**Backend:**
```bash
npm run dev        # Desarrollo con nodemon
npm start          # Producción
npm test           # Tests con Jest
```

**Frontend:**
```bash
npm run dev        # Servidor de desarrollo Vite
npm run build      # Build para producción
npm run preview    # Preview del build
npm test           # Tests con Vitest
```

## 🎯 Funcionalidades Principales

### **Chat Inteligente**
- ✅ Respuestas streaming en tiempo real
- ✅ Historial persistente de conversaciones
- ✅ Búsqueda en historial con regex
- ✅ Sesiones múltiples por usuario
- ✅ Títulos automáticos de sesiones
- ✅ Exportación de conversaciones

### **RAG (Retrieval Augmented Generation)**
- ✅ Subida de documentos corporativos
- ✅ Búsqueda semántica en documentos
- ✅ Contexto automático en respuestas
- ✅ OCR para procesamiento de imágenes
- ✅ Separación por áreas/departamentos

### **Gestión Multi-Usuario**
- ✅ Áreas corporativas independientes
- ✅ Configuración específica por área
- ✅ Modelos de IA personalizados
- ✅ System prompts especializados

### **Experiencia de Usuario**
- ✅ Interfaz responsive
- ✅ Modo claro/oscuro
- ✅ Atajos de teclado
- ✅ Notificaciones toast
- ✅ Drag & drop de archivos
- ✅ Reacciones a mensajes
- ✅ Copia rápida de código

## 🔧 Personalización Avanzada

### **Modificar System Prompts**
Editar `area_config.json` para cambiar el comportamiento del AI por área:
```json
"system_prompt": "Tu nuevo comportamiento personalizado..."
```

### **Agregar Nuevas Áreas**
```json
"nueva_area": {
  "password_hash": "$2b$10$...",
  "agent_config": {
    "model": "llama3.2:latest",
    "system_prompt": "Comportamiento específico...",
    "temperature": 0.7,
    "max_tokens": 1500
  }
}
```

### **Cambiar Modelos**
Modificar el modelo de IA por área en `agent_config.model`

## 🐛 Logging y Debugging

### **Logs del Sistema**
- `logs/error.log` - Errores del sistema
- `logs/combined.log` - Logs completos
- Console - Logs de desarrollo

### **Debugging Frontend**
- React DevTools disponible
- Axios interceptors para logging de API
- Error boundaries implementados

## 📊 Monitoreo

### **Health Checks**
- `GET /health` - Estado general del sistema
- `GET /api/qdrant/status` - Estado de Qdrant
- `GET /api/embeddings/test` - Test de embeddings

### **Métricas**
- Sesiones activas por SQLite
- Estadísticas de uso por área
- Performance de queries a Qdrant

## 🔄 Workflow de GitHub Actions

### **CI/CD Pipeline**
```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline
on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
      - name: Install dependencies
        run: |
          cd backend && npm install --omit=optional
          cd ../frontend && npm install --omit=optional
      - name: Build frontend
        run: cd frontend && npm run build
      - name: Lint frontend
        run: cd frontend && npm run lint
```

## 📝 Notas de Desarrollo

### **Patrones de Código**
- **Backend**: MVC pattern, middleware chain
- **Frontend**: Hooks + Context, component composition
- **Estado**: Local state con useState, no Redux necesario
- **Estilos**: Tailwind CSS, CSS custom properties para temas

### **Convenciones**
- **Commits**: Descriptivos en español
- **Archivos**: kebab-case para archivos, PascalCase para componentes
- **Variables**: camelCase JavaScript, snake_case configuraciones
- **Logs**: Winston con levels apropiados

### **Performance**
- **Frontend**: Lazy loading, memoization con useMemo
- **Backend**: Connection pooling SQLite, streaming responses
- **Qdrant**: Búsquedas optimizadas con límites
- **Ollama**: Timeouts apropiados, modelos eficientes

## 🚨 Problemas Conocidos y Soluciones

### **CORS Issues**
Si hay problemas de CORS, verificar configuración en `index.js`:
```javascript
app.use(cors({
  origin: function (origin, callback) {
    // Configuración permisiva para desarrollo
    callback(null, true);
  },
  credentials: true
}));
```

### **Timeouts de Ollama**
Para respuestas largas, ajustar timeouts:
```javascript
timeout: 180000 // 3 minutos
```

### **Memoria Qdrant**
Para grandes volúmenes de documentos, monitorear uso de memoria de Qdrant.

---

## 📋 Estado Actual del Proyecto

**✅ Completamente Funcional**
- Chat streaming con IA local
- Sistema RAG con documentos
- Multi-usuario por áreas
- Personalización completa
- Interfaz moderna y responsive
- Logging y monitoreo

**🎯 Listo para Producción**
- Docker containerizado
- CI/CD configurado
- Seguridad implementada
- Documentación completa