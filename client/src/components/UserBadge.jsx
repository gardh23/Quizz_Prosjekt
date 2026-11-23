import { useNavigate } from 'react-router-dom'
import { reconnectWithCurrentToken } from '../socket'

function UserBadge() {
    const user = JSON.parse(localStorage.getItem('user'))
    const navigate = useNavigate()

    const logout = () => {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        reconnectWithCurrentToken()
        navigate('/login')
    }

    if (!user) return null

    return (
        <div className="flex items-center gap-3 bg-white rounded-xl px-4 py-2 shadow-lg">
            <span className="text-purple-900 font-semibold">{user.username}</span>
            <span className="text-xs bg-purple-100 text-purple-700 font-bold px-2 py-1 rounded-lg">{user.role}</span>
            <button
                onClick={logout}
                className="text-gray-500 hover:text-red-600 font-bold transition-colors rounded focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400"
            >
                Logg ut
            </button>
        </div>
    )
}

export default UserBadge