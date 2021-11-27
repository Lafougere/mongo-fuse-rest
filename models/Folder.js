const mongoose = require('mongoose')
const { Schema } = mongoose


const FolderSchema = new Schema({
    name: {type: String, required: true},
	path: String,
	parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder' },
	owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true, autoIndex: true })

FolderSchema.index({path: 1, name: 1, owner: 1}, {unique: true})

FolderSchema.methods.countItems = function () {
	const File = mongoose.model('File')
	const Folder = mongoose.model('Folder')
	return Promise.all([
		File.count({ folder: this._id }),
		Folder.count({ parent: this._id })
	]).then(all => {
		return all.reduce((a, b) => a + b, 0)
	})
}

FolderSchema.pre('remove', { document: true, query: true }, async function (next) {
	const File = mongoose.model('File')
	const Folder = mongoose.model('Folder')
	const [files, folders] = await Promise.all([
		File.find({ folder: this._id }),
		Folder.find({ parent: this._id })
	])
	const proms = files.map(file => file.remove())
	proms.push(...folders.map(folder => folder.remove()))
	await Promise.all(proms)
	next()
})

mongoose.model('Folder', FolderSchema)
const Folder = mongoose.model('Folder')