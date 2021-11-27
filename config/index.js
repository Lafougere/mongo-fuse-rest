const mongoUser = process.env.MONGO_INITDB_USERNAME
const mongoPassword = process.env.MONGO_INITDB_PASSWORD
const database = process.env.MONGO_INITDB_DATABASE
const host = process.env.MONGO_INITDB_HOST || 'localhost'
const port = process.env.MONGO_INITDB_PORT || '27018'

// console.log(process.env)
const mongoUrl = process.env.MONGO_URL || `mongodb://${mongoUser}:${mongoPassword}@${host}:${port}/${database}?authSource=admin`

module.exports = {
    mongo: {
        url: mongoUrl,
        user: mongoUser,
        password: mongoPassword,
    },
    jwt: {
        issuer: 'MongoFuse Auth',
        secret: process.env.JWT_SECRET || 'some secret',
        expires: process.env.JWT_EXPIRES || '1d'
    },
}