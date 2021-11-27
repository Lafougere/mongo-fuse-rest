const express = require('express')
const mime = require('mime-types')
const router = express.Router()
const Blob = require('../models/Blob')
const Folder = mongoose.model('Folder')
const File = mongoose.model('File')

function writeBlob(name, type, stream) {
    return new Promise((resolve, reject) => {
        const options = ({ filename: name, contentType: type })
        Blob.write(options, stream, (error, file) => {
            if (error) return reject(error)
            resolve(file)
        })
    })
}
function deleteBlob(_id) {
    return new Promise((resolve, reject) => {
        Blob.unlink({ _id }, (error) => {
            if (error) return reject(error)
            resolve()
        })
    })
}
function getBlobStream(_id) {
    console.log('read blob', _id)
    return Blob.read({ _id })
}


async function ensurePath(path, user) {
    let folder = await Folder.findOne({path, owner: user._id})
    if (!folder) {
        const parentPath = path.split('/').slice(0, -1).join('/')
        let parentId = null
        if (parentPath) {
            const parent = await ensurePath(parentPath, user)
            parentId = parent._id
        }
        const name = path.split('/').pop()
        folder = new Folder({
            name,
            path,
            parent: parentId,
            owner: user._id
        })
        await folder.save()
    }
    return folder
}



router.get('/list/*', async (req, res) => {
    const p = '/' + req.params['0']
    let files
    console.log('lisfiles', p)
    if (p === '/') {
        files = await File.find({ folder: null, owner: req.user._id }).select('name size type _id lastModified createdAt')
    }
    else {
        const folder = await Folder.findOne({path: p, owner: req.user._id})
        if (!folder) {
            return res.status(404).send('folder not found')
        }
        files = await File.find({ folder: folder._id }).select('name size type _id lastModified createdAt')
    }
    res.send(files)
})
router.get('/download/:id', async (req, res) => {
    const _id = req.params.id
    console.log('dwl', _id)
    const file = await File.findOne({ _id, owner: req.user._id }).select('blob size')
    if (!file) {
        return res.status(404).send('fnot found')
    }
    console.log(file)
    if (!file.size) {
        return res.status(204).end()
    }
    const stream = getBlobStream(file.blob)
    stream.pipe(res)
    
})
router.get('/info/*', async (req, res) => {
    // get file info by path
    const p = '/' + req.params['0']

    const filePath = p.split('/').slice(0, -1).join('/')
    const fileName = p.split('/').pop()
    console.log('fileinfo', filePath, fileName)
    const where = { folder: null, owner: req.user._id, name: fileName }
    if (filePath !== '/') {
        const folder = await Folder.findOne({path: filePath, owner: req.user._id}).select('_id')
        if (!folder) {
            return res.status(404).send('folder not found')
        }
        where.folder = folder._id
    }
    const file = await File.findOne(where).select('_id name size type createdAt updatedAt')
    if (!file) {
        return res.status(404).send('file not found')
    }
    console.log(file)
    res.send(file)
    
})
router.post('/*', async (req, res) => {
    const p = '/' + req.params['0']
    // console.log(req.user)
    const filePath = p.split('/').slice(0, -1).join('/')
    const fileName = p.split('/').pop()
    console.log('filePath', filePath)
    console.log('fileName', fileName)
    const proms = []
    if (req.headers['content-length'] && parseInt(req.headers['content-length'])) {
        proms.push(writeBlob(fileName, req.query.type, req))
    }
    else {
        proms.push(Promise.resolve({_id: null, length: 0}))
    }

    if (filePath.length && filePath !== '/') {
        proms.push(ensurePath(filePath, req.user))
    }
    else {
        proms.push(Promise.resolve({_id: null}))
    }
    const [blob, folder] = await Promise.all(proms)
    const file = new File({
        name: fileName,
        type: req.query.type || mime.lookup(fileName),
        size: blob.length,
        lastModified: new Date(),
        owner: req.user._id,
        folder: folder._id,
        blob: blob._id,
    })
    
    try {
        await file.save()
        res.send(file)
    }
    catch (err) {
        console.log(err)
        deleteBlob(blob._id)
        if (err.code === 11000) {
            res.status(409).send('file exists')
        }
        else {
            res.status(500).send(err)
        }
    }
})
router.put('/:id', async (req, res) => {

    const file = await File.findOne({ _id: req.params.id, owner: req.user._id })
    if (!file) return res.status(404).send('file not found')
    if (file.blob) {
        console.log('del blb')
        deleteBlob(file.blob).catch(err => {
            console.log('blob not fnd')
            console.error(err)
        })
    }

    try {
        const blob = await writeBlob(file.name, file.type, req)
        console.log('blob writren')
        file.blob = blob._id
        file.size = blob.length
        await file.save()
        res.status(204).end()
    }
    catch (err) {
        console.log(err)
        res.status(500).send(err)
    }
})

router.patch('/:id', async (req, res) => {
    console.log('rename file')
    const file = await File.findOne({ _id: req.params.id, owner: req.user._id })
    if (!file) return res.status(404).send('file not found')
    if (req.query.rename) {
        const destPath = req.query.rename
        const destParent = destPath.split('/').slice(0, -1).join('/')
        const destName = destPath.split('/').pop()
        const newParent = await Folder.findOne({path: destParent, owner: req.user._id})
        if (!newParent) return res.status(404).send('destination folder not found')
        file.folder = newParent
        file.name = destName
        await file.save()
        res.send(file)
    }
})

router.delete('/:id', async (req, res) => {
    const file = await File.findOne({_id: req.params.id, owner: req.user._id})
    if (!file) {
        return res.status(404).send('not found')
    
    }
    console.log(file)
    const f = await file.remove()
    console.log(f)
    res.status(204).end()
    
})

module.exports = router