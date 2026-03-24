# ClassQuiz API Contracts
# Complete request/response examples for all endpoints
# Base URL: http://localhost:3000/api

# ═══════════════════════════════════════════════════════════════════════════════
# AUTH
# ═══════════════════════════════════════════════════════════════════════════════

### POST /api/auth/login
# Request
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "Admin@ClassQuiz2024!"
}

# Response 200
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "7d",
    "user": { "username": "admin", "role": "admin" }
  },
  "timestamp": "2024-12-15T10:00:00.000Z"
}

# Response 401
{
  "success": false,
  "message": "Invalid credentials",
  "timestamp": "2024-12-15T10:00:00.000Z"
}

---

### GET /api/auth/me
Authorization: Bearer <token>

# Response 200
{
  "success": true,
  "message": "Authenticated",
  "data": {
    "user": { "username": "admin", "role": "admin", "iat": 1734255600, "exp": 1734860400 }
  },
  "timestamp": "2024-12-15T10:00:00.000Z"
}


# ═══════════════════════════════════════════════════════════════════════════════
# STUDENTS
# ═══════════════════════════════════════════════════════════════════════════════

### POST /api/students
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Ahmed Ben Ali",
  "code": "STU-2024-001",
  "class": 3
}

# Response 201
{
  "success": true,
  "message": "Student created successfully",
  "data": {
    "_id": "6759a1b2c3d4e5f6a7b8c9d0",
    "name": "Ahmed Ben Ali",
    "code": "STU-2024-001",
    "class": 3,
    "isActive": true,
    "createdAt": "2024-12-15T10:05:00.000Z",
    "updatedAt": "2024-12-15T10:05:00.000Z"
  },
  "timestamp": "2024-12-15T10:05:00.000Z"
}

---

### GET /api/students?class=3&page=1&limit=10
Authorization: Bearer <token>

# Response 200
{
  "success": true,
  "message": "Success",
  "data": {
    "students": [
      {
        "_id": "6759a1b2c3d4e5f6a7b8c9d0",
        "name": "Ahmed Ben Ali",
        "code": "STU-2024-001",
        "class": 3,
        "isActive": true,
        "createdAt": "2024-12-15T10:05:00.000Z"
      }
    ],
    "pagination": {
      "total": 28,
      "page": 1,
      "limit": 10,
      "pages": 3
    }
  },
  "timestamp": "2024-12-15T10:06:00.000Z"
}

---

### GET /api/students/:id/performance
Authorization: Bearer <token>

# Response 200
{
  "success": true,
  "data": {
    "student": { "_id": "...", "name": "Ahmed Ben Ali", "code": "STU-2024-001", "class": 3 },
    "performance": {
      "totalExams": 4,
      "averagePercentage": 72.5,
      "exams": [
        {
          "_id": "...",
          "exam": { "title": "Mid-Term Math", "subject": "Mathematics", "class": 3 },
          "totalScore": 14.5,
          "maxPossibleScore": 20,
          "percentage": 72.5,
          "grade": "B",
          "evaluatedAt": "2024-12-10T14:00:00.000Z"
        }
      ]
    }
  },
  "timestamp": "2024-12-15T10:07:00.000Z"
}


# ═══════════════════════════════════════════════════════════════════════════════
# EXAMS
# ═══════════════════════════════════════════════════════════════════════════════

### POST /api/exams  (multipart/form-data)
Authorization: Bearer <token>
Content-Type: multipart/form-data

Fields:
  title         = "Mid-Term Mathematics Exam"
  subject       = "Mathematics"
  class         = 3
  correctedExam = [file: corrected_page1.jpg, corrected_page2.jpg]
  blankExam     = [file: blank_page1.jpg]

# Response 201
{
  "success": true,
  "message": "Exam created. OCR processing started.",
  "data": {
    "_id": "6759b2c3d4e5f6a7b8c9d0e1",
    "title": "Mid-Term Mathematics Exam",
    "subject": "Mathematics",
    "class": 3,
    "totalScore": 0,
    "questions": [],
    "status": "processing",
    "correctedExamImages": [
      { "path": "uploads/exams/uuid1.jpg", "originalName": "corrected_page1.jpg", "uploadedAt": "..." },
      { "path": "uploads/exams/uuid2.jpg", "originalName": "corrected_page2.jpg", "uploadedAt": "..." }
    ],
    "createdAt": "2024-12-15T10:10:00.000Z"
  },
  "timestamp": "2024-12-15T10:10:00.000Z"
}

