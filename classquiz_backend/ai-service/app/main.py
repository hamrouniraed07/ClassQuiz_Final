"""
ClassQuiz AI Service
====================
FastAPI application handling OCR (Gemini) and Evaluation (OpenAI/Ollama).
"""

import structlog
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.routers import ocr, evaluation

# Configure structured logging
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.stdlib.add_log_level,
        structlog.processors.StackInfoRenderer(),
        structlog.dev.ConsoleRenderer() if get_settings().env != "production"
        else structlog.processors.JSONRenderer(),
    ],
)

logger = structlog.get_logger()
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    evaluation_model = (
        settings.ollama_model
        if settings.ai_provider.lower() == "ollama"
        else settings.openai_model
    )
    logger.info(
        "ClassQuiz AI Service starting",
        env=settings.env,
        gemini_model=settings.gemini_model,
        ai_provider=settings.ai_provider,
        evaluation_model=evaluation_model,
    )
    yield
    logger.info("ClassQuiz AI Service shutting down")


app = FastAPI(
    title="ClassQuiz AI Service",
    description="OCR extraction and exam evaluation for ClassQuiz EdTech platform.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://web-api:3000"],  # Only internal service
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


# ── Request Logging Middleware ────────────────────────────────────────────────
@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(
        "Incoming request",
        method=request.method,
        path=request.url.path,
    )
    response = await call_next(request)
    logger.info(
        "Request completed",
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
    )
    return response


# ── Global Exception Handler ──────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception", path=request.url.path, error=str(exc))
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "path": str(request.url.path)},
    )


# ── Health Check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health():
    evaluation_model = (
        settings.ollama_model
        if settings.ai_provider.lower() == "ollama"
        else settings.openai_model
    )
    return {
        "status": "ok",
        "service": "classquiz-ai-service",
        "version": "1.0.0",
        "models": {
            "ocr": settings.gemini_model,
            "evaluation": evaluation_model,
        },
        "provider": {
            "evaluation": settings.ai_provider,
        },
    }


# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(ocr.router)
app.include_router(evaluation.router)
