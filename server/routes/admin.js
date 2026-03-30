const express = require('express')
const router = express.Router()
const pool = require('../db')
const { requireAuth, requireRole } = require('../middleware/auth')

router.get('/users', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const result = await pool.query('SELECT id, username, role FROM users ORDER BY username')
        res.json(result.rows)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Noe gikk galt' })
    }
})

router.put('/users/:id/role', requireAuth, requireRole('admin'), async (req, res) => {
    const { id } = req.params
    const { role } = req.body

    const validRoles = ['player', 'host', 'admin']
    if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'Ugyldig rolle' })
    }

    try {
        const result = await pool.query(
            'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, username, role',
            [role, id]
        )
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Bruker ikke funnet' })
        }
        res.json(result.rows[0])
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Noe gikk galt' })
    }
})

router.delete('/users/:id', requireAuth, requireRole('admin'), async (req, res) => {
    const { id } = req.params

    if (parseInt(id) === req.user.id) {
        return res.status(400).json({ error: 'Du kan ikke slette din egen bruker' })
    }

    try {
        const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id])
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Bruker ikke funnet' })
        }
        res.json({ message: 'Bruker slettet' })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Noe gikk galt' })
    }
})

module.exports = router