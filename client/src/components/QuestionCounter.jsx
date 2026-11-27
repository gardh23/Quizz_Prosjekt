// `tone` matches Timer: "dark" on the purple header, "light" inside a white card.
function QuestionCounter({ index, total, tone = 'dark' }) {
    if (index === null || !total) return null
    const color = tone === 'dark' ? 'text-purple-200' : 'text-purple-500'
    return (
        <p className={`text-sm font-bold uppercase tracking-wide mb-3 tabular-nums ${color}`}>
            Spørsmål {index + 1} av {total}
        </p>
    )
}

export default QuestionCounter
