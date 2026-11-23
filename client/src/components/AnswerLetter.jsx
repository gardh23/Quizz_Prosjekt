import { answerLetter } from '../answerLetter'

function AnswerLetter({ index }) {
    return (
        <span aria-hidden="true" className="w-12 h-12 text-2xl rounded-xl shrink-0 grid place-items-center font-black bg-black/20">
            {answerLetter(index)}
        </span>
    )
}

export default AnswerLetter
