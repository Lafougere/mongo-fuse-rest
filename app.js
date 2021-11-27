
const path = require('path')
const fs = require('fs')
const express = require('express')
const mongoose = require('mongoose')
require('dotenv').config()
const conf = require('./config')
const app = express()
const cookieParser = require('cookie-parser')
const cors = require('cors')


// console.log(conf)

mongoose.connect(conf.mongo.url, {
	useNewUrlParser: true,
    useUnifiedTopology: true,
    autoIndex: true,
})
global.mongoose = mongoose

mongoose.connection.on('connected', () => {
    console.log('mongoose connected')

    
    
    require('./models/File')
    require('./models/Folder')
    require('./models/Blob')
    require('./models/User')

    require('./seed')

    const {checkToken, getToken, requireCookie, verifyToken } = require('./controllers/auth')
    
    app.use(cookieParser())
    app.use(cors())

    app.get('/', async (req, res) => {
        try {
            const decoded = await checkToken(req.cookies.token)
            res.sendFile(path.join(__dirname, 'index.html'))
        }
        catch (e) {
            res.sendFile(path.join(__dirname, 'login.html'))
        }
        
    })
    app.post('/auth/login', express.json(), getToken)
    app.use('/files', verifyToken, require('./controllers/files'))
    app.use('/folders', verifyToken, require('./controllers/folders'))

    app.listen(9004, () => {
        console.log('app listening on port', 9004)
    })

})




// app.use(express.urlencoded({ extended: true }))
// app.use(express.json())


