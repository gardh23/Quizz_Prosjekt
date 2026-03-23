  const express = require('express')                                                                                                                                                          
  const app = express()
  const PORT = 3000                                                                                                                                                                           
  const pool = require('./db')                                                                                                                                                                
   
  app.use(express.json())                                                                                                                                                                     
                                                            
  const authRoutes = require('./routes/auth')                                                                                                                                                 
  app.use('/auth', authRoutes)                              

  app.get('/', async (req, res) => {                                                                                                                                                          
    const result = await pool.query('SELECT NOW()')
    res.send(`Database tilkoblet! Tidspunkt: ${result.rows[0].now}`)                                                                                                                          
  })                                                        

  app.listen(PORT, () => {
    console.log(`Server kjører på http://localhost:${PORT}`)
  }) 