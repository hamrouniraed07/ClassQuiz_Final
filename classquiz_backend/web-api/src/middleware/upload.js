const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024; // 10MB

// Ensure directories exist
['exams', 'student-exams', 'temp'].forEach((dir) => {
  const fullPath = path.join(UPLOAD_DIR, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

const allowedMimeTypes = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/tiff',
];

const fileFilter = (req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: JPEG, PNG, WebP, TIFF`), false);
  }
};

/**
 * Create storage engine for a given subdirectory
 */
const createStorage = (subdir) =>
  multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, path.join(UPLOAD_DIR, subdir));
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${uuidv4()}${ext}`);
    },
  });

// Exam images uploader (corrected + blank)
const examImageUpload = multer({
  storage: createStorage('exams'),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

// Student exam uploader (single)
const studentExamUpload = multer({
  storage: createStorage('student-exams'),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

// Batch upload (multiple student exams)
const batchUpload = multer({
  storage: createStorage('student-exams'),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 50, // Max 50 student exams per batch
  },
  fileFilter,
});

module.exports = { examImageUpload, studentExamUpload, batchUpload };