# After OCR completes, GET /api/exams/:id returns:
{
  "success": true,
  "data": {
    "_id": "6759b2c3d4e5f6a7b8c9d0e1",
    "title": "Mid-Term Mathematics Exam",
    "subject": "Mathematics",
    "class": 3,
    "totalScore": 20,
    "status": "active",
    "ocrProcessedAt": "2024-12-15T10:11:30.000Z",
    "questions": [
      {
        "number": 1,
        "text": "What is 15 × 8?",
        "correctAnswer": "120",
        "maxScore": 2,
        "type": "short_answer"
      },
      {
        "number": 2,
        "text": "Solve for x: 3x + 7 = 22",
        "correctAnswer": "x = 5",
        "maxScore": 3,
        "type": "short_answer"
      },
      {
        "number": 3,
        "text": "What is the area of a rectangle with length 8cm and width 5cm?",
        "correctAnswer": "40 cm²",
        "maxScore": 2,
        "type": "short_answer"
      }
    ]
  }
}


# ═══════════════════════════════════════════════════════════════════════════════
# STUDENT EXAMS — Single Upload
# ═══════════════════════════════════════════════════════════════════════════════

### POST /api/student-exams  (multipart/form-data)
Authorization: Bearer <token>
Content-Type: multipart/form-data

Fields:
  studentId  = "6759a1b2c3d4e5f6a7b8c9d0"
  examId     = "6759b2c3d4e5f6a7b8c9d0e1"
  examImage  = [file: ahmed_exam.jpg]

# Response 201
{
  "success": true,
  "message": "Student exam uploaded. OCR processing started.",
  "data": {
    "_id": "6759c3d4e5f6a7b8c9d0e1f2",
    "student": "6759a1b2c3d4e5f6a7b8c9d0",
    "exam": "6759b2c3d4e5f6a7b8c9d0e1",
    "examImagePath": "uploads/student-exams/uuid3.jpg",
    "maxPossibleScore": 20,
    "status": "uploaded",
    "answers": [],
    "createdAt": "2024-12-15T10:15:00.000Z"
  }
}

# After OCR (confidence above threshold) → status = "ocr_done":
{
  "_id": "6759c3d4e5f6a7b8c9d0e1f2",
  "status": "ocr_done",
  "ocrConfidenceAvg": 87.3,
  "requiresValidation": false,
  "answers": [
    { "questionNumber": 1, "extractedText": "120", "confidenceScore": 95.2, "maxScore": 2 },
    { "questionNumber": 2, "extractedText": "x = 5", "confidenceScore": 88.1, "maxScore": 3 },
    { "questionNumber": 3, "extractedText": "40 cm2", "confidenceScore": 78.6, "maxScore": 2 }
  ]
}

# After OCR (confidence BELOW threshold) → status = "validation_pending":
{
  "_id": "6759c3d4e5f6a7b8c9d0e1f2",
  "status": "validation_pending",
  "ocrConfidenceAvg": 55.4,
  "requiresValidation": true,
  "answers": [
    { "questionNumber": 1, "extractedText": "120", "confidenceScore": 92.0, "maxScore": 2 },
    { "questionNumber": 2, "extractedText": "x = ?", "confidenceScore": 38.5, "maxScore": 3 },
    { "questionNumber": 3, "extractedText": "", "confidenceScore": 22.1, "maxScore": 2 }
  ]
}


# ═══════════════════════════════════════════════════════════════════════════════
# STUDENT EXAMS — Batch Upload
# ═══════════════════════════════════════════════════════════════════════════════

### POST /api/student-exams/batch  (multipart/form-data)
Authorization: Bearer <token>
Content-Type: multipart/form-data

Fields:
  examId      = "6759b2c3d4e5f6a7b8c9d0e1"
  mappings    = '[{"studentId":"6759a1b2...","fileName":"ahmed.jpg"},{"studentId":"6759a1c3...","fileName":"sara.jpg"}]'
  examImages  = [file: ahmed.jpg, file: sara.jpg]

# Response 201
{
  "success": true,
  "message": "Batch upload created. Processing started.",
  "data": {
    "_id": "6759d4e5f6a7b8c9d0e1f2a3",
    "exam": "6759b2c3d4e5f6a7b8c9d0e1",
    "totalCount": 2,
    "successCount": 0,
    "failedCount": 0,
    "pendingCount": 2,
    "status": "created",
    "createdAt": "2024-12-15T10:20:00.000Z"
  }
}

