# 🎨 Personalización de Luckia Chat

Este documento explica cómo personalizar fácilmente la apariencia y branding de la aplicación sin necesidad de tocar el código.

## 📁 Archivo de Configuración

La configuración se encuentra en: `backend/config/branding-config.json`

## ⚙️ Configuraciones Disponibles

### 🏢 Información de la Empresa
```json
"company": {
  "name": "Luckia",                    // Nombre de tu empresa
  "logo": "/Logo_Luckia.svg"           // Ruta del logo (en public/)
}
```

### 📱 Configuración de la Aplicación
```json
"app": {
  "name": "Luckia Chat",               // Nombre que aparece en el título
  "agent_name": "Asistente Luckia",    // Nombre del asistente por defecto
  "description": "Sistema de chat..."   // Descripción (para futuro uso)
}
```

### 🎨 Configuración de Colores
```json
"theme": {
  "primary_color": "#1f2937",          // Color principal (cabeceras, bordes)
  "accent_color": "#3b82f6",           // Color de acento (botones, enlaces)
  "background_color": "#f9fafb",       // Color de fondo principal
  "text_color": "#111827"              // Color de texto principal
}
```

## 🎨 Temas Predefinidos

El archivo incluye 5 esquemas de colores listos para usar:

1. **Azul Corporativo** (por defecto)
2. **Verde Luckia** 
3. **Rojo Elegante**
4. **Púrpura**
5. **Naranja**

Para cambiar el tema, copia los valores de `"available_themes"` a la sección `"theme"` principal.

### Ejemplo: Cambiar a Verde Luckia
```json
"theme": {
  "primary_color": "#065f46",
  "accent_color": "#10b981", 
  "background_color": "#ecfdf5",
  "text_color": "#064e3b"
}
```

## 🔄 Aplicar Cambios

1. **Edita el archivo** `backend/config/branding-config.json`
2. **Guarda los cambios**
3. **Recarga la página** - Los cambios se aplicarán automáticamente

> **Nota**: No necesitas reiniciar el servidor, los cambios se leen dinámicamente.

## 📝 Ejemplos de Personalización

### Cambiar Nombre de la Empresa
```json
"company": {
  "name": "Mi Empresa",
  "logo": "/mi-logo.svg"
}
```

### Cambiar Nombre de la App
```json
"app": {
  "name": "Mi Chat IA",
  "agent_name": "Asistente Virtual",
  "description": "Mi sistema personalizado"
}
```

### Crear Esquema de Colores Personalizado
```json
"theme": {
  "primary_color": "#2d1b69",          // Púrpura oscuro
  "accent_color": "#7c3aed",           // Púrpura brillante  
  "background_color": "#faf5ff",       // Fondo púrpura claro
  "text_color": "#2d1b69"              // Texto púrpura oscuro
}
```

## 🖼️ Cambiar Logo

1. Coloca tu logo en `frontend/public/`
2. Actualiza la ruta en el archivo de configuración:
```json
"company": {
  "logo": "/tu-logo.svg"   // o .png, .jpg, etc.
}
```

## ⚠️ Notas Importantes

- **Colores en formato hexadecimal**: Usa siempre formato `#RRGGBB`
- **Logo en public/**: El logo debe estar en la carpeta `frontend/public/`
- **Formato del logo**: Recomendado SVG para mejor calidad
- **Backup**: Haz backup del archivo antes de hacer cambios importantes

## 🆘 Restaurar Valores por Defecto

Si algo sale mal, simplemente restaura estos valores:

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