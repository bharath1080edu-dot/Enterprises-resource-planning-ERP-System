require('dotenv').config();
const mysql = require('mysql2');

const pool = mysql.createPool({
    host:     process.env.DB_HOST     || 'localhost',
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASS     || '',
    database: process.env.DB_NAME     || 'upvc_erp',
    waitForConnections: true,
    connectionLimit:    10,
    queueLimit:         0,
    timezone:           '+05:30'
});

// Test connection on startup
pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Database connection failed:', err.message);
        return;
    }
    console.log('✅ MySQL Database connected successfully!');
    connection.release();
});

module.exports = pool.promise();