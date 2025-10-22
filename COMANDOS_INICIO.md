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

### 3. Admin Server (Puerto 3002) - Para panel administrativo
```bash
cd backend
node admin-server.js
```

## URLs de acceso

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **Admin Server**: http://localhost:3002
- **Ollama**: http://172.19.5.212:11434
- **Supabase**: Tu URL de Supabase configurada en .env

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

1. **Primero**: Iniciar el backend (puerto 3001)
2. **Segundo**: Iniciar el admin server (puerto 3002) - Solo si usas panel admin
3. **Tercero**: Iniciar el frontend (puerto 5173)
4. **Acceder**: http://localhost:5173

## Notas importantes

- El backend debe estar corriendo antes que el frontend
- Asegúrate de que Ollama esté corriendo en la dirección configurada
- Configura las variables de entorno de Supabase en backend/.env
- Si cambias dependencias, ejecuta `npm install` nuevamente