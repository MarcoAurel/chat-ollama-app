#!/bin/bash

# ================================
# 🚀 Luckia Chat - Deploy Script
# One-click deployment for EasyPanel
# ================================

set -e  # Exit on any error

echo "🎬 Iniciando despliegue de Luckia Chat..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if .env exists
if [ ! -f .env ]; then
    log_warning "Archivo .env no encontrado. Creando desde .env.example..."
    cp .env.example .env
    log_info "Por favor edita .env con tus configuraciones antes de continuar."
    echo -e "${YELLOW}Presiona Enter para continuar una vez editado .env...${NC}"
    read
fi

# Load environment variables
source .env

# Verify required variables
if [ -z "$OLLAMA_BASE_URL" ]; then
    log_error "OLLAMA_BASE_URL no configurado en .env"
    exit 1
fi

if [ -z "$SESSION_SECRET" ] || [ "$SESSION_SECRET" = "your-super-secret-key-change-in-production-please" ]; then
    log_error "SESSION_SECRET debe ser configurado con una clave segura en .env"
    exit 1
fi

log_info "Verificando conectividad con Ollama..."
if curl -s -f "$OLLAMA_BASE_URL/api/tags" > /dev/null; then
    log_success "Ollama accesible en $OLLAMA_BASE_URL"
else
    log_error "No se puede conectar a Ollama en $OLLAMA_BASE_URL"
    exit 1
fi

# Create necessary directories
log_info "Creando directorios de datos..."
mkdir -p data/database data/logs

# Build and deploy
log_info "Construyendo imágenes Docker..."
docker-compose build --no-cache

log_info "Iniciando servicios..."
docker-compose up -d

# Wait for services to be healthy
log_info "Esperando que los servicios estén listos..."
sleep 10

# Health checks
log_info "Verificando salud de los servicios..."

# Check backend
if curl -s -f "http://localhost:${BACKEND_PORT:-3001}/health" > /dev/null; then
    log_success "Backend funcionando correctamente"
else
    log_error "Backend no responde en el health check"
    docker-compose logs backend
    exit 1
fi

# Check frontend
if curl -s -f "http://localhost:${FRONTEND_PORT:-80}/health" > /dev/null; then
    log_success "Frontend funcionando correctamente"
else
    log_error "Frontend no responde en el health check"
    docker-compose logs frontend
    exit 1
fi

# Display final information
echo ""
log_success "🎉 ¡Despliegue completado exitosamente!"
echo ""
echo "📍 URLs de acceso:"
echo "   Frontend: http://localhost:${FRONTEND_PORT:-80}"
echo "   Backend API: http://localhost:${BACKEND_PORT:-3001}"
echo "   Health Checks:"
echo "     - Frontend: http://localhost:${FRONTEND_PORT:-80}/health"
echo "     - Backend: http://localhost:${BACKEND_PORT:-3001}/health"
echo ""
echo "🔧 Comandos útiles:"
echo "   Ver logs:           docker-compose logs -f"
echo "   Ver logs backend:   docker-compose logs -f backend"
echo "   Ver logs frontend:  docker-compose logs -f frontend"
echo "   Parar servicios:    docker-compose down"
echo "   Actualizar:         ./deploy.sh"
echo ""
echo "🎯 Para EasyPanel:"
echo "   1. Sube este repositorio a tu servidor"
echo "   2. Configura las variables de entorno en EasyPanel"
echo "   3. Usa el archivo easypanel.yml para la configuración"
echo ""

# Check if monitoring profile should be enabled
if [ "$ENABLE_MONITORING" = "true" ]; then
    log_info "Habilitando monitoreo..."
    docker-compose --profile monitoring up -d
    echo "   Prometheus: http://localhost:${PROMETHEUS_PORT:-9090}"
    echo ""
fi

log_success "🚀 Luckia Chat está listo para usar!"