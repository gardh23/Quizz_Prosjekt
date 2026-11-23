import { useEffect, useState } from 'react'
import confetti from 'canvas-confetti'
import { sounds } from '../sound'
import YouBadge from './YouBadge'

const places = {
    1: { block: 'h-64 md:h-80 from-yellow-300 to-yellow-500', medal: '🥇' },
    2: { block: 'h-48 md:h-60 from-gray-200 to-gray-400', medal: '🥈' },
    3: { block: 'h-36 md:h-44 from-amber-500 to-amber-700', medal: '🥉' }
}

// Drumroll length per place (ms) and the pause after each reveal: about 10 s in all.
const drumMs = place => place === 1 ? 3000 : 2000
const PAUSE_MS = 600

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const stageLabel = place => place === 1 ? 'Og vinneren er …' : `${place}. plass …`

// Full-screen results: the podium is revealed 3rd → 2nd → 1st after a drumroll each, then the
// full list and the titles slide in. Tied players share a step; an empty place is skipped.
function FinalResults({ leaderboard, titles = [], me = null, footer = null }) {
    const columns = [2, 1, 3].filter(place => leaderboard.some(p => p.rank === place))
    const sequence = [...columns].sort((a, b) => b - a)
    const steps = sequence.length
    const [revealed, setRevealed] = useState(() => prefersReducedMotion() ? steps : 0)
    const done = revealed >= steps

    useEffect(() => {
        if (prefersReducedMotion() || revealed >= steps) return
        const place = sequence[revealed]
        sounds.drumroll(drumMs(place) / 1000)
        const timer = setTimeout(() => setRevealed(r => r + 1), drumMs(place) + (revealed === 0 ? 0 : PAUSE_MS))
        return () => clearTimeout(timer)
        // sequence is derived from leaderboard, which does not change once results are in.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [revealed, steps])

    useEffect(() => {
        if (steps > 0 && done) {
            confetti({ particleCount: 200, spread: 100, origin: { y: 0.55 }, disableForReducedMotion: true })
            sounds.fanfare()
        }
    }, [done, steps])

    return (
        <div className="min-h-screen bg-purple-900 px-4 py-10 flex flex-col items-center">
            <h1 className="text-4xl md:text-5xl font-black text-white mb-2">Resultater</h1>
            <p className="h-8 text-xl font-semibold text-yellow-300" aria-live="polite">
                {!done && `🥁 ${stageLabel(sequence[revealed])}`}
            </p>

            <div className="flex items-end justify-center gap-3 md:gap-6 mt-6 w-full max-w-3xl">
                {columns.map(place => {
                    const group = leaderboard.filter(p => p.rank === place)
                    const shown = sequence.indexOf(place) < revealed
                    return (
                        <div key={place} className="flex flex-col items-center flex-1 max-w-56 min-w-0">
                            <div className={`mb-3 text-center transition-all duration-500 ${shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                                {place === 1 && <div className="text-5xl mb-1 motion-safe:animate-pop" aria-hidden="true">👑</div>}
                                {group.map(p => (
                                    <p key={p.username} className="text-2xl md:text-3xl font-black text-white leading-tight break-words">
                                        {p.username}
                                        {p.username === me && <YouBadge />}
                                    </p>
                                ))}
                                <p className="text-purple-200 font-semibold mt-1">
                                    {group[0].score} poeng · {group[0].correct}/{group[0].total} riktige
                                </p>
                            </div>
                            <div
                                className={`w-full rounded-t-2xl bg-gradient-to-b shadow-2xl flex justify-center overflow-hidden transition-all duration-700 ease-out ${shown ? `${places[place].block} pt-4` : 'h-0'}`}
                            >
                                <span className="text-6xl md:text-7xl font-black text-white/90 drop-shadow" role="img" aria-label={`${place}. plass`}>
                                    {place}
                                </span>
                            </div>
                        </div>
                    )
                })}
            </div>
            <div className="w-full max-w-3xl h-3 bg-purple-950/60 rounded-b-xl" aria-hidden="true" />

            {done && (
                <div className="w-full max-w-2xl mt-10 flex flex-col gap-6 motion-safe:animate-rise">
                    {footer}

                    {titles.length > 0 && (
                        <div className="grid md:grid-cols-2 gap-3">
                            {titles.map(t => (
                                <div key={t.id} className="bg-purple-800 rounded-2xl p-4 flex items-center gap-4">
                                    <span className="text-4xl" aria-hidden="true">{t.emoji}</span>
                                    <div className="min-w-0">
                                        <p className="text-sm uppercase tracking-widest font-semibold text-purple-200">{t.title}</p>
                                        <p className="text-xl font-black text-white break-words">{t.winners.join(' og ')}</p>
                                        <p className="text-sm text-purple-200">{t.detail}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="bg-white rounded-2xl p-4 shadow-xl">
                        <h2 className="text-sm uppercase tracking-widest font-semibold text-gray-500 mb-2 px-2">Alle spillere</h2>
                        <div className="flex flex-col gap-1">
                            {leaderboard.map(p => (
                                <div key={p.username} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${p.username === me ? 'bg-purple-100 ring-2 ring-purple-500' : ''}`}>
                                    <span className="w-8 font-black text-purple-900 tabular-nums">#{p.rank}</span>
                                    <span className="flex-1 font-bold text-purple-900 min-w-0 truncate">
                                        {p.username}{p.username === me && <YouBadge />}
                                    </span>
                                    <span className="text-sm text-gray-500 tabular-nums">{p.correct}/{p.total} riktige</span>
                                    <span className="w-24 text-right font-bold text-purple-700 tabular-nums">{p.score} poeng</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default FinalResults
