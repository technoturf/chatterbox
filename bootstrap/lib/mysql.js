const mysql = require('mysql');
const Promise = require('bluebird');
const mysql2 = require('mysql');

Promise.promisifyAll(require('mysql/lib/Connection').prototype);
Promise.promisifyAll(require('mysql/lib/Pool').prototype);

const pool = mysql.createPool({
    connectionLimit: config.db.mysql.pool.max,
    host: config.db.mysql.host,
    user: config.db.mysql.user,
    password: config.db.mysql.password,
    database: config.db.mysql.database
});

module.exports = pool;

var connection = mysql2.createConnection({
  host: config.db.mysql.host,
  user: config.db.mysql.user,
  password: config.db.mysql.password,
  database: config.db.mysql.database
});

connection.connect();
module.exports = connection
