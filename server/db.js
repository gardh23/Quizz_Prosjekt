const { Pool } = require('pg')

const pool = new Pool({
  user: 'gard',
  host: 'localhost',
  database: 'quizz_db',
  password: '',
  port: 5432
})

module.exports = pool