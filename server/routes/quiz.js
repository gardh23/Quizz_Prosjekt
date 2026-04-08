const express = require('express')
const router = express.Router()
const pool = require('../db')
const fs = require('fs')
const { requireAuth, requireRole } = require('../middleware/auth')
const upload = require('../middleware/upload')

router.post('/', requireAuth, requireRole('host', 'admin'), async (req, res) => {
    const { title, speed_bonus } = req.body

    try {
        const result = await pool.query(
            'INSERT INTO quizzes (title, created_by, speed_bonus) VALUES ($1, $2, $3) RETURNING *',
            [title, req.user.id, speed_bonus || false]
        )
        res.status(201).json(result.rows[0])
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Noe gikk galt' })
    }
})

router.get('/', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT quizzes.*, users.username as created_by_username FROM quizzes JOIN users ON quizzes.created_by = users.id ORDER BY created_at DESC'
        )
        res.json(result.rows)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Noe gikk galt' })
    }
})


router.get('/:id', requireAuth, async (req, res) => {
    const { id } = req.params

    try {
        const quizResult = await pool.query('SELECT * FROM quizzes WHERE id = $1', [id])
        if (quizResult.rows.length === 0) {
            return res.status(404).json({ error: 'Quiz ikke funnet' })
        }

        const questionsResult = await pool.query(
            'SELECT * FROM questions WHERE quiz_id = $1 ORDER BY order_index',
            [id]
        )

        for (const question of questionsResult.rows) {
            const answersResult = await pool.query(
                'SELECT * FROM answers WHERE question_id = $1',
                [question.id]
            )
            question.answers = answersResult.rows
        }

        const quiz = quizResult.rows[0]
        quiz.questions = questionsResult.rows

        res.json(quiz)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Noe gikk galt' })
    }
})

router.put('/:id', requireAuth, requireRole('host', 'admin'), async (req, res) => {
    const { id } = req.params
    const { title } = req.body

    try {
        const quizResult = await pool.query('SELECT created_by FROM quizzes WHERE id = $1', [id])
        if (quizResult.rows.length === 0) {
            return res.status(404).json({ error: 'Quiz ikke funnet' })
        }
        if (req.user.role !== 'admin' && quizResult.rows[0].created_by !== req.user.id) {
            return res.status(403).json({ error: 'Du kan bare redigere dine egne quizer' })
        }

        const result = await pool.query(
            'UPDATE quizzes SET title = $1 WHERE id = $2 RETURNING *',
            [title, id]
        )
        res.json(result.rows[0])
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Noe gikk galt' })
    }
})

router.delete('/:id', requireAuth, requireRole('host', 'admin'), async (req, res) => {
    const { id } = req.params

    try {
        const quizResult = await pool.query('SELECT created_by FROM quizzes WHERE id = $1', [id])
        if (quizResult.rows.length === 0) {
            return res.status(404).json({ error: 'Quiz ikke funnet' })
        }

        if (req.user.role !== 'admin' && quizResult.rows[0].created_by !== req.user.id) {
            return res.status(403).json({ error: 'Du kan bare slette dine egne quizer' })
        }

        const questionsResult = await pool.query('SELECT image_path, audio_path FROM questions WHERE quiz_id = $1', [id])
        await pool.query('DELETE FROM quizzes WHERE id = $1', [id])

        for (const q of questionsResult.rows) {
            if (q.image_path) fs.unlink(q.image_path, () => {})
            if (q.audio_path) fs.unlink(q.audio_path, () => {})
        }

        res.json({ message: 'Quiz slettet' })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Noe gikk galt' })
    }
})

router.post('/:id/questions', requireAuth, requireRole('host', 'admin'), upload.fields([{ name: 'image' }, { name: 'audio' }]), async (req, res) => {
    const { id } = req.params
    const { type, text, time_limit, order_index, answers, image_width } = req.body
    const parsedAnswers = typeof answers === 'string' ? JSON.parse(answers) : answers
    const image_path = req.files?.image ? req.files.image[0].path : null
    const audio_path = req.files?.audio ? req.files.audio[0].path : null

    try {
        const questionResult = await pool.query(
            'INSERT INTO questions (quiz_id, type, text, time_limit, order_index, image_path, audio_path, image_width) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
            [id, type, text, time_limit, order_index, image_path, audio_path, image_width || 100]
        )

        const question = questionResult.rows[0]

        if (parsedAnswers && parsedAnswers.length > 0) {
            for (const answer of parsedAnswers) {
                await pool.query(
                    'INSERT INTO answers (question_id, text, is_correct) VALUES ($1, $2, $3)',
                    [question.id, answer.text, answer.is_correct]
                )
            }
        }

        res.status(201).json(question)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Noe gikk galt' })
    }
})


router.put('/:quizId/questions/:questionId', requireAuth, requireRole('host', 'admin'), upload.fields([{ name: 'image' }, { name: 'audio' }]), async (req,
    res) => {
    const { questionId } = req.params
    const { type, text, time_limit, order_index, answers, image_width } = req.body
    const parsedAnswers = typeof answers === 'string' ? JSON.parse(answers) : answers
    const image_path = req.files?.image ? req.files.image[0].path : null
    const audio_path = req.files?.audio ? req.files.audio[0].path : null

    try {
        const old = await pool.query('SELECT image_path, audio_path FROM questions WHERE id = $1', [questionId])
        const oldImage = old.rows[0]?.image_path
        const oldAudio = old.rows[0]?.audio_path

        const result = await pool.query(
            'UPDATE questions SET type=$1, text=$2, time_limit=$3, order_index=$4, image_path=COALESCE($5, image_path), audio_path=COALESCE($6, audio_path), image_width=$7 WHERE id=$8 RETURNING *',
            [type, text, time_limit, order_index, image_path, audio_path, image_width || 100, questionId]
        )

        if (image_path && oldImage) fs.unlink(oldImage, () => {})
        if (audio_path && oldAudio) fs.unlink(oldAudio, () => {})
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Spørsmål ikke funnet' })
        }

        if (parsedAnswers && parsedAnswers.length > 0) {
            await pool.query('DELETE FROM answers WHERE question_id = $1', [questionId])
            for (const answer of parsedAnswers) {
                await pool.query(
                    'INSERT INTO answers (question_id, text, is_correct) VALUES ($1, $2, $3)',
                    [questionId, answer.text, answer.is_correct]
                )
            }
        }

        res.json(result.rows[0])
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Noe gikk galt' })
    }
})

router.delete('/:quizId/questions/:questionId', requireAuth, requireRole('host', 'admin'), async (req, res) => {
    const { questionId } = req.params

    try {
        const result = await pool.query('DELETE FROM questions WHERE id = $1 RETURNING *', [questionId])
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Spørsmål ikke funnet' })
        }

        const { image_path, audio_path } = result.rows[0]
        if (image_path) fs.unlink(image_path, () => {})
        if (audio_path) fs.unlink(audio_path, () => {})

        res.json({ message: 'Spørsmål slettet' })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Noe gikk galt' })
    }
})


module.exports = router