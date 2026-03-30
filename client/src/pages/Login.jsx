import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

function Login() {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const navigate = useNavigate()

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            const res = await api.post('/auth/login', { username, password })
            localStorage.setItem('token', res.data.token)
            localStorage.setItem('user', JSON.stringify(res.data.user))
            navigate('/')
        } catch (err) {
            setError(err.response?.data?.error || 'Noe gikk galt')
        }
    }

    return (
        <div className="min-h-screen bg-purple-900 flex items-center justify-center">
            <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
                <h1 className="text-4xl font-bold text-center text-purple-900 mb-8">Quizz</h1>
                {error && <p className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-center">{error}</p>}
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <input
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        placeholder="Brukernavn"
                        className="border-2 border-gray-200 rounded-xl p-3 text-lg focus:outline-none focus:border-purple-500"
                    />
                    <input
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Passord"
                        type="password"
                        className="border-2 border-gray-200 rounded-xl p-3 text-lg focus:outline-none focus:border-purple-500"
                    />
                    <button
                        type="submit"
                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xl py-3 rounded-xl transition-colors"
                    >
                        Logg inn
                    </button>
                </form>
                <hr className="my-6" />
                <p className="text-center text-gray-500 mb-3">Er du spiller?</p>
                <button
                    onClick={() => navigate('/play')}
                    className="w-full bg-green-500 hover:bg-green-600 text-white font-bold text-xl py-3 rounded-xl transition-colors"
                >
                    Bli med i quiz
                </button>
            </div>
        </div>
    )
}

export default Login