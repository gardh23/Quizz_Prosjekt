import { io } from 'socket.io-client'

const socket = io(window.location.hostname === 'localhost' ? 'http://localhost:3000' : '/', {
    auth: {
        token: localStorage.getItem('token')
    }
})

export default socket