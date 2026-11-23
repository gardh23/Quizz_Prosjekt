import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import socket from '../socket'
import TopBar from '../components/TopBar'
import { mediaBase } from '../api'
import AnswerDistribution from '../components/AnswerDistribution'
import Podium from '../components/Podium'
import { sounds, startLobbyMusic, stopLobbyMusic } from '../sound'
import Timer from '../components/Timer'

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
    const [phase, setPhase] = useState('waiting')
    const [error, setError] = useState('')
    const [copied, setCopied] = useState(false)
    const timerRef = useRef(null)
    const countdownRef = useRef(null)

    // Rettefase
    const [gradingQuestion, setGradingQuestion] = useState(null)
    const [gradingPlayerAnswers, setGradingPlayerAnswers] = useState([])
    const [gradingDistribution, setGradingDistribution] = useState(null)
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
        // After a refresh or a dropped connection the server has frozen the game;
        // rejoining hands it to this socket. On a fresh room it is a harmless no-op.
        const rejoin = () => socket.emit('host:rejoin', { roomCode })
        socket.on('connect', rejoin)
        if (socket.connected) rejoin()

        socket.on('host:rejoined', ({ status }) => setPhase(status))
        socket.on('session:resumed', ({ question, timeRemaining }) => {
            if (!question) return
            setQuestion(question)
            setCountdownLeft(null)
            startTimer(timeRemaining)
        })
        socket.on('error', ({ message }) => {
            if (message === 'Romkode ikke funnet') navigate('/host')
            else setError(message)
        })
        socket.on('session:players', ({ players }) => setPlayers(players))
        socket.on('session:question', ({ question }) => {
            setPhase('active')
            setError('')
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
        socket.on('session:grading_question', ({ question, playerAnswers, distribution, gradingIndex, total }) => {
            setGradingDistribution(distribution)
            setPhase('grading')
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
            socket.off('connect', rejoin)
            socket.off('host:rejoined')
            socket.off('session:resumed')
            socket.off('error')
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
    }, [roomCode, navigate])

    const inLobby = phase === 'waiting' && !question && countdownLeft === null && !finished
    useEffect(() => {
        if (!inLobby) return
        startLobbyMusic()
        return stopLobbyMusic
    }, [inLobby])

    useEffect(() => {
        if (countdownLeft > 0) sounds.tick()
    }, [countdownLeft])

    const answeredCount = question ? players.filter(p => p.answers?.[question.id]).length : 0
    const allAnswered = players.length > 0 && answeredCount === players.length

    // A ready-to-paste message for the video call; the link pre-fills the room code.
    const copyInvite = async () => {
        const link = `${window.location.origin}/quiz/play?rom=${encodeURIComponent(roomCode)}`
        try {
            await navigator.clipboard.writeText(`Bli med i quizen: ${link} (romkode ${roomCode})`)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            setError('Kunne ikke kopiere — del romkoden manuelt')
        }
    }

    const questionOpen = !!question
    useEffect(() => {
        if (!questionOpen || timeLeft === null) return
        if (timeLeft > 0 && timeLeft <= 5) sounds.tick()
        if (timeLeft === 0) sounds.timeUp()
    }, [timeLeft, questionOpen])

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
                    <Podium leaderboard={leaderboard} />
                    <button
                        onClick={() => navigate('/host')}
                        className="mt-6 btn btn-next btn-lg"
                    >
                        Tilbake til quizene
                    </button>
                </div>
            </div>
        )
    }

    // Rettefase
    if (gradingQuestion) {
        const correctAnswers = gradingQuestion.type === 'ranking'
            ? [{ id: 'order', text: (gradingQuestion.answers || []).filter(Boolean).map(a => a.text).join(' → ') }]
            : gradingQuestion.answers?.filter(a => a.is_correct) || []
        return (
            <div className="min-h-screen bg-purple-900 p-8">
                <TopBar />
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

                        <AnswerDistribution distribution={gradingDistribution} />
                        <div className="flex flex-col gap-2 mt-3">
                            {gradingPlayerAnswers.map(a => {
                                const grade = localGrades[a.username]
                                return (
                                    <div key={a.username} className="flex items-center justify-between bg-purple-50 rounded-xl px-4 py-3">
                                        <div>
                                            <span className="font-semibold text-purple-900">{a.username}</span>
                                            {!a.answered ? (
                                                <span className="text-gray-400 text-sm ml-2">Ikke svart</span>
                                            ) : gradingQuestion.type !== 'free_text' ? (
                                                <span className="text-gray-700 text-sm ml-2">{a.answerText}</span>
                                            ) : (
                                                <span className="text-gray-700 text-sm ml-2">"{a.freeTextResponse}"</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {!a.answered ? null
                                            : gradingQuestion.type !== 'free_text' ? (
                                                <span className={`font-bold px-3 py-1 rounded-lg text-sm ${a.isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                    {a.isCorrect ? `✓ ${a.points}p` : a.points > 0 ? `${a.points}p` : '✗'}
                                                </span>
                                            ) : grade ? (
                                                <span className={`font-bold px-3 py-1 rounded-lg text-sm ${grade.isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                    {grade.isCorrect ? `✓ ${grade.points}p` : '✗'}
                                                </span>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => socket.emit('host:grade', { roomCode, playerId: a.socketId, isCorrect: true })}
                                                        className="btn btn-go px-3 py-1 rounded-lg text-sm"
                                                    >
                                                        Riktig
                                                    </button>
                                                    <button
                                                        onClick={() => socket.emit('host:grade', { roomCode, playerId: a.socketId, isCorrect: false })}
                                                        className="btn btn-danger px-3 py-1 rounded-lg text-sm"
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
                        className="btn btn-next btn-lg"
                    >
                        {gradingIndex + 1 < gradingTotal ? 'Neste spørsmål →' : 'Vis leaderboard'}
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-purple-900 p-8">
            {/* Leaving is only offered in the lobby; mid-game it would strand the players. */}
            <TopBar onBack={inLobby ? () => navigate('/host') : undefined} />
            <div className="max-w-2xl mx-auto">
                {!inLobby && (
                    <div className="flex items-center justify-between mb-6">
                        <h1 className="text-2xl font-bold text-white">Rom <span className="text-yellow-300">{roomCode}</span></h1>
                        <span className="bg-purple-700 text-purple-100 px-4 py-2 rounded-xl">{players.length} spillere</span>
                    </div>
                )}

                {error && <p role="alert" className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-center">{error}</p>}

                {inLobby && (
                    <div>
                        <div className="bg-white rounded-3xl p-8 text-center shadow-2xl mb-8">
                            <p className="text-gray-500 uppercase tracking-widest text-sm font-semibold">Bli med på</p>
                            <p className="text-xl font-semibold text-purple-900 mt-1">{window.location.host}/quiz/play</p>
                            <p className="text-gray-500 uppercase tracking-widest text-sm font-semibold mt-6">med romkoden</p>
                            <p className="text-5xl md:text-7xl font-black tracking-wider text-purple-900 font-mono mt-1 break-all">{roomCode}</p>
                            <button onClick={copyInvite} className="btn btn-soft mt-6">
                                {copied ? '✓ Kopiert' : 'Kopier invitasjon'}
                            </button>
                        </div>

                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-xl font-bold text-white">Spillere</h2>
                            <span className="text-purple-200 font-semibold tabular-nums">{players.length}</span>
                        </div>
                        {players.length === 0 ? (
                            <p className="text-purple-200 text-center py-8 border-2 border-dashed border-purple-500 rounded-2xl mb-6">
                                Venter på spillere …
                            </p>
                        ) : (
                            <div className="flex flex-wrap gap-2 mb-6">
                                {players.map(p => (
                                    <span key={p.username} className="bg-white text-purple-900 font-semibold px-4 py-2 rounded-full">{p.username}</span>
                                ))}
                            </div>
                        )}

                        <label className="flex items-start gap-3 cursor-pointer text-white mb-6">
                            <input
                                type="checkbox"
                                checked={speedBonus}
                                onChange={e => setSpeedBonus(e.target.checked)}
                                className="w-5 h-5 mt-1 accent-purple-400"
                            />
                            <span>
                                <span className="block text-lg font-semibold">Hastighetsbonus</span>
                                <span className="block text-sm text-purple-200">Raskere svar gir flere poeng (opptil 1000 per spørsmål)</span>
                            </span>
                        </label>
                        <button
                            onClick={() => socket.emit('host:start', { roomCode, speedBonus })}
                            disabled={players.length === 0}
                            className="btn btn-go btn-lg text-2xl py-5"
                        >
                            Start quiz
                        </button>
                    </div>
                )}

                {question && (
                    <div>
                        <div className={`bg-white rounded-2xl p-6 mb-4 shadow-lg transition-shadow ${allAnswered ? 'ring-4 ring-green-400' : ''}`}>
                            <Timer timeLeft={timeLeft} total={question.time_limit} tone="light" />
                            <h2 className="text-2xl font-bold text-purple-900 mt-4 mb-3 leading-tight text-balance">{question.text}</h2>
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
                            <div className="flex items-end justify-between mt-2 mb-2">
                                <p>
                                    <span className="text-4xl font-black text-purple-900 tabular-nums">{answeredCount}</span>
                                    <span className="text-gray-500"> av {players.length} har svart</span>
                                </p>
                                {allAnswered && <span className="text-green-700 font-bold">✓ Alle har svart!</span>}
                            </div>
                            <div className="h-2 rounded-full bg-gray-100 overflow-hidden mb-3">
                                <div
                                    className="h-full bg-green-500 transition-[width] duration-500"
                                    style={{ width: `${players.length ? (answeredCount / players.length) * 100 : 0}%` }}
                                />
                            </div>
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

                        <button
                            onClick={next}
                            className="btn btn-next btn-lg"
                        >
                            Neste spørsmål
                        </button>

                        <details className="mt-4 text-purple-200">
                            <summary className="cursor-pointer text-sm font-semibold w-fit">Juster tid</summary>
                            <form onSubmit={overrideTimer} className="flex gap-3 mt-3">
                                <input
                                    value={timer}
                                    onChange={e => setTimer(e.target.value)}
                                    placeholder="Sekunder igjen"
                                    type="number"
                                    min="0"
                                    className="field flex-1 text-base"
                                />
                                <button type="submit" className="btn btn-soft">Sett tid</button>
                            </form>
                        </details>
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
