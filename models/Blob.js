const { createModel } =  require('mongoose-gridfs')

const Blob = createModel({
    modelName: 'blob'
})

module.exports = Blob