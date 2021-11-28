const fuse = require('node-fuse-bindings')
const { FileService } = require('./service')
const service = FileService.getInstance()

function getattr(path, cb) {
    service.getattr(path)
        .then(stat => cb(0, stat))
        .catch(cb)
}

function fgetattr(path, fd, cb) {
    service.fgetattr(path, fd)
        .then(stat => {
            console.log(stat)
            cb(0, stat)
        })
        .catch(cb)
}

function readdir(path, cb) {
    service.readdir(path)
        .then(items => cb(0, items))
        .catch(cb)
}

function open(path, flags, cb) {
    const fd = service.open(path, flags)
    cb(0, fd)
}

function opendir(path, flags, cb) {
    const fd = service.opendir(path, flags)
    cb(0, fd)
}

function read(path, fd, buf, len, pos, cb) {
    service.read(fd, buf, len, pos)
        .then((length) => cb(length))
        .catch(cb)
}

function ftruncate(path, fd, size, cb) {
    cb(service.ftruncate(fd, size))
}

function release(path, fd, cb) {
    if (fd) cb(service.release(fd))
    else cb(0)
}

function releasedir (path, fd, cb) {
    cb(service.releasedir(fd))
}

function write(path, fd, buffer, length, position, cb) {
    cb(service.write(fd, buffer, length, position))
}

function fsync(path, fd, datasync, cb) {
    console.log('fsync', path, fd)
    service.fsync(fd, datasync)
        .then(() => cb(0))
        .catch(err => {
            console.error(err)
            cb(err)
        })
}

function flush(path, fd, cb) {
    console.log('flush', fd)
    if (fd) {
        service.flush(fd)
            .then(() => cb(0))
            .catch(err => {
                console.error(err)
                cb(err)
            })
    }
    else {
        cb(0)
    }
}

function fsyncdir(path, fd, datasync, cb) {
    console.log('syncdir', fd)
    cb(0)
}
function access(path, mode, cb) {
    // console.log('access')
    cb(0)
}

function setxattr(path, name, buffer, length, offset, flags, cb) {
    console.log('setxattr', buffer.toString())
    cb(0)
}
function getxattr(path, name, buffer, length, offset, cb) {
    // console.log('getxattr', buffer.toString())
    cb(0)
}

function create(path, mode, cb) {
    console.log('create', path, mode)
    service.create(path, mode).then(fd => {
        cb(0, fd)
    })
    .catch(cb)
}

function mkdir(path, mode, cb) {
    console.log('mkdir', path, mode)
    service.mkdir(path, mode)
        .then(() => cb(0))
        .catch(cb)
}


function unlink(path, cb) {
    service.unlink(path)
        .then(() => cb(0))
        .catch(cb)
}

function rmdir(path, cb) {
    service.rmdir(path)
        .then(() => cb(0))
        .catch(cb)
}

function rename(src, dest, cb) {
    service.rename(src, dest)
        .then(() => cb(0))
        .catch(cb)
}
function chmod(path, mode, cb) {
    console.log('chmod', path, mode)
    cb(0)
}
function chown(path, uid, gid, cb) {
    console.log('chown', path, uid, gid)
    cb(0)
}
function utimens(path, atime, mtime, cb) {
    console.log('utimens', path, atime, mtime)
    cb(0)
}


module.exports = {
    getattr,
    readdir,
    open,
    read,
    ftruncate,
    release,
    write,
    fsync,
    flush,
    fgetattr,
    access,
    fsyncdir,
    opendir,
    setxattr,
    getxattr,
    releasedir,
    create,
    unlink,
    mkdir,
    rmdir,
    rename,
    chmod,
    chown,
    utimens,
}