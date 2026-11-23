// Shared by player and host so the countdown reads the same on both screens.
// `tone="dark"` sits on the purple header, `tone="light"` inside a white card.
function Timer({ timeLeft, total, tone = 'dark' }) {
    if (timeLeft === null) return null
    const urgent = timeLeft <= 5
    // A host override can raise the time above the question's limit.
    const pct = Math.max(0, Math.min(100, (timeLeft / Math.max(total, timeLeft, 1)) * 100))
    const track = tone === 'dark' ? 'bg-purple-950/40' : 'bg-purple-100'
    const fill = urgent ? 'bg-red-500' : tone === 'dark' ? 'bg-white' : 'bg-purple-600'
    const badge = urgent ? 'bg-red-500 text-white' : tone === 'dark' ? 'bg-purple-950/40 text-white' : 'bg-purple-100 text-purple-900'

    return (
        <div className="flex items-center gap-4" role="timer" aria-label={`${timeLeft} sekunder igjen`}>
            <span className={`w-14 h-14 shrink-0 rounded-full grid place-items-center text-2xl font-black tabular-nums transition-colors ${badge}`}>
                {timeLeft}
            </span>
            <div className={`flex-1 h-3 rounded-full overflow-hidden ${track}`}>
                <div className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${fill}`} style={{ width: `${pct}%` }} />
            </div>
        </div>
    )
}

export default Timer
