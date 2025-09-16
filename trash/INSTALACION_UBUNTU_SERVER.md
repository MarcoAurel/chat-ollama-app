# 🚀 Instalación Servidor Ubuntu - Chat Anyelita

## 📋 Dependencias para Funcionalidades Avanzadas

### 🎯 **1. OCR para PDFs Escaneados (Prioridad Baja)**

```bash
# Instalar Tesseract OCR
sudo apt update
sudo apt install tesseract-ocr tesseract-ocr-spa

# Instalar ImageMagick para procesamiento de imágenes
sudo apt install imagemagick

# Verificar instalación
tesseract --version
convert --version
```

**Uso:**
- Permite extraer texto de PDFs que son imágenes escaneadas
- Soporte multiidioma (español incluido)
- Se activará automáticamente cuando un PDF no tenga texto extraíble

---

### 📊 **2. Procesamiento Excel/CSV (Prioridad Media)**

```bash
# No requiere instalación en sistema
# Solo dependencias npm que se instalarán automáticamente:
# - xlsx (para archivos Excel)
# - csv-parser (para archivos CSV)
```

**Características:**
- Soporte .xlsx, .xls, .csv
- Procesamiento inteligente de hojas múltiples
- Conversión automática a texto para embeddings

---

### 🔍 **3. Monitoreo y Performance (Opcional)**

```bash
# Para monitoreo del sistema (opcional)
sudo apt install htop iotop

# Para logs avanzados (opcional)
sudo apt install logrotate
```

---

## 🛠️ **Dependencias npm Adicionales**

Las siguientes se instalarán automáticamente al desplegar:

```json
{
  "xlsx": "^0.18.5",           // Excel processing
  "csv-parser": "^3.0.0",     // CSV processing  
  "node-tesseract-ocr": "^2.2.1", // OCR integration
  "sharp": "^0.32.6"           // Image processing
}
```

---

## 🔐 **Configuración de Seguridad**

### **Panel de Administración IT**
```bash
# El panel admin estará en:
# https://tu-dominio.com/admin/documents

# Acceso restringido por:
# 1. Autenticación de área
# 2. Rol de administrador
# 3. IP whitelisting (opcional)
```

### **Variables de Entorno Adicionales**

Agregar al `.env`:

```env
# OCR Configuration
OCR_ENABLED=true
OCR_LANGUAGE=spa+eng
OCR_CONFIDENCE_THRESHOLD=60

# Admin Panel
ADMIN_ENABLED=true
ADMIN_AREAS=informatica,sistemas

# Document Limits
MAX_RAG_DOCUMENTS=1000
MAX_DOCUMENT_SIZE_MB=50
CLEANUP_OLD_DOCUMENTS_DAYS=90
```

---

## 📁 **Estructura de Directorios**

```
chat-ollama-app/
├── backend/
│   ├── uploads/
│   │   ├── temp/          # Documentos temporales (chat)
│   │   └── rag/           # Documentos permanentes (RAG)
│   ├── admin/             # Panel administración
│   └── services/
│       ├── ocrService.js  # Nuevo: OCR
│       └── excelProcessor.js # Nuevo: Excel/CSV
└── INSTALACION_UBUNTU_SERVER.md # Este archivo
```

---

## 🚦 **Plan de Despliegue**

### **Fase 1: Separación Chat/RAG** ✅ Sin dependencias
- Implementación inmediata
- Sin instalaciones adicionales requeridas

### **Fase 2: Panel IT** ✅ Sin dependencias
- Implementación inmediata  
- Solo cambios en código

### **Fase 3: Excel/CSV** ✅ Sin dependencias de sistema
- Instalación automática de npm packages
- No requiere sudo/instalación manual

### **Fase 4: OCR** ⚠️ Requiere instalación
- **Ejecutar comandos OCR de arriba**
- **Reiniciar servidor después de la instalación**

---

## 🔍 **Verificación Post-Instalación**

```bash
# Verificar OCR
tesseract --list-langs | grep spa

# Verificar ImageMagick
convert --version | head -n1

# Test completo desde la app
curl http://localhost:3001/api/admin/health
```

---

## 💡 **Notas Importantes**

1. **OCR es OPCIONAL** - El sistema funcionará perfectamente sin él
2. **Excel/CSV** se instala automáticamente vía npm
3. **Panel IT** no requiere instalaciones adicionales
4. **Qdrant** ya está configurado y funcionando
5. **Embeddings** no requieren cambios

---

## 🆘 **Troubleshooting**

### **Si OCR falla:**
```bash
# Verificar permisos ImageMagick
sudo nano /etc/ImageMagick-6/policy.xml
# Comentar líneas que bloqueen PDFs
```

### **Si faltan dependencias npm:**
```bash
cd backend/
npm install xlsx csv-parser node-tesseract-ocr sharp
```

### **Si el panel admin no aparece:**
- Verificar variable `ADMIN_ENABLED=true` en .env
- Verificar que tu área esté en `ADMIN_AREAS`
- Limpiar caché del navegador

---

**📅 Última actualización:** $(date)  
**🔄 Siguiente actualización:** Después de implementar Fase 4 (OCR)

**✅ Sistema funcionará COMPLETAMENTE sin instalar nada adicional**  
**⚡ OCR es solo un bonus para PDFs escaneados**