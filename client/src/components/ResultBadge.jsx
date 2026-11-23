// A check mark only for a fully right answer. Ranking and estimates can earn points while
// being partly wrong, so they show how far off they were in amber instead.
function ResultBadge({ answer, type }) {
    // Points the host set by hand say nothing about right or wrong, only the amount.
    if (answer.manual) {
        const style = answer.points > 0 ? 'bg-green-100 text-green-700' : answer.points < 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
        return (
            <span className={`shrink-0 font-bold px-3 py-1 rounded-lg text-sm ${style}`}>
                {answer.points > 0 ? '+' : ''}{answer.points}p · justert
            </span>
        )
    }

    const detail = type === 'ranking'
        ? `${answer.correctPositions}/${answer.totalPositions} riktig plass`
        : type === 'number_estimate'
            ? (answer.percentOff === 0 ? 'Eksakt' : `${answer.percentOff} % unna`)
            : null
    const fullyRight = type === 'ranking'
        ? answer.correctPositions === answer.totalPositions
        : type === 'number_estimate' ? answer.percentOff === 0 : answer.isCorrect
    const earned = answer.points > 0

    const style = fullyRight
        ? 'bg-green-100 text-green-700'
        : earned ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700'
    const mark = fullyRight ? '✓ ' : earned ? '' : '✗ '
    const text = [detail, earned ? `${answer.points}p` : null].filter(Boolean).join(' · ')

    return (
        <span className={`shrink-0 font-bold px-3 py-1 rounded-lg text-sm ${style}`}>
            {mark}{text}
        </span>
    )
}

export default ResultBadge
