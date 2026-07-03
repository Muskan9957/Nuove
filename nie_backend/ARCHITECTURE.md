# Nuove Intelligence Engine (NIE) Architecture

This document outlines the high-level architecture, database strategy, and integration plan between the **Node.js backend** (`viralcoach`) and the **Python NIE microservice** (`nie_backend`).

## 1. Shared PostgreSQL Database Strategy
Both the Node.js backend (using Prisma) and the Python NIE backend (using SQLAlchemy) will share the exact same PostgreSQL database instance. However, strict logical ownership is enforced to prevent migrations from clashing.

### Table Ownership

**Node.js (Prisma) owns application tables:**
- `User`
- `Script`
- `Rewrite`
- `ChatMessage`
- `PerformanceLog`
- `TrendingCache`
- *(All existing application tables)*

**Python NIE (SQLAlchemy/Alembic) owns ML-specific tables:**
- `raw_interactions`
- `creator_features`
- `creator_dna`
- `community_profiles`
- `training_labels`
- *(Any future ML pipelines tables)*

**Migration Rules:**
1. SQLAlchemy and Alembic must **never** modify, drop, or manage tables owned by Prisma.
2. Prisma must **never** manage or migrate ML tables owned by the NIE.

### Existing Data Usage
To keep the services loosely coupled, the NIE should primarily receive data through its own API contracts and manage state in its own ML tables. Direct read-only access to existing Prisma-managed tables (`User`, `Rewrite`, `PerformanceLog`, `Script`, `ChatMessage`) should only be introduced when specifically required for future model training, analytics, or performance optimization.

## 2. API Contract & Boundaries
The NIE follows an **API-first architecture**.
- Every module exposes stable request and response schemas (via Pydantic).
- Once an API contract is finalized, breaking changes should be avoided to ensure stable integration with the Node.js backend.

### API Versioning
Every public NIE endpoint must be versioned (e.g., `/api/v1/`). Future breaking changes should be introduced under a new version (e.g., `/api/v2/`) rather than modifying the existing endpoints.

### Internal vs Public APIs
- **Public Endpoints:** The NIE exposes REST API endpoints *only* for functionality the Node.js backend explicitly needs to trigger (e.g., `POST /api/v1/interactions/`).
- **Internal APIs:** Communication between ML modules (like Feature Extraction, Feature Store, and Semi-Supervised Learning) happens internally via Python Service classes, NOT via HTTP endpoints.
- Specifically, the **Feature Store retrieval APIs** are strictly internal and must not be exposed to the public internet or the Node.js frontend.

## 3. Integration Plan
When V1 of the NIE is complete, it will be integrated with the Node.js backend as follows:

1. **Feature Extraction Hook:**
   The Node.js backend will fire an HTTP POST request to the NIE `interactions` endpoint whenever users generate, edit, save, or refine content. This populates the ML pipeline.
   
2. **Prompt Builder Interception:**
   Before the Node.js backend calls the Gemini API (in `llm.js`), it will invoke the NIE Prompt Builder API. The NIE will process the creator's history, retrieve their features, and return a personalized system prompt to be injected into the LLM request.

3. **Internal ML Pipeline:**
   The rest of the ML processing (Semi-Supervised Learning, Random Forest training, and Creator DNA updates) remains completely isolated and internal to the Python service, running asynchronously without blocking the Node.js application.
