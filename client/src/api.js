import axios from 'axios'
import { endSession } from './session'

export const mediaBase = window.location.hostname === 'localhost' ? 'http://localhost:3000' : ''

const api = axios.create({
    baseURL: window.location.hostname === 'localhost' ? 'http://localhost:3000' : '/'
})

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token')
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

// A 401 on login just means a wrong password; anywhere else the login is gone.
api.interceptors.response.use(
    response => response,
    error => {
        if (error.response?.status === 401 && !error.config?.url?.startsWith('/auth/')) {
            endSession()
        }
        return Promise.reject(error)
    }
)

export default api