require('dotenv').config()
const express = require('express')
const app = express()
const PORT = process.env.PORT
const pool = require('./db')

const authRoutes = require('./routes/auth')
const quizRoutes = require('./routes/quiz')


app.use(express.json())
app.use('/uploads', express.static('uploads'))
app.use('/auth', authRoutes)
app.use('/quizzes', quizRoutes)



app.get('/', async (req, res) => {
  const result = await pool.query('SELECT NOW()')
  res.send(`Database tilkoblet! Tidspunkt: ${result.rows[0].now}`)
})

app.listen(PORT, () => {
  console.log(`Server kjører på http://localhost:${PORT}`)
}) 