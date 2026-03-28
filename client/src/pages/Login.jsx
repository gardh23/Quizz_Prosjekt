import { useState } from 'react'
import api from '../api'

function Login() {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            const res = await api.post('/auth/login', { username, password })
            localStorage.setItem('token', res.data.token)
            localStorage.setItem('user', JSON.stringify(res.data.user))
            window.location.href = '/'
        } catch (err) {
            setError(err.response?.data?.error || 'Noe gikk galt')
        }
    }

    return (
        <div>
            <h1>Logg inn</h1>
            {error && <p>{error}</p>}
            <form onSubmit={handleSubmit}>
                <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Brukernavn" />
                <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Passord" type="password" />
                <button type="submit">Logg inn</button>
            </form>
        </div>
    )
}

export default Login