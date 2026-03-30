const multer = require('multer')
const path = require('path')

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
        cb(null, unique + path.extname(file.originalname))
    }
})

const fileFilter = function (req, file, cb) {
    const allowedMimes = ['image/jpeg', 'image/png', 'audio/mpeg', 'audio/mp3']
    const allowedExts = ['.jpg', '.jpeg', '.png', '.mp3']
    const ext = path.extname(file.originalname).toLowerCase()

    if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
        cb(null, true)
    } else {
        cb(new Error('Kun jpg, png og mp3 er tillatt'), false)
    }
}

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 }
})

module.exports = upload 