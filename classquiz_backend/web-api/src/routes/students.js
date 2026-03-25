const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const { createStudent, getStudents, getStudent, updateStudent, deleteStudent, getStudentPerformance, importCSV } = require('../controllers/studentController');

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (['text/csv', 'application/vnd.ms-excel', 'text/plain'].includes(file.mimetype) || file.originalname.endsWith('.csv')) cb(null, true);
    else cb(new Error('Only CSV files are allowed'), false);
  },
});

router.use(authenticate);

router.route('/').get(getStudents).post(createStudent);
router.post('/import-csv', csvUpload.single('file'), importCSV);
router.route('/:id').get(getStudent).put(updateStudent).delete(deleteStudent);
router.get('/:id/performance', getStudentPerformance);

module.exports = router;