### GET /api/student-exams/batch/:batchId
# Response after processing
{
  "data": {
    "_id": "6759d4e5f6a7b8c9d0e1f2a3",
    "exam": { "title": "Mid-Term Mathematics Exam", "subject": "Mathematics" },
    "totalCount": 2,
    "successCount": 2,
    "failedCount": 0,
    "status": "completed",
    "completedAt": "2024-12-15T10:21:15.000Z",
    "items": [
      {
        "studentId": { "name": "Ahmed Ben Ali", "code": "STU-2024-001" },
        "status": "success",
        "studentExamId": { "status": "ocr_done", "ocrConfidenceAvg": 87.3 }
      }
    ]
  }
}


# ═══════════════════════════════════════════════════════════════════════════════
# VALIDATIONS
# ═══════════════════════════════════════════════════════════════════════════════

### GET /api/validations?status=pending
Authorization: Bearer <token>

# Response 200
{
  "data": {
    "validations": [
      {
        "_id": "6759e5f6a7b8c9d0e1f2a3b4",
        "student": { "name": "Ahmed Ben Ali", "code": "STU-2024-001", "class": 3 },
        "exam": { "title": "Mid-Term Mathematics Exam", "subject": "Mathematics" },
        "studentExam": {
          "examImagePath": "uploads/student-exams/uuid3.jpg",
          "ocrConfidenceAvg": 55.4
        },
        "flaggedAnswers": [
          { "questionNumber": 2, "extractedText": "x = ?", "confidenceScore": 38.5 },
          { "questionNumber": 3, "extractedText": "", "confidenceScore": 22.1 }
        ],
        "status": "pending",
        "createdAt": "2024-12-15T10:16:00.000Z"
      }
    ],
    "pagination": { "total": 5, "page": 1, "limit": 20, "pages": 1 }
  }
}

---

### POST /api/validations/:id/review
Authorization: Bearer <token>
Content-Type: application/json

{
  "corrections": [
    {
      "questionNumber": 2,
      "correctedText": "x = 5"
    },
    {
      "questionNumber": 3,
      "correctedText": "40 cm²"
    }
  ],
  "notes": "Handwriting was smudged on bottom half of page"
}

# Response 200
{
  "success": true,
  "message": "Review submitted and corrections applied",
  "data": {
    "_id": "6759e5f6a7b8c9d0e1f2a3b4",
    "status": "completed",
    "correctionCount": 2,
    "reviewedBy": "admin",
    "reviewedAt": "2024-12-15T10:30:00.000Z"
  }
}


# ═══════════════════════════════════════════════════════════════════════════════
# EVALUATION
# ═══════════════════════════════════════════════════════════════════════════════

### POST /api/student-exams/:id/evaluate
Authorization: Bearer <token>

# Response 200
{
  "success": true,
  "message": "Evaluation started"
}

# GET /api/student-exams/:id after evaluation completes:
{
  "data": {
    "_id": "6759c3d4e5f6a7b8c9d0e1f2",
    "status": "evaluated",
    "totalScore": 6.5,
    "maxPossibleScore": 20,
    "percentage": 32.5,
    "grade": "F",
    "evaluatedAt": "2024-12-15T10:35:00.000Z",
    "answers": [
      {
        "questionNumber": 1,
        "extractedText": "120",
        "correctedText": null,
        "confidenceScore": 95.2,
        "score": 2,
        "maxScore": 2,
        "feedback": "Excellent! Perfect answer.",
        "mistakeType": "correct",
        "evaluatedAt": "2024-12-15T10:35:01.000Z"
      },
      {
        "questionNumber": 2,
        "extractedText": "x = ?",
        "correctedText": "x = 5",
        "confidenceScore": 38.5,
        "score": 3,
        "maxScore": 3,
        "feedback": "Correct! Good algebra work.",
        "mistakeType": "correct",
        "evaluatedAt": "2024-12-15T10:35:01.000Z"
      },
      {
        "questionNumber": 3,
        "extractedText": "40 cm2",
        "correctedText": null,
        "confidenceScore": 78.6,
        "score": 1.5,
        "maxScore": 2,
        "feedback": "You correctly calculated the area (40). Remember to include the correct unit: cm² not cm2.",
        "mistakeType": "partial",
        "evaluatedAt": "2024-12-15T10:35:01.000Z"
      }
    ]
  }
}


# ═══════════════════════════════════════════════════════════════════════════════
# REPORTS
# ═══════════════════════════════════════════════════════════════════════════════

### POST /api/reports/generate/:studentExamId
Authorization: Bearer <token>

