import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import socket from '../socket'
import UserBadge from '../components/UserBadge'

function HostLive() {
    const { roomCode } = useParams()
    const navigate = useNavigate()
    const [players, setPlayers] = useState([])
    const [question, setQuestion] = useState(null)
    const [leaderboard, setLeaderboard] = useState(null)
    const [finished, setFinished] = useState(false)
    const [timer, setTimer] = useState('')
    const [freeTextAnswers, setFreeTextAnswers] = useState([])
    const [gradedAnswers, setGradedAnswers] = useState({})
    const [speedBonus, setSpeedBonus] = useState(false)
    const [timeLeft, setTimeLeft] = useState(null)
    const timerRef = useRef(null)

    const startTimer = (seconds) => {
        if (timerRef.current) clearInterval(timerRef.current)
        setTimeLeft(seconds)
        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timerRef.current)
                    return 0
                }
                return prev - 1
            })
        }, 1000)
    }

    useEffect(() => {
        socket.on('session:players', ({ players }) => setPlayers(players))
        socket.on('session:question', ({ question }) => {
            setQuestion(question)
            setLeaderboard(null)
            setFreeTextAnswers([])
            setGradedAnswers({})
            startTimer(question.time_limit)
        })
        socket.on('session:leaderboard', ({ leaderboard }) => setLeaderboard(leaderboard))
        socket.on('session:finished', ({ leaderboard }) => {
            setLeaderboard(leaderboard)
            setFinished(true)
        })
        socket.on('host:free_text_answer', (data) => {
            setFreeTextAnswers(prev => [...prev, data])
        })

        return () => {
            socket.off('session:players')
            socket.off('session:question')
            socket.off('session:leaderboard')
            socket.off('session:finished')
            socket.off('host:free_text_answer')
            if (timerRef.current) clearInterval(timerRef.current)
        }
    }, [])

    const next = () => {
        socket.emit('host:next', { roomCode })
        setQuestion(null)
    }

    const overrideTimer = (e) => {
        e.preventDefault()
        const seconds = parseInt(timer)
        socket.emit('host:set_timer', { roomCode, seconds })
        startTimer(seconds)
        setTimer('')
    }

    if (finished) {
        return (
            <div className="min-h-screen bg-purple-900 flex items-center justify-center">
                <div className="bg-white rounded-2xl p-10 text-center shadow-2xl w-full max-w-lg">
                    <h1 className="text-4xl font-bold text-purple-900 mb-6">Quiz ferdig!</h1>
                    <div className="flex flex-col gap-3">
                        {leaderboard.map(p => (
                            <div key={p.username} className="flex items-center justify-between bg-purple-100 rounded-xl px-5 py-3">
                                <span className="font-bold text-purple-900">#{p.rank} {p.username}</span>
                                <span className="text-purple-600 font-bold">{p.score} poeng</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-purple-900 p-8">
            <UserBadge />
            <div className="max-w-2xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-3xl font-bold text-white">Romkode: <span className="text-yellow-300">{roomCode}</span></h1>
                    <span className="bg-purple-700 text-purple-200 px-4 py-2 rounded-xl">{players.length} spillere</span>
                </div>

                {!question && !leaderboard && (
                    <div>
                        <button
                            onClick={() => navigate('/host')}
                            className="fixed top-4 left-4 bg-white text-purple-900 font-bold px-4 py-2 rounded-xl shadow-lg hover:bg-purple-100 transition-colors z-50"
                        >
                            ← Tilbake
                        </button>
                        <div className="flex flex-wrap gap-2 mb-6">
                            {players.map((p, i) => (
                                <span key={i} className="bg-white text-purple-900 font-semibold px-4 py-2 rounded-full">{p.username}</span>
                            ))}
                        </div>
                        <label className="flex items-center gap-3 cursor-pointer text-white mb-4">
                            <input
                                type="checkbox"
                                checked={speedBonus}
                                onChange={e => setSpeedBonus(e.target.checked)}
                                className="w-5 h-5 accent-purple-400"
                            />
                            <span className="text-lg font-semibold">Hastighetsbonus</span>
                        </label>
                        <button
                            onClick={() => socket.emit('host:start', { roomCode, speedBonus })}
                            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold text-2xl py-5 rounded-2xl transition-colors"
                        >
                            Start quiz
                        </button>
                    </div>
                )}

                {question && !leaderboard && (
                    <div>
                        <div className="bg-white rounded-2xl p-6 mb-4 shadow-lg">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-2xl font-bold text-purple-900">{question.text}</h2>
                                {timeLeft !== null && (
                                    <span className={`text-3xl font-bold ${timeLeft <= 10 ? 'text-red-500' : 'text-purple-700'}`}>{timeLeft}</span>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {question.answers.filter(a => a.is_correct).map(a => (
                                    <span key={a.id} className="bg-green-100 text-green-700 font-semibold px-3 py-1 rounded-lg text-sm">
                                        {a.text}
                                    </span>
                                ))}
                            </div>
                            {question.image_path && (
                                <img
                                    src={`http://localhost:3000/${question.image_path}`}
                                    style={{ width: `${question.image_width || 100}%` }}
                                    className="mx-auto rounded-xl object-contain mb-3 mt-3"
                                />
                            )}
                            {question.audio_path && (
                                <audio controls src={`http://localhost:3000/${question.audio_path}`} className="w-full mb-3 mt-3" />
                            )}
                            <p className="text-gray-500 text-sm mb-2">
                                {players.filter(p => p.answers && p.answers[question.id]).length} / {players.length} har svart
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {players.map((p, i) => (
                                    <span key={i} className={`px-3 py-1 rounded-full text-sm font-semibold ${p.answers && p.answers[question.id] ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                                        {p.username}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <form onSubmit={overrideTimer} className="flex gap-3 mb-4">
                            <input
                                value={timer}
                                onChange={e => setTimer(e.target.value)}
                                placeholder="Overstyr timer (sekunder)"
                                type="number"
                                className="flex-1 border-2 border-purple-300 rounded-xl p-3 bg-purple-800 text-white placeholder-purple-300
  focus:outline-none focus:border-white"
                            />
                            <button
                                type="submit"
                                className="bg-yellow-400 hover:bg-yellow-500 text-purple-900 font-bold px-5 py-3 rounded-xl transition-colors"
                            >
                                Sett timer
                            </button>
                        </form>

                        {question.type === 'free_text' && freeTextAnswers.length > 0 && (
                            <div className="bg-white rounded-2xl p-5 mb-4 shadow-lg">
                                <h3 className="text-lg font-bold text-purple-900 mb-3">Fritekst-svar</h3>
                                <div className="flex flex-col gap-3">
                                    {freeTextAnswers.map((a, i) => (
                                        <div key={i} className="flex items-center justify-between bg-purple-50 rounded-xl px-4 py-3">
                                            <span className="font-semibold text-purple-900">{a.username}: <span
                                                className="text-gray-700">{a.answer}</span></span>
                                            <div className="flex gap-2">
                                                {gradedAnswers[a.playerId] !== undefined ? (
                                                    <span className={`font-bold px-3 py-1 rounded-lg ${gradedAnswers[a.playerId] ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                        {gradedAnswers[a.playerId] ? 'Riktig ✓' : 'Feil ✗'}
                                                    </span>
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={() => {
                                                                socket.emit('host:grade', { roomCode, playerId: a.playerId, isCorrect: true })
                                                                setGradedAnswers(prev => ({ ...prev, [a.playerId]: true }))
                                                            }}
                                                            className="bg-green-500 hover:bg-green-600 text-white font-bold px-3 py-1 rounded-lg transition-colors"
                                                        >
                                                            Riktig
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                socket.emit('host:grade', { roomCode, playerId: a.playerId, isCorrect: false })
                                                                setGradedAnswers(prev => ({ ...prev, [a.playerId]: false }))
                                                            }}
                                                            className="bg-red-500 hover:bg-red-600 text-white font-bold px-3 py-1 rounded-lg transition-colors"
                                                        >
                                                            Feil
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <button
                            onClick={next}
                            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold text-xl py-4 rounded-2xl transition-colors"
                        >
                            Neste spørsmål
                        </button>
                    </div>
                )}

                {leaderboard && (
                    <div>
                        <div className="bg-white rounded-2xl p-6 mb-4 shadow-lg">
                            <h2 className="text-2xl font-bold text-purple-900 mb-4">Leaderboard</h2>
                            <div className="flex flex-col gap-3">
                                {leaderboard.map(p => (
                                    <div key={p.username} className="flex items-center justify-between bg-purple-100 rounded-xl px-5 py-3">
                                        <span className="font-bold text-purple-900">#{p.rank} {p.username}</span>
                                        <span className="text-purple-600 font-bold">{p.score} poeng</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <button
                            onClick={next}
                            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold text-xl py-4 rounded-2xl transition-colors"
                        >
                            Neste spørsmål
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

export default HostLive