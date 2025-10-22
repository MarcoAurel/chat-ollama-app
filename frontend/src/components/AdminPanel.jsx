import React, { useState, useEffect } from 'react';
import { Upload, FileText, Trash2, BarChart3, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

const AdminPanel = ({ sessionData, onClose }) => {
  const [stats, setStats] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);

  useEffect(() => {
    if (sessionData?.token) {
      fetchStats();
    }
  }, [sessionData]);

  const fetchStats = async () => {
    try {
      const response = await fetch('http://localhost:3002/documents/stats', {
        headers: {
          'Authorization': `Bearer ${sessionData.token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        console.error('Error fetching admin stats');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    setSelectedFiles(files);
    setUploadResults(null);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    setUploadResults(null);

    const formData = new FormData();
    selectedFiles.forEach(file => {
      formData.append('documents', file);
    });

    try {
      const response = await fetch('http://localhost:3002/documents/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionData.token}`
        },
        body: formData
      });

      const result = await response.json();
      setUploadResults(result);
      
      if (response.ok && result.processed > 0) {
        // Refresh stats after successful upload
        setTimeout(() => {
          fetchStats();
        }, 1000);
        
        // Clear selected files
        setSelectedFiles([]);
        document.getElementById('file-input').value = '';
      }

    } catch (error) {
      setUploadResults({
        error: 'Error de conexión: ' + error.message,
        processed: 0,
        total: selectedFiles.length
      });
    }

    setUploading(false);
  };

  const handleDeleteDocument = async (filename) => {
    if (!confirm(`¿Eliminar documento "${filename}"?`)) return;

    try {
      const response = await fetch(`/api/admin/documents/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${sessionData.token}`
        }
      });

      if (response.ok) {
        fetchStats();
        alert('Documento eliminado correctamente');
      } else {
        alert('Error eliminando documento');
      }
    } catch (error) {
      alert('Error de conexión');
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="bg-blue-600 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-6 h-6" />
            <h2 className="text-xl font-bold">Panel Administrativo IT</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-white hover:text-gray-200 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          
          {/* Stats Section */}
          {stats && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <BarChart3 className="w-5 h-5 mr-2 text-blue-500" />
                Estadísticas RAG
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{stats.total_documents}</div>
                  <div className="text-sm text-gray-600">Documentos en RAG</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{stats.collection_status}</div>
                  <div className="text-sm text-gray-600">Estado Colección</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{stats.admin_area}</div>
                  <div className="text-sm text-gray-600">Tu Área</div>
                </div>
              </div>
            </div>
          )}

          {/* Upload Section */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Upload className="w-5 h-5 mr-2 text-green-500" />
              Subir Documentos al RAG
            </h3>
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                id="file-input"
                type="file"
                multiple
                accept=".pdf,.docx,.txt,.md,.json,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.gif,.bmp,.tiff"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              <label 
                htmlFor="file-input" 
                className="cursor-pointer block"
              >
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">
                  Haz clic para seleccionar documentos
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  PDF, DOCX, TXT, MD, JSON, XLSX, XLS, CSV, Imágenes (PNG, JPG, etc.) - máx 10MB
                </p>
              </label>
            </div>

            {/* Selected Files */}
            {selectedFiles.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium mb-2">Archivos seleccionados:</h4>
                <div className="space-y-2">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                      <div className="flex items-center">
                        <FileText className="w-4 h-4 mr-2 text-gray-500" />
                        <span className="text-sm">{file.name}</span>
                      </div>
                      <span className="text-sm text-gray-500">{formatFileSize(file.size)}</span>
                    </div>
                  ))}
                </div>
                
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="mt-4 bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                      Subiendo...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Subir al RAG
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Upload Results */}
            {uploadResults && (
              <div className="mt-4 p-4 rounded-lg border">
                <div className="flex items-center mb-2">
                  {uploadResults.processed > 0 ? (
                    <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500 mr-2" />
                  )}
                  <h4 className="font-medium">
                    Resultado: {uploadResults.processed}/{uploadResults.total} documentos procesados
                  </h4>
                </div>

                {uploadResults.results && uploadResults.results.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="font-medium text-green-600">Procesados correctamente:</h5>
                    {uploadResults.results.map((result, index) => (
                      <div key={index} className="text-sm bg-green-50 p-2 rounded">
                        <div className="flex justify-between">
                          <span>{result.filename}</span>
                          <span>{result.chunks} fragmentos</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {uploadResults.errors && uploadResults.errors.length > 0 && (
                  <div className="space-y-2 mt-3">
                    <h5 className="font-medium text-red-600">Errores:</h5>
                    {uploadResults.errors.map((error, index) => (
                      <div key={index} className="text-sm bg-red-50 p-2 rounded">
                        <div className="flex justify-between">
                          <span>{error.filename}</span>
                          <span className="text-red-600">{error.error}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {uploadResults.error && (
                  <div className="text-red-600 text-sm mt-2">
                    Error: {uploadResults.error}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Info Section */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
              <div>
                <h4 className="font-medium text-yellow-800">Información importante</h4>
                <ul className="text-sm text-yellow-700 mt-2 space-y-1">
                  <li>• Los documentos subidos aquí se almacenan permanentemente en el sistema RAG</li>
                  <li>• Estarán disponibles para todas las consultas futuras del chatbot</li>
                  <li>• Los documentos temporales del chat NO van al RAG automáticamente</li>
                  <li>• Solo usuarios del área IT pueden acceder a este panel</li>
                </ul>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AdminPanel;