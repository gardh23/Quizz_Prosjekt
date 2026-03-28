import { useState, useEffect } from 'react'
import api from '../api'
import socket from '../socket'
import { useNavigate } from 'react-router-dom'

function Host() {
    const [quizzes, setQuizzes] = useState([])
    const navigate = useNavigate()



    const [newTitle, setNewTitle] = useState('')

    const createQuiz = async (e) => {
        e.preventDefault()
        const res = await api.post('/quizzes', { title: newTitle })
        const user = JSON.parse(localStorage.getItem('user'))
        setQuizzes([{ ...res.data, created_by_username: user.username }, ...quizzes])
        setNewTitle('')
    }

    const startQuiz = (quizId) => {
        socket.emit('host:create', { quizId })
        socket.once('host:created', ({ roomCode }) => {
            navigate(`/host/live/${roomCode}`)
        })
    }

    useEffect(() => {
        api.get('/quizzes').then(res => setQuizzes(res.data))
    }, [])

    return (
        <div>
            <h1>Host-meny</h1>
            <form onSubmit={createQuiz}>
                <input
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    placeholder="Navn på ny quiz"
                />
                <button type="submit">Opprett quiz</button>
            </form>
            <h2>Dine quizer</h2>
            {quizzes.length === 0 && <p>Ingen quizer ennå</p>}
            {quizzes.map(quiz => (
                <div key={quiz.id}>
                    <h3>{quiz.title}</h3>
                    <p>Laget av: {quiz.created_by_username}</p>
                    <button onClick={() => window.location.href = `/quiz/${quiz.id}/edit`}>Rediger</button>
                    <button onClick={() => startQuiz(quiz.id)}>Start quiz</button>
                </div>
            ))}
        </div>
    )
}

export default Host