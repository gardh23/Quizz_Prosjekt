const jwt = require('jsonwebtoken')
const JWT_SECRET = 'midlertidig_hemmelig_nokkel'



function requireAuth(req, res, next) {
    const authHeader = req.headers['authorization']

    if (!authHeader) {
        return res.status(401).json({ error: 'Ingen token oppgitt' })
    }

    const token = authHeader.split(' ')[1]

    try {
        const decoded = jwt.verify(token, JWT_SECRET)
        req.user = decoded
        next()
    } catch (err) {
        return res.status(401).json({ error: 'Ugyldig token' })
    }
}

function requireRole(...roles) {
    return function (req, res, next) {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Ikke tilgang' })
        }
        next()
    }
}

module.exports = { requireAuth, requireRole } 