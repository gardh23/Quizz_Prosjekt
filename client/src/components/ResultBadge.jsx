// A check mark only for a fully right answer. Ranking and estimates can earn points while
// being partly wrong, so they show how far off they were in amber instead.
function ResultBadge({ answer, type }) {
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
