# 🎯 Integración Qdrant - Luckia Chat

## 📋 Resumen Ejecutivo

Esta documentación detalla la integración planificada de **Qdrant** como base de datos vectorial para implementar **RAG (Retrieval-Augmented Generation)** en el sistema Luckia Chat, mejorando significativamente las capacidades de procesamiento de documentos y respuestas contextuales.

## 🚀 Objetivos

### 🎯 **Objetivo Principal**
Implementar un sistema RAG robusto que permita al chat procesar y consultar grandes volúmenes de documentos de manera inteligente, proporcionando respuestas más precisas y contextuales.

### 🎪 **Objetivos Específicos**
1. **Procesamiento Robusto**: Solucionar los problemas actuales con archivos DOCX/PDF
2. **Búsqueda Inteligente**: Implementar búsqueda semántica vectorial
3. **Escalabilidad**: Manejar miles de documentos por área
4. **Performance**: Respuestas sub-segundo para consultas complejas
5. **Integración Transparente**: Mantener la UX actual del chat

## 🏗️ Arquitectura Propuesta

### 🌐 **Stack Tecnológico**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │     Qdrant      │
│   React + UI    │◄──►│  Express + RAG  │◄──►│ Vector Database │
│                 │    │                 │    │ (Port: 6333)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │     Ollama      │
                       │ (Port: 11434)   │
                       └─────────────────┘
```

### 🏛️ **Componentes del Sistema**

#### 1. **Document Ingestion Pipeline**
```javascript
DocumentUpload → TextExtraction → Chunking → Embedding → VectorStore
```

#### 2. **Query Pipeline**
```javascript
UserQuery → Embedding → VectorSearch → ContextRetrieval → LLM → Response
```

#### 3. **Qdrant Collections Schema**
```json
{
  "luckia_documents": {
    "vectors": {
      "size": 384,  // all-MiniLM-L6-v2 dimensions
      "distance": "Cosine"
    },
    "payload_schema": {
      "area": "keyword",
      "document_type": "keyword",
      "filename": "text",
      "chunk_id": "integer",
      "content": "text",
      "metadata": "json",
      "timestamp": "datetime"
    }
  }
}
```

## 🔧 Implementación Técnica

### 📦 **Dependencias Requeridas**

#### Backend
```json
{
  "dependencies": {
    "@qdrant/js-client-rest": "^1.8.0",
    "sentence-transformers": "^1.0.0",
    "langchain": "^0.1.0",
    "pdf-parse": "^1.1.1",
    "mammoth": "^1.6.0",
    "tiktoken": "^1.0.0"
  }
}
```

#### Docker Services
```yaml
qdrant:
  image: qdrant/qdrant:v1.8.0
  ports:
    - "6333:6333"
  environment:
    - QDRANT__SERVICE__HTTP_PORT=6333
  volumes:
    - qdrant_data:/qdrant/storage
```

### 🏗️ **Configuración de Servicios**

#### 1. **Qdrant Configuration**
```yaml
# qdrant-config.yaml
service:
  http_port: 6333
  grpc_port: 6334
  
storage:
  storage_path: ./storage
  snapshots_path: ./snapshots
  
log_level: INFO

cluster:
  enabled: false
```

#### 2. **EasyPanel Setup**
```yaml
services:
  qdrant:
    image: qdrant/qdrant:v1.8.0
    environment:
      - QDRANT__SERVICE__HTTP_PORT=6333
    ports:
      - "6333:6333"
    volumes:
      - type: volume
        source: qdrant-data
        target: /qdrant/storage
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.0'
    networks:
      - luckia-network
