import React, { useState, useRef, useCallback } from 'react';

const FileDropZone = ({ onFileSelect, darkMode = false, disabled = false }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Tipos de archivo soportados
  const supportedTypes = {
    'text/plain': ['.txt'],
    'text/markdown': ['.md'],
    'text/csv': ['.csv'],
    'application/json': ['.json'],
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'image/png': ['.png'],
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/gif': ['.gif'],
    'image/webp': ['.webp']
  };

  const maxFileSize = 10 * 1024 * 1024; // 10MB

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const validateFile = (file) => {
    // Verificar tamaño
    if (file.size > maxFileSize) {
      throw new Error(`El archivo ${file.name} es demasiado grande. Máximo: 10MB`);
    }

    // Verificar tipo
    const isSupported = Object.keys(supportedTypes).includes(file.type) || 
                       Object.values(supportedTypes).flat().some(ext => 
                         file.name.toLowerCase().endsWith(ext)
                       );

    if (!isSupported) {
      throw new Error(`Tipo de archivo no soportado: ${file.name}`);
    }

    return true;
  };

  const handleFiles = async (files) => {
    if (disabled || files.length === 0) return;

    setIsUploading(true);
    const validFiles = [];

    try {
      // Validar archivos
      for (const file of files) {
        validateFile(file);
        validFiles.push({
          file,
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified
        });
      }

      // Procesar archivos válidos
      const fileContents = await Promise.all(
        validFiles.map(async ({ file, name, size, type }) => {
          if (type.startsWith('image/')) {
            // Para imágenes, retornar metadata
            return {
              name,
              size,
              type,
              isImage: true,
              preview: URL.createObjectURL(file)
            };
          } else {
            // Para archivos de texto, leer contenido
            const content = await readFileContent(file);
            return {
              name,
              size,
              type,
              content,
              isImage: false
            };
          }
        })
      );

      onFileSelect?.(fileContents);
    } catch (error) {
      console.error('Error processing files:', error);
      onFileSelect?.(null, error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const readFileContent = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error(`Error leyendo archivo: ${file.name}`));
      
      if (file.type.includes('pdf')) {
        reader.readAsArrayBuffer(file);
      } else {
        reader.readAsText(file);
      }
    });
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }, [disabled, onFileSelect]);

  const handleFileInput = (e) => {
    const files = Array.from(e.target.files);
    handleFiles(files);
    // Reset input
    e.target.value = '';
  };

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  const getSupportedExtensions = () => {
    return Object.values(supportedTypes).flat().join(', ');
  };

  return (
    <div className="relative">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={Object.keys(supportedTypes).join(',')}
        onChange={handleFileInput}
        className="hidden"
      />

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`
          relative p-6 border-2 border-dashed rounded-lg transition-all duration-300 cursor-pointer
          ${disabled 
            ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600' 
            : isDragOver
              ? 'border-orange-500 dark:border-orange-400 bg-orange-50 dark:bg-orange-900/20'
              : 'border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/50 hover:border-orange-400 dark:hover:border-orange-500'
          }
        `}
      >
        {isUploading ? (
          <div className="flex flex-col items-center space-y-3">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Procesando archivos...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-3">
            <div className={`text-3xl ${isDragOver ? 'animate-bounce' : ''}`}>
              📎
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {isDragOver ? '¡Suelta aquí tus archivos!' : 'Arrastra archivos o haz clic'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Máximo 10MB • {getSupportedExtensions()}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Info tooltip */}
      <div className="absolute -bottom-2 left-2 transform translate-y-full z-10">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 shadow-lg opacity-0 hover:opacity-100 transition-opacity duration-200 pointer-events-none">
          <p className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
            Soporta: Texto, Markdown, PDF, Word, CSV, JSON, Imágenes
          </p>
        </div>
      </div>
    </div>
  );
};

export default FileDropZone;