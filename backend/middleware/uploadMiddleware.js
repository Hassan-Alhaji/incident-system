const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// B1: Magic bytes map — verifies actual file content (not just the declared MIME type)
// Prevents MIME spoofing: e.g. renaming a .exe to .jpg and uploading it
const MAGIC_BYTES = {
    'image/jpeg':   [Buffer.from([0xFF, 0xD8, 0xFF])],
    'image/png':    [Buffer.from([0x89, 0x50, 0x4E, 0x47])],
    'image/webp':   [Buffer.from('RIFF'), Buffer.from('WEBP')],  // RIFF....WEBP
    'image/gif':    [Buffer.from('GIF87a'), Buffer.from('GIF89a')],
    'application/pdf': [Buffer.from('%PDF')],
    'application/msword': [Buffer.from([0xD0, 0xCF, 0x11, 0xE0])],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [Buffer.from([0x50, 0x4B, 0x03, 0x04])],
    'application/vnd.ms-excel': [Buffer.from([0xD0, 0xCF, 0x11, 0xE0])],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [Buffer.from([0x50, 0x4B, 0x03, 0x04])],
};

const ALLOWED_MIMES = Object.keys(MAGIC_BYTES);

const verifyMagicBytes = (buffer, mimeType) => {
    const signatures = MAGIC_BYTES[mimeType];
    if (!signatures) return false;
    for (const sig of signatures) {
        if (mimeType === 'image/webp') {
            // WEBP: starts with RIFF and has WEBP at offset 8
            if (buffer.slice(0, 4).equals(Buffer.from('RIFF')) &&
                buffer.slice(8, 12).equals(Buffer.from('WEBP'))) return true;
        } else {
            if (buffer.slice(0, sig.length).equals(sig)) return true;
        }
    }
    return false;
};

// Configure storage — use memory storage so we can inspect bytes before saving
const storage = multer.memoryStorage();

// File filter: checks declared MIME first (fast reject)
const fileFilter = (req, file, cb) => {
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
        return cb(new Error('نوع الملف غير مدعوم. يُقبل فقط: الصور، PDF، Word، Excel.\nFile type not allowed. Only images, PDF, Word, and Excel are accepted.'), false);
    }
    cb(null, true);
};

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
    fileFilter,
});

module.exports = { upload, verifyMagicBytes, ALLOWED_MIMES };
