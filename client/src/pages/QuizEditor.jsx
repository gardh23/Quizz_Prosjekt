import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import api from '../api'

function QuizEditor() {
    const { id } = useParams()
    const [quiz, setQuiz] = useState(null)
    const [type, setType] = useState('multiple_choice')
    const [text, setText] = useState('')
    const [timeLimit, setTimeLimit] = useState(30)
    const [speedBonus, setSpeedBonus] = useState(false)
    const [answers, setAnswers] = useState([
        { text: '', is_correct: false },
        { text: '', is_correct: false },
        { text: '', is_correct: false },
        { text: '', is_correct: false }
    ])

    const createQuestion = async (e) => {
        e.preventDefault()
        const formData = new FormData()
        formData.append('type', type)
        formData.append('text', text)
        formData.append('time_limit', timeLimit)
        formData.append('speed_bonus', speedBonus)
        formData.append('order_index', quiz.questions.length + 1)
        formData.append('answers', JSON.stringify(answers))

        const res = await api.post(`/quizzes/${id}/questions`, formData)
        setQuiz({ ...quiz, questions: [...quiz.questions, { ...res.data, answers }] })
        setText('')
        setAnswers([
            { text: '', is_correct: false },
            { text: '', is_correct: false },
            { text: '', is_correct: false },
            { text: '', is_correct: false }
        ])
    }

    const deleteQuestion = async (questionId) => {
        await api.delete(`/quizzes/${id}/questions/${questionId}`)
        setQuiz({ ...quiz, questions: quiz.questions.filter(q => q.id !== questionId) })
    }


    useEffect(() => {
        api.get(`/quizzes/${id}`).then(res => setQuiz(res.data))
    }, [id])

    if (!quiz) return <div>Laster...</div>

    return (
        <div>
            <h1>{quiz.title}</h1>
            <h2>Spørsmål</h2>
            {quiz.questions.length === 0 && <p>Ingen spørsmål ennå</p>}
            {quiz.questions.map((q, i) => (
                <div key={q.id}>
                    <p>{i + 1}. {q.text}</p>
                    <button onClick={() => deleteQuestion(q.id)}>Slett</button>
                </div>
            ))}
            <h2>Legg til spørsmål</h2>
            <form onSubmit={createQuestion}>
                <select value={type} onChange={e => {
                    setType(e.target.value)
                    setAnswers([
                        { text: '', is_correct: false },
                        { text: '', is_correct: false },
                        { text: '', is_correct: false },
                        { text: '', is_correct: false }
                    ])
                }}>
                    <option value="multiple_choice">Flervalg</option>
                    <option value="free_text">Fritekst</option>
                </select>

                <input
                    value={text}
                    onChange={e => setText(e.target.value)}
                    placeholder="Spørsmålstekst"
                />

                <input
                    type="number"
                    value={timeLimit}
                    onChange={e => setTimeLimit(e.target.value)}
                    placeholder="Tidsbegrensning (sekunder)"
                />

                <label>
                    <input
                        type="checkbox"
                        checked={speedBonus}
                        onChange={e => setSpeedBonus(e.target.checked)}
                    />
                    Hastighetsbonus
                </label>

                {type === 'multiple_choice' && answers.map((answer, i) => (
                    <div key={i}>
                        <input
                            value={answer.text}
                            onChange={e => {
                                const updated = [...answers]
                                updated[i] = { ...updated[i], text: e.target.value }
                                setAnswers(updated)
                            }}
                            placeholder={`Svar ${i + 1}`}
                        />
                        <label>
                            <input
                                type="checkbox"
                                checked={answer.is_correct}
                                onChange={e => {
                                    const updated = [...answers]
                                    updated[i] = { ...updated[i], is_correct: e.target.checked }
                                    setAnswers(updated)
                                }}
                            />
                            Riktig
                        </label>
                    </div>
                ))}

                {type === 'free_text' && (
                    <input
                        value={answers[0].text}
                        onChange={e => setAnswers([{ text: e.target.value, is_correct: true }])}
                        placeholder="Fasit"
                    />
                )}

                <button type="submit">Legg til spørsmål</button>
            </form>

        </div>
    )
}

export default QuizEditor