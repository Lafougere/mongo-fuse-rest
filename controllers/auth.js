const jwt = require('jsonwebtoken')
const conf = require('../config')
const crypto = require('crypto')
const uuidv4 = require('uuid').v4
// const { User, Company, Role, Log } = require('../models')

const User = mongoose.model('User')

// const { sendMailResetPassword } = require('./mail')






async function getToken(req, res) {
    console.log('gettoken', req.body.username)
    const user = await User.findOne({
        $or: [{email: req.body.username}, {username: req.body.username}]
    })
    console.log(user)
    if (!user) {
        res.status(401).send({message: 'bad credentials'})
        return
    }
    if (user.authenticate(req.body.password)) {

        const payload = {
            _id: user.id,
            email: user.email,
            emailHash: crypto.createHash('md5').update(user.email).digest("hex"),
            username: user.username,
        }
        const token = jwt.sign(payload, conf.jwt.secret, {expiresIn: conf.jwt.expires, issuer: conf.jwt.issuer})
        // res.set('Content-Type', 'application/json').status(200).json({token: token})
        res.cookie('token', token, {
            expires: new Date(Date.now() + 8 * 3600000) // cookie will be removed after 8 hours
        })

        res.set('Content-Type', 'application/json').status(200).send({token: token, user: payload})
    }
    else {
        res.set('Content-Type', 'application/json').status(401).send({message: 'Invalid username/password'})
    }

}

function checkToken(token) {
    return new Promise((resolve, reject) => {
        if (token) {
            jwt.verify(token, conf.jwt.secret, {
                issuer: conf.jwt.issuer,
                expiresIn: conf.jwt.expires
            },
                (error, decoded) => {
                    if (error === null && decoded) {
                        
                        return resolve(decoded)
                    }
                    console.log('cookie error', error)
                    return reject(error)
                }
            )
        }
        else reject('no cookie')
    })
}

function verifyToken(req, res, next) {
    const bearerRegex = /^Bearer\s/
    const bearerString = req.headers.authorization
    
    if (bearerString && bearerRegex.test(bearerString) || req.headers.token) {
        const token = bearerString ? bearerString.replace(bearerRegex, '') : req.query.token || req.cookies.token
        // console.log(' token', token)
        jwt.verify(token, conf.jwt.secret, {
            issuer: conf.jwt.issuer,
            expiresIn: conf.jwt.expires
        },
            (error, decoded) => {
                if (error === null && decoded) {
                    req.user = decoded
                    return next()
                }
                console.log('auth error', error)
                return next(req.res.status(401).send(error))
            }
        );
    } else {
        return next(req.res.sendStatus(401))
    }
}

function requireCookie(req, res, next) {
    if (req.cookies.token) {
        jwt.verify(req.cookies.token, conf.jwt.secret, {
            issuer: conf.jwt.issuer,
            expiresIn: conf.jwt.expires
        },
            (error, decoded) => {
                if (error === null && decoded) {
                    req.user = decoded
                    return next()
                }
                console.log('auth error', error)
                return res.status(401).send(error)
            }
        )
    }
    else res.status(401).send('unauthorized')
}

async function resetPassword(req, res) {
    console.log('reset pass', req.body)
    try {
        const user = await User.findOne({email: req.body.email})
        if (!user) {
            return res.status(404).send('user not found')
        }
        console.log(user)
        user.passwordResetToken = uuidv4()
        await user.save()
        await sendMailResetPassword(user.email, user.passwordResetToken)
        res.send({success: true})

        
    }
    catch (e) {
        console.error(e)
        res.status(500).send({name: e.name, message: e.message})
    }

}

async function setPassword(req, res) {
    console.log('SETTING PASS')
    try {
        const token = req.body.reset_token
        const password = req.body.password
        const user = await User.findOne({ passwordResetToken: token })
        if (!user) {
            return res.status(404).send('user not found')
        }
        user.password = password
        user.passwordResetToken = ''
        user.save()
        const payload = {
            id: user.id,
            email: user.email,
            emailHash: crypto.createHash('md5').update(user.email).digest("hex"),
            username: user.username,
            role: user.role,
            company: user.company
        }
        const newToken = jwt.sign(payload, conf.jwt.secret, {expiresIn: conf.jwt.expires, issuer: conf.jwt.issuer})
        res.send({token: newToken, user: payload})
    }
    catch (e) {
        res.status(500).send({error: e.error, message: e.message})
    }
}



module.exports = {
    getToken,
    verifyToken,
    requireCookie,
    resetPassword,
    setPassword,
    checkToken,
}