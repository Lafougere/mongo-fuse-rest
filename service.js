const bent = require('bent')
const fuse = require('node-fuse-bindings')
// const config = require('./conf.json')
const { backendUrl, username, password } = require('./conf.json')
const cache = {
    '/': {
        updatedAt: new Date()
    }
}
const descriptors = {
	next: 10,
	add: function(path, flag ='r') {
		const fd = this.next++
		this[fd] = { path, flag, buf: Buffer.from([]), promise: null }
		return fd
	}
}
const uid = process.getuid ? process.getuid() : 0
const gid = process.getgid ? process.getgid() : 0
let instance

function toFlag(flags) {
    flags = flags & 3
    if (flags === 0) return 'r'
    if (flags === 1) return 'w'
    return 'r+'
}

class FileService {
    token = ''
    headers = {}
    static getInstance() {
        if(!instance) {
            instance = new FileService()
        }

        return instance
    }
    constructor() {
        
    }
    
    authenticate() {
        const postJson = bent(backendUrl, 'POST', 'json', 200)
        return postJson('/auth/login', {username, password}).then(data => {
            this.token = data.token
            this.headers = {'Authorization': `Bearer ${this.token}`}
            this.getJson = bent(backendUrl, 'json', 200, this.headers)
            this.getBuffer = bent(backendUrl, 'buffer', [200, 204], this.headers)
            this.putBuffer = bent(backendUrl, 'PUT', [200, 204], this.headers)
            this.postJson = bent(backendUrl, 'POST', 'json', [200, 204], this.headers)
            this.del = bent(backendUrl, 'DELETE', [200, 204], this.headers)
            this.patch = bent(backendUrl, 'PATCH', [200, 204], this.headers)
        })
    }
    getItem(path) {
        // console.log('get item', path, typeof cache[path])
        if (cache[path]) return Promise.resolve(cache[path])
        else {
            return Promise.all([
                this.getFileInfo(path),
                this.getFolderInfo(path),
            ])
            .then(all => {
                const [file, folder] = all
                if (file) {
                    console.log(path, 'is file')
                    file.isFile = true
                    cache[path] = file
                    return file
                }
                else if (folder) {
                    console.log(path, 'is folder')
                    cache[path] = folder
                    return folder
                }
            })
        }
    }
    getFileInfo(path) {
        return this.getJson(`/files/info${path}`).catch(() => null)
    }
    getFolderInfo(path) {
        return this.getJson(`/folders/info${path}`).catch(() => null)
    }
    getFileStat(file) {
        return {
            mtime: new Date(file.updatedAt),
            atime: new Date(file.updatedAt),
            ctime: new Date(file.updatedAt),
            nlink: 1,
            size: file.size,
            mode: 33188,
            uid,
            gid,
        }
    }
    getFolderStat(folder) {
        return {
            mtime: new Date(folder.updatedAt),
            atime: new Date(folder.updatedAt),
            ctime: new Date(folder.updatedAt),
            nlink: 1,
            size: 100,
            mode: 16877,
            uid,
            gid,
        }
    }
    getStat(item) {
        return item.isFile ? this.getFileStat(item) : this.getFolderStat(item)
    }
    getattr(path) {
        console.log('getattr', path)
        return new Promise((resolve, reject) => {
            this.getItem(path).then(item => {
            // console.log('attr', item)
                if (item) resolve(this.getStat(item))
                reject(fuse.ENOENT)
            })
        })
    }
    fgetattr(path, fd) {
        console.log('fgetattr', path, fd)
        return new Promise((resolve, reject) => {
            if (fd) {
                const desc = descriptors[fd]
                if (!desc) {
                    return reject(fuse.EBADF)
                }
                this.getItem(desc.path).then(item => {
                    // console.log('ITEMFOUND')
                    if (item) resolve(this.getStat(item))
                    reject(fuse.ENOENT)
                })
            }
            else if (cache[path]) {
                resolve(this.getStat(cache[path]))
            }
            else {
                reject(fuse.ENOENT)
            }
        })
        
    }
    async readdir(path) {
        console.log('readdir', path)
        const [folders, files] = await Promise.all([
            this.getJson('/folders/list' + path),
            this.getJson('/files/list' + path)
        ])
        folders.forEach(folder => {
            cache[folder.path] = folder
        })
        files.forEach(file => {
            const filePath = `${path}/${file.name}`.replace('//', '/')
            file.isFile = true
            cache[filePath] = file
            // TODO: invalidate cache
        })
        return [...folders, ...files].map(i => i.name)
    }
    open(path, flags) {
        const flag = toFlag(flags)
        console.log('open(%s, %s)', path, flag)
        
        return descriptors.add(path, flag)
    }
    opendir(path, flags) {
        const flag = toFlag(flags)
        console.log('opendir(%s, %s)', path, flag)
        
        return descriptors.add(path, flag)
    }
    read(fd, buf, len, pos) {
        console.log('read', fd, pos, len)
        return new Promise(async (resolve, reject) => {
            const desc = descriptors[fd]
            if (!desc) {
                return reject(fuse.EBADF)
            }
            const item = await this.getItem(desc.path)
            if (!item) {
                return reject(fuse.ENOENT)
            }
            if (!desc.promise) {
                desc.promise = this.getBuffer(`/files/download/${item._id}`)
            }
            desc.promise.then(buffer => {
                desc.buf = buffer
                const part = buffer.slice(pos, pos + len)
                part.copy(buf)
				resolve(part.length)
            })
            .catch(err => {
                console.error(err)
                if (err.statusCode === 404) {
                    return reject(fuse.ENOENT)
                }
                reject(fuse.EIO)
            })
        })
    }
    ftruncate(fd, size) {
        console.log('ftruncate', size)
        const desc = descriptors[fd]
        if (!desc) {
            return fuse.EBADF
        }
        desc.buf = desc.buf.slice(0, size)
        cache[desc.path].size = 0
        return 0
    }
    release(fd) {
        console.log('release', fd)
        delete descriptors[fd]
        return 0
    }
    releasedir(fd) {
        console.log('releasedir', fd)
        delete descriptors[fd]
        return 0
    }
    write(fd, buffer, length, position) {
        console.log('write', fd, position, length, buffer.length)
        const desc = descriptors[fd]
        if (!desc) {
            return fuse.EBADF
        }
        const newBuf = Buffer.alloc(position + length)
        desc.buf.copy(newBuf)
        buffer.copy(newBuf, position)
        desc.buf = newBuf
        const item = cache[desc.path]
        item.size = desc.buf.length
        return length
    }
    fsync(fd, datasync) {
        console.log('fsync', fd)
        return new Promise(async (resolve, reject) => {
            const desc = descriptors[fd]
            if (!desc) {
                return reject(fuse.EBADF)
            }
            const item = await this.getItem(desc.path)
            if (!item) {
                return reject(fuse.ENOENT)
            }
            this.putBuffer('/files/' + item._id, desc.buf)
                .then(() => {
                    console.log('file put', desc.buf.length)
                    item.size = desc.buf.length
                    resolve()
                })
                .catch(err => {
                    console.error(err)
                    reject(fuse.EIO)
                })
        })
    }
    flush(fd) {
        return new Promise(async (resolve, reject) => {
            const desc = descriptors[fd]
            if (!desc) {
                return reject(fuse.EBADF)
            }
            if (desc.flag === 'w') {
                const item = await this.getItem(desc.path)
                if (!item) {
                    return reject(fuse.ENOENT)
                }
                this.putBuffer('/files/' + item._id, desc.buf)
                    .then(() => {
                        console.log('file put', desc.buf.length)
                        item.size = desc.buf.length
                        resolve(0)
                    })
                    .catch(err => {
                        console.error(err)
                        reject(fuse.EIO)
                    })
            }
            else {
                resolve(0)
            }
            
        })
    }
    create(path, mode) {
        return new Promise((resolve, reject) => {
            cache[path] = {
                name: path.split('/').pop(),
                size: 0,
                isFile: true,
                updatedAt: new Date()
            }
            this.postJson('/files' + path).then((file) => {
                console.log('file created', file)
                file.isFile = true
                cache[path] = file
                const fd = descriptors.add(path, 'w')
                resolve(fd)
            })
            .catch((err) => {
                console.error(err)
                reject(fuse.ENOENT)
            })
        })
    }
    unlink(path) {
        return new Promise((resolve, reject) => {
            this.getItem(path).then(item => {
                if (item) {
                    this.del('/files/' + item._id)
                        .then(() => {
                            delete cache[path]
                            resolve(0)
                        })
                        .catch(err => {
                            console.error(err)
                            reject(fuse.EIO)
                        })
                }
                else reject(fuse.ENOENT)
            })
        })
    }
    mkdir(path, mode) {
        return new Promise((resolve, reject) => {
            this.postJson('/folders' + path)
				.then((folder) => {
					cache[path] = folder
					resolve(0)
				})
				.catch(err => {
					console.error(err)
					reject(fuse.EIO)
				})
        })
    }
    rmdir(path) {
        return new Promise((resolve, reject) => {
            this.getItem(path).then(item => {
                if (item) {
                    this.del('/folders/' + item._id + '?recurse=1')
                        .then(() => {
                            resolve(0)
                        })
                        .catch(err => {
                            console.error(err)
                            reject(fuse.EIO)
                        })
                }
                else reject(fuse.ENOENT)
            })
        })
    }
    rename(src, dest) {
        return new Promise((resolve, reject) => {
            this.getItem(src).then(item => {
                if (item) {
                    if (item.isFile) {
                        this.patch('/files/' + item._id + '?rename=' + dest)
                            .then(() => {
                                cache[dest] = {...cache[src]}
                                delete cache[src]
                                resolve(0)
                            })
                            .catch(err => {
                                console.error(err)
                                reject(fuse.EIO)
                            })
                    }
                    else {
                        this.patch('/folders' + src + '?rename=' + dest)
                            .then(() => {
                                cache[dest] = {...cache[src]}
                                delete cache[src]
                                resolve(0)
                            })
                            .catch(err => {
                                console.error(err)
                                reject(fuse.EIO)
                            })
                    }
                }
                else reject(fuse.ENOENT)
            })
        })
    }
}

module.exports = {
    FileService
}

