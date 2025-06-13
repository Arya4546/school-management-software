const bcrypt = require('bcryptjs');
bcrypt.hash('', 10, (err, hash) => {
  console.log(hash);
});