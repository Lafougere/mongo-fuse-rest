const libfuse = require('fuse-shared-library-darwin')
 
console.log(libfuse.lib) // path to the shared library
console.log(libfuse.include) // path to the include folder
 
// tells you if libfuse has been configured on this machine
libfuse.isConfigured(function (err, yes) {
    console.log(err)
    console.log(yes)
 })
 
// configure libfuse on this machine (requires root access)
// but only needs to run once
libfuse.configure(function (err) {
    console.log(err)
 })
 
// unconfigures libfuse on this machine
//libfuse.unconfigure(function (err) { })