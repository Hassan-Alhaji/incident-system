const multer = require('multer');

// Configure storage to memory so we get the file buffer
const storage = multer.memoryStorage();

const dbUpload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

module.exports = dbUpload;
