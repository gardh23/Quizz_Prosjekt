  const express = require('express')
  const app = express()
  const PORT = 3000

  app.get('/', (req, res) => {
    res.send('Server kjører!')
  })

  app.listen(PORT, () => {
    console.log(`Server kjører på http://localhost:${PORT}`)
  })

  /*
  Forklaring linje for linje:
  - require('express') — importerer Express-pakken vi installerte
  - app — selve serveren vår
  - app.get('/') — når noen besøker / i nettleseren, send tilbake en tekstmelding
  - app.listen(PORT) — start serveren og lytt på port 3000
  */