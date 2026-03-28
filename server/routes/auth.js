const express = require('express')
const router = express.Router()
const bcrypt = require('bcrypt')
const pool = require('../db')
const JWT_SECRET = process.env.JWT_SECRET
const jwt = require('jsonwebtoken')

router.post('/register', async (req, res) => {
    const { username, password } = req.body

    try {
        const existing = await pool.query('SELECT id FROM users WHERE username = $1', [username])
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Brukernavnet er allerede tatt' })
        }

        const password_hash = await bcrypt.hash(password, 10)

        const result = await pool.query(
            'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, role',
            [username, password_hash]
        )

        res.status(201).json({ message: 'Bruker opprettet', user: result.rows[0] })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Noe gikk galt' })
    }
})

router.post('/login', async (req, res) => {
    const { username, password } = req.body

    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username])
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Feil brukernavn eller passord' })
        }

        const user = result.rows[0]
        const match = await bcrypt.compare(password, user.password_hash)
        if (!match) {
            return res.status(401).json({ error: 'Feil brukernavn eller passord' })
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        )

        res.json({ message: 'Innlogget', token, user: { id: user.id, username: user.username, role: user.role } })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Noe gikk galt' })
    }
})


module.exports = router 