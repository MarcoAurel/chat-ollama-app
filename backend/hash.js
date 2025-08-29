const bcrypt = require('bcrypt');

const password = 'claveinformatica';

bcrypt.hash(password, 10, function(err, hash) {
  if (err) throw err;
  console.log('Nuevo hash bcrypt:', hash);
});
