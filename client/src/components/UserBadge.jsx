import { useNavigate } from 'react-router-dom'

function UserBadge() {
    const user = JSON.parse(localStorage.getItem('user'))
    const navigate = useNavigate()

    const logout = () => {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        navigate('/login')
    }

    if (!user) return null

    return (
        <div className="fixed top-4 right-4 flex items-center gap-3 bg-white rounded-xl px-4 py-2 shadow-lg z-50">
            <span className="text-purple-900 font-semibold">{user.username}</span>
            <span className="text-xs bg-purple-100 text-purple-600 font-bold px-2 py-1 rounded-lg">{user.role}</span>
            <button
                onClick={logout}
                className="text-gray-400 hover:text-red-500 font-bold transition-colors"
            >
                Logg ut
            </button>
        </div>
    )
}

export default UserBadge