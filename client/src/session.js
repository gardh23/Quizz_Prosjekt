// The JWT expires after 7 days, but the user object kept beside it in localStorage does not.
// Without these checks the app keeps showing the host menu while the server answers 401 to
// everything and the socket is silently anonymous, so nothing works and nothing says why.

const EXPIRED_FLAG = 'quizz_session_expired'

function tokenExpired(token) {
    try {
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
        return typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()
    } catch {
        return true
    }
}

export function clearSession() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
}

// Logs out and goes to the login page; it says why only if the user had been logged in.
export function endSession() {
    if (localStorage.getItem('token')) sessionStorage.setItem(EXPIRED_FLAG, '1')
    clearSession()
    window.location.assign(`${import.meta.env.BASE_URL}login`)
}

export function takeExpiredNotice() {
    const expired = sessionStorage.getItem(EXPIRED_FLAG) === '1'
    sessionStorage.removeItem(EXPIRED_FLAG)
    return expired
}

// Runs on import, i.e. before the socket's first handshake reads the token.
const stored = localStorage.getItem('token')
if (stored && tokenExpired(stored)) {
    sessionStorage.setItem(EXPIRED_FLAG, '1')
    clearSession()
}
