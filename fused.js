const fuse = require('node-fuse-bindings')
const bent = require('bent')
const backendUrl = 'http://localhost:9004'
const mountPath = process.platform !== 'win32' ? './mnt' : 'M:\\'
const cache = {}
const descriptors = {
	next: 10,
	add: function(path) {
		console.log('adding desc', this.next)
		const fd = this.next++
		this[fd] = path
		return fd
	}
}

async function authenticate(username, password) {
	const postJson = bent(backendUrl, 'POST', 'json', 200)
	return postJson('/auth/login', { username, password }).then(data => data.token)
}

function toFlag(flags) {
  flags = flags & 3
  if (flags === 0) return 'r'
  if (flags === 1) return 'w'
  return 'r+'
}


authenticate('axel', 'pass').then(token => {
	const headers = {'Authorization': `Bearer ${token}`}
	const getJson = bent(backendUrl, 'json', 200, headers)
	const getBuffer = bent(backendUrl, 'buffer', [200, 204], headers)
	const postJson = bent(backendUrl, 'POST', 'json', [200, 204], headers)
	const put = bent(backendUrl, 'PUT', [200, 204], headers)
	const patch = bent(backendUrl, 'PATCH','json', [200, 204], headers)
	const del = bent(backendUrl, 'DELETE', [200, 204], headers)

	const ops = {
		readdir: async (path, cb) => {
			console.log('readdir', path)
			const [folders, files] = await Promise.all([
				getJson('/folders/list' + path),
				getJson('/files/list' + path)
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
			cb(0, [...folders, ...files].map(i => i.name))
		},
		getattr: function (path, cb) {
			// console.log('getattr', path)
			if (path === '/') {
				return cb(0, {
					mtime: new Date(),
					atime: new Date(),
					ctime: new Date(),
					nlink: 1,
					size: 100,
					mode: 16877,
					uid: process.getuid ? process.getuid() : 0,
					gid: process.getgid ? process.getgid() : 0
				})
			}
			const item = cache[path]
			// console.log(item)
			if (item) {
				if (item.isFile) {
					return cb(0, {
						mtime: new Date(item.updatedAt),
						atime: new Date(item.updatedAt),
						ctime: new Date(item.updatedAt),
						nlink: 1,
						size: item.size,
						mode: 33188,
						uid: process.getuid ? process.getuid() : 0,
						gid: process.getgid ? process.getgid() : 0
					})
				}
				return cb(0, {
					mtime: new Date(item.updatedAt),
					atime: new Date(item.updatedAt),
					ctime: new Date(item.updatedAt),
					nlink: 1,
					size: 100,
					mode: 16877,
					uid: process.getuid ? process.getuid() : 0,
					gid: process.getgid ? process.getgid() : 0
				})
			}
			const url = '/files/info/' + path
			getJson(url.replace('//', '/')).then((file) => {
				console.log('caching')
				file.isFile = true
				cache[path] = file
				cache[path].getcontent = getBuffer('/files/download/' + file._id).then(buf => {
					console.log('got buf', buf)
					// console.log('buf',buf.toString())
					return buf
				})
				console.log('call cb')
				return cb(0, {
						mtime: new Date(file.updatedAt),
						atime: new Date(file.updatedAt),
						ctime: new Date(file.updatedAt),
						nlink: 1,
						size: file.size,
						mode: 33188,
						uid: process.getuid ? process.getuid() : 0,
						gid: process.getgid ? process.getgid() : 0
					})
			})
			.catch(err => {
				// console.error(err)
				cb(fuse.ENOENT)
			})
		},
		fgetattr: (path, fd, cb) => {
			// console.log('fgetattr', path)
			if (path === '/') {
				return cb(0, {
					mtime: new Date(),
					atime: new Date(),
					ctime: new Date(),
					nlink: 1,
					size: 100,
					mode: 16877,
					uid: process.getuid ? process.getuid() : 0,
					gid: process.getgid ? process.getgid() : 0
				})
			}
			const item = cache[path]
			if (item) {
				if (item.isFile) {
					return cb(0, {
						mtime: new Date(item.updatedAt),
						atime: new Date(item.updatedAt),
						ctime: new Date(item.updatedAt),
						nlink: 1,
						size: item.size,
						mode: 33188,
						uid: process.getuid ? process.getuid() : 0,
						gid: process.getgid ? process.getgid() : 0
					})
				}
				return cb(0, {
					mtime: new Date(item.updatedAt),
					atime: new Date(item.updatedAt),
					ctime: new Date(item.updatedAt),
					nlink: 1,
					size: 100,
					mode: 16877,
					uid: process.getuid ? process.getuid() : 0,
					gid: process.getgid ? process.getgid() : 0
				})
			}
			const url = '/files/info/' + path
			getJson(url.replace('//', '/')).then((file) => {
				// console.log('caching')
				file.isFile = true
				cache[path] = file
				cache[path].getcontent = getBuffer('/files/download/' + file._id).then(buf => {
					// console.log('got buf', buf)
					// console.log('buf',buf.toString())
					return buf
				})
				// console.log('call cb')
				return cb(0, {
						mtime: new Date(file.updatedAt),
						atime: new Date(file.updatedAt),
						ctime: new Date(file.updatedAt),
						nlink: 1,
						size: file.size,
						mode: 33188,
						uid: process.getuid ? process.getuid() : 0,
						gid: process.getgid ? process.getgid() : 0
					})
			})
			.catch(err => {
				console.error(err)
				cb(fuse.EIO)
			})
			// cb(fuse.ENOENT)
		},
		open: async function (path, flags, cb) {
			const flag = toFlag(flags)
			console.log('open(%s, %s)', path, flag)
			
			if (flag === 'w') {
				const fd = descriptors.add(path)
				return cb(0, fd)
			}
			// cache[path] = cache[path] || {}
			const url = '/files/info/' + path
			getJson(url.replace('//', '/')).then((file) => {
				const fd = descriptors.add(path)
				console.log('openeed', fd)
				file.isFile = true
				cache[path] = file
				cache[path].getcontent = getBuffer('/files/download/' + file._id).then(buf => {
					console.log('got buf', buf)
					// console.log('buf',buf.toString())
					return buf
				})
				console.log('call cb with fd')
				cb(0, fd) 
			})
			.catch(err => {
				console.error(err)
				cb(fuse.EIO)
			})
			
			
		},
		read: async function (path, fd, buf, len, pos, cb) {
			console.log('read(%s, %d, %d, %d)', path, fd, len, pos)
			
			const item = cache[path]
			if (item) {
				if (!item.size) return cb(0)
				const content = await cache[path].getcontent
				console.log('content', content)

				const part = content.slice(pos, pos + len)
				part.copy(buf)
				cb(part.length)
			}
			else {
				return cb(fuse.ENOENT)
			}
			
		},
		create: (path, mode, cb) => {
			console.log('create file')
			postJson('/files' + path).then((file) => {
				file.isFile = true
				cache[path] = file
				cb(0)
			})
			.catch((err) => {
				console.error(err)
				cb(fuse.ENOENT)
			})
		},
		access: (path, mode, cb) => {
			cb(0)
		},
		setxattr: (path, name, buffer, length, offset, flags, cb) => {
			console.log('setxattr')
			cb(0)
		},
		getxattr: (path, name, buffer, length, offset, cb) => {
			// console.log('getxattr')
			cb(0)
		},
		listxattr: (path, buffer, length, cb) => {
			console.log('listxattr')
			cb(0)
		},
		
		truncate: (path, size, cb) => {
			console.log('truncate', path)
			const item = cache[path]
			if (item) {
				console.log('truncate item')
				delete item.buf
				item.getcontent = Promise.resolve(Buffer.from(''))
				item.size = 0
				put('/files/' + item._id).then(() => cb(0))
				return
			}
			cb(0)
		},
		ftruncate: (path, fd, size, cb) => {
			console.log('ftruncate', path)
			const item = cache[path]
			if (item) {
				console.log('truncate item')
				delete item.buf
				item.getcontent = Promise.resolve(Buffer.from(''))
				item.size = 0
				put('/files/' + item._id).then(() => cb(0))
				return
			}
			cb(0)
		},
		opendir: (path, flags, cb) => {
			console.log('opendir', path)
			cb(0, 43)
		},
		releasedir: (path, fd, cb) => {
			console.log('releasedir', path)
			cb(0)
		},
		release: (path, fd, cb) => {
			console.log('release', path)
			const item = cache[path]
			if (item) {
				delete item.buf
			}
			cb(0)
		},
		flush: (path, fd, cb) => {
			console.log('flush', path)
			cb(0)
		},
		fsync: (path, fd, datasync, cb) => {
			console.log('fsync', path)
			cb(0)
		},
		fsyncdir: (path, fd, datasync, cb) => {
			console.log('fsyncdir', path)
			cb(0)
		},
		chown: (path, uid, gid, cb) => {
			console.log('chown', path)
			cb(0)
		},
		chmod: (path, mode, cb) => {
			console.log('chmod', path)
			cb(0)
		},
		mknod: (path, mode, dev, cb) => {
			console.log('mknd')
			cb(0)
		},
		readlink: (path, cb) => {
			console.log('readlink')
			cb(0)
		},
		utimens: (path, atime, mtime, cb) => {
			console.log('utimens')
			cb(0)
		},
		write: (path, fd, buffer, length, position, cb) => {
			console.log('write', length, position)
			const item = cache[path]
			if (item) {
				// console.log(buffer.toString())
				item.buf = item.buf || Buffer.from('')
				// console.log(item.buf)
				item.buf = Buffer.concat([item.buf, buffer])
				// const part = buffer.slice(0, length)
				// part.copy(item.buf)
				console.log('buff', item.buf)
				// console.log(buffer.toString())
				// console.log('buffer', part)
				put('/files/' + item._id, item.buf)
					.then(() => {
						item.size = item.buf.length
						item.getcontent = Promise.resolve(item.buf)
						console.log('written')
						cb(length)
					})
					.catch(err => {
						console.error(err)
						cb(fuse.EIO)
					})
				return
			}
			cb(fuse.ENOENT)
		},
		rmdir: (path, cb) => {
			const item = cache[path]
			if (item) {
				del('/folders/' + item._id)
					.then(() => {
						cb(0)
					})
					.catch(err => {
						console.error(err)
						cb(fuse.EIO)
					})
				return
			}
			cb(fuse.ENOENT)
		},
		mkdir: (path, mode, cb) => {
			postJson('/folders' + path)
				.then((folder) => {
					cache[path] = folder
					cb(0)
				})
				.catch(err => {
					console.error(err)
					cb(fuse.EIO)
				})
		},
		unlink: (path, cb) => {
			const item = cache[path]
			if (item) {
				del('/files/' + item._id)
					.then(() => {
						cb(0)
					})
					.catch(err => {
						console.error(err)
						cb(fuse.EIO)
					})
				return
			}
			cb(fuse.ENOENT)
			
		},
		rename: (src, dest, cb) => {
			console.log('rename')
			const item = cache[src]
			if (item) {
				if (item.isFile) {
					console.log('rename file', item)
					patch('/files/' + item._id + '?rename=' + dest)
						.then(() => {
							cb(0)
						})
						.catch(err => {
							console.error(err)
							cb(fuse.EIO)
						})
				}
				else {
					patch('/folders' + src + '?rename=' + dest)
						.then(() => {
							cb(0)
						})
						.catch(err => {
							console.error(err)
							cb(fuse.EIO)
						})
				}

				return
			}
			cb(fuse.ENOENT)
		}
	}
	ops.force = true
	fuse.mount(mountPath, ops, (err) => {
		if (err) throw err
		console.log('filesystem mounted on ' + mountPath)
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