import { useEffect, useState } from 'react'
import confetti from 'canvas-confetti'
import { sounds } from '../sound'
import YouBadge from './YouBadge'

const places = {
    1: { height: 'h-44', medal: '🥇', color: 'bg-yellow-400' },
    2: { height: 'h-32', medal: '🥈', color: 'bg-gray-300' },
    3: { height: 'h-24', medal: '🥉', color: 'bg-amber-600' }
}

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Tied players share a step; a place nobody holds (e.g. 2nd after a tie for 1st) is skipped.
function Podium({ leaderboard, me = null }) {
    const columns = [2, 1, 3].filter(place => leaderboard.some(p => p.rank === place))
    // Revealed 3rd → 2nd → 1st for suspense, confetti on the winner.
    const sequence = [...columns].sort((a, b) => b - a)
    const steps = sequence.length
    const [revealed, setRevealed] = useState(() => prefersReducedMotion() ? steps : 0)

    useEffect(() => {
        if (prefersReducedMotion()) return
        const timers = Array.from({ length: steps }, (_, i) => setTimeout(() => setRevealed(i + 1), 800 * (i + 1)))
        return () => timers.forEach(clearTimeout)
    }, [steps])

    useEffect(() => {
        if (steps > 0 && revealed === steps) {
            confetti({ particleCount: 160, spread: 90, origin: { y: 0.6 }, disableForReducedMotion: true })
            sounds.fanfare()
        }
    }, [revealed, steps])

    const rest = leaderboard.filter(p => p.rank > 3)

    return (
        <div>
            <div className="flex items-end justify-center gap-3 mb-6">
                {columns.map(place => {
                    const group = leaderboard.filter(p => p.rank === place)
                    const shown = sequence.indexOf(place) < revealed
                    return (
                        <div key={place} className="flex flex-col items-center w-28">
                            <div className={`mb-2 text-center transition-opacity duration-500 ${shown ? 'opacity-100' : 'opacity-0'}`}>
                                {group.map(p => (
                                    <p key={p.username} className="font-bold leading-tight break-words text-purple-900">
                                        {p.username}
                                        {p.username === me && <YouBadge />}
                                    </p>
                                ))}
                                <p className="text-sm text-gray-500">{group[0].score} poeng</p>
                            </div>
                            <div className={`w-full overflow-hidden rounded-t-xl ${places[place].color} flex justify-center transition-all duration-700 ease-out ${shown ? `${places[place].height} pt-2` : 'h-0'}`}>
                                <span className="text-3xl" role="img" aria-label={`${place}. plass`}>{places[place].medal}</span>
                            </div>
                        </div>
                    )
                })}
            </div>
            {rest.length > 0 && (
                <div className="flex flex-col gap-2">
                    {rest.map(p => (
                        <div key={p.username} className={`flex items-center justify-between rounded-xl px-5 py-3 ${p.username === me ? 'bg-purple-100 ring-2 ring-purple-500' : 'bg-purple-50'}`}>
                            <span className="font-bold text-purple-900">#{p.rank} {p.username}{p.username === me && <YouBadge />}</span>
                            <span className="text-purple-600 font-bold">{p.score} poeng</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default Podium
