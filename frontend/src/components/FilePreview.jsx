import React from 'react';

const FilePreview = ({ files, onRemove, darkMode = false }) => {
  if (!files || files.length === 0) return null;

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileIcon = (type) => {
    if (type.startsWith('image/')) return '🖼️';
    if (type.includes('pdf')) return '📄';
    if (type.includes('word') || type.includes('doc')) return '📝';
    if (type.includes('json')) return '🔧';
    if (type.includes('csv')) return '📊';
    if (type.includes('markdown')) return '📋';
    return '📄';
  };

  const truncateContent = (content, maxLength = 100) => {
    if (!content || content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  return (
    <div className="space-y-2 max-h-48 overflow-y-auto">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Archivos adjuntos ({files.length})
      </h4>
      
      {files.map((file, index) => (
        <div
          key={index}
          className="flex items-start space-x-3 p-3 bg-white/80 dark:bg-gray-700/80 rounded-lg border border-gray-200 dark:border-gray-600"
        >
          <div className="text-xl">{getFileIcon(file.type)}</div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h5 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {file.name}
              </h5>
              <button
                onClick={() => onRemove?.(index)}
                className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors ml-2"
                title="Eliminar archivo"
              >
                ✕
              </button>
            </div>
            
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {formatFileSize(file.size)} • {file.type}
            </p>
            
            {/* Preview content */}
            {file.isImage && file.preview ? (
              <div className="mt-2">
                <img
                  src={file.preview}
                  alt={file.name}
                  className="max-w-32 max-h-20 object-cover rounded border"
                />
              </div>
            ) : file.content ? (
              <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs text-gray-600 dark:text-gray-400 max-w-full overflow-hidden">
                <pre className="whitespace-pre-wrap break-words font-mono">
                  {truncateContent(file.content)}
                </pre>
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
};

export default FilePreview;