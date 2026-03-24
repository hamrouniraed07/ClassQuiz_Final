const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const {
  createStudent,
  getStudents,
  getStudent,
  updateStudent,
  deleteStudent,
  getStudentPerformance,
  importCSV,
} = require('../controllers/studentController');

// CSV upload: store in memory buffer (not disk) — multer is already a project dependency
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max for CSV
  fileFilter: (req, file, cb) => {
    const allowed = ['text/csv', 'application/vnd.ms-excel', 'text/plain'];
    if (allowed.includes(file.mimetype) || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  },
});

router.use(authenticate);

router.route('/')
  .get(getStudents)
  .post(createStudent);

// IMPORTANT: /import-csv MUST be before /:id so Express doesn't match "import-csv" as an :id
router.post('/import-csv', csvUpload.single('file'), importCSV);

router.route('/:id')
  .get(getStudent)
  .put(updateStudent)
  .delete(deleteStudent);

router.get('/:id/performance', getStudentPerformance);

module.exports = router;