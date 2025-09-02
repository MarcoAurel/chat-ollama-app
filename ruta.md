# 📁 Estructura del Proyecto - Luckia Chat IA

## 🗂️ Directorio Completo

```
chat-ollama-app/
├── 📁 .claude/
│   └── settings.local.json
├── 📁 .github/
│   ├── 📁 workflows/
│   │   ├── ci.yml
│   │   └── release.yml
│   └── PULL_REQUEST_TEMPLATE.md
├── 📁 backend/
│   ├── 📁 config/
│   │   └── area_config.json
│   ├── 📁 database/
│   │   ├── database.js
│   │   ├── luckia_chat.db
│   │   ├── schema.sql
│   │   └── sessions.db
│   ├── 📁 logs/
│   │   ├── combined.log
│   │   └── error.log
│   ├── 📁 tests/
│   │   ├── auth.test.js
│   │   ├── health.test.js
│   │   └── setup.js
│   ├── .env
│   ├── hash.js
│   ├── index.js
│   ├── index.js.backup
│   ├── jest.config.js
│   ├── package.json
│   ├── package.json.backup
│   └── package-lock.json
├── 📁 docs/
│   ├── DEPLOYMENT_GUIDE.md
│   └── QDRANT_INTEGRATION.md
├── 📁 frontend/
│   ├── 📁 public/
│   │   ├── Logo_Luckia.svg
│   │   └── vite.svg
│   ├── 📁 src/
│   │   ├── 📁 assets/
│   │   │   └── react.svg
│   │   ├── 📁 components/
│   │   │   ├── AutoComplete.jsx
│   │   │   ├── CopyButton.jsx
│   │   │   ├── FileDropZone.jsx
│   │   │   ├── FilePreview.jsx
│   │   │   ├── MarkdownMessage.jsx
│   │   │   ├── MessageReactions.jsx
│   │   │   └── ToastNotification.jsx
│   │   ├── 📁 hooks/
│   │   │   └── useKeyboardShortcuts.js
│   │   ├── 📁 tests/
│   │   │   ├── 📁 components/
│   │   │   │   └── CopyButton.test.jsx
│   │   │   ├── App.test.jsx
│   │   │   └── setup.js
│   │   ├── 📁 utils/
│   │   │   └── axios.js
│   │   ├── App.css
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── eslint.config.js
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   ├── postcss.config.js
│   ├── README.md
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── vitest.config.js
├── 📁 monitoring/
│   └── prometheus.yml
├── .dockerignore
├── .env
├── .env.example
├── .gitignore
├── ANALISIS_PROYECTO.md
├── Captura de pantalla 2025-08-29 114547.png
├── color.txt
├── deploy.sh
├── docker-compose.yml
├── Dockerfile.backend
├── Dockerfile.frontend
├── easypanel.yml
├── error.txt
├── healthcheck.js
├── Logo_Luckia.svg
├── nginx.conf
├── README.md
├── RESUMEN.md
├── Resumen-Proyecto.pdf
├── ROADMAP_LUCKIA.md
└── ruta.md (este archivo)
```

## 📋 Descripción de Archivos Clave

### 🏗️ **Configuración del Proyecto**
- `package.json` (frontend/backend): Dependencias y scripts
- `docker-compose.yml`: Orquestación de servicios
- `Dockerfile.backend` / `Dockerfile.frontend`: Imágenes Docker
- `easypanel.yml`: Configuración de despliegue EasyPanel
- `deploy.sh`: Script de despliegue automatizado

### 🎨 **Frontend (React)**
- `src/App.jsx`: Componente principal del chat
- `src/components/`: Componentes reutilizables
  - `MarkdownMessage.jsx`: Renderizado de markdown
  - `CopyButton.jsx`: Funcionalidad de copiado
  - `AutoComplete.jsx`: Autocompletado inteligente
  - `FileDropZone.jsx`: Subida de archivos drag & drop
  - `MessageReactions.jsx`: Reacciones a mensajes
- `src/hooks/useKeyboardShortcuts.js`: Atajos de teclado
- `src/utils/axios.js`: Configuración HTTP

### 🔧 **Backend (Express)**
- `index.js`: Servidor principal con API
- `database/`: Persistencia SQLite
  - `database.js`: Configuración BD
  - `schema.sql`: Estructura de tablas
  - `luckia_chat.db`: Base de datos principal
- `config/area_config.json`: Configuración por áreas
- `logs/`: Archivos de log del sistema

### 🧪 **Testing**
- `backend/tests/`: Tests Jest del backend
- `frontend/src/tests/`: Tests Vitest del frontend
- `jest.config.js` / `vitest.config.js`: Configuraciones

### 🚀 **DevOps & CI/CD**
- `.github/workflows/ci.yml`: Pipeline de integración continua
- `healthcheck.js`: Verificación de salud del sistema
- `monitoring/prometheus.yml`: Configuración de monitoreo

### 📚 **Documentación**
- `RESUMEN.md`: Resumen ejecutivo completo
- `ROADMAP_LUCKIA.md`: Hoja de ruta del proyecto
- `docs/DEPLOYMENT_GUIDE.md`: Guía de despliegue
- `docs/QDRANT_INTEGRATION.md`: Planificación RAG
- `PULL_REQUEST_TEMPLATE.md`: Template para PRs

### 🔧 **Configuración**
- `.env` / `.env.example`: Variables de entorno
- `nginx.conf`: Configuración proxy reverso
- `tailwind.config.js`: Configuración CSS framework
- `eslint.config.js`: Reglas de linting

## 📊 **Estadísticas del Proyecto**

- **Total Archivos**: ~70 archivos
- **Componentes React**: 7 componentes principales
- **Tests**: 4+ archivos de testing
- **Documentación**: 6+ archivos MD
- **Configuración**: 15+ archivos de config
- **Scripts**: 3 scripts de automatización

## 🎯 **Archivos Principales por Funcionalidad**

### Chat & UI
- `frontend/src/App.jsx`
- `frontend/src/components/MarkdownMessage.jsx`
- `frontend/src/components/FileDropZone.jsx`

### API & Backend
- `backend/index.js`
- `backend/database/database.js`

### DevOps
- `docker-compose.yml`
- `easypanel.yml`
- `healthcheck.js`

### Documentación
- `RESUMEN.md`
- `ROADMAP_LUCKIA.md`
- `docs/DEPLOYMENT_GUIDE.md`

---

**📅 Generado**: Agosto 2025  
**🎯 Estado**: Proyecto completo y listo para producción  
**📊 Cobertura**: Estructura completa sin node_modules ni artifacts