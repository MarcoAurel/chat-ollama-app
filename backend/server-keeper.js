// Servidor con reinicio automático para manejar crashes
const { spawn } = require('child_process');
const path = require('path');

console.log('🔄 Iniciando Server Keeper...');

let restartCount = 0;
const maxRestarts = 10;

function startServer() {
  console.log(`🚀 Iniciando servidor (intento ${restartCount + 1}/${maxRestarts})`);
  
  const server = spawn('node', [
    '--max-old-space-size=8192', 
    path.join(__dirname, 'index.js')
  ], {
    stdio: ['inherit', 'inherit', 'inherit'],
    cwd: __dirname
  });

  server.on('exit', (code, signal) => {
    console.log(`⚠️ Servidor terminó con código ${code}, señal: ${signal}`);
    
    if (restartCount < maxRestarts) {
      restartCount++;
      console.log(`🔄 Reiniciando servidor en 2 segundos...`);
      setTimeout(startServer, 2000);
    } else {
      console.error(`❌ Máximo número de reinicios alcanzado (${maxRestarts}). Deteniendo.`);
      process.exit(1);
    }
  });

  server.on('error', (err) => {
    console.error('❌ Error al iniciar servidor:', err);
  });

  // Reset restart count on successful run (after 30 seconds)
  setTimeout(() => {
    if (restartCount > 0) {
      console.log('✅ Servidor estable, resetando contador de reinicios');
      restartCount = 0;
    }
  }, 30000);
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('🛑 Deteniendo Server Keeper...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Server Keeper terminado');
  process.exit(0);
});

startServer();