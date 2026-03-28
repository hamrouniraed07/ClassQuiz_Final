# Compte rendu des modifications (OpenAI -> Ollama)

## Contexte de votre demande initiale
Vous avez demandé de remplacer temporairement OpenAI par Ollama (installé localement) afin de tester l'application, puis de pouvoir revenir facilement à OpenAI plus tard.

---

## 1) Migration IA: OpenAI -> Ollama (backend IA)

### Objectif
Permettre l'évaluation des copies avec Ollama sans clé OpenAI, tout en gardant la compatibilité OpenAI.

### Modifications réalisées

1. Configuration multi-provider (OpenAI / Ollama)
- Fichier: [classquiz_backend/ai-service/app/config.py](classquiz_backend/ai-service/app/config.py)
- Changements:
  - `openai_api_key` rendu optionnel
  - Ajout de:
    - `ai_provider` (`openai` ou `ollama`)
    - `ollama_base_url`
    - `ollama_model`

2. Service d'évaluation compatible OpenAI + Ollama
- Fichier: [classquiz_backend/ai-service/app/services/evaluation_service.py](classquiz_backend/ai-service/app/services/evaluation_service.py)
- Changements:
  - Ajout d'un flux conditionnel selon `AI_PROVIDER`
  - Mode Ollama via `POST /api/chat` (`stream=false`, `format=json`)
  - Mode OpenAI conservé
  - Journalisation provider + tokens

3. Messages d'erreur d'évaluation améliorés
- Fichier: [classquiz_backend/ai-service/app/routers/evaluation.py](classquiz_backend/ai-service/app/routers/evaluation.py)
- Changements:
  - Messages spécifiques OpenAI (quota/clé)
  - Message spécifique Ollama (injoignable)

4. Santé et logs enrichis
- Fichier: [classquiz_backend/ai-service/app/main.py](classquiz_backend/ai-service/app/main.py)
- Changements:
  - `/health` expose provider + modèle actif
  - Logs de démarrage indiquent provider/modèle d'évaluation

5. Docker Compose orienté Ollama pour tests locaux
- Fichier: [classquiz_backend/docker-compose.yml](classquiz_backend/docker-compose.yml)
- Changements:
  - `AI_PROVIDER=ollama`
  - `OLLAMA_BASE_URL` configuré pour accès hôte depuis conteneur
  - `extra_hosts: host.docker.internal:host-gateway`

---

## 2) Vérifications et tests effectués

1. Vérification santé des services
- `ai-service`, `web-api`, `mongo` vérifiés en état `healthy`.

2. Test réel de l'endpoint d'évaluation
- Requête `POST /evaluate/grade` exécutée avec payload d'exemple.
- Résultat obtenu: réponse `200` avec score et feedback.

3. Diagnostic connectivité Ollama
- Problème identifié: Ollama bindé en loopback (`127.0.0.1`).
- Ajustements de configuration/networking pour permettre la communication conteneur -> Ollama local.

---

## 3) Corrections interface Reports (note /20 + visibilité PDF)

### Problèmes signalés
- Note sur 20 non visible.
- Difficulté à retrouver/ouvrir les rapports PDF.

### Modifications backend

1. Enrichissement des données rapport examen
- Fichier: [classquiz_backend/web-api/src/controllers/reportController.js](classquiz_backend/web-api/src/controllers/reportController.js)
- Changements:
  - Ajout de `reportPath` et `reportGeneratedAt` dans la liste `students` de `/api/reports/exam/:examId`

### Modifications frontend Reports

1. Source de données corrigée
- Fichier: [classquiz-frontend/src/pages/reports/ReportsPage.tsx](classquiz-frontend/src/pages/reports/ReportsPage.tsx)
- Changements:
  - Utilisation de `reportData.students` (aligné avec endpoint reports)
  - Suppression de la dépendance principale à la liste filtrée `status=evaluated`

2. Affichage note `/20`
- Fichier: [classquiz-frontend/src/pages/reports/ReportsPage.tsx](classquiz-frontend/src/pages/reports/ReportsPage.tsx)
- Changements:
  - Nouvelle colonne "Note (/20)" = `percentage * 20 / 100`

3. Actions rapport explicites
- Fichiers:
  - [classquiz-frontend/src/hooks/useApi.ts](classquiz-frontend/src/hooks/useApi.ts)
  - [classquiz-frontend/src/pages/reports/ReportsPage.tsx](classquiz-frontend/src/pages/reports/ReportsPage.tsx)
- Changements:
  - `usePreviewReport` (ouverture dans nouvel onglet)
  - `useDownloadReport` fiabilisé
  - Génération puis ouverture automatique du PDF

---

## 4) Corrections Dashboard (Report Ready -> action réelle)

### Problème signalé
- Sur Dashboard, statut "Report Ready" visible, mais pas d'accès direct au PDF.

