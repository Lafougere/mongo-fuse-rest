const mongoose = require('mongoose')
const {Schema} = mongoose
const Blob = require('./Blob')

const FileSchema = new Schema({
    name: String,
    type: String,
    size: Number,
    lastModified: Date,
	folder: { type: Schema.Types.ObjectId, ref: 'Folder' },
	owner: { type: Schema.Types.ObjectId, ref: 'User' },
	blob: { type: Schema.Types.ObjectId }
}, { timestamps: true, autoIndex: true })

FileSchema.index({ folder: 1, name: 1, owner: 1 }, { unique: true })

FileSchema.pre('remove', { document: true, query: true },  function (next) {
    console.log('removing dile', this.name, this.blob)
    Blob.unlink({_id: this.blob}, (err) => {
        // if (err) return next(err)
        next()
    })
})

mongoose.model('File', FileSchema)