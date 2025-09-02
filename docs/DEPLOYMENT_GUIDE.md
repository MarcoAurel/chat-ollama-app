# 🚀 Guía de Despliegue - Luckia Chat

## 📋 Resumen

Esta guía detalla el proceso completo de despliegue de Luckia Chat en **EasyPanel**, desde la configuración inicial hasta el monitoreo post-despliegue.

## 🎯 Pre-requisitos

### **Infraestructura Requerida**
- ✅ **Servidor**: Con Docker y EasyPanel instalado
- ✅ **Ollama**: Funcionando en `192.168.1.206:11434`
- ✅ **Dominio**: Para acceso web (ej: `chat.luckia.com`)
- ✅ **SSL Certificate**: Para HTTPS (recomendado)

### **Recursos Mínimos**
```yaml
Production:
  CPU: 2 cores
  RAM: 4GB
  Storage: 20GB SSD
  Network: 100Mbps

Recommended:
  CPU: 4 cores
  RAM: 8GB
  Storage: 50GB SSD
  Network: 1Gbps
```

## 🔧 Configuración Inicial

### 1. **Preparación del Entorno**

```bash
# Clonar repositorio
git clone https://github.com/luckia/chat-ollama-app.git
cd chat-ollama-app

# Crear archivo de configuración
cp .env.example .env
```

### 2. **Configurar Variables de Entorno**

```bash
# .env
OLLAMA_BASE_URL=http://192.168.1.206:11434
SESSION_SECRET=your-super-secret-production-key
DOMAIN=chat.luckia.com
FRONTEND_PORT=80
BACKEND_PORT=3001
NODE_ENV=production
```

### 3. **Verificar Conectividad**

```bash
# Verificar Ollama
curl http://192.168.1.206:11434/api/tags

# Ejecutar health check
node healthcheck.js
```

## 🐳 Despliegue Local (Desarrollo)

### **Opción A: Docker Compose**
```bash
# Build y deploy completo
./deploy.sh

# O manualmente:
docker-compose build
docker-compose up -d

# Verificar logs
docker-compose logs -f
```

### **Opción B: Desarrollo Nativo**
```bash
# Backend
cd backend
npm install
npm run dev

# Frontend (nueva terminal)
cd frontend
npm install
npm run dev
```

## 🌐 Despliegue en EasyPanel

### **Paso 1: Configurar Proyecto**

1. **Acceder a EasyPanel**: `https://your-easypanel-domain.com`

2. **Crear Nuevo Proyecto**: 
   - Name: `luckia-chat`
   - Repository: `https://github.com/your-org/chat-ollama-app`

3. **Configurar Variables de Entorno**:
   ```
   OLLAMA_BASE_URL=http://192.168.1.206:11434
   SESSION_SECRET=<generated-secure-key>
   DOMAIN=chat.luckia.com
   NODE_ENV=production
   ```

### **Paso 2: Deploy Services**

```yaml
# easypanel.yml ya está configurado
# EasyPanel detectará automáticamente la configuración

services:
  - frontend: Dockerfile.frontend
  - backend: Dockerfile.backend
  - monitoring: prometheus (opcional)
```

### **Paso 3: Configurar Dominios**

1. **DNS Configuration**:
   ```
   chat.luckia.com -> A record -> server-ip
   api.chat.luckia.com -> A record -> server-ip
   ```

2. **SSL Certificate**: EasyPanel configurará automáticamente Let's Encrypt

3. **Verificar Acceso**: 
   - Frontend: `https://chat.luckia.com`
   - Backend: `https://api.chat.luckia.com/health`

## 📊 Monitoreo Post-Despliegue

### **Health Checks Automáticos**

```bash
# Health check completo
node healthcheck.js

# Verificar servicios específicos
curl https://chat.luckia.com/health
curl https://api.chat.luckia.com/health
```

### **Prometheus Metrics** (Opcional)

```yaml
# Habilitar monitoreo en docker-compose.yml
ENABLE_MONITORING=true

# Acceder a métricas
# http://your-domain:9090
```

### **Log Monitoring**

```bash
# Ver logs en tiempo real
docker-compose logs -f backend
docker-compose logs -f frontend

# Logs específicos en EasyPanel
# Disponible en el dashboard de EasyPanel
```