# Response 200
{
  "success": true,
  "message": "Report generated",
  "data": {
    "reportPath": "/reports/report_6759c3d4e5f6a7b8c9d0e1f2.pdf",
    "generatedAt": "2024-12-15T10:40:00.000Z"
  }
}

### GET /api/reports/download/:studentExamId
# → Streams PDF file as application/pdf

### GET /api/reports/exam/:examId
{
  "data": {
    "exam": { "_id": "...", "title": "Mid-Term Mathematics Exam", "subject": "Mathematics", "class": 3 },
    "summary": {
      "totalStudents": 28,
      "averagePercentage": 68.4,
      "highestScore": 95.0,
      "lowestScore": 20.0,
      "passRate": 75,
      "gradeDistribution": { "A": 4, "B": 9, "C": 8, "D": 4, "F": 3 }
    },
    "students": [
      { "student": { "name": "Sara Mbarek", "code": "STU-2024-012" }, "percentage": 95.0, "grade": "A" },
      { "student": { "name": "Ahmed Ben Ali", "code": "STU-2024-001" }, "percentage": 72.5, "grade": "B" }
    ]
  }
}


# ═══════════════════════════════════════════════════════════════════════════════
# AI SERVICE CONTRACTS (internal — called by web-api only)
# Base URL: http://ai-service:8000
# ═══════════════════════════════════════════════════════════════════════════════

### POST /ocr/extract-exam  (multipart/form-data)
corrected_images: [file1.jpg, file2.jpg]
blank_images: [blank.jpg]  (optional)

# Response 200
{
  "questions": [
    { "number": 1, "text": "What is 15 × 8?", "correct_answer": "120", "max_score": 2.0, "type": "short_answer" },
    { "number": 2, "text": "Solve for x: 3x + 7 = 22", "correct_answer": "x = 5", "max_score": 3.0, "type": "short_answer" }
  ],
  "total_score": 20.0,
  "confidence_score": 91.5,
  "page_count": 2,
  "notes": null
}

---

### POST /ocr/extract-answers  (multipart/form-data)
student_exam_image: ahmed.jpg
questions: '[{"number":1,"text":"What is 15 × 8?","type":"short_answer"},...]'
exam_id: "6759b2c3..."  (optional)

# Response 200
{
  "answers": [
    { "question_number": 1, "extracted_text": "120", "confidence_score": 95.2 },
    { "question_number": 2, "extracted_text": "x = ?", "confidence_score": 38.5 },
    { "question_number": 3, "extracted_text": "40 cm2", "confidence_score": 78.6 }
  ],
  "overall_confidence": 70.8,
  "student_name_detected": "Ahmed Ben Ali",
  "exam_id_detected": null
}

---

### POST /evaluate/grade  (application/json)
{
  "student_exam_id": "6759c3d4e5f6a7b8c9d0e1f2",
  "questions": [
    { "number": 1, "text": "What is 15 × 8?", "correct_answer": "120", "max_score": 2.0, "type": "short_answer" },
    { "number": 2, "text": "Solve for x: 3x + 7 = 22", "correct_answer": "x = 5", "max_score": 3.0, "type": "short_answer" },
    { "number": 3, "text": "Area of rectangle 8cm × 5cm?", "correct_answer": "40 cm²", "max_score": 2.0, "type": "short_answer" }
  ],
  "student_answers": [
    { "question_number": 1, "answer_text": "120", "max_score": 2.0 },
    { "question_number": 2, "answer_text": "x = 5", "max_score": 3.0 },
    { "question_number": 3, "answer_text": "40 cm2", "max_score": 2.0 }
  ]
}

# Response 200
{
  "student_exam_id": "6759c3d4e5f6a7b8c9d0e1f2",
  "results": [
    {
      "question_number": 1,
      "score": 2.0,
      "max_score": 2.0,
      "mistake_type": "correct",
      "feedback": "Excellent! Perfect multiplication.",
      "is_correct": true
    },
    {
      "question_number": 2,
      "score": 3.0,
      "max_score": 3.0,
      "mistake_type": "correct",
      "feedback": "Well done! Correct algebraic solution.",
      "is_correct": true
    },
    {
      "question_number": 3,
      "score": 1.5,
      "max_score": 2.0,
      "mistake_type": "partial",
      "feedback": "Great job calculating the area! Just remember to write cm² (with the superscript) not cm2.",
      "is_correct": false
    }
  ],
  "total_score": 6.5,
  "max_possible_score": 7.0,
  "percentage": 92.86,
  "overall_feedback": "Excellent performance! You demonstrated strong understanding of multiplication and algebra. Pay attention to notation details like units."
}
