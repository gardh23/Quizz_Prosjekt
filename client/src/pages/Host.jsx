import { useState, useEffect } from 'react'
import api from '../api'
import socket from '../socket'
import { useNavigate } from 'react-router-dom'
import UserBadge from '../components/UserBadge'

function Host() {
    const [quizzes, setQuizzes] = useState([])
    const [newTitle, setNewTitle] = useState('')
    const navigate = useNavigate()

    const createQuiz = async (e) => {
        e.preventDefault()
        const res = await api.post('/quizzes', { title: newTitle })
        const user = JSON.parse(localStorage.getItem('user'))
        setQuizzes([{ ...res.data, created_by_username: user.username }, ...quizzes])
        setNewTitle('')
    }

    const deleteQuiz = async (quizId, title) => {
        if (!window.confirm(`Er du helt sikker på at du vil slette "${title}"?`)) return
        await api.delete(`/quizzes/${quizId}`)
        setQuizzes(quizzes.filter(q => q.id !== quizId))
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
        <div className="min-h-screen bg-purple-900 p-8">
            <UserBadge />
            <h1 className="text-4xl font-bold text-white text-center mb-8">Host-meny</h1>
            <div className="max-w-2xl mx-auto">
                <form onSubmit={createQuiz} className="flex gap-3 mb-8">
                    <input
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                        placeholder="Navn på ny quiz"
                        className="flex-1 border-2 border-purple-300 rounded-xl p-3 text-lg focus:outline-none focus:border-white bg-purple-800 text-white placeholder-purple-300"
                    />
                    <button
                        type="submit"
                        className="bg-green-500 hover:bg-green-600 text-white font-bold px-6 py-3 rounded-xl transition-colors"
                    >
                        Opprett
                    </button>
                </form>

                {quizzes.length === 0 && <p className="text-purple-300 text-center">Ingen quizer ennå</p>}
                <div className="flex flex-col gap-4">
                    {quizzes.map(quiz => (
                        <div key={quiz.id} className="bg-white rounded-2xl p-5 flex items-center justify-between shadow-lg">
                            <div>
                                <h3 className="text-xl font-bold text-purple-900">{quiz.title}</h3>
                                <p className="text-gray-400 text-sm">Laget av: {quiz.created_by_username}</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => navigate(`/quiz/${quiz.id}/edit`)}
                                    className="bg-purple-100 hover:bg-purple-200 text-purple-800 font-bold px-4 py-2 rounded-xl transition-colors"
                                >
                                    Rediger
                                </button>
                                <button
                                    onClick={() => startQuiz(quiz.id)}
                                    className="bg-green-500 hover:bg-green-600 text-white font-bold px-4 py-2 rounded-xl transition-colors"
                                >
                                    Start
                                </button>
                                <button
                                    onClick={() => deleteQuiz(quiz.id, quiz.title)}
                                    className="bg-red-100 hover:bg-red-200 text-red-700 font-bold px-4 py-2 rounded-xl transition-colors"
                                >
                                    Slett
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default Host