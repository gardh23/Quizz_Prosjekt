require('dotenv').config()
const cors = require('cors')
const express = require('express')
const http = require('http')
const { Server } = require('socket.io')

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173'
  }
})


const PORT = process.env.PORT
const pool = require('./db')

const authRoutes = require('./routes/auth')
const quizRoutes = require('./routes/quiz')

app.use(express.json())
app.use(cors({ origin: 'http://localhost:5173' }))
app.use('/uploads', express.static('uploads'))
app.use('/auth', authRoutes)
app.use('/quizzes', quizRoutes)

app.get('/', async (req, res) => {
  const result = await pool.query('SELECT NOW()')
  res.send(`Database tilkoblet! Tidspunkt: ${result.rows[0].now}`)
})

require('./socket')(io)

server.listen(PORT, () => {
  console.log(`Server kjører på http://localhost:${PORT}`)
})