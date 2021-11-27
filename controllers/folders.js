const express = require('express')
const router = express.Router()
const Blob = require('../models/Blob')
const Folder = mongoose.model('Folder')
const File = mongoose.model('File')



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

router.get('/*', async (req, res) => {
    const p = '/' + req.params['0']
    // console.log(p)
    // console.log(req.user)
    if (p === '/') {

        const folders = await Folder.find({parent: null, owner: req.user._id }).lean()
        console.log(folders)
        res.send(folders)
    }
    else {
        const folder = await Folder.findOne({ path: p, owner: req.user._id })
        if (!folder) return res.status(404).send('not found')
        const folders = await Folder.find({parent: folder._id}).lean()
        res.send(folders)
    }
    // res.send('folders')
})

router.post('/*', async (req, res) => {
    const p = '/' + req.params['0']
    // console.log(req.user)
    // console.log(p)
    const parentPath = p.split('/').slice(0, -1).join('/')
    const name = p.split('/').pop()
    console.log(parentPath)
    const folder = new Folder({ name, path: p, owner: req.user._id })
    if (parentPath !== '') {
        const parent = await Folder.findOne({ path: parentPath, owner: req.user._id })
        folder.parent = parent._id
    }
    await folder.save()
    res.send(folder)
    
})
router.patch('/*', async (req, res) => {
    console.log('rename folder')
    const p = '/' + req.params['0']
    // console.log(req.user)
    // console.log(p)
    const parentPath = p.split('/').slice(0, -1).join('/')
    const name = p.split('/').pop()
    console.log(parentPath)
    const folder = await Folder.findOne({ path: p, owner: req.user._id })
    if (!folder) return res.status(404).send('not found')
    if (req.query.rename) {
        const destPath = req.query.rename
        const destParent = destPath.split('/').slice(0, -1).join('/')
        const destName = destPath.split('/').pop()
        const newParent = await Folder.findOne({path: destParent, owner: req.user._id})
        if (!newParent) return res.status(404).send('destination folder not found')
        folder.path = destPath
        folder.parent = newParent
        folder.name = destName
        await folder.save()
        res.send(folder)
    }
})

router.delete('/:id', async (req, res) => {
    const recurse = req.query.recurse === '1'
    console.log('delete folder', recurse)
    const folder = await Folder.findOne({_id: req.params.id, owner: req.user._id})
    if (!folder) {
        return res.status(404).send('not found')
    }
    if (!recurse) {
        const count = await folder.countItems()
        console.log(count)
        if (count) {
            return res.status(403).send('not empty')
        }
    }
    
    await folder.remove()
    res.status(204).end()
    
})

module.exports = router