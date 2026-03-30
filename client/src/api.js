import axios from 'axios'

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

export default api