// The host's −/+ for one player's points on the current grading question. Each click sends
// the new total (not a delta), so a double click can never count twice on the server.
function PointsStepper({ username, points, onChange }) {
    return (
        <div className="flex items-center gap-1" role="group" aria-label={`Poeng til ${username}`}>
            <button
                type="button"
                onClick={() => onChange(points - 1)}
                aria-label={`Ett poeng mindre til ${username}`}
                className="btn btn-soft w-8 h-8 p-0 rounded-lg text-lg"
            >
                −
            </button>
            <span className={`w-10 text-center font-black tabular-nums ${points < 0 ? 'text-red-700' : 'text-purple-900'}`}>
                {points}
            </span>
            <button
                type="button"
                onClick={() => onChange(points + 1)}
                aria-label={`Ett poeng mer til ${username}`}
                className="btn btn-soft w-8 h-8 p-0 rounded-lg text-lg"
            >
                +
            </button>
        </div>
    )
}

export default PointsStepper
