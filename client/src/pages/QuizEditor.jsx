import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api'
import UserBadge from '../components/UserBadge'

const emptyAnswers = [
    { text: '', is_correct: false },
    { text: '', is_correct: false },
    { text: '', is_correct: false },
    { text: '', is_correct: false }
]

function QuizEditor() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [quiz, setQuiz] = useState(null)
    const [editingTitle, setEditingTitle] = useState(false)
    const [titleInput, setTitleInput] = useState('')
    const [type, setType] = useState('multiple_choice')
    const [text, setText] = useState('')
    const [timeLimit, setTimeLimit] = useState(30)
    const [answers, setAnswers] = useState(emptyAnswers)
    const [editingQuestion, setEditingQuestion] = useState(null)
    const [imageFile, setImageFile] = useState(null)
    const [audioFile, setAudioFile] = useState(null)
    const [imageWidth, setImageWidth] = useState(100)

    const resetForm = () => {
        setType('multiple_choice')
        setText('')
        setTimeLimit(30)
        setAnswers(emptyAnswers)
        setEditingQuestion(null)
        setImageFile(null)
        setAudioFile(null)
        setImageWidth(100)
    }

    const startEdit = (q) => {
        setEditingQuestion(q)
        setType(q.type)
        setText(q.text)
        setTimeLimit(q.time_limit)
        setAnswers(q.answers && q.answers.length > 0 ? q.answers : emptyAnswers)
        setImageFile(null)
        setAudioFile(null)
        setImageWidth(q.image_width || 100)
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
    }

    const submitQuestion = async (e) => {
        e.preventDefault()
        const formData = new FormData()
        formData.append('type', type)
        formData.append('text', text)
        formData.append('time_limit', timeLimit)
        formData.append('answers', JSON.stringify(answers))
        formData.append('image_width', imageWidth)
        if (imageFile) formData.append('image', imageFile)
        if (audioFile) formData.append('audio', audioFile)

        if (editingQuestion) {
            formData.append('order_index', editingQuestion.order_index)
            await api.put(`/quizzes/${id}/questions/${editingQuestion.id}`, formData)
            setQuiz({
                ...quiz,
                questions: quiz.questions.map(q =>
                    q.id === editingQuestion.id ? { ...q, type, text, time_limit: timeLimit, answers, image_width: imageWidth } : q
                )
            })
        } else {
            formData.append('order_index', quiz.questions.length + 1)
            const res = await api.post(`/quizzes/${id}/questions`, formData)
            setQuiz({ ...quiz, questions: [...quiz.questions, { ...res.data, answers }] })
        }

        resetForm()
    }

    const deleteQuestion = async (questionId) => {
        await api.delete(`/quizzes/${id}/questions/${questionId}`)
        setQuiz({ ...quiz, questions: quiz.questions.filter(q => q.id !== questionId) })
    }

    const saveTitle = async () => {
        if (!titleInput.trim() || titleInput === quiz.title) {
            setEditingTitle(false)
            return
        }
        const res = await api.put(`/quizzes/${id}`, { title: titleInput.trim() })
        setQuiz({ ...quiz, title: res.data.title })
        setEditingTitle(false)
    }

    useEffect(() => {
        api.get(`/quizzes/${id}`).then(res => setQuiz(res.data))
    }, [id])

    if (!quiz) return (
        <div className="min-h-screen bg-purple-900 flex items-center justify-center">
            <p className="text-white text-2xl">Laster...</p>
        </div>
    )

    return (
        <div className="min-h-screen bg-purple-900 p-8">
            <UserBadge />
            <button
                onClick={() => navigate('/host')}
                className="fixed top-4 left-4 bg-white text-purple-900 font-bold px-4 py-2 rounded-xl shadow-lg hover:bg-purple-100 transition-colors z-50"
            >
                ← Tilbake
            </button>
            <div className="max-w-2xl mx-auto">
                {editingTitle ? (
                    <div className="flex gap-3 mb-8">
                        <input
                            value={titleInput}
                            onChange={e => setTitleInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false) }}
                            autoFocus
                            className="flex-1 text-2xl font-bold rounded-xl px-4 py-2 focus:outline-none focus:border-white border-2 border-purple-400 bg-purple-800 text-white"
                        />
                        <button onClick={saveTitle} className="bg-green-500 hover:bg-green-600 text-white font-bold px-5 py-2 rounded-xl transition-colors">Lagre</button>
                        <button onClick={() => setEditingTitle(false)} className="bg-gray-500 hover:bg-gray-600 text-white font-bold px-5 py-2 rounded-xl transition-colors">Avbryt</button>
                    </div>
                ) : (
                    <div className="flex items-center gap-3 mb-8">
                        <h1 className="text-4xl font-bold text-white">{quiz.title}</h1>
                        <button
                            onClick={() => { setTitleInput(quiz.title); setEditingTitle(true) }}
                            className="bg-purple-700 hover:bg-purple-600 text-white px-3 py-1 rounded-lg text-sm transition-colors"
                        >
                            ✏️ Endre navn
                        </button>
                    </div>
                )}

                <div className="mb-8">
                    <h2 className="text-xl font-bold text-purple-200 mb-3">Spørsmål ({quiz.questions.length})</h2>
                    {quiz.questions.length === 0 && <p className="text-purple-400">Ingen spørsmål ennå</p>}
                    <div className="flex flex-col gap-3">
                        {quiz.questions.map((q, i) => (
                            <div key={q.id} className={`bg-white rounded-2xl px-5 py-4 flex items-center justify-between shadow-lg ${editingQuestion?.id === q.id ? 'ring-2 ring-purple-500' : ''}`}>
                                <p className="text-purple-900 font-semibold">{i + 1}. {q.text}</p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => startEdit(q)}
                                        className="bg-purple-100 hover:bg-purple-200 text-purple-800 font-bold px-4 py-2 rounded-xl transition-colors"
                                    >
                                        Rediger
                                    </button>
                                    <button
                                        onClick={() => deleteQuestion(q.id)}
                                        className="bg-red-100 hover:bg-red-200 text-red-700 font-bold px-4 py-2 rounded-xl transition-colors"
                                    >
                                        Slett
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-lg">
                    <h2 className="text-xl font-bold text-purple-900 mb-4">
                        {editingQuestion ? 'Rediger spørsmål' : 'Legg til spørsmål'}
                    </h2>
                    <form onSubmit={submitQuestion} className="flex flex-col gap-4">
                        <select
                            value={type}
                            onChange={e => {
                                setType(e.target.value)
                                setAnswers(emptyAnswers)
                            }}
                            className="border-2 border-gray-200 rounded-xl p-3 text-lg focus:outline-none focus:border-purple-500"
                        >
                            <option value="multiple_choice">Flervalg</option>
                            <option value="free_text">Fritekst</option>
                        </select>

                        <input
                            value={text}
                            onChange={e => setText(e.target.value)}
                            placeholder="Spørsmålstekst"
                            className="border-2 border-gray-200 rounded-xl p-3 text-lg focus:outline-none focus:border-purple-500"
                        />

                        <input
                            type="number"
                            value={timeLimit}
                            onChange={e => setTimeLimit(e.target.value)}
                            placeholder="Tidsbegrensning (sekunder)"
                            className="border-2 border-gray-200 rounded-xl p-3 text-lg focus:outline-none focus:border-purple-500"
                        />

                        <div className="flex flex-col gap-2">
                            <label className="text-gray-600 font-semibold">Bilde (jpg/png)</label>
                            <input
                                type="file"
                                accept="image/jpeg,image/png"
                                onChange={e => setImageFile(e.target.files[0] || null)}
                                className="border-2 border-gray-200 rounded-xl p-2 text-gray-600"
                            />
                            {(imageFile || editingQuestion?.image_path) && (
                                <div className="mt-2 p-4 bg-purple-50 rounded-xl">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-sm font-semibold text-gray-600">Størrelse: {imageWidth}%</label>
                                        <input
                                            type="range"
                                            min="10"
                                            max="100"
                                            value={imageWidth}
                                            onChange={e => setImageWidth(parseInt(e.target.value))}
                                            className="w-40 accent-purple-600"
                                        />
                                    </div>
                                    <div className="bg-purple-800 rounded-xl p-4 text-center">
                                        <p className="text-purple-200 text-sm mb-2">Forhåndsvisning</p>
                                        <img
                                            src={imageFile ? URL.createObjectURL(imageFile) : `http://localhost:3000/${editingQuestion.image_path}`}
                                            style={{ width: `${imageWidth}%` }}
                                            className="mx-auto rounded-xl object-contain"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-gray-600 font-semibold">Lydfil (mp3)</label>
                            {editingQuestion?.audio_path && !audioFile && (
                                <audio controls src={`http://localhost:3000/${editingQuestion.audio_path}`} className="w-full mb-1" />
                            )}
                            <input
                                type="file"
                                accept="audio/mpeg"
                                onChange={e => setAudioFile(e.target.files[0] || null)}
                                className="border-2 border-gray-200 rounded-xl p-2 text-gray-600"
                            />
                        </div>

                        {type === 'multiple_choice' && answers.map((answer, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <input
                                    value={answer.text}
                                    onChange={e => {
                                        const updated = [...answers]
                                        updated[i] = { ...updated[i], text: e.target.value }
                                        setAnswers(updated)
                                    }}
                                    placeholder={`Svar ${i + 1}`}
                                    className="flex-1 border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-purple-500"
                                />
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={answer.is_correct}
                                        onChange={e => {
                                            const updated = [...answers]
                                            updated[i] = { ...updated[i], is_correct: e.target.checked }
                                            setAnswers(updated)
                                        }}
                                        className="w-5 h-5 accent-purple-600"
                                    />
                                    <span className="text-gray-600">Riktig</span>
                                </label>
                            </div>
                        ))}

                        {type === 'free_text' && (
                            <input
                                value={answers[0]?.text || ''}
                                onChange={e => setAnswers([{ text: e.target.value, is_correct: true }])}
                                placeholder="Fasit"
                                className="border-2 border-gray-200 rounded-xl p-3 text-lg focus:outline-none focus:border-purple-500"
                            />
                        )}

                        <div className="flex gap-3">
                            <button
                                type="submit"
                                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xl py-3 rounded-xl transition-colors"
                            >
                                {editingQuestion ? 'Oppdater spørsmål' : 'Legg til spørsmål'}
                            </button>
                            {editingQuestion && (
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-6 py-3 rounded-xl transition-colors"
                                >
                                    Avbryt
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}

export default QuizEditor
