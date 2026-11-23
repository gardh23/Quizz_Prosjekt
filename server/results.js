// End-of-quiz results: the leaderboard plus fun titles. A title is shown only when someone
// earned it, and ties share it. To add a title, add an entry to `titles`: `score` returns a
// number for a player (or null when they do not qualify), `best` says whether lower or higher
// wins, and `detail` describes the winning value.

const formatSeconds = ms => `${(ms / 1000).toFixed(1).replace('.', ',')} sek i snitt`

const titles = [
    {
        id: 'fastest',
        emoji: '⚡',
        title: 'Raskest',
        best: 'lowest',
        score: s => s.scoredTimes.length ? average(s.scoredTimes) : null,
        detail: formatSeconds
    },
    {
        id: 'streak',
        emoji: '🔥',
        title: 'Lengste rekke',
        best: 'highest',
        score: s => s.longestStreak >= 2 ? s.longestStreak : null,
        detail: n => `${n} på rad`
    },
    {
        id: 'sharpshooter',
        emoji: '🎯',
        title: 'Skarpskytter',
        best: 'lowest',
        score: s => s.estimateOffs.length ? Math.round(average(s.estimateOffs)) : null,
        detail: pct => pct === 0 ? 'Eksakt på tallestimatene' : `${pct} % unna i snitt`
    },
    {
        // Only negative points the host handed out; there is no title if none were given.
        id: 'toughest',
        emoji: '🫠',
        title: 'Tøffeste kveld',
        best: 'lowest',
        score: s => s.negativePoints < 0 ? s.negativePoints : null,
        detail: n => `${n} poeng i minus`
    }
]

function average(values) {
    return values.reduce((a, b) => a + b, 0) / values.length
}

// An answer counts as correct when it scored more than 0 (partial credit and host points included).
function playerStats(player, questions) {
    const stats = { correct: 0, longestStreak: 0, scoredTimes: [], estimateOffs: [], negativePoints: 0 }
    let streak = 0
    for (const question of questions) {
        const ans = player.answers[question.id]
        const scored = !!ans && ans.points > 0
        if (scored) {
            stats.correct++
            streak++
            stats.longestStreak = Math.max(stats.longestStreak, streak)
            if (Number.isFinite(ans.timeUsed)) stats.scoredTimes.push(ans.timeUsed)
        } else {
            streak = 0
        }
        if (ans && question.type === 'number_estimate' && Number.isFinite(ans.percentOff)) {
            stats.estimateOffs.push(ans.percentOff)
        }
        if (ans && ans.points < 0) stats.negativePoints += ans.points
    }
    return stats
}

function buildResults(session) {
    const players = Object.values(session.players)
    const statsByName = new Map(players.map(p => [p.username, playerStats(p, session.questions)]))

    const sorted = [...players].sort((a, b) => b.score - a.score)
    // Ties share a place and the next place is skipped (1, 1, 3).
    const leaderboard = sorted.map(p => ({
        username: p.username,
        score: p.score,
        rank: 1 + sorted.filter(other => other.score > p.score).length,
        correct: statsByName.get(p.username).correct,
        total: session.questions.length
    }))

    const awarded = []
    for (const t of titles) {
        const scored = players
            .map(p => ({ username: p.username, value: t.score(statsByName.get(p.username)) }))
            .filter(e => e.value !== null)
        if (scored.length === 0) continue
        const values = scored.map(e => e.value)
        const bestValue = t.best === 'lowest' ? Math.min(...values) : Math.max(...values)
        awarded.push({
            id: t.id,
            emoji: t.emoji,
            title: t.title,
            winners: scored.filter(e => e.value === bestValue).map(e => e.username),
            detail: t.detail(bestValue)
        })
    }

    return { leaderboard, titles: awarded }
}

module.exports = { buildResults }
