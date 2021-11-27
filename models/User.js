const mongoose = require('mongoose')
const { Schema } = mongoose
const crypto = require('crypto')
const { v4: uuidv4 } = require('uuid')


const UserSchema = new Schema({
	username: {type: String, unique: true},
	email: {type: String, lowercase: true, unique: true},
	hashedPassword: String,
	salt: String,
	creator: {type: 'ObjectId', ref: 'User'},
	passwordResetToken: {type: String, default: uuidv4},
}, { timestamps: true })

UserSchema
	.virtual('password')
	.set(function (password) {
		this._password = password
		this.salt = this.makeSalt()
		this.hashedPassword = this.encryptPassword(password)
	})
	.get(function () {
		return this._password
	})




// Validate empty email
UserSchema
	.path('email')
	.validate(function (email) {
		return email.length
	}, 'Email cannot be blank')

// Validate empty password
UserSchema
	.path('hashedPassword')
	.validate(function (hashedPassword) {
		return hashedPassword.length
	}, 'Password cannot be blank')

// Validate email is not taken
UserSchema
	.path('email')
	.validate(async function (value) {
		var self = this
		console.log('VALIDATE EMAIL', value)
		const user = await this.constructor.findOne({email: value}, ['_id', 'username'])
		if (user) {
			console.log('SUBB', user, self._id, self._id === user._id)
			if (self._id === user._id) return true
			console.log('NOT VALID')
			return false
		}
		return true
	}, 'The specified email address is already in use.')

UserSchema
	.path('username')
	.validate(async function (value) {
		var self = this
		console.log('VALIDATE NAME', value)
		const user = await this.constructor.findOne({username: value}, ['_id', 'username'])
		if (user) {
			console.log('SUBB', user, self._id, self._id === user._id)
			if (self._id === user._id) return true
			console.log('NOT VALID')
			return false
		}
		return true
		
	}, 'The specified username is already in use.')

const validatePresenceOf = function (value) {
	return value && value.length
}


UserSchema
	.pre('save', function (next) {
		if (!this.isNew) return next()
		next()
		// if (!validatePresenceOf(this.hashedPassword))
		// 	next(new Error('Invalid password'))
		// else
		// 	next()
	})

UserSchema.methods = {
	/**
	* Authenticate - check if the passwords are the same
	*
	* @param {String} plainText
	* @return {Boolean}
	* @api public
	*/
	authenticate: function (plainText) {
		return this.encryptPassword(plainText) === this.hashedPassword
	},

	/**
	* Make salt
	*
	* @return {String}
	* @api public
	*/
	makeSalt: function () {
		return crypto.randomBytes(16).toString('base64')
	},

	/**
	* Encrypt password
	*
	* @param {String} password
	* @return {String}
	* @api public
	*/
	encryptPassword: function (password) {
		if (!password || !this.salt) return ''
		var salt = Buffer.from(this.salt, 'base64')
		return crypto.pbkdf2Sync(password, salt, 10000, 512, 'sha512').toString('base64')
	}
}

mongoose.model('User', UserSchema)