```

### 💾 **Estructura de Datos**

#### **Document Metadata**
```json
{
  "id": "uuid-v4",
  "area": "informatica",
  "document_type": "pdf|docx|txt|md",
  "filename": "manual_windows.pdf",
  "title": "Manual de Windows 11",
  "author": "IT Team",
  "upload_date": "2025-08-30T19:30:00Z",
  "file_size": 2048576,
  "chunk_count": 45,
  "language": "es",
  "tags": ["windows", "manual", "sistema"]
}
```

#### **Chunk Structure**
```json
{
  "chunk_id": "doc_uuid_chunk_001",
  "document_id": "uuid-v4",
  "chunk_index": 1,
  "content": "Windows 11 es el sistema operativo...",
  "vector": [0.123, -0.456, 0.789, ...], // 384 dimensions
  "start_char": 0,
  "end_char": 500,
  "overlap": 50,
  "metadata": {
    "section": "Introducción",
    "page": 1,
    "confidence": 0.95
  }
}
```

## 🔍 **Proceso de RAG**

### 1. **Document Ingestion**

```javascript
async function ingestDocument(file, area) {
  // 1. Extract text
  const text = await extractText(file);
  
  // 2. Chunk document
  const chunks = await chunkDocument(text, {
    chunkSize: 500,
    overlap: 50,
    strategy: 'recursive'
  });
  
  // 3. Generate embeddings
  const embeddings = await generateEmbeddings(chunks);
  
  // 4. Store in Qdrant
  await qdrantClient.upsert('luckia_documents', {
    points: chunks.map((chunk, i) => ({
      id: generateChunkId(file.id, i),
      vector: embeddings[i],
      payload: {
        area,
        content: chunk.text,
        document_id: file.id,
        filename: file.name,
        chunk_index: i,
        metadata: chunk.metadata
      }
    }))
  });
}
```

### 2. **Query Processing**

```javascript
async function processRAGQuery(query, area, options = {}) {
  // 1. Generate query embedding
  const queryEmbedding = await generateEmbedding(query);
  
  // 2. Search similar chunks
  const searchResults = await qdrantClient.search('luckia_documents', {
    vector: queryEmbedding,
    limit: options.limit || 10,
    filter: {
      must: [
        { key: 'area', match: { value: area } }
      ]
    },
    with_payload: true,
    score_threshold: 0.7
  });
  
  // 3. Rank and filter results
  const relevantChunks = rankResults(searchResults, query);
  
  // 4. Build context
  const context = buildContext(relevantChunks, {
    maxTokens: 4000,
    includeMetadata: true
  });
  
  // 5. Generate LLM response
  const response = await ollamaClient.generate({
    model: 'llama3.2:1b',
    prompt: buildRAGPrompt(query, context),
    system: getSystemPrompt(area)
  });
  
  return {
    response: response.response,
    sources: relevantChunks.map(chunk => ({
      filename: chunk.payload.filename,
      confidence: chunk.score,
      excerpt: chunk.payload.content.substring(0, 100) + '...'
    }))
  };
}
```

## 🚀 **Plan de Implementación**

### **Fase 5.1: Setup Inicial (Semana 1)**
- [ ] Despliegue de Qdrant en servidor 192.168.1.206:6333
- [ ] Configuración de colecciones y esquemas
- [ ] Integración básica con backend
- [ ] Tests de conectividad

### **Fase 5.2: Document Pipeline (Semana 2)**
- [ ] Sistema de extracción de texto robusto
- [ ] Algoritmo de chunking optimizado
- [ ] Pipeline de embeddings
- [ ] Interfaz de administración de documentos

### **Fase 5.3: Search & Retrieval (Semana 3)**
- [ ] Motor de búsqueda semántica
- [ ] Sistema de ranking y scoring
- [ ] Filtros por área y metadata
- [ ] Optimización de performance

### **Fase 5.4: Integration & UX (Semana 4)**
- [ ] Integración con chat existente
- [ ] UI para gestión de documentos
- [ ] Indicadores de fuentes en respuestas
- [ ] Tests de usuario final

### **Fase 5.5: Production & Monitoring (Semana 5-6)**
- [ ] Deployment en EasyPanel
- [ ] Monitoreo y alertas
- [ ] Optimización de costos
- [ ] Documentación completa

## 📊 **Métricas y Monitoreo**

### **KPIs Técnicos**
- **Ingestion Rate**: Documentos/minuto procesados
- **Query Latency**: < 2 segundos para búsqueda + LLM
- **Relevance Score**: > 0.7 promedio en resultados
- **Storage Efficiency**: Compresión de vectores

### **KPIs de Negocio**
- **User Satisfaction**: Surveys post-interacción
- **Query Success Rate**: % respuestas satisfactorias
- **Document Utilization**: % documentos consultados
- **Response Accuracy**: Validación por expertos

## 💰 **Estimación de Recursos**

### **Hardware Requirements**
- **Qdrant**: 2GB RAM, 1 CPU, 50GB SSD
- **Embeddings**: Temporal durante ingestion
- **Storage Growth**: ~1MB per 1000 chunks

### **Costos Operacionales**
- **Servidor**: Incluido en infraestructura actual
- **Storage**: Escalable según volumen de documentos
- **Embeddings**: Procesamiento local (sin costo API)

## 🔒 **Seguridad y Compliance**

### **Data Protection**
- Documentos segmentados por área (aislamiento)
- Encriptación en reposo (Qdrant snapshots)
- Logs de acceso y auditoría
- Backup automático diario

### **Privacy Controls**
- Filtrado automático por área de usuario
- No indexación de información sensible
- Retención configurable por tipo de documento
- GDPR compliance para datos personales

## 🎯 **Beneficios Esperados**

### **Funcionales**
- ✅ **Resolución de archivos**: DOCX/PDF funcionarán perfectamente
- ✅ **Búsqueda inteligente**: Encontrar información por conceptos
- ✅ **Respuestas precisas**: Contexto específico por área
- ✅ **Escalabilidad**: Miles de documentos sin degradación

### **Técnicos**
- ✅ **Performance**: Búsquedas sub-segundo
- ✅ **Reliability**: Sistema robusto y testeable
- ✅ **Maintainability**: Arquitectura modular
- ✅ **Observability**: Métricas y monitoring completo

### **De Negocio**
- 🚀 **Productividad**: Acceso instantáneo a conocimiento
- 💡 **Innovación**: Capacidades de IA avanzadas
- 📈 **ROI**: Mayor eficiencia en resolución de consultas
- 🎯 **Competitividad**: Sistema de chat empresarial avanzado

---

**📅 Fecha de Documento**: Agosto 2025  
**📋 Estado**: Planificación - FASE 5  
**👨‍💻 Responsable**: Luckia IT Team  
**🎯 Target**: Q4 2025