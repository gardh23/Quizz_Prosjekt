import UserBadge from './UserBadge'

// In normal flow rather than fixed corners, so it never covers page content on narrower screens.
function TopBar({ onBack }) {
    return (
        <header className="flex items-center justify-between gap-4 max-w-5xl mx-auto mb-6">
            <div>
                {onBack && <button onClick={onBack} className="btn btn-soft">← Tilbake</button>}
            </div>
            <UserBadge />
        </header>
    )
}

export default TopBar
