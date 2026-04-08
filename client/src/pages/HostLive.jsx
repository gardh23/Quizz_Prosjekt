import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import socket from '../socket'
import UserBadge from '../components/UserBadge'
import { mediaBase } from '../api'

function HostLive() {
    const { roomCode } = useParams()
    const navigate = useNavigate()
    const [players, setPlayers] = useState([])
    const [question, setQuestion] = useState(null)
    const [leaderboard, setLeaderboard] = useState(null)
    const [finished, setFinished] = useState(false)
    const [timer, setTimer] = useState('')
    const [freeTextAnswers, setFreeTextAnswers] = useState({})
    const [speedBonus, setSpeedBonus] = useState(false)
    const [timeLeft, setTimeLeft] = useState(null)
    const [countdownLeft, setCountdownLeft] = useState(null)
    const timerRef = useRef(null)
    const countdownRef = useRef(null)

    // Rettefase
    const [gradingQuestion, setGradingQuestion] = useState(null)
    const [gradingPlayerAnswers, setGradingPlayerAnswers] = useState([])
    const [gradingIndex, setGradingIndex] = useState(0)
    const [gradingTotal, setGradingTotal] = useState(0)
    const [localGrades, setLocalGrades] = useState({})

    const startTimer = (seconds) => {
        if (timerRef.current) clearInterval(timerRef.current)
        setTimeLeft(seconds)
        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) { clearInterval(timerRef.current); return 0 }
                return prev - 1
            })
        }, 1000)
    }

    useEffect(() => {
        socket.on('session:players', ({ players }) => setPlayers(players))
        socket.on('session:question', ({ question }) => {
            setQuestion(question)
            setFreeTextAnswers({})
            setCountdownLeft(null)
            if (countdownRef.current) clearInterval(countdownRef.current)
            startTimer(question.time_limit)
        })
        socket.on('session:countdown', ({ seconds }) => {
            setQuestion(null)
            setCountdownLeft(seconds)
            if (countdownRef.current) clearInterval(countdownRef.current)
            countdownRef.current = setInterval(() => {
                setCountdownLeft(prev => {
                    if (prev <= 1) { clearInterval(countdownRef.current); return 0 }
                    return prev - 1
                })
            }, 1000)
        })
        socket.on('session:grading_question', ({ question, playerAnswers, gradingIndex, total }) => {
            setGradingQuestion(question)
            setGradingPlayerAnswers(playerAnswers)
            setGradingIndex(gradingIndex)
            setGradingTotal(total)
            setLocalGrades({})
            setQuestion(null)
            setCountdownLeft(null)
        })
        socket.on('session:answer_graded', ({ username, isCorrect, points }) => {
            setLocalGrades(prev => ({ ...prev, [username]: { isCorrect, points } }))
        })
        socket.on('session:finished', ({ leaderboard }) => {
            setLeaderboard(leaderboard)
            setGradingQuestion(null)
            setFinished(true)
        })
        socket.on('host:free_text_answer', (data) => {
            setFreeTextAnswers(prev => ({ ...prev, [data.username]: data }))
        })

        return () => {
            socket.off('session:players')
            socket.off('session:question')
            socket.off('session:countdown')
            socket.off('session:grading_question')
            socket.off('session:answer_graded')
            socket.off('session:finished')
            socket.off('host:free_text_answer')
            if (timerRef.current) clearInterval(timerRef.current)
            if (countdownRef.current) clearInterval(countdownRef.current)
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
        if (seconds === 0) {
            if (timerRef.current) clearInterval(timerRef.current)
            setTimeLeft(0)
        } else {
            startTimer(seconds)
        }
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

    // Rettefase
    if (gradingQuestion) {
        const correctAnswers = gradingQuestion.answers?.filter(a => a.is_correct) || []
        return (
            <div className="min-h-screen bg-purple-900 p-8">
                <UserBadge />
                <div className="max-w-2xl mx-auto">
                    <div className="flex items-center justify-between mb-6">
                        <h1 className="text-2xl font-bold text-white">
                            Rettefase — <span className="text-yellow-300">{gradingIndex + 1} / {gradingTotal}</span>
                        </h1>
                        <span className="bg-purple-700 text-purple-200 px-4 py-2 rounded-xl">{players.length} spillere</span>
                    </div>

                    <div className="bg-white rounded-2xl p-6 mb-4 shadow-lg">
                        <h2 className="text-xl font-bold text-purple-900 mb-2">{gradingQuestion.text}</h2>
                        {correctAnswers.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3">
                                {correctAnswers.map(a => (
                                    <span key={a.id} className="bg-green-100 text-green-700 font-semibold px-3 py-1 rounded-lg text-sm">
                                        Fasit: {a.text}
                                    </span>
                                ))}
                            </div>
                        )}
                        {gradingQuestion.image_path && (
                            <img
                                src={`${mediaBase}/${gradingQuestion.image_path}`}
                                style={{ width: `${gradingQuestion.image_width || 100}%` }}
                                className="mx-auto rounded-xl object-contain mb-3"
                            />
                        )}
                        {gradingQuestion.audio_path && (
                            <audio key={gradingQuestion.id} controls src={`${mediaBase}/${gradingQuestion.audio_path}`} className="w-full mb-3" />
                        )}

                        <div className="flex flex-col gap-2 mt-3">
                            {gradingPlayerAnswers.map(a => {
                                const grade = localGrades[a.username]
                                return (
                                    <div key={a.username} className="flex items-center justify-between bg-purple-50 rounded-xl px-4 py-3">
                                        <div>
                                            <span className="font-semibold text-purple-900">{a.username}</span>
                                            {!a.answered ? (
                                                <span className="text-gray-400 text-sm ml-2">Ikke svart</span>
                                            ) : gradingQuestion.type === 'multiple_choice' ? (
                                                <span className="text-gray-700 text-sm ml-2">{a.answerText}</span>
                                            ) : (
                                                <span className="text-gray-700 text-sm ml-2">"{a.freeTextResponse}"</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {!a.answered ? null
                                            : gradingQuestion.type === 'multiple_choice' ? (
                                                <span className={`font-bold px-3 py-1 rounded-lg text-sm ${a.isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                    {a.isCorrect ? `✓ ${a.points}p` : '✗'}
                                                </span>
                                            ) : grade ? (
                                                <span className={`font-bold px-3 py-1 rounded-lg text-sm ${grade.isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                    {grade.isCorrect ? `✓ ${grade.points}p` : '✗'}
                                                </span>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => socket.emit('host:grade', { roomCode, playerId: a.socketId, isCorrect: true })}
                                                        className="bg-green-500 hover:bg-green-600 text-white font-bold px-3 py-1 rounded-lg transition-colors text-sm"
                                                    >
                                                        Riktig
                                                    </button>
                                                    <button
                                                        onClick={() => socket.emit('host:grade', { roomCode, playerId: a.socketId, isCorrect: false })}
                                                        className="bg-red-500 hover:bg-red-600 text-white font-bold px-3 py-1 rounded-lg transition-colors text-sm"
                                                    >
                                                        Feil
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <button
                        onClick={() => socket.emit('host:grading_next', { roomCode })}
                        className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold text-xl py-4 rounded-2xl transition-colors"
                    >
                        {gradingIndex + 1 < gradingTotal ? 'Neste spørsmål →' : 'Vis leaderboard'}
                    </button>
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

                {!question && countdownLeft === null && (
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

                {question && (
                    <div>
                        <div className="bg-white rounded-2xl p-6 mb-4 shadow-lg">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-2xl font-bold text-purple-900">{question.text}</h2>
                                {timeLeft !== null && (
                                    <span className={`text-3xl font-bold ${timeLeft <= 10 ? 'text-red-500' : 'text-purple-700'}`}>{timeLeft}</span>
                                )}
                            </div>
                            {question.image_path && (
                                <img
                                    src={`${mediaBase}/${question.image_path}`}
                                    style={{ width: `${question.image_width || 100}%` }}
                                    className="mx-auto rounded-xl object-contain mb-3 mt-3"
                                />
                            )}
                            {question.audio_path && (
                                <audio controls src={`${mediaBase}/${question.audio_path}`} className="w-full mb-3 mt-3" />
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

                        {question.type === 'free_text' && Object.keys(freeTextAnswers).length > 0 && (
                            <div className="bg-white rounded-2xl p-5 mb-4 shadow-lg">
                                <h3 className="text-lg font-bold text-purple-900 mb-1">Fritekst-svar</h3>
                                {question.answers?.filter(a => a.is_correct).map(a => (
                                    <span key={a.id} className="inline-block bg-green-100 text-green-700 font-semibold px-3 py-1 rounded-lg text-sm mb-3">
                                        Fasit: {a.text}
                                    </span>
                                ))}
                                <p className="text-sm text-gray-400 mb-3">Rettes i rettefasen</p>
                                <div className="flex flex-col gap-2">
                                    {Object.values(freeTextAnswers).map(a => (
                                        <div key={a.username} className="bg-purple-50 rounded-xl px-4 py-3">
                                            <span className="font-semibold text-purple-900">{a.username}:</span>
                                            <span className="text-gray-700 ml-2">{a.answer}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <form onSubmit={overrideTimer} className="flex gap-3 mb-4">
                            <input
                                value={timer}
                                onChange={e => setTimer(e.target.value)}
                                placeholder="Overstyr timer (sekunder)"
                                type="number"
                                className="flex-1 border-2 border-purple-300 rounded-xl p-3 bg-purple-800 text-white placeholder-purple-300 focus:outline-none focus:border-white"
                            />
                            <button
                                type="submit"
                                className="bg-yellow-400 hover:bg-yellow-500 text-purple-900 font-bold px-5 py-3 rounded-xl transition-colors"
                            >
                                Sett timer
                            </button>
                        </form>

                        <button
                            onClick={next}
                            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold text-xl py-4 rounded-2xl transition-colors"
                        >
                            Neste spørsmål
                        </button>
                    </div>
                )}

                {countdownLeft !== null && !question && (
                    <div className="bg-white rounded-2xl p-10 text-center shadow-lg">
                        <p className="text-gray-500 text-lg mb-2">Neste spørsmål om</p>
                        <p className="text-8xl font-bold text-purple-700">{countdownLeft}</p>
                    </div>
                )}
            </div>
        </div>
    )
}

export default HostLive
