import browserEnv from 'browser-env'
const { subtle, randomUUID } = require('node:crypto').webcrypto
Object.defineProperty(global, 'crypto', {
    value: { subtle, randomUUID }
})
browserEnv(['crypto']);