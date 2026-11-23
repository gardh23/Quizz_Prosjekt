import { useEffect, useState } from 'react'
import { answerLetter } from '../answerLetter'

// Bar colors follow the answer buttons' order (red, blue, yellow, green) so an option keeps
// its identity. Yellow is a darker step than the button's so the bar holds up on the white card.
const barColors = ['#ef4444', '#3b82f6', '#ca8a04', '#22c55e']

function AnswerDistribution({ distribution }) {
    // Bars start at 0 and grow on the next frame; the grading card is keyed per question,
    // so this replays for each one. Without motion-safe the width just jumps.
    const [grown, setGrown] = useState(false)
    useEffect(() => {
        const frame = requestAnimationFrame(() => setGrown(true))
        return () => cancelAnimationFrame(frame)
    }, [])

    if (!distribution || distribution.length === 0) return null
    const total = distribution.reduce((sum, o) => sum + o.count, 0)
    const max = Math.max(1, ...distribution.map(o => o.count))

    return (
        <div className="flex flex-col gap-2 my-4" role="table" aria-label="Svarfordeling">
            {distribution.map((o, i) => (
                <div key={o.id} role="row" className="flex items-center gap-3" title={`${o.count} av ${total} valgte «${o.text}»`}>
                    <span role="cell" className="w-44 shrink-0 text-sm font-semibold text-gray-800 truncate">
                        <span className="inline-grid place-items-center w-6 h-6 mr-2 rounded-md bg-gray-100 text-gray-700 text-xs font-black">{answerLetter(i)}</span>
                        {o.isCorrect && <span className="text-green-700">✓ </span>}
                        {o.text}
                        {o.isCorrect && <span className="text-green-700 font-normal"> (riktig)</span>}
                    </span>
                    <div role="cell" className="flex-1 h-6">
                        <div
                            className="h-full rounded-r motion-safe:transition-[width] motion-safe:duration-700 motion-safe:ease-out motion-safe:[transition-delay:var(--bar-delay)]"
                            style={{
                                width: grown ? `${(o.count / max) * 100}%` : 0,
                                minWidth: grown && o.count ? 4 : 0,
                                '--bar-delay': `${i * 80}ms`,
                                backgroundColor: barColors[i % barColors.length]
                            }}
                        />
                    </div>
                    <span role="cell" className="w-8 text-right text-sm font-bold text-gray-700">{o.count}</span>
                </div>
            ))}
        </div>
    )
}

export default AnswerDistribution
