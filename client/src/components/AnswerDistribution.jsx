// Bar colors follow the answer buttons' order (red, blue, yellow, green) so an option keeps
// its identity. Yellow is a darker step than the button's so the bar holds up on the white card.
const barColors = ['#ef4444', '#3b82f6', '#ca8a04', '#22c55e']

function AnswerDistribution({ distribution }) {
    if (!distribution || distribution.length === 0) return null
    const total = distribution.reduce((sum, o) => sum + o.count, 0)
    const max = Math.max(1, ...distribution.map(o => o.count))

    return (
        <div className="flex flex-col gap-2 my-4" role="table" aria-label="Svarfordeling">
            {distribution.map((o, i) => (
                <div key={o.id} role="row" className="flex items-center gap-3" title={`${o.count} av ${total} valgte «${o.text}»`}>
                    <span role="cell" className="w-36 shrink-0 text-sm font-semibold text-gray-800 truncate">
                        {o.isCorrect && <span className="text-green-700">✓ </span>}
                        {o.text}
                        {o.isCorrect && <span className="text-green-700 font-normal"> (riktig)</span>}
                    </span>
                    <div role="cell" className="flex-1 h-6">
                        <div
                            className="h-full rounded-r"
                            style={{
                                width: `${(o.count / max) * 100}%`,
                                minWidth: o.count ? 4 : 0,
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
