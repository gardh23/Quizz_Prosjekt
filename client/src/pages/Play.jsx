
import socket from '../socket'
import { useState, useEffect, useRef } from 'react'

function Play() {
    const [answered, setAnswered] = useState(false)
    const [result, setResult] = useState(null)
    const [roomCode, setRoomCode] = useState('')
    const [username, setUsername] = useState('')
    const usernameRef = useRef('')
    const [joined, setJoined] = useState(false)
    const [error, setError] = useState('')
    const [players, setPlayers] = useState([])
    const [questionStartTime, setQuestionStartTime] = useState(null)

    const join = (e) => {
        e.preventDefault()
        setRoomCode(roomCode.toUpperCase())
        usernameRef.current = username
        socket.emit('player:join', { roomCode: roomCode.toUpperCase(), username })
    }

    const [question, setQuestion] = useState(null)

    useEffect(() => {
        socket.on('player:joined', () => setJoined(true))
        socket.on('error', (data) => setError(data.message))
        socket.on('session:players', ({ players }) => setPlayers(players))
        socket.on('session:question', ({ question }) => {
            setQuestion(question)
            setQuestionStartTime(Date.now())
            setAnswered(false)
            setResult(null)
        })
        socket.on('player:answer_result', () => {
            setAnswered(true)
        })
        socket.on('session:leaderboard', ({ leaderboard }) => {
            const me = leaderboard.find(p => p.username === usernameRef.current)
            setResult(me || null)
        })

        return () => {
            socket.off('player:joined')
            socket.off('error')
            socket.off('session:players')
            socket.off('session:question')
            socket.off('player:answer_result')
            socket.off('session:leaderboard')
        }
    }, [])

    if (joined && question) {
        return (
            <div>
                {answered && !result && <p>Svar registrert — venter på neste spørsmål...</p>}
                {result && (
                    <div>
                        <p>Poeng totalt: {result.score}</p>
                        <p>Plass: {result.rank}</p>
                    </div>
                )}
                <h1>{question.text}</h1>
                {question.type === 'multiple_choice' && (
                    <div>
                        {question.answers.map(answer => (
                            <button key={answer.id} onClick={() => {
                                socket.emit('player:answer', {
                                    roomCode,
                                    answerId: answer.id,
                                    timeUsed: Date.now() - questionStartTime
                                })
                            }}>
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
                            timeUsed: Date.now() - questionStartTime
                        })
                    }}>
                        <input placeholder="Ditt svar" />
                        <button type="submit">Send svar</button>
                    </form>
                )}
            </div>
        )
    }

    if (joined) {
        return (
            <div>
                <h1>Venter på at host starter...</h1>
                <p>Rom: {roomCode.toUpperCase()}</p>
                <h2>Spillere ({players.length})</h2>
                {players.map((p, i) => <p key={i}>{p.username}</p>)}
            </div>
        )
    }

    return (
        <div>
            <h1>Bli med i quiz</h1>
            {error && <p>{error}</p>}
            <form onSubmit={join}>
                <input
                    value={roomCode}
                    onChange={e => setRoomCode(e.target.value)}
                    placeholder="Romkode"
                />
                <input
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Brukernavn"
                />
                <button type="submit">Bli med</button>
            </form>
        </div>
    )
}

export default Play