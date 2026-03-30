require('dotenv').config()
const fs = require('fs')
fs.mkdirSync('uploads', { recursive: true })
const cors = require('cors')
const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const jwt = require('jsonwebtoken')
const adminRoutes = require('./routes/admin')

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
app.use('/admin', adminRoutes) 

app.get('/', async (req, res) => {
  const result = await pool.query('SELECT NOW()')
  res.send(`Database tilkoblet! Tidspunkt: ${result.rows[0].now}`)
})

io.use((socket, next) => {
    const token = socket.handshake.auth.token
    if (!token) {
        socket.user = null
        return next()
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        socket.user = decoded
        next()
    } catch {
        socket.user = null
        next()
    }
})

require('./socket')(io)

server.listen(PORT, () => {
  console.log(`Server kjører på http://localhost:${PORT}`)
})