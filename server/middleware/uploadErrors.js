const multer = require('multer')

// A rejected upload is the sender's fault, so it gets a 4xx with a message the editor can
// show, instead of Express' default 500 page. Everything else falls through unchanged.
function uploadErrors(err, req, res, next) {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'Filen er for stor (maks 10 MB)' })
    }
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: 'Ugyldig opplasting' })
    }
    if (err.code === 'UPLOAD_REJECTED_TYPE') {
        return res.status(400).json({ error: err.message })
    }
    next(err)
}

module.exports = uploadErrors
