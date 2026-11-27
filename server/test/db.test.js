const { test } = require('node:test')
const assert = require('node:assert/strict')
const pool = require('../db')

// pg-pool emits 'error' when an idle client dies (e.g. PostgreSQL restarts). Without a
// listener Node treats it as an unhandled error and the whole process exits, which
// drops every running game.
test('an error from an idle database client does not crash the server', () => {
    assert.doesNotThrow(() => pool.emit('error', new Error('terminating connection due to administrator command')))
})
