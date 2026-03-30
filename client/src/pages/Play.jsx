import socket from '../socket'
import { useState, useEffect, useRef } from 'react'
import { mediaBase } from '../api'

function Play() {
    const [answered, setAnswered] = useState(false)
    const [confirmFlash, setConfirmFlash] = useState(false)
    const [selectedAnswerId, setSelectedAnswerId] = useState(null)
    const [finished, setFinished] = useState(false)
    const [finalLeaderboard, setFinalLeaderboard] = useState(null)
    const [myResult, setMyResult] = useState(null)
    const [countdownLeft, setCountdownLeft] = useState(null)
    const countdownRef = useRef(null)
    const [roomCode, setRoomCode] = useState('')
    const [username, setUsername] = useState('')
    const usernameRef = useRef('')
    const [joined, setJoined] = useState(false)
    const [error, setError] = useState('')
    const isRejoinAttemptRef = useRef(false)
    const [players, setPlayers] = useState([])
    const [questionStartTime, setQuestionStartTime] = useState(null)
    const [freeTextInput, setFreeTextInput] = useState('')
    const [question, setQuestion] = useState(null)
    const audioRef = useRef(null)
    const [audioPlaying, setAudioPlaying] = useState(false)
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
        const saved = sessionStorage.getItem('quizz_player')
        if (saved) {
            const { roomCode: savedRoom, username: savedUsername } = JSON.parse(saved)
            setRoomCode(savedRoom)
            setUsername(savedUsername)
            usernameRef.current = savedUsername
            isRejoinAttemptRef.current = true
            socket.emit('player:rejoin', { roomCode: savedRoom, username: savedUsername })
        }
    }, [])

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
        socket.on('player:answer_result', () => {
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
        socket.on('session:finished', ({ leaderboard }) => {
            const me = leaderboard.find(p => p.username === usernameRef.current)
            setMyResult(me || null)
            setFinalLeaderboard(leaderboard)
            setQuestion(null)
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
            socket.off('player:answer_result')
            socket.off('session:countdown')
            socket.off('session:finished')
            if (timerRef.current) clearInterval(timerRef.current)
            if (countdownRef.current) clearInterval(countdownRef.current)
        }
    }, [])

    const answerColors = [
        'bg-red-500 hover:bg-red-600',
        'bg-blue-500 hover:bg-blue-600',
        'bg-yellow-400 hover:bg-yellow-500',
        'bg-green-500 hover:bg-green-600',
    ]

    if (joined && finished && finalLeaderboard) {
        return (
            <div className="min-h-screen bg-purple-900 flex items-center justify-center p-6">
                <div className="bg-white rounded-2xl p-10 shadow-2xl w-full max-w-md">
                    <h1 className="text-4xl font-bold text-purple-900 mb-6 text-center">Quiz ferdig!</h1>
                    {myResult && (
                        <div className="bg-purple-100 rounded-xl px-5 py-3 mb-6 text-center">
                            <p className="text-lg text-purple-700 font-semibold">Din plass: #{myResult.rank} — {myResult.score} poeng</p>
                        </div>
                    )}
                    <div className="flex flex-col gap-2">
                        {finalLeaderboard.map(p => (
                            <div key={p.username} className={`flex items-center justify-between rounded-xl px-5 py-3 ${myResult && p.username === myResult.username ? 'bg-purple-200' : 'bg-purple-50'}`}>
                                <span className="font-bold text-purple-900">#{p.rank} {p.username}</span>
                                <span className="text-purple-600 font-bold">{p.score} poeng</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    if (joined && countdownLeft !== null && !question && !finished) {
        return (
            <div className="min-h-screen bg-purple-900 flex items-center justify-center">
                <div className="bg-white rounded-2xl p-10 text-center shadow-2xl">
                    <p className="text-gray-500 text-lg mb-2">Neste spørsmål om</p>
                    <p className="text-8xl font-bold text-purple-700">{countdownLeft}</p>
                </div>
            </div>
        )
    }

    if (joined && question) {
        return (
            <div className="min-h-screen bg-purple-900 flex flex-col">
                <div className="bg-purple-800 p-6 text-center">
                    <div className="max-w-2xl mx-auto">
                    {timeLeft !== null && (
                        <p className={`text-4xl font-bold ${timeLeft <= 10 ? 'text-red-400' : 'text-white'}`}>{timeLeft}</p>
                    )}
                    {answered && <p className="text-green-300 font-bold text-lg animate-pulse">Svar registrert — venter på neste spørsmål...</p>}
                    <h1 className="text-3xl font-bold text-white mt-2">{question.text}</h1>
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
                <div className="flex-1 p-6">
                    {question.type === 'multiple_choice' && (
                        <div className="grid grid-cols-2 gap-4 h-full">
                            {question.answers.map((answer, i) => (
                                <button
                                    key={answer.id}
                                    onClick={() => {
                                        setSelectedAnswerId(answer.id)
                                        socket.emit('player:answer', {
                                            roomCode,
                                            answerId: answer.id,
                                            timeUsed: Date.now() - questionStartTime
                                        })
                                    }}
                                    disabled={answered || timeLeft === 0}
                                    className={`${answerColors[i % 4]} text-white font-bold text-xl rounded-2xl p-6 transition-all hover:scale-[1.03] hover:shadow-xl
  disabled:opacity-50 disabled:hover:scale-100 ${selectedAnswerId === answer.id ? 'ring-4 ring-white ring-offset-2' : ''}`}
                                >
                                    {answer.text}
                                </button>
                            ))}
                        </div>
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
                            {answered && !confirmFlash && <p className="text-green-300 font-semibold text-center">Svar registrert — du kan endre det til tiden er ute</p>}
                            {confirmFlash && <p className="text-white font-bold text-center bg-green-500 rounded-xl py-2 animate-pulse">✓ Svar registrert!</p>}
                            <input
                                value={freeTextInput}
                                onChange={e => setFreeTextInput(e.target.value)}
                                placeholder="Ditt svar"
                                disabled={timeLeft === 0}
                                className="border-2 border-purple-300 rounded-xl p-4 text-xl focus:outline-none focus:border-purple-500
  disabled:opacity-50"
                            />
                            <button
                                type="submit"
                                disabled={timeLeft === 0}
                                className="bg-green-500 hover:bg-green-600 text-white font-bold text-xl py-4 rounded-xl transition-colors
  disabled:opacity-50"
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
                    <p className="text-gray-500 mb-6">Rom: <span className="font-bold text-purple-600">{roomCode}</span></p>
                    <h2 className="text-xl font-bold text-gray-700 mb-3">Spillere ({players.length})</h2>
                    <div className="flex flex-col gap-2">
                        {players.map((p, i) => (
                            <p key={i} className="bg-purple-100 text-purple-800 font-semibold py-2 rounded-lg">{p.username}</p>
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
                {error && <p className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-center">{error}</p>}
                <form onSubmit={join} className="flex flex-col gap-4">
                    <input
                        value={roomCode}
                        onChange={e => setRoomCode(e.target.value)}
                        placeholder="f.eks. glad-hest"
                        className="border-2 border-gray-200 rounded-xl p-3 text-lg text-center focus:outline-none focus:border-purple-500"
                    />
                    <input
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        placeholder="Brukernavn"
                        className="border-2 border-gray-200 rounded-xl p-3 text-lg focus:outline-none focus:border-purple-500"
                    />
                    <button
                        type="submit"
                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xl py-3 rounded-xl transition-colors"
                    >
                        Bli med
                    </button>
                </form>
            </div>
        </div>
    )
}

export default Play