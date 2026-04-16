const mysql = require("mysql2/promise");
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "mailserver",
  user: process.env.DB_USER || "mailuser",
  password: process.env.DB_PASS || "",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});
module.exports = pool;
