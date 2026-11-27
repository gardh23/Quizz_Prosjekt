const { Pool } = require('pg')

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT
})

// An idle client dying (e.g. PostgreSQL restarting during an update) is emitted here.
// Unhandled, it would exit the process and drop every running game; the pool replaces
// the client on the next query.
pool.on('error', err => {
  console.error('Databasetilkobling feilet (ledig klient):', err.message)
})

module.exports = pool
