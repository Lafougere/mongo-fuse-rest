const fs = require('fs')

const stat = fs.statSync('./app.js')
console.log(stat)
console.log(parseInt(stat.mode.toString(8), 10))

const stat2 = fs.statSync('./mnt')
console.log(stat2)
// fs.writeFileSync('./mnt/tst/bleb.txt', 'bleb',  'utf8',function (err) {
//     console.log(err)
// })