// Deliberately small and soft: it is an escape hatch, not the next step.
function EndQuizButton({ onEnd, grading = false }) {
    const message = grading
        ? 'Avslutte rettingen og vise pallen nå?'
        : 'Avslutte quizen nå? Resten av spørsmålene hoppes over, og dere går rett til rettingen.'
    return (
        <div className="mt-6 text-center">
            <button
                onClick={() => { if (window.confirm(message)) onEnd() }}
                className="btn btn-danger-soft px-4 py-2 text-sm"
            >
                Avslutt quiz
            </button>
        </div>
    )
}

export default EndQuizButton
