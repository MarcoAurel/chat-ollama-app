# 🚀 Comandos para Iniciar el Proyecto

## Iniciar el proyecto completo

### 1. Backend (Puerto 3001)
```bash
cd backend
npm install  # Solo la primera vez o si hay nuevas dependencias
npm start
```

### 2. Frontend (Puerto 5173)
```bash
cd frontend
npm install  # Solo la primera vez o si hay nuevas dependencias
npm run dev
```

## URLs de acceso

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **Ollama**: http://172.19.5.212:11434

## Comandos útiles

### Backend
- `npm run dev` - Modo desarrollo con nodemon (reinicio automático)
- `npm start` - Modo producción
- `npm test` - Ejecutar tests

### Frontend
- `npm run dev` - Servidor de desarrollo
- `npm run build` - Compilar para producción
- `npm run preview` - Previsualizar build de producción
- `npm test` - Ejecutar tests

## Orden de inicio recomendado

1. **Primero**: Iniciar el backend
2. **Segundo**: Iniciar el frontend
3. **Acceder**: http://localhost:5173

## Notas importantes

- El backend debe estar corriendo antes que el frontend
- Asegúrate de que Ollama esté corriendo en la dirección configurada
- Si cambias dependencias, ejecuta `npm install` nuevamente