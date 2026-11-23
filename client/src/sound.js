// Every sound is synthesised with Web Audio, so the app ships no audio files.

const STORAGE_KEY = 'quizz_muted'
let ctx = null
let muted = readMuted()
let lobbyTimer = null
const listeners = new Set()

function readMuted() {
    try {
        return localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
        return false
    }
}

function audio() {
    if (!ctx) {
        const Ctx = window.AudioContext || window.webkitAudioContext
        if (!Ctx) return null
        ctx = new Ctx()
    }
    return ctx
}

// Browsers keep audio suspended until the user interacts with the page.
for (const event of ['pointerdown', 'keydown']) {
    window.addEventListener(event, () => audio()?.resume(), { capture: true })
}

function tone(freq, start, duration, { type = 'sine', volume = 0.2 } = {}) {
    const c = audio()
    // Tones scheduled while suspended would all play at once when audio unlocks.
    if (!c || muted || c.state !== 'running') return
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = type
    osc.frequency.value = freq
    const t = c.currentTime + start
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
    osc.connect(gain).connect(c.destination)
    osc.start(t)
    osc.stop(t + duration + 0.05)
}

export const sounds = {
    tick: () => tone(880, 0, 0.08, { type: 'square', volume: 0.06 }),
    submitted: () => {
        tone(660, 0, 0.1)
        tone(990, 0.08, 0.15)
    },
    timeUp: () => tone(196, 0, 0.5, { type: 'sawtooth', volume: 0.1 }),
    correct: () => [523, 659, 784].forEach((f, i) => tone(f, i * 0.09, 0.25, { type: 'triangle' })),
    wrong: () => {
        tone(311, 0, 0.25, { type: 'square', volume: 0.08 })
        tone(233, 0.2, 0.4, { type: 'square', volume: 0.08 })
    },
    fanfare: () => {
        const notes = [[523, 0], [523, 0.15], [523, 0.3], [659, 0.45], [784, 0.75], [659, 0.95], [784, 1.1]]
        notes.forEach(([f, t], i) => tone(f, t, i === notes.length - 1 ? 0.8 : 0.18, { type: 'triangle', volume: 0.16 }))
    }
}

const lobbyBar = [[262, 0], [330, 0.25], [392, 0.5], [330, 0.75], [294, 1], [349, 1.25], [440, 1.5], [349, 1.75]]

export function startLobbyMusic() {
    if (lobbyTimer) return
    const playBar = () => lobbyBar.forEach(([f, t]) => tone(f, t, 0.22, { type: 'triangle', volume: 0.05 }))
    playBar()
    lobbyTimer = setInterval(playBar, 2000)
}

export function stopLobbyMusic() {
    clearInterval(lobbyTimer)
    lobbyTimer = null
}

export function isMuted() {
    return muted
}

export function setMuted(value) {
    muted = value
    try {
        localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
    } catch {
        // Private mode or blocked storage: the choice just won't survive a reload.
    }
    listeners.forEach(fn => fn())
}

export function subscribeMuted(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
}
