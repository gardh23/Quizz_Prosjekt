const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const express = require('express')
const upload = require('../middleware/upload')
const uploadErrors = require('../middleware/uploadErrors')

let server, base

before(async () => {
    const app = express()
    app.post('/up', upload.fields([{ name: 'image' }]), (req, res) => res.status(201).json({}))
    app.use(uploadErrors)
    server = app.listen(0)
    await new Promise(resolve => server.once('listening', resolve))
    base = `http://127.0.0.1:${server.address().port}`
})

after(() => server.close())

function post(bytes, name, type) {
    const form = new FormData()
    form.append('image', new Blob([bytes], { type }), name)
    return fetch(`${base}/up`, { method: 'POST', body: form })
}

test('a file of the wrong type is a 400 with a message the host can read', async () => {
    const before = fs.readdirSync('uploads').length
    const res = await post('<script>alert(1)</script>', 'evil.html', 'text/html')
    assert.equal(res.status, 400)
    assert.match((await res.json()).error, /jpg, png og mp3/)
    assert.equal(fs.readdirSync('uploads').length, before, 'nothing was stored')
})

test('a file over 10 MB is a 413 with a message the host can read', async () => {
    const before = fs.readdirSync('uploads').length
    const res = await post(Buffer.alloc(10 * 1024 * 1024 + 1), 'big.png', 'image/png')
    assert.equal(res.status, 413)
    assert.match((await res.json()).error, /10 MB/)
    assert.equal(fs.readdirSync('uploads').length, before, 'the partial file was removed')
})
