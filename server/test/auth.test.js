const { test, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')
const pool = require('../db')

let server, base, queries
pool.query = async (sql) => {
    queries.push(sql)
    return { rows: [] }
}

// A fresh router per test, so its rate limiter starts from zero.
beforeEach(async () => {
    delete require.cache[require.resolve('../routes/auth')]
    const app = express()
    app.use(express.json())
    app.use('/auth', require('../routes/auth'))
    server = app.listen(0)
    await new Promise(resolve => server.once('listening', resolve))
    base = `http://127.0.0.1:${server.address().port}/auth`
})

afterEach(() => server.close())

const badBodies = [
    ['no body', undefined],
    ['empty object', '{}'],
    ['missing password', '{"username":"ada"}'],
    ['non-string username', '{"username":{"x":1},"password":"pw"}'],
    ['non-string password', '{"username":"ada","password":123}'],
    ['blank username', '{"username":"   ","password":"pw"}']
]

for (const route of ['login', 'register']) {
    for (const [name, body] of badBodies) {
        test(`${route} with ${name} is a 400 and never reaches the database`, async () => {
            queries = []
            const res = await fetch(`${base}/${route}`, {
                method: 'POST',
                headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
                body
            })
            assert.equal(res.status, 400)
            assert.equal(typeof (await res.json()).error, 'string')
            assert.deepEqual(queries, [])
        })
    }
}

test('login with a well-formed body still reaches the database', async () => {
    queries = []
    const res = await fetch(`${base}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"username":"ada","password":"pw"}'
    })
    assert.equal(res.status, 401)
    assert.equal(queries.length, 1)
})

// In production every request reaches Express from NGINX on 127.0.0.1; only X-Real-IP tells clients apart.
async function loginFrom(ip) {
    const res = await fetch(`${base}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Real-IP': ip },
        body: '{"username":"ada","password":"pw"}'
    })
    return res.status
}

test('one client hitting the login limit does not lock out another client', async () => {
    queries = []
    for (let i = 0; i < 10; i++) assert.equal(await loginFrom('203.0.113.7'), 401)
    assert.equal(await loginFrom('203.0.113.7'), 429)
    assert.equal(await loginFrom('198.51.100.20'), 401)
})
