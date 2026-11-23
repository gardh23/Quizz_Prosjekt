import { useSyncExternalStore } from 'react'
import { isMuted, setMuted, subscribeMuted } from '../sound'

function MuteButton() {
    const muted = useSyncExternalStore(subscribeMuted, isMuted)
    return (
        <button
            onClick={() => setMuted(!muted)}
            aria-label={muted ? 'Slå på lyd' : 'Slå av lyd'}
            title={muted ? 'Slå på lyd' : 'Slå av lyd'}
            className="fixed bottom-4 right-4 z-50 bg-white text-2xl w-12 h-12 rounded-full shadow-lg hover:bg-purple-100 transition-colors"
        >
            {muted ? '🔇' : '🔊'}
        </button>
    )
}

export default MuteButton
