# ClassQuiz - AI-Powered EdTech Platform

A comprehensive, production-ready examination correction and grading system for primary schools (Grades 1–6), leveraging AI for automated OCR, handwriting recognition, and intelligent grading with pedagogical feedback.

## 🏗️ Architecture Overview

ClassQuiz is a microservices-based platform consisting of:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           ClassQuiz System                               │
│                                                                         │
│  ┌──────────────┐                                                        │
│  │   Frontend   │  React + TypeScript + Vite + Tailwind CSS             │
│  │   (Port 80)  │  - Admin Dashboard                                     │
│  └──────┬───────┘  - Student Management                                  │
│         │          - Exam Upload & Validation                            │
│         │          - Reports & Analytics                                 │
│         ▼          - WhatsApp Integration                                │
│  ┌──────────────┐                                                        │
│  │   Web API    │  Node.js + Express + MongoDB (Port 3000)               │
│  │              │  - JWT Authentication (multi-admin)                   │
│  │              │  - Student CRUD Operations                              │
│  │              │  - Exam Management                                      │
│  │              │  - OCR Orchestration                                   │
│  │              │  - Validation Workflow                                │
│  │              │  - Evaluation Trigger                                   │
│  │              │  - PDF Report Generation                                │
│  └──────┬───────┘                                                        │
│         │                                                                │
│         ├──────────────────┐                                              │
│         │                  │                                              │
│         ▼                  ▼                                              │
│  ┌──────────────┐  ┌──────────────┐                                      │
│  │  AI Service  │  │WhatsApp Agent│  Node.js + Express (Port 4000)       │
│  │  (Port 8000) │  │              │  - WAHA Webhook Receiver              │
│  │              │  │              │  - WAHA Integration                   │
│  │  Python +    │  │              │  - Session Management                 │
│  │  FastAPI     │  │              │  - Admin Dashboard                   │
│  │              │  │              │  - File Upload to ClassQuiz          │
│  │  - Gemini    │  └──────────────┘                                      │
│  │    2.5 Flash │                                                        │
│  │  - Ollama    │  ┌──────────────┐                                      │
│  │    Llama3.2  │  │    WAHA      │  WhatsApp HTTP API (Port 3001)        │
│  │              │  │              │  - Session Management                 │
│  │  - OCR       │  │              │  - Message Sending                   │
│  │  - Grading   │  │              │  - Media Handling                     │
│  └──────────────┘  └──────────────┘                                      │
│         │                                                                │
│         ▼                                                                │
│  ┌──────────────┐                                                        │
│  │   MongoDB    │  Port 27017                                            │
│  │              │                                                        │
│  │  Collections: │                                                        │
│  │  - students  │                                                        │
│  │  - exams     │                                                        │
│  │  - studentexams│                                                       │
│  │  - validations│                                                       │
│  │  - batchuploads│                                                       │
│  │  - admins    │                                                        │
│  │  - sessions  │                                                        │
│  └──────────────┘                                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [API Documentation](#api-documentation)
- [Workflow](#workflow)
- [Development](#development)
- [Deployment](#deployment)
- [Contributing](#contributing)

## ✨ Features

### Core Functionality
- **AI-Powered OCR**: Extract questions and answers from exam papers using Google Gemini 2.5 Flash
- **Handwriting Recognition**: Automatically transcribe student handwriting from exam images
- **Intelligent Grading**: Grade answers using Ollama Llama3.2 with pedagogical feedback
- **Confidence-Based Validation**: Flag low-confidence OCR results for human review
- **Batch Processing**: Upload and process multiple student exams at once
- **PDF Report Generation**: Generate detailed individual student reports
- **Analytics Dashboard**: Track class performance with charts and statistics

### WhatsApp Integration
- **Parent Submission**: Parents can submit exam photos via WhatsApp
- **Automatic Processing**: Agent automatically triggers OCR and grading pipeline
- **Session Management**: Multi-session support with WAHA
- **Admin Dashboard**: Monitor and manage WhatsApp sessions

### User Experience
- **Modern UI**: Glass-morphism design with smooth animations
- **Responsive**: Works on desktop and mobile devices
- **RTL Support**: Full Arabic language support
- **Real-time Updates**: Live status tracking for processing tasks

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: Zustand (auth), TanStack Query v5 (server state)
- **Routing**: React Router DOM
- **UI Components**: Radix UI, shadcn/ui
- **Animations**: Framer Motion
- **Charts**: Recharts
- **Forms**: React Hook Form + Zod
- **HTTP Client**: Axios

### Backend Services

#### Web API (Node.js)
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT with bcrypt
- **File Upload**: Multer
- **PDF Generation**: PDFKit
- **Logging**: Winston
- **Validation**: express-validator

#### AI Service (Python)
- **Framework**: FastAPI
- **OCR**: Google Gemini 2.5 Flash
- **Grading**: Ollama Llama3.2
- **Image Processing**: Pillow
- **HTTP Client**: httpx
- **Retry Logic**: Tenacity
- **Logging**: structlog

#### WhatsApp Agent (Node.js)
- **Framework**: Express.js
- **WhatsApp Integration**: WAHA (devlikeapro/waha)
- **Session Management**: Custom session store
- **Scheduling**: node-cron
- **HTTP Client**: Axios

### Infrastructure
- **Containerization**: Docker & Docker Compose
- **Database**: MongoDB 7.0
- **Reverse Proxy**: Nginx (frontend)
- **Health Checks**: Custom health endpoints

## 📁 Project Structure

```
ClassQuiz/
├── classquiz-frontend/              # React Frontend Application
│   ├── public/                     # Static assets
│   ├── src/
│   │   ├── components/            # Reusable UI components
│   │   ├── pages/                 # Page components
│   │   │   ├── auth/             # Login pages
│   │   │   ├── dashboard/        # Admin dashboard
│   │   │   ├── students/         # Student management
│   │   │   ├── exams/            # Exam management
│   │   │   ├── batch/            # Batch upload wizard
│   │   │   ├── validation/       # OCR validation queue
│   │   │   ├── reports/          # Reports & analytics
│   │   │   └── whatsapp/         # WhatsApp integration
│   │   ├── hooks/                # Custom React hooks
│   │   ├── lib/                  # Utility libraries
│   │   ├── store/                # Zustand stores
│   │   ├── types/                # TypeScript types
│   │   ├── constants/            # Application constants
│   │   ├── App.tsx               # Main app component
│   │   └── main.tsx              # Entry point
│   ├── Dockerfile                # Frontend Docker image
│   ├── package.json              # Frontend dependencies
│   └── README.md                 # Frontend documentation
│
├── classquiz_backend/             # Backend Services
│   ├── web-api/                   # Main Web API Service
│   │   ├── src/
│   │   │   ├── config/           # Database configuration
│   │   │   ├── controllers/      # Route controllers
│   │   │   ├── middleware/       # Express middleware
│   │   │   ├── models/           # Mongoose models
│   │   │   ├── routes/           # API routes
│   │   │   ├── utils/            # Utility functions
│   │   │   └── server.js         # Express app entry
│   │   ├── uploads/              # File upload directory
│   │   ├── Dockerfile            # Web API Docker image
│   │   ├── package.json          # Web API dependencies
│   │   └── .env.example          # Environment variables template
│   │
│   ├── ai-service/                # AI Processing Service
│   │   ├── app/
│   │   │   ├── main.py           # FastAPI app entry
│   │   │   ├── config.py         # Configuration settings
│   │   │   ├── models/           # Pydantic schemas
│   │   │   ├── prompts/          # AI prompts
│   │   │   ├── services/         # AI services (OCR, evaluation)
│   │   │   └── routers/          # API routers
│   │   ├── Dockerfile            # AI Service Docker image
│   │   ├── requirements.txt      # Python dependencies
│   │   └── .env.example          # Environment variables template
│   │
│   ├── whatsapp-agent/            # WhatsApp Integration Service
│   │   ├── src/
│   │   │   ├── config/           # Configuration
│   │   │   ├── controllers/      # Route controllers
│   │   │   ├── middleware/       # Express middleware
│   │   │   ├── models/           # Mongoose models
│   │   │   ├── routes/           # API routes
│   │   │   ├── utils/            # Utility functions
│   │   │   └── server.js         # Express app entry
│   │   ├── uploads/              # File upload directory
│   │   ├── Dockerfile            # WhatsApp Agent Docker image
│   │   ├── package.json          # WhatsApp Agent dependencies
│   │   └── .env.example          # Environment variables template
│   │
│   ├── docker-compose.yml         # Multi-service orchestration
│   ├── mongo-init.js             # MongoDB initialization script
│   ├── API_CONTRACTS.md          # Complete API documentation
│   └── README.md                 # Backend documentation
│
└── README.md                      # This file
```

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose
- Git
- (For local development) Node.js 18+, Python 3.11+

### 1. Clone the Repository

```bash
git clone <repository-url>
cd ClassQuiz
```

### 2. Configure Environment Variables

```bash
# Configure Web API
cp classquiz_backend/web-api/.env.example classquiz_backend/web-api/.env
# Edit: JWT_SECRET, MONGODB_URI, AI_SERVICE_URL

# Configure AI Service
cp classquiz_backend/ai-service/.env.example classquiz_backend/ai-service/.env
# Edit: GEMINI_API_KEY, OLLAMA_BASE_URL

# Configure WhatsApp Agent
cp classquiz_backend/whatsapp-agent/.env.example classquiz_backend/whatsapp-agent/.env
# Edit: WAHA_URL, WAHA_API_KEY, CLASSQUIZ_API_TOKEN, AGENT_ADMIN_API_KEY
```

### 3. Start All Services

```bash
# Production mode
docker compose -f classquiz_backend/docker-compose.yml up --build -d

# Development mode (includes Mongo Express at :8081)
docker compose -f classquiz_backend/docker-compose.yml --profile dev up --build
```

### 4. Build and Start Frontend

```bash
cd classquiz-frontend
npm install
npm run build
docker build -t classquiz-frontend .
docker run -p 80:80 classquiz-frontend
```

### 5. Access the Application

- **Frontend**: http://localhost
- **Web API**: http://localhost:3000
- **AI Service**: http://localhost:8000 (internal only)
- **WhatsApp Agent**: http://localhost:4000
- **WAHA Dashboard**: http://localhost:3001
- **Mongo Express** (dev only): http://localhost:8081

### 6. Initial Setup

1. Register the first admin account via the API
2. Login to the frontend dashboard
3. Create student records
4. Upload your first exam
5. Start grading!

## ⚙️ Configuration

### Web API Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `JWT_SECRET` | JWT signing secret | - | Yes |
| `MONGODB_URI` | MongoDB connection string | `mongodb://mongo:27017/classquiz` | No |
| `AI_SERVICE_URL` | AI service base URL | `http://ai-service:8000` | No |
| `OCR_CONFIDENCE_THRESHOLD` | Min confidence before validation | `70` | No |
| `NODE_ENV` | Environment | `production` | No |
| `PORT` | Server port | `3000` | No |

### AI Service Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `GEMINI_API_KEY` | Google Gemini API key | - | Yes |
| `GEMINI_VERTEXAI` | Enable Vertex mode | `true` | No |
| `GEMINI_MODEL` | Gemini model name | `gemini-2.0-flash` | No |
| `OLLAMA_BASE_URL` | Ollama server URL | `http://host.docker.internal:11434` | No |
| `OLLAMA_MODEL` | Ollama model name | `llama3.2:3b` | No |
| `PORT` | Server port | `8000` | No |
| `ENV` | Environment | `production` | No |

### WhatsApp Agent Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `WA_PROVIDER` | WhatsApp provider (`waha`) | `waha` | No |
| `WAHA_URL` | WAHA internal service URL (Docker network) | `http://waha:3000` | No |
| `WAHA_API_KEY` | WAHA API key | `change_this_secret` | Yes |
| `WAHA_SESSION` | WAHA session name | `default` | No |
| `PHOTO_WAIT_SECONDS` | Wait window after last incoming photo | `20` | No |
| `MONGODB_URI` | MongoDB connection string | `mongodb://mongo:27017/classquiz` | No |
| `CLASSQUIZ_API_URL` | ClassQuiz API URL | `http://web-api:3000` | No |
| `CLASSQUIZ_API_TOKEN` | API token used by the agent | - | Yes |
| `AGENT_ADMIN_API_KEY` | Admin key for protected agent routes | - | Yes |
| `PORT` | Server port | `4000` | No |
| `NODE_ENV` | Environment | `production` | No |

### WAHA Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `WHATSAPP_API_KEY` | WAHA API key | `change_this_secret` |
| `WHATSAPP_DEFAULT_ENGINE` | WhatsApp engine | `NOWEB` |
| `WAHA_DASHBOARD_USERNAME` | Dashboard username | `admin` |
| `WAHA_DASHBOARD_PASSWORD` | Dashboard password | `classquiz2024` |
| `WHATSAPP_RESTART_ALL_SESSIONS` | Auto-restart sessions | `true` |
| `WHATSAPP_START_SESSION` | Default session name | `default` |

Note: from your host machine, WAHA is exposed on `http://localhost:3001`, but inside Docker services the correct URL is `http://waha:3000`.

## 📚 API Documentation

Complete API documentation is available in `classquiz_backend/API_CONTRACTS.md`.

### Main Endpoints

#### Authentication
- `POST /api/auth/login` - Admin login
- `GET /api/auth/me` - Get current user

#### Students
- `POST /api/students` - Create student
- `GET /api/students` - List students with pagination
- `GET /api/students/:id` - Get student details
- `PUT /api/students/:id` - Update student
- `DELETE /api/students/:id` - Delete student
- `GET /api/students/:id/performance` - Get student performance

#### Exams
- `POST /api/exams` - Upload exam with OCR processing
- `GET /api/exams` - List exams
- `GET /api/exams/:id` - Get exam details
- `DELETE /api/exams/:id` - Delete exam

#### Student Exams
- `POST /api/student-exams` - Upload single student exam
- `POST /api/student-exams/batch` - Batch upload student exams
- `GET /api/student-exams/:id` - Get student exam details
- `POST /api/student-exams/:id/evaluate` - Trigger evaluation

#### Validations
- `GET /api/validations` - List validations requiring review
- `POST /api/validations/:id/review` - Submit validation review

#### Reports
- `POST /api/reports/generate/:studentExamId` - Generate PDF report
- `GET /api/reports/download/:studentExamId` - Download PDF report
- `GET /api/reports/exam/:examId` - Get exam statistics

#### WhatsApp Agent
- `POST /webhook` - WAHA event webhook endpoint
- `GET /webhook` - Webhook health/verification endpoint
- `GET /health` - Health check
- `GET /admin/sessions` - List WhatsApp sessions
- `POST /admin/sessions/:sessionId/restart` - Restart session

#### AI Service (Internal)
- `POST /ocr/extract-exam` - Extract questions from exam
- `POST /ocr/extract-answers` - Extract student handwriting
- `POST /evaluate/grade` - Grade student answers

## 🔄 Workflow

### Exam Processing Pipeline

```
1. Admin uploads corrected exam
   ↓
2. Gemini OCR extracts questions and correct answers
   ↓
3. Admin uploads student exams (single or batch)
   ↓
4. Gemini OCR extracts student handwriting
   ↓
5. Confidence Check
   ├─ ≥ 70% confidence → Auto-proceed to evaluation
   └─ < 70% confidence → Flag for validation
   ↓
6. Validation Queue (if flagged)
   └─ Admin reviews and corrects OCR output
   ↓
7. Ollama Llama3.2 grades answers with pedagogical feedback
   ↓
8. Scores and feedback stored in database
   ↓
9. PDF report generated
```

### WhatsApp Submission Workflow

```
1. Parent sends exam photo + student code via WhatsApp
   ↓
2. WAHA webhook triggers WhatsApp Agent
   ↓
3. Agent validates student code
   ↓
4. Agent uploads image to ClassQuiz API
   ↓
5. ClassQuiz processes exam (OCR → Validation → Grading)
   ↓
6. Agent sends result back via WhatsApp
```

## 💻 Development

### Local Development Setup

#### Frontend Development

```bash
cd classquiz-frontend
npm install
npm run dev
```

Frontend runs on http://localhost:5173

#### Web API Development

```bash
cd classquiz_backend/web-api
npm install
cp .env.example .env
# Edit .env with local settings
npm run dev
```

Web API runs on http://localhost:3000

#### AI Service Development

```bash
cd classquiz_backend/ai-service
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with local settings
uvicorn app.main:app --reload --port 8000
```

AI Service runs on http://localhost:8000

#### WhatsApp Agent Development

```bash
cd classquiz_backend/whatsapp-agent
npm install
cp .env.example .env
# Edit .env with local settings
npm run dev
```

WhatsApp Agent runs on http://localhost:4000

### Running Tests

```bash
# Frontend
cd classquiz-frontend
npm run lint

# Web API
cd classquiz_backend/web-api
npm test

# AI Service
cd classquiz_backend/ai-service
pytest
```

### Code Style

- **Frontend**: ESLint + Prettier
- **Backend**: ESLint (Node.js), Black (Python)
- **Commit Messages**: Conventional Commits

## 🚢 Deployment

### Production Deployment with Docker

```bash
# Build and start all services
docker compose -f classquiz_backend/docker-compose.yml up --build -d

# View logs
docker compose -f classquiz_backend/docker-compose.yml logs -f

# Stop services
docker compose -f classquiz_backend/docker-compose.yml down

# Stop and remove volumes
docker compose -f classquiz_backend/docker-compose.yml down -v
```

### Environment-Specific Configurations

1. **Production**: Use strong JWT secrets and API keys
2. **Staging**: Use separate MongoDB instance
3. **Development**: Enable debug logging and Mongo Express

### Monitoring

- Health checks available at `/health` for all services
- Logs stored in `/app/logs` volume
- Use Docker Compose logs for real-time monitoring

### Backup Strategy

- MongoDB data persisted in `mongo_data` volume
- Upload files persisted in `uploads_data` volume
- Regular backups of Docker volumes recommended

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Write clean, commented code
- Follow existing code style
- Add tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting

## 📄 License

This project is licensed under the MIT License.

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Contact the development team
- Check the API documentation in `API_CONTRACTS.md`

## 🙏 Acknowledgments

- Google Gemini for OCR capabilities
- Ollama for local LLM hosting
- WAHA for WhatsApp integration
- The open-source community for the amazing tools and libraries

---

**Built with ❤️ for education**