## 🔄 Actualizaciones y CI/CD

### **Despliegue Manual**

```bash
# Actualizar código
git pull origin main

# Rebuild y redeploy
docker-compose build --no-cache
docker-compose up -d

# Verificar salud
./healthcheck.js
```

### **Despliegue Automático** (GitHub Actions)

```yaml
# .github/workflows/ci.yml ya configurado
# Se despliega automáticamente en:
# - Push to main: Production
# - Push to develop: Staging
```

### **Rollback Process**

```bash
# Rollback con Docker
docker-compose down
git checkout previous-stable-tag
docker-compose up -d

# Rollback en EasyPanel
# Usar el dashboard para revertir a imagen anterior
```

## 🔒 Seguridad y Backup

### **Backup Strategy**

```bash
# Backup base de datos
docker exec luckia-chat-backend \
  sqlite3 /app/database/luckia_chat.db \
  ".backup /app/database/backup_$(date +%Y%m%d).db"

# Backup logs
tar -czf logs_backup_$(date +%Y%m%d).tar.gz \
  data/logs/
```

### **Security Checklist**

- [ ] **SSL/HTTPS**: Habilitado y funcionando
- [ ] **Firewall**: Solo puertos necesarios abiertos
- [ ] **Sessions**: Claves secretas únicas y seguras  
- [ ] **Updates**: OS y Docker actualizados
- [ ] **Access Control**: Solo usuarios autorizados
- [ ] **Backup**: Estrategia de backup automático

## 🔧 Troubleshooting

### **Problemas Comunes**

#### 1. **Backend no conecta con Ollama**
```bash
# Verificar conectividad
curl http://192.168.1.206:11434/api/tags

# Verificar logs
docker-compose logs backend
```

#### 2. **Frontend no carga**
```bash
# Verificar build
docker-compose logs frontend

# Verificar proxy Nginx
docker exec -it luckia-chat-frontend nginx -t
```

#### 3. **Sesiones no persisten**
```bash
# Verificar volúmenes
docker volume ls
docker volume inspect luckia-chat-db

# Verificar permisos
docker exec luckia-chat-backend ls -la /app/database/
```

#### 4. **Performance Issues**
```bash
# Verificar recursos
docker stats

# Ver métricas
curl http://localhost:9090 # Si Prometheus está habilitado
```

### **Logs de Debug**

```bash
# Habilitar debug mode
echo "LOG_LEVEL=debug" >> .env
docker-compose restart

# Ver logs detallados
docker-compose logs -f --tail=100
```

## 📈 Scaling y Optimización

### **Horizontal Scaling**

```yaml
# docker-compose.yml
backend:
  deploy:
    replicas: 3
  
frontend:
  deploy:
    replicas: 2
```

### **Load Balancing**

```nginx
# nginx.conf
upstream backend {
  server backend1:3001;
  server backend2:3001;
  server backend3:3001;
}
```

### **Database Optimization**

```bash
# Para SQLite (desarrollo)
# Migrar a PostgreSQL para producción alta carga

# postgresql.conf optimizations:
shared_buffers = 256MB
max_connections = 100
work_mem = 4MB
```

## 📊 Métricas de Success

### **Técnicas**
- ✅ **Uptime**: > 99.5%
- ✅ **Response Time**: < 2s promedio
- ✅ **Error Rate**: < 1%
- ✅ **Resource Usage**: < 80% CPU/RAM

### **Negocio**
- ✅ **User Adoption**: Login diario activo
- ✅ **Satisfaction**: > 4.5/5 en surveys
- ✅ **Performance**: Queries resueltas exitosamente
- ✅ **Availability**: 24/7 sin interrupciones

## 📞 Soporte y Mantenimiento

### **Contactos**
- **DevOps**: devops@luckia.com
- **Backend**: backend@luckia.com  
- **Frontend**: frontend@luckia.com

### **Recursos**
- **Documentation**: `/docs/`
- **Health Checks**: `./healthcheck.js`
- **Logs**: `./data/logs/`
- **Monitoring**: EasyPanel Dashboard

---

**📅 Última Actualización**: Agosto 2025  
**📋 Versión**: 3.0.0  
**👨‍💻 Mantenido por**: Luckia IT Team