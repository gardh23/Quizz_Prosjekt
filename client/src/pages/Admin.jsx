import { useState, useEffect } from 'react'
import api from '../api'
import UserBadge from '../components/UserBadge'

function Admin() {
    const [users, setUsers] = useState([])

    useEffect(() => {
        api.get('/admin/users').then(res => setUsers(res.data))
    }, [])

    const changeRole = async (id, role) => {
        const res = await api.put(`/admin/users/${id}/role`, { role })
        setUsers(users.map(u => u.id === id ? res.data : u))
    }

    const deleteUser = async (id, username) => {
        if (!window.confirm(`Er du helt sikker på at du vil slette "${username}"?`)) return
        await api.delete(`/admin/users/${id}`)
        setUsers(users.filter(u => u.id !== id))
    }

    return (
        <div className="min-h-screen bg-purple-900 p-8">
            <UserBadge />
            <div className="max-w-2xl mx-auto">
                <h1 className="text-4xl font-bold text-white mb-8">Admin-panel</h1>
                <div className="flex flex-col gap-4">
                    {users.map(user => (
                        <div key={user.id} className="bg-white rounded-2xl px-5 py-4 flex items-center justify-between shadow-lg">
                            <span className="text-purple-900 font-bold text-lg">{user.username}</span>
                            <div className="flex items-center gap-3">
                                <select
                                    value={user.role}
                                    onChange={e => changeRole(user.id, e.target.value)}
                                    className="border-2 border-purple-200 rounded-xl px-4 py-2 text-purple-900 font-semibold focus:outline-none focus:border-purple-500"
                                >
                                    <option value="player">Player</option>
                                    <option value="host">Host</option>
                                    <option value="admin">Admin</option>
                                </select>
                                <button
                                    onClick={() => deleteUser(user.id, user.username)}
                                    className="bg-red-100 hover:bg-red-200 text-red-700 font-bold px-4 py-2 rounded-xl transition-colors"
                                >
                                    Slett
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default Admin