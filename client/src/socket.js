import { io } from 'socket.io-client'
import './session'

// auth as a function is re-read on every (re)connect, so the socket picks up
// a token stored after the page loaded.
const socket = io(window.location.hostname === 'localhost' ? 'http://localhost:3000' : '/', {
    auth: (cb) => cb({ token: localStorage.getItem('token') })
})

// The server only reads the token during the handshake.
export function reconnectWithCurrentToken() {
    socket.disconnect().connect()
}

export default socket
