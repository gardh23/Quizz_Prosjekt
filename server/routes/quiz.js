const express = require('express')
const router = express.Router()
const pool = require('../db')
const { requireAuth, requireRole } = require('../middleware/auth')
const upload = require('../middleware/upload')

router.post('/', requireAuth, requireRole('host', 'admin'), async (req, res) => {
    const { title } = req.body

    try {
        const result = await pool.query(
            'INSERT INTO quizzes (title, created_by) VALUES ($1, $2) RETURNING *',
            [title, req.user.id]
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

router.delete('/:id', requireAuth, requireRole('host', 'admin'), async (req, res) => {
    const { id } = req.params

    try {
        const result = await pool.query('DELETE FROM quizzes WHERE id = $1 RETURNING id', [id])
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Quiz ikke funnet' })
        }
        res.json({ message: 'Quiz slettet' })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Noe gikk galt' })
    }
})

router.post('/:id/questions', requireAuth, requireRole('host', 'admin'), upload.fields([{ name: 'image' }, { name: 'audio' }]), async (req, res) => {
    const { id } = req.params
    const { type, text, time_limit, speed_bonus, order_index, answers } = req.body
    const parsedAnswers = typeof answers === 'string' ? JSON.parse(answers) : answers
    const image_path = req.files?.image ? req.files.image[0].path : null
    const audio_path = req.files?.audio ? req.files.audio[0].path : null

    try {
        const questionResult = await pool.query(
            'INSERT INTO questions (quiz_id, type, text, time_limit, speed_bonus, order_index, image_path, audio_path) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING * ',
            [id, type, text, time_limit, speed_bonus, order_index, image_path, audio_path]
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
    const { type, text, time_limit, speed_bonus, order_index, answers } = req.body
    const image_path = req.files?.image ? req.files.image[0].path : null
    const audio_path = req.files?.audio ? req.files.audio[0].path : null

    try {
        const result = await pool.query(
            'UPDATE questions SET type=$1, text=$2, time_limit=$3, speed_bonus=$4, order_index=$5, image_path=$6, audio_path=$7 WHERE id=$8 RETURNING *',
            [type, text, time_limit, speed_bonus, order_index, image_path, audio_path, questionId]
        )
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Spørsmål ikke funnet' })
        }

        if (answers && answers.length > 0) {
            await pool.query('DELETE FROM answers WHERE question_id = $1', [questionId])
            for (const answer of answers) {
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
        const result = await pool.query('DELETE FROM questions WHERE id = $1 RETURNING id', [questionId])
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Spørsmål ikke funnet' })
        }
        res.json({ message: 'Spørsmål slettet' })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Noe gikk galt' })
    }
})


module.exports = router