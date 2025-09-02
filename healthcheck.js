#!/usr/bin/env node

// ================================
// 🏥 Luckia Chat - Health Checker
// Comprehensive system health validation
// ================================

const http = require('http');
const fs = require('fs');
const path = require('path');

// Configuration
const config = {
  backend: {
    host: process.env.BACKEND_HOST || 'localhost',
    port: process.env.BACKEND_PORT || 3001,
    timeout: 5000
  },
  frontend: {
    host: process.env.FRONTEND_HOST || 'localhost', 
    port: process.env.FRONTEND_PORT || 80,
    timeout: 5000
  },
  ollama: {
    url: process.env.OLLAMA_BASE_URL || 'http://192.168.1.206:11434',
    timeout: 10000
  }
};

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

// Utility functions
const log = (color, level, message) => {
  const timestamp = new Date().toISOString();
  console.log(`${colors[color]}[${level}]${colors.reset} ${colors.bold}${timestamp}${colors.reset} ${message}`);
};

const logSuccess = (message) => log('green', 'SUCCESS', message);
const logError = (message) => log('red', 'ERROR', message);
const logWarning = (message) => log('yellow', 'WARNING', message);
const logInfo = (message) => log('blue', 'INFO', message);

// Health check functions
const checkHttpEndpoint = (name, host, port, path = '/health', timeout = 5000) => {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    const req = http.request({
      hostname: host,
      port: port,
      path: path,
      method: 'GET',
      timeout: timeout
    }, (res) => {
      const responseTime = Date.now() - startTime;
      
      if (res.statusCode === 200) {
        logSuccess(`${name} - Status: ${res.statusCode}, Response time: ${responseTime}ms`);
        resolve({ name, status: 'healthy', responseTime, statusCode: res.statusCode });
      } else {
        logError(`${name} - Unexpected status: ${res.statusCode}, Response time: ${responseTime}ms`);
        resolve({ name, status: 'unhealthy', responseTime, statusCode: res.statusCode });
      }
    });

    req.on('error', (error) => {
      const responseTime = Date.now() - startTime;
      logError(`${name} - Connection failed: ${error.message}, Time: ${responseTime}ms`);
      resolve({ name, status: 'error', responseTime, error: error.message });
    });

    req.on('timeout', () => {
      req.destroy();
      const responseTime = Date.now() - startTime;
      logError(`${name} - Timeout after ${responseTime}ms`);
      resolve({ name, status: 'timeout', responseTime });
    });

    req.end();
  });
};

const checkOllama = () => {
  return new Promise((resolve) => {
    const ollamaUrl = new URL(config.ollama.url);
    const startTime = Date.now();
    
    const req = http.request({
      hostname: ollamaUrl.hostname,
      port: ollamaUrl.port || 11434,
      path: '/api/tags',
      method: 'GET',
      timeout: config.ollama.timeout
    }, (res) => {
      const responseTime = Date.now() - startTime;
      
      if (res.statusCode === 200) {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const models = JSON.parse(data);
            logSuccess(`Ollama - Status: ${res.statusCode}, Models: ${models.models?.length || 0}, Response time: ${responseTime}ms`);
            resolve({ 
              name: 'Ollama', 
              status: 'healthy', 
              responseTime, 
              statusCode: res.statusCode,
              modelsCount: models.models?.length || 0
            });
          } catch (e) {
            logError(`Ollama - Invalid JSON response, Response time: ${responseTime}ms`);
            resolve({ name: 'Ollama', status: 'unhealthy', responseTime, error: 'Invalid JSON' });
          }
        });
      } else {
        logError(`Ollama - Unexpected status: ${res.statusCode}, Response time: ${responseTime}ms`);
        resolve({ name: 'Ollama', status: 'unhealthy', responseTime, statusCode: res.statusCode });
      }
    });

    req.on('error', (error) => {
      const responseTime = Date.now() - startTime;
      logError(`Ollama - Connection failed: ${error.message}, Time: ${responseTime}ms`);
      resolve({ name: 'Ollama', status: 'error', responseTime, error: error.message });
    });

    req.on('timeout', () => {
      req.destroy();
      const responseTime = Date.now() - startTime;
      logError(`Ollama - Timeout after ${responseTime}ms`);
      resolve({ name: 'Ollama', status: 'timeout', responseTime });
    });

    req.end();
  });
};

const checkDatabaseFile = () => {
  const dbPath = path.join(__dirname, 'backend', 'database', 'luckia_chat.db');
  
  try {
    if (fs.existsSync(dbPath)) {
      const stats = fs.statSync(dbPath);
      logSuccess(`Database - File exists, Size: ${(stats.size / 1024).toFixed(2)}KB, Modified: ${stats.mtime.toISOString()}`);
      return { name: 'Database', status: 'healthy', size: stats.size, lastModified: stats.mtime };
    } else {
      logWarning('Database - File does not exist (first run?)');
      return { name: 'Database', status: 'warning', error: 'File not found' };
    }
  } catch (error) {
    logError(`Database - Error checking file: ${error.message}`);
    return { name: 'Database', status: 'error', error: error.message };
  }
};

const checkLogDirectory = () => {
  const logDir = path.join(__dirname, 'backend', 'logs');
  
  try {
    if (fs.existsSync(logDir)) {
      const files = fs.readdirSync(logDir);
      logSuccess(`Logs - Directory exists, Files: ${files.length}`);
      return { name: 'Logs', status: 'healthy', filesCount: files.length };
    } else {
      logWarning('Logs - Directory does not exist');
      return { name: 'Logs', status: 'warning', error: 'Directory not found' };
    }
  } catch (error) {
    logError(`Logs - Error checking directory: ${error.message}`);
    return { name: 'Logs', status: 'error', error: error.message };
  }
};

// Main health check function
const runHealthChecks = async () => {
  logInfo('🏥 Iniciando chequeos de salud del sistema Luckia Chat...');
  console.log('');

  const results = [];

  // Check all services
  results.push(await checkHttpEndpoint('Backend API', config.backend.host, config.backend.port, '/health', config.backend.timeout));
  results.push(await checkHttpEndpoint('Frontend', config.frontend.host, config.frontend.port, '/health', config.frontend.timeout));
  results.push(await checkOllama());
  results.push(checkDatabaseFile());
  results.push(checkLogDirectory());

  console.log('');
  logInfo('📊 Resumen de resultados:');
  console.log('');

  const healthyCount = results.filter(r => r.status === 'healthy').length;
  const totalCount = results.length;

  results.forEach(result => {
    const status = result.status === 'healthy' ? '✅' : 
                  result.status === 'warning' ? '⚠️' : 
                  result.status === 'timeout' ? '⏱️' : '❌';
    
    let details = '';
    if (result.responseTime) details += ` (${result.responseTime}ms)`;
    if (result.modelsCount !== undefined) details += ` - ${result.modelsCount} models`;
    if (result.size) details += ` - ${(result.size / 1024).toFixed(2)}KB`;
    if (result.filesCount !== undefined) details += ` - ${result.filesCount} files`;
    
    console.log(`  ${status} ${result.name}${details}`);
  });

  console.log('');
  
  if (healthyCount === totalCount) {
    logSuccess(`🎉 Todos los servicios están saludables (${healthyCount}/${totalCount})`);
    process.exit(0);
  } else {
    logError(`⚠️ Algunos servicios tienen problemas (${healthyCount}/${totalCount} saludables)`);
    process.exit(1);
  }
};

// CLI mode
if (require.main === module) {
  runHealthChecks().catch(error => {
    logError(`Error ejecutando health checks: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { runHealthChecks, checkHttpEndpoint, checkOllama };