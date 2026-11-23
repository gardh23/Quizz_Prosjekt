import socket from '../socket'
import { useState, useEffect, useRef } from 'react'
import { mediaBase } from '../api'
import AnswerDistribution from '../components/AnswerDistribution'
import Podium from '../components/Podium'
import { sounds, startLobbyMusic, stopLobbyMusic } from '../sound'
import Timer from '../components/Timer'
import AnswerLetter from '../components/AnswerLetter'
import ResultBadge from '../components/ResultBadge'
import YouBadge from '../components/YouBadge'

function Play() {
    const [answered, setAnswered] = useState(false)
    const [confirmFlash, setConfirmFlash] = useState(false)
    const [selectedAnswerId, setSelectedAnswerId] = useState(null)
    const [finished, setFinished] = useState(false)
    const [finalLeaderboard, setFinalLeaderboard] = useState(null)
    const [myResult, setMyResult] = useState(null)
    const [countdownLeft, setCountdownLeft] = useState(null)
    const countdownRef = useRef(null)
    // Saved at join time so a page refresh mid-game can rejoin.
    const [savedPlayer] = useState(() => {
        try {
            return JSON.parse(sessionStorage.getItem('quizz_player'))
        } catch {
            return null
        }
    })
    // Otherwise the host's invite link carries ?rom=CODE so players only have to type their name.
    const [roomCode, setRoomCode] = useState(() => savedPlayer?.roomCode || new URLSearchParams(window.location.search).get('rom') || '')
    const [username, setUsername] = useState(savedPlayer?.username || '')
    const usernameRef = useRef(savedPlayer?.username || '')
    const [joined, setJoined] = useState(false)
    const [error, setError] = useState('')
    const isRejoinAttemptRef = useRef(false)
    const [players, setPlayers] = useState([])
    const [questionStartTime, setQuestionStartTime] = useState(null)
    const [freeTextInput, setFreeTextInput] = useState('')
    const [numberInput, setNumberInput] = useState('')
    const [rankingOrder, setRankingOrder] = useState([])
    const [question, setQuestion] = useState(null)
    const audioRef = useRef(null)
    const [audioPlaying, setAudioPlaying] = useState(false)
    const [timeLeft, setTimeLeft] = useState(null)
    const timerRef = useRef(null)
    const [frozen, setFrozen] = useState(false)

    // Rettefase
    const [gradingQuestion, setGradingQuestion] = useState(null)
    const [gradingPlayerAnswers, setGradingPlayerAnswers] = useState([])
    const [gradingDistribution, setGradingDistribution] = useState(null)
    const [gradingIndex, setGradingIndex] = useState(0)
    const [gradingTotal, setGradingTotal] = useState(0)

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
        if (!savedPlayer) return
        isRejoinAttemptRef.current = true
        socket.emit('player:rejoin', { roomCode: savedPlayer.roomCode, username: savedPlayer.username })
    }, [savedPlayer])

    const normalizeRoomCode = (raw) =>
        raw.trim().split(/[\s-]+/).join('-').toUpperCase()

    const join = (e) => {
        e.preventDefault()
        const normalized = normalizeRoomCode(roomCode)
        setRoomCode(normalized)
        usernameRef.current = username
        sessionStorage.setItem('quizz_player', JSON.stringify({ roomCode: normalized, username }))
        socket.emit('player:join', { roomCode: normalized, username })
    }

    useEffect(() => {
        socket.on('player:joined', () => setJoined(true))
        socket.on('player:rejoined', ({ status, question, timeRemaining }) => {
            isRejoinAttemptRef.current = false
            setJoined(true)
            if (status === 'active' && question) {
                setQuestion(question)
                setRankingOrder(question.answers || [])
                setQuestionStartTime(Date.now())
                startTimer(timeRemaining)
            }
        })
        socket.on('error', (data) => {
            if (isRejoinAttemptRef.current) {
                isRejoinAttemptRef.current = false
                sessionStorage.removeItem('quizz_player')
            }
            setError(data.message)
        })
        socket.on('session:players', ({ players }) => setPlayers(players))
        socket.on('session:question', ({ question }) => {
            setQuestion(question)
            setQuestionStartTime(Date.now())
            setAnswered(false)
            setConfirmFlash(false)
            setSelectedAnswerId(null)
            setFreeTextInput('')
            setNumberInput('')
            setRankingOrder(question.answers || [])
            setAudioPlaying(false)
            setCountdownLeft(null)
            if (countdownRef.current) clearInterval(countdownRef.current)
            if (audioRef.current) {
                audioRef.current.pause()
                audioRef.current.currentTime = 0
            }
            startTimer(question.time_limit)
        })
        socket.on('session:timer_override', ({ seconds }) => startTimer(seconds))
        socket.on('session:frozen', () => setFrozen(true))
        socket.on('session:resumed', ({ question: resumed, timeRemaining }) => {
            setFrozen(false)
            // The server paused the deadline while frozen; resync the local countdown.
            if (resumed) startTimer(timeRemaining)
        })
        socket.on('player:answer_result', () => {
            sounds.submitted()
            setAnswered(true)
            setConfirmFlash(true)
            setTimeout(() => setConfirmFlash(false), 2000)
        })
        socket.on('session:countdown', ({ seconds }) => {
            setQuestion(null)
            if (timerRef.current) clearInterval(timerRef.current)
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
            // Free text waits for the host's verdict (session:answer_graded); the rest is decided already.
            const mine = playerAnswers.find(a => a.username === usernameRef.current)
            if (mine?.answered && question.type !== 'free_text') {
                if (mine.isCorrect || mine.points > 0) sounds.correct()
                else sounds.wrong()
            }
            setGradingDistribution(distribution)
            setGradingQuestion(question)
            setGradingPlayerAnswers(playerAnswers)
            setGradingIndex(gradingIndex)
            setGradingTotal(total)
            setQuestion(null)
            setCountdownLeft(null)
            if (countdownRef.current) clearInterval(countdownRef.current)
        })
        socket.on('session:answer_graded', ({ username, isCorrect, points }) => {
            if (username === usernameRef.current) {
                if (isCorrect) sounds.correct()
                else sounds.wrong()
            }
            setGradingPlayerAnswers(prev => prev.map(a =>
                a.username === username ? { ...a, isCorrect, points, graded: true } : a
            ))
        })
        socket.on('session:finished', ({ leaderboard }) => {
            const me = leaderboard.find(p => p.username === usernameRef.current)
            setMyResult(me || null)
            setFinalLeaderboard(leaderboard)
            setQuestion(null)
            setGradingQuestion(null)
            if (countdownRef.current) clearInterval(countdownRef.current)
            setCountdownLeft(null)
            setFinished(true)
            sessionStorage.removeItem('quizz_player')
        })

        return () => {
            socket.off('player:joined')
            socket.off('player:rejoined')
            socket.off('error')
            socket.off('session:players')
            socket.off('session:question')
            socket.off('session:timer_override')
            socket.off('session:frozen')
            socket.off('session:resumed')
            socket.off('player:answer_result')
            socket.off('session:countdown')
            socket.off('session:grading_question')
            socket.off('session:answer_graded')
            socket.off('session:finished')
            if (timerRef.current) clearInterval(timerRef.current)
            if (countdownRef.current) clearInterval(countdownRef.current)
        }
    }, [])

    const inLobby = joined && !question && countdownLeft === null && !gradingQuestion && !finished && !frozen
    useEffect(() => {
        if (!inLobby) return
        startLobbyMusic()
        return stopLobbyMusic
    }, [inLobby])

    useEffect(() => {
        if (countdownLeft > 0) sounds.tick()
    }, [countdownLeft])

    const questionOpen = !!question
    useEffect(() => {
        if (!questionOpen || timeLeft === null) return
        if (timeLeft > 0 && timeLeft <= 5) sounds.tick()
        if (timeLeft === 0) sounds.timeUp()
    }, [timeLeft, questionOpen])

    // White text is unreadable on yellow (~1.6:1), so yellow gets dark text and green a darker step.
    const answerColors = [
        'bg-red-500 hover:bg-red-600 text-white',
        'bg-blue-500 hover:bg-blue-600 text-white',
        'bg-yellow-400 hover:bg-yellow-300 text-purple-950',
        'bg-green-600 hover:bg-green-700 text-white',
    ]
    const textInput = 'bg-white text-purple-900 placeholder-gray-400 rounded-xl p-4 text-xl focus:outline-none focus:ring-4 focus:ring-purple-300 disabled:opacity-60'

    if (joined && finished && finalLeaderboard) {
        return (
            <div className="min-h-screen bg-purple-900 flex items-center justify-center p-6">
                <div className="bg-white rounded-2xl p-10 shadow-2xl w-full max-w-lg">
                    <h1 className="text-4xl font-bold text-purple-900 mb-6 text-center">Quiz ferdig!</h1>
                    <Podium leaderboard={finalLeaderboard} me={myResult?.username} />
                    {myResult && (
                        <div className="bg-purple-100 rounded-xl px-5 py-3 mt-6 text-center">
                            <p className="text-lg text-purple-700 font-semibold">Din plass: #{myResult.rank} — {myResult.score} poeng</p>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    if (joined && frozen && !finished) {
        return (
            <div className="min-h-screen bg-purple-900 flex items-center justify-center">
                <div className="bg-white rounded-2xl p-10 text-center shadow-2xl w-full max-w-md">
                    <h1 className="text-3xl font-bold text-purple-900 mb-2">Pause</h1>
                    <p className="text-gray-500">Hosten mistet forbindelsen — quizen fortsetter når hosten er tilbake.</p>
                </div>
            </div>
        )
    }

    if (joined && countdownLeft !== null && !question && !finished) {
        return (
            <div className="min-h-screen bg-purple-900 flex items-center justify-center">
                <div className="bg-white rounded-2xl p-10 text-center shadow-2xl">
                    <p className="text-gray-500 text-lg mb-2">Neste spørsmål om</p>
                    <p key={countdownLeft} className="text-8xl font-bold text-purple-700 tabular-nums motion-safe:animate-pop">{countdownLeft}</p>
                </div>
            </div>
        )
    }

    if (joined && gradingQuestion) {
        const correctAnswers = gradingQuestion.type === 'ranking'
            ? [{ id: 'order', text: (gradingQuestion.answers || []).filter(Boolean).map(a => a.text).join(' → ') }]
            : gradingQuestion.answers?.filter(a => a.is_correct) || []
        return (
            <div className="min-h-screen bg-purple-900 p-6">
                <div className="max-w-2xl mx-auto">
                    <h1 className="text-2xl font-bold text-white mb-4">
                        Rettefase — <span className="text-yellow-300">{gradingIndex + 1} / {gradingTotal}</span>
                    </h1>
                    <div key={gradingQuestion.id} className="bg-white rounded-2xl p-6 shadow-lg motion-safe:animate-rise">
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
                            {gradingPlayerAnswers.map(a => (
                                <div key={a.username} className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 ${a.username === username ? 'bg-purple-100 ring-2 ring-purple-500' : 'bg-purple-50'}`}>
                                    <div>
                                        <span className="font-semibold text-purple-900">{a.username}</span>
                                        {a.username === username && <YouBadge />}
                                        {!a.answered ? (
                                            <span className="text-gray-500 text-sm ml-2">Ikke svart</span>
                                        ) : gradingQuestion.type !== 'free_text' ? (
                                            <span className="text-gray-700 text-sm ml-2">{a.answerText}</span>
                                        ) : (
                                            <span className="text-gray-700 text-sm ml-2">"{a.freeTextResponse}"</span>
                                        )}
                                    </div>
                                    {a.answered && (gradingQuestion.type !== 'free_text' || a.graded) && (
                                        <ResultBadge answer={a} type={gradingQuestion.type} />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (joined && question) {
        return (
            <div className="min-h-screen bg-purple-900 flex flex-col">
                <div key={question.id} className="bg-purple-800 p-6 text-center motion-safe:animate-rise">
                    <div className="max-w-3xl mx-auto">
                    <Timer timeLeft={timeLeft} total={question.time_limit} />
                    <h1 className="text-3xl md:text-4xl font-bold text-white mt-5 leading-tight text-balance">{question.text}</h1>
                    {/* Fixed height so the layout does not jump when the answer is registered. */}
                    <p className="min-h-7 mt-2 text-green-300 font-bold text-lg" aria-live="polite">
                        {answered && (question.type === 'free_text'
                            ? '✓ Svar registrert — du kan endre det til tiden er ute'
                            : '✓ Svar registrert — venter på neste spørsmål')}
                    </p>
                    {question.image_path && (
                        <img
                            src={`${mediaBase}/${question.image_path}`}
                            style={{ width: `${question.image_width || 100}%` }}
                            className="mx-auto mt-4 rounded-xl object-contain"
                        />
                    )}
                    {question.audio_path && (
                        <div className="flex items-center gap-3 mx-auto mt-4 bg-purple-700 rounded-xl px-4 py-3 max-w-xs">
                            <button
                                onClick={() => {
                                    if (audioPlaying) {
                                        audioRef.current.pause()
                                    } else {
                                        audioRef.current.play()
                                    }
                                    setAudioPlaying(!audioPlaying)
                                }}
                                className="bg-white text-purple-900 font-bold w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                            >
                                {audioPlaying ? '⏸' : '▶'}
                            </button>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                defaultValue="1"
                                onChange={e => { audioRef.current.volume = parseFloat(e.target.value) }}
                                className="flex-1 accent-white"
                            />
                            <audio
                                ref={audioRef}
                                src={`${mediaBase}/${question.audio_path}`}
                                onEnded={() => setAudioPlaying(false)}
                            />
                        </div>
                    )}
                    </div>
                </div>
                <div className="flex-1 p-6 flex flex-col">
                    {(question.type === 'multiple_choice' || question.type === 'true_false') && (
                        <div className="grid grid-cols-2 auto-rows-fr gap-4 flex-1 max-h-[60vh] w-full max-w-5xl mx-auto">
                            {question.answers.map((answer, i) => {
                                const selected = selectedAnswerId === answer.id
                                const state = selected
                                    ? 'ring-4 ring-white ring-offset-2 ring-offset-purple-900 scale-[1.02] shadow-2xl'
                                    : answered ? 'opacity-40 saturate-50 scale-95'
                                    : timeLeft === 0 ? 'opacity-60' : 'hover:scale-[1.03] hover:shadow-xl'
                                return (
                                <button
                                    key={answer.id}
                                    style={{ animationDelay: `${i * 60}ms` }}
                                    onClick={() => {
                                        setSelectedAnswerId(answer.id)
                                        socket.emit('player:answer', {
                                            roomCode,
                                            answerId: answer.id,
                                            timeUsed: Date.now() - questionStartTime
                                        })
                                    }}
                                    disabled={answered || timeLeft === 0}
                                    className={`${answerColors[i % 4]} motion-safe:animate-pop relative min-h-32 flex items-center gap-4 px-6 text-left font-bold text-2xl md:text-3xl rounded-2xl transition-all duration-300 disabled:cursor-default focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-yellow-300 ${state}`}
                                >
                                    <AnswerLetter index={i} />
                                    <span className="break-words min-w-0">{answer.text}</span>
                                    {selected && (
                                        <span className="absolute top-2 right-3 bg-white text-purple-900 rounded-full w-8 h-8 grid place-items-center text-base" aria-label="Ditt svar">✓</span>
                                    )}
                                </button>
                                )
                            })}
                        </div>
                    )}
                    {question.type === 'ranking' && (
                        <div key={question.id} className="flex flex-col gap-3 max-w-lg mx-auto mt-4 motion-safe:animate-rise">
                            {rankingOrder.map((item, i) => {
                                const move = (to) => {
                                    const updated = [...rankingOrder]
                                    ;[updated[i], updated[to]] = [updated[to], updated[i]]
                                    setRankingOrder(updated)
                                }
                                const locked = answered || timeLeft === 0
                                return (
                                    <div key={item.id} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow">
                                        <span className="w-6 font-bold text-purple-700">{i + 1}.</span>
                                        <span className="flex-1 text-lg font-semibold text-purple-900">{item.text}</span>
                                        <button type="button" aria-label={`Flytt ${item.text} opp`} onClick={() => move(i - 1)} disabled={locked || i === 0}
                                            className="btn btn-soft w-10 h-10 p-0 rounded-lg disabled:opacity-30">▲</button>
                                        <button type="button" aria-label={`Flytt ${item.text} ned`} onClick={() => move(i + 1)} disabled={locked || i === rankingOrder.length - 1}
                                            className="btn btn-soft w-10 h-10 p-0 rounded-lg disabled:opacity-30">▼</button>
                                    </div>
                                )
                            })}
                            <button
                                onClick={() => socket.emit('player:answer', { roomCode, ranking: rankingOrder.map(a => a.id) })}
                                disabled={answered || timeLeft === 0}
                                className="btn btn-go btn-lg"
                            >
                                Send rekkefølge
                            </button>
                        </div>
                    )}
                    {question.type === 'number_estimate' && (
                        <form onSubmit={e => {
                            e.preventDefault()
                            const value = Number(numberInput.replace(/\s/g, '').replace(',', '.'))
                            if (!numberInput.trim() || !Number.isFinite(value)) return
                            socket.emit('player:answer', { roomCode, numberResponse: value })
                        }} className="flex flex-col gap-4 max-w-lg mx-auto mt-8">
                            <input
                                value={numberInput}
                                onChange={e => setNumberInput(e.target.value)}
                                inputMode="decimal"
                                placeholder="Ditt tall"
                                disabled={answered || timeLeft === 0}
                                className={`${textInput} text-center`}
                            />
                            <button
                                type="submit"
                                disabled={answered || timeLeft === 0}
                                className="btn btn-go btn-lg"
                            >
                                Send svar
                            </button>
                        </form>
                    )}
                    {question.type === 'free_text' && (
                        <form onSubmit={e => {
                            e.preventDefault()
                            if (!freeTextInput.trim()) return
                            socket.emit('player:answer', {
                                roomCode,
                                answerId: question.answers[0]?.id,
                                freeTextResponse: freeTextInput,
                                timeUsed: Date.now() - questionStartTime
                            })
                        }} className="flex flex-col gap-4 max-w-lg mx-auto mt-8">
                            <input
                                value={freeTextInput}
                                onChange={e => setFreeTextInput(e.target.value)}
                                placeholder="Ditt svar"
                                disabled={timeLeft === 0}
                                className={`${textInput} ${confirmFlash ? 'ring-4 ring-green-400' : ''} transition-shadow`}
                            />
                            <button
                                type="submit"
                                disabled={timeLeft === 0}
                                className="btn btn-go btn-lg"
                            >
                                {answered ? 'Oppdater svar' : 'Send svar'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        )
    }

    if (joined) {
        return (
            <div className="min-h-screen bg-purple-900 flex items-center justify-center">
                <div className="bg-white rounded-2xl p-10 text-center shadow-2xl w-full max-w-md">
                    <h1 className="text-3xl font-bold text-purple-900 mb-2">Venter på host...</h1>
                    <p className="text-gray-500">Du er med som <span className="font-bold text-purple-900">{username}</span></p>
                    <p className="text-gray-500 mb-6">i rom <span className="font-bold font-mono tracking-wider text-purple-900">{roomCode}</span></p>
                    <h2 className="text-sm uppercase tracking-widest font-semibold text-gray-500 mb-3">Spillere ({players.length})</h2>
                    <div className="flex flex-wrap justify-center gap-2">
                        {players.map(p => (
                            <span key={p.username} className={`font-semibold px-4 py-2 rounded-full motion-safe:animate-pop ${p.username === username ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-800'}`}>
                                {p.username}{p.username === username && ' (deg)'}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-purple-900 flex items-center justify-center">
            <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
                <h1 className="text-4xl font-bold text-center text-purple-900 mb-8">Bli med i quiz</h1>
                {error && <p role="alert" className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-center motion-safe:animate-rise">{error}</p>}
                <form onSubmit={join} className="flex flex-col gap-4">
                    <label className="flex flex-col gap-1">
                        <span className="text-sm font-semibold text-gray-600">Romkode</span>
                        <input
                            value={roomCode}
                            onChange={e => setRoomCode(e.target.value)}
                            placeholder="f.eks. glad-hest"
                            className="field text-center text-2xl font-bold uppercase tracking-widest placeholder:normal-case placeholder:tracking-normal placeholder:font-normal"
                        />
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className="text-sm font-semibold text-gray-600">Ditt navn</span>
                        <input
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            placeholder="Brukernavn"
                            autoFocus={!!roomCode}
                            maxLength={30}
                            className="field text-center"
                        />
                    </label>
                    <button
                        type="submit"
                        className="btn btn-go btn-lg"
                    >
                        Bli med
                    </button>
                </form>
            </div>
        </div>
    )
}

export default Play