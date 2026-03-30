import socket from '../socket'
import { useState, useEffect, useRef } from 'react'

function Play() {
    const [answered, setAnswered] = useState(false)
    const [result, setResult] = useState(null)
    const [finished, setFinished] = useState(false)
    const [roomCode, setRoomCode] = useState('')
    const [username, setUsername] = useState('')
    const usernameRef = useRef('')
    const [joined, setJoined] = useState(false)
    const [error, setError] = useState('')
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

    const join = (e) => {
        e.preventDefault()
        setRoomCode(roomCode.toUpperCase())
        usernameRef.current = username
        socket.emit('player:join', { roomCode: roomCode.toUpperCase(), username })
    }

    useEffect(() => {
        socket.on('player:joined', () => setJoined(true))
        socket.on('error', (data) => setError(data.message))
        socket.on('session:players', ({ players }) => setPlayers(players))
        socket.on('session:question', ({ question }) => {
            setQuestion(question)
            setQuestionStartTime(Date.now())
            setAnswered(false)
            setResult(null)
            setFreeTextInput('')
            setAudioPlaying(false)
            if (audioRef.current) {
                audioRef.current.pause()
                audioRef.current.currentTime = 0
            }
            startTimer(question.time_limit)
        })
        socket.on('session:timer_override', ({ seconds }) => startTimer(seconds))
        socket.on('player:answer_result', () => {
            setAnswered(true)
        })
        socket.on('session:leaderboard', ({ leaderboard }) => {
            const me = leaderboard.find(p => p.username === usernameRef.current)
            setResult(me || null)
            setQuestion(null)
        })
        socket.on('session:finished', ({ leaderboard }) => {
            const me = leaderboard.find(p => p.username === usernameRef.current)
            setResult(me || null)
            setQuestion(null)
            setFinished(true)
        })

        return () => {
            socket.off('player:joined')
            socket.off('error')
            socket.off('session:players')
            socket.off('session:question')
            socket.off('session:timer_override')
            socket.off('player:answer_result')
            socket.off('session:leaderboard')
            socket.off('session:finished')
            if (timerRef.current) clearInterval(timerRef.current)
        }
    }, [])

    const answerColors = [
        'bg-red-500 hover:bg-red-600',
        'bg-blue-500 hover:bg-blue-600',
        'bg-yellow-400 hover:bg-yellow-500',
        'bg-green-500 hover:bg-green-600',
    ]

    if (joined && finished && result) {
        return (
            <div className="min-h-screen bg-purple-900 flex items-center justify-center">
                <div className="bg-white rounded-2xl p-10 text-center shadow-2xl">
                    <h1 className="text-4xl font-bold text-purple-900 mb-4">Quiz ferdig!</h1>
                    <p className="text-2xl text-gray-700 mb-2">Poeng: <span className="font-bold text-purple-600">{result.score}</span></p>
                    <p className="text-xl text-gray-500">Plass: {result.rank}</p>
                </div>
            </div>
        )
    }

    if (joined && result && !question) {
        return (
            <div className="min-h-screen bg-purple-900 flex items-center justify-center">
                <div className="bg-white rounded-2xl p-10 text-center shadow-2xl">
                    <h1 className="text-3xl font-bold text-purple-900 mb-4">Leaderboard</h1>
                    <p className="text-2xl text-gray-700 mb-2">Poeng: <span className="font-bold text-purple-600">{result.score}</span></p>
                    <p className="text-xl text-gray-500 mb-6">Plass: {result.rank}</p>
                    <p className="text-gray-400 animate-pulse">Venter på neste spørsmål...</p>
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
                            src={`http://localhost:3000/${question.image_path}`}
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
                                src={`http://localhost:3000/${question.audio_path}`}
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
                                        socket.emit('player:answer', {
                                            roomCode,
                                            answerId: answer.id,
                                            timeUsed: Date.now() - questionStartTime
                                        })
                                    }}
                                    disabled={answered || timeLeft === 0}
                                    className={`${answerColors[i % 4]} text-white font-bold text-xl rounded-2xl p-6 transition-colors
  disabled:opacity-50`}
                                >
                                    {answer.text}
                                </button>
                            ))}
                        </div>
                    )}
                    {question.type === 'free_text' && (
                        <form onSubmit={e => {
                            e.preventDefault()
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
                                disabled={answered || timeLeft === 0}
                                className="border-2 border-purple-300 rounded-xl p-4 text-xl focus:outline-none focus:border-purple-500
  disabled:opacity-50"
                            />
                            <button
                                type="submit"
                                disabled={answered || timeLeft === 0}
                                className="bg-green-500 hover:bg-green-600 text-white font-bold text-xl py-4 rounded-xl transition-colors
  disabled:opacity-50"
                            >
                                Send svar
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
                        placeholder="Romkode"
                        className="border-2 border-gray-200 rounded-xl p-3 text-lg text-center uppercase tracking-widest focus:outline-none               
  focus:border-purple-500"
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