// Script para generar hash de contraseña bcrypt
const bcrypt = require('bcrypt');

const password = 'Informatica2025!'; // Nueva contraseña para el área informatica
const saltRounds = 10;

bcrypt.hash(password, saltRounds, (err, hash) => {
  if (err) {
    console.error('Error generando hash:', err);
    process.exit(1);
  }

  console.log('\n========================================');
  console.log('CREDENCIALES ÁREA INFORMATICA');
  console.log('========================================');
  console.log('Área:      informatica');
  console.log('Password:  ' + password);
  console.log('\nHash (para area_config.json):');
  console.log(hash);
  console.log('========================================\n');

  process.exit(0);
});
