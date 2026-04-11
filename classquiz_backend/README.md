# ClassQuiz — EdTech Backend Platform

A production-ready, microservices backend for an AI-powered exam correction and grading system for primary schools (Grades 1–6).

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          ClassQuiz System                               │
│                                                                         │
│  Admin/Client                                                           │
│      │                                                                  │
│      ▼                                                                  │
│  ┌──────────────────────────────┐                                       │
│  │     Web API Service          │  Node.js + Express + MongoDB          │
│  │  Port 3000                   │                                       │
│  │                              │  • JWT Authentication (single admin)  │
│  │  /api/auth                   │  • Student CRUD                       │
│  │  /api/students               │  • Exam management                    │
│  │  /api/exams                  │  • OCR orchestration                  │
│  │  /api/student-exams          │  • Validation workflow                │
│  │  /api/validations            │  • Evaluation trigger                 │
│  │  /api/reports                │  • PDF report generation              │
│  └──────────┬───────────────────┘                                       │
│             │  Internal HTTP                                            │
│             ▼                                                           │
│  ┌──────────────────────────────┐                                       │
│  │     AI Service               │  Python + FastAPI                     │
│  │  Port 8000 (internal only)   │                                       │
│  │                              │  • POST /ocr/extract-exam             │
│  │  Gemini 2.0 Flash            │    → Extract questions from exam      │
  │  Ollama                      │  • POST /ocr/extract-answers          │
│  │                              │    → Extract student handwriting      │
│  │                              │  • POST /evaluate/grade               │
│  │                              │    → Grade + pedagogical feedback     │
│  └──────────────────────────────┘                                       │
│                                                                         │
│  ┌──────────────────────────────┐                                       │
│  │     MongoDB                  │  Port 27017 (internal only)           │
│  │                              │                                       │
│  │  Collections:                │                                       │
│  │  • students                  │                                       │
│  │  • exams                     │                                       │
│  │  • studentexams              │                                       │
│  │  • validations               │                                       │
│  │  • batchuploads              │                                       │
│  └──────────────────────────────┘                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Workflow

```
1. Admin uploads corrected exam → Gemini OCR extracts questions/answers
                                                    │
2. Admin uploads student exams (single or batch) ──►│
                                                    │
3. Gemini OCR extracts student answers              │
                                                    ▼
4. Confidence check ──── < 70% ──────► Validation Queue
         │                                    │ Admin corrects OCR
         │ ≥ 70%                              │
         ▼                                    ▼
5. Ollama Llama3.2 grades answers ◄───────────────┘
         │
         ▼
6. Scores + feedback stored → PDF report generated
```

---

## Project Structure

```
classquiz/
├── docker-compose.yml
├── mongo-init.js
├── API_CONTRACTS.http
│
├── web-api/                        # Node.js Express API
│   ├── Dockerfile
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── server.js               # App entry point
│       ├── config/
│       │   └── database.js         # MongoDB connection
│       ├── models/
│       │   ├── Student.js
│       │   ├── Exam.js
│       │   ├── StudentExam.js
│       │   ├── Validation.js
│       │   └── BatchUpload.js
│       ├── controllers/
│       │   ├── authController.js
│       │   ├── studentController.js
│       │   ├── examController.js
│       │   ├── studentExamController.js
│       │   ├── validationController.js
│       │   └── reportController.js
│       ├── routes/
│       │   ├── auth.js
│       │   ├── students.js
│       │   ├── exams.js
│       │   ├── studentExams.js
│       │   ├── validations.js
│       │   └── reports.js
│       ├── middleware/
│       │   ├── auth.js             # JWT middleware
│       │   ├── upload.js           # Multer config
│       │   └── errorHandler.js     # Global error handler
│       └── utils/
│           ├── logger.js           # Winston logger
│           ├── response.js         # API response helpers
│           └── aiClient.js         # HTTP client for AI service
│
└── ai-service/                     # Python FastAPI AI Service
    ├── Dockerfile
    ├── requirements.txt
    ├── .env.example
    └── app/
        ├── main.py                 # FastAPI app
        ├── config.py               # Settings (pydantic)
        ├── models/
        │   └── schemas.py          # Pydantic request/response models
        ├── prompts/
        │   └── prompts.py          # OCR + evaluation prompts ⭐
        ├── services/
        │   ├── ocr_service.py      # Gemini 2.0 integration
        │   └── evaluation_service.py # Ollama Llama3.2 integration
        └── routers/
            ├── ocr.py              # /ocr endpoints
            └── evaluation.py       # /evaluate endpoints
```

---

## Quick Start

### 1. Clone & Configure

```bash
git clone <repo>
cd classquiz

# Configure Web API
cp web-api/.env.example web-api/.env
# Edit: JWT_SECRET, ADMIN_PASSWORD

# Configure AI Service
cp ai-service/.env.example ai-service/.env
# Edit: GEMINI_API_KEY
```

### 2. Start All Services

```bash
# Production
docker compose up --build -d

# Development (includes Mongo Express at :8081)
docker compose --profile dev up --build
```

### 3. Verify Health

```bash
curl http://localhost:3000/health
curl http://localhost:8000/health  # from within Docker network
```

### 4. Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@ClassQuiz2024!"}'
```

---

## Environment Variables

### Web API (`web-api/.env`)

| Variable | Description | Default |
|---|---|---|
| `JWT_SECRET` | JWT signing secret | (required) |
| `ADMIN_USERNAME` | Admin login username | `admin` |
| `ADMIN_PASSWORD` | Admin login password | (required) |
| `MONGODB_URI` | MongoDB connection string | `mongodb://mongo:27017/classquiz` |
| `AI_SERVICE_URL` | AI service base URL | `http://ai-service:8000` |
| `OCR_CONFIDENCE_THRESHOLD` | Min confidence before validation | `70` |

### AI Service (`ai-service/.env`)

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API key |
| `GEMINI_VERTEXAI` | Enable Vertex mode for `google-genai` client (`true`/`false`, default `true`) |
| `GEMINI_MODEL` | Gemini model name (`gemini-2.0-flash`) |
| `OLLAMA_BASE_URL` | Ollama server URL (`http://localhost:11434`) |
| `OLLAMA_MODEL` | Ollama model name (`llama3.2`) |

---

## Key Design Decisions

1. **Async OCR & Evaluation** — Long-running AI operations run in the background. Clients poll status via GET endpoints rather than blocking on upload.

2. **Confidence-based Validation Loop** — Any OCR answer below 70% confidence is flagged for human review before evaluation. Admin corrections override OCR output cleanly.

3. **Structured AI Prompts** — Both prompts enforce JSON-only output with explicit schemas, reducing parsing failures. Temperature is set very low (0.05–0.1) for deterministic extraction.

4. **Retry with Tenacity** — Both Gemini and Ollama calls retry on JSON parse errors (transient model output issues) up to 3 times.

5. **Single Admin Architecture** — EdTech platform for classrooms; JWT-based single-admin design avoids complexity of multi-user RBAC.

6. **Separation of AI and Business Logic** — The AI service has zero knowledge of MongoDB; it only receives images/text and returns structured JSON. All business state lives in the web-api.
