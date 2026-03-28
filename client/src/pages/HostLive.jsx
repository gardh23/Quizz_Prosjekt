import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import socket from '../socket'

function HostLive() {
    const { roomCode } = useParams()
    const [players, setPlayers] = useState([])
    const [question, setQuestion] = useState(null)
    const [leaderboard, setLeaderboard] = useState(null)
    const [finished, setFinished] = useState(false)
    const [timer, setTimer] = useState('')

    useEffect(() => {
        socket.on('session:players', ({ players }) => setPlayers(players))
        socket.on('session:question', ({ question }) => setQuestion(question))
        socket.on('session:leaderboard', ({ leaderboard }) => setLeaderboard(leaderboard))
        socket.on('session:finished', ({ leaderboard }) => {
            setLeaderboard(leaderboard)
            setFinished(true)
        })
    }, [])

    const next = () => {
        socket.emit('host:next', { roomCode })
        setLeaderboard(null)
    }

    const overrideTimer = (e) => {
        e.preventDefault()
        socket.emit('host:set_timer', { roomCode, seconds: parseInt(timer) })
        setTimer('')
    }

    if (finished) {
        return (
            <div>
                <h1>Quiz ferdig!</h1>
                {leaderboard.map(p => (
                    <p key={p.username}>{p.rank}. {p.username} — {p.score} poeng</p>
                ))}
            </div>
        )
    }

    return (
        <div>
            <h1>Romkode: {roomCode}</h1>
            <h2>Spillere ({players.length})</h2>
            {players.map((p, i) => <p key={i}>{p.username}</p>)}

            {leaderboard && (
                <div>
                    <h2>Leaderboard</h2>
                    {leaderboard.map(p => (
                        <p key={p.username}>{p.rank}. {p.username} — {p.score} poeng</p>
                    ))}
                    <button onClick={next}>Neste spørsmål</button>
                </div>
            )}

            {question && !leaderboard && (
                <div>
                    <h2>{question.text}</h2>
                    <form onSubmit={overrideTimer}>
                        <input
                            value={timer}
                            onChange={e => setTimer(e.target.value)}
                            placeholder="Overstyr timer (sekunder)"
                            type="number"
                        />
                        <button type="submit">Sett timer</button>
                    </form>
                    <button onClick={next}>Neste spørsmål</button>
                </div>
            )}

            {!question && !leaderboard && (
                <button onClick={() => socket.emit('host:start', { roomCode })}>
                    Start quiz
                </button>
            )}
        </div>
    )
}

export default HostLive