### Modifications
- Fichier: [classquiz-frontend/src/pages/dashboard/DashboardPage.tsx](classquiz-frontend/src/pages/dashboard/DashboardPage.tsx)
- Changements:
  - Ajout colonne "Report" dans "Recent Exams"
  - Bouton oeil (ouvrir PDF)
  - Bouton download (télécharger PDF)

---

## 5) Corrections TypeScript

1. Typage Reports
- Fichiers:
  - [classquiz-frontend/src/types/index.ts](classquiz-frontend/src/types/index.ts)
  - [classquiz-frontend/src/hooks/useApi.ts](classquiz-frontend/src/hooks/useApi.ts)
  - [classquiz-frontend/src/pages/reports/ReportsPage.tsx](classquiz-frontend/src/pages/reports/ReportsPage.tsx)
- Changements:
  - Ajout de types `ExamReportData`, `ExamReportSummary`, `ReportStudentExam`
  - Suppression des `implicit any` signalés

2. Paramètres validations
- Fichier: [classquiz-frontend/src/hooks/useApi.ts](classquiz-frontend/src/hooks/useApi.ts)
- Changement:
  - `useValidations` accepte `limit`

---

## 6) Correction erreur 500/429 à l'ouverture du PDF

### Problème identifié
- Erreur backend: `Invalid character in header content ["Content-Disposition"]`
- Cause: nom de fichier incluant caractères non ASCII (ex: arabe) dans le header HTTP.

### Correctif
- Fichier: [classquiz_backend/web-api/src/controllers/reportController.js](classquiz_backend/web-api/src/controllers/reportController.js)
- Changements:
  - Ajout d'un fallback ASCII
  - Ajout de `filename*` encodé UTF-8 (RFC 5987)

Résultat:
- Endpoint download validé en `200`.

---

## 7) Correction affichage arabe dans le PDF (mojibake)

### Problème identifié
- Le texte arabe en base est correct.
- Le PDF affichait du texte illisible à cause d'une police non adaptée (Helvetica).

### Correctifs appliqués

1. Installation police Unicode côté web-api
- Fichier: [classquiz_backend/web-api/Dockerfile](classquiz_backend/web-api/Dockerfile)
- Changement:
  - Installation `ttf-dejavu`

2. Sélection dynamique de police pour texte arabe
- Fichier: [classquiz_backend/web-api/src/controllers/reportController.js](classquiz_backend/web-api/src/controllers/reportController.js)
- Changements:
  - Détection caractères arabes
  - Application de DejaVu Sans pour les champs arabes (questions/réponses)
  - Support des chemins Alpine (`/usr/share/fonts/dejavu/...`)

3. Régénération lors du download
- Fichier: [classquiz_backend/web-api/src/controllers/reportController.js](classquiz_backend/web-api/src/controllers/reportController.js)
- Changement:
  - Regénération du PDF au moment du téléchargement pour appliquer les fixes aux anciens rapports

Résultat:
- PDF généré avec font embarquée Unicode (indices `FontFile2`, `Type0`, `CIDFontType2`).

---

## 8) État final

### Fonctionnel
- Migration OpenAI -> Ollama opérationnelle pour tests.
- Évaluation IA fonctionne avec Ollama.
- Reports et Dashboard affichent/ouvrent les PDF.
- Note `/20` visible.
- Téléchargement PDF sans erreur `500`.
- Texte arabe rendu correctement dans le PDF (après régénération).

### Fichiers principalement modifiés
- [classquiz_backend/ai-service/app/config.py](classquiz_backend/ai-service/app/config.py)
- [classquiz_backend/ai-service/app/services/evaluation_service.py](classquiz_backend/ai-service/app/services/evaluation_service.py)
- [classquiz_backend/ai-service/app/routers/evaluation.py](classquiz_backend/ai-service/app/routers/evaluation.py)
- [classquiz_backend/ai-service/app/main.py](classquiz_backend/ai-service/app/main.py)
- [classquiz_backend/docker-compose.yml](classquiz_backend/docker-compose.yml)
- [classquiz_backend/web-api/src/controllers/reportController.js](classquiz_backend/web-api/src/controllers/reportController.js)
- [classquiz_backend/web-api/Dockerfile](classquiz_backend/web-api/Dockerfile)
- [classquiz-frontend/src/hooks/useApi.ts](classquiz-frontend/src/hooks/useApi.ts)
- [classquiz-frontend/src/pages/reports/ReportsPage.tsx](classquiz-frontend/src/pages/reports/ReportsPage.tsx)
- [classquiz-frontend/src/pages/dashboard/DashboardPage.tsx](classquiz-frontend/src/pages/dashboard/DashboardPage.tsx)
- [classquiz-frontend/src/types/index.ts](classquiz-frontend/src/types/index.ts)

---

## 9) Retour à OpenAI (quand vous aurez la clé)
1. Mettre `AI_PROVIDER=openai`.
2. Renseigner `OPENAI_API_KEY`.
3. Rebuild/restart services backend.
4. Les routes et interfaces restent compatibles.
