const fuse = require('node-fuse-bindings')
const { FileService } = require('./service')
const { mountPath } = require('./conf.json')
const ops = require('./ops')
const service = FileService.getInstance()



service.authenticate().then(() => {
    console.log('authed')
    ops.force = true
    fuse.mount(mountPath, ops, (err) => {
        if (err) throw err
        console.log('filesystem mounted on ', mountPath)
    })
})

process.on('SIGINT', function () {
    fuse.unmount(mountPath, function (err) {
        if (err) {
            console.log('filesystem at ' + mountPath + ' not unmounted', err)
        } else {
            console.log('filesystem at ' + mountPath + ' unmounted')
        }
    })
})