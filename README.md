# Code Quality Evaluator

A web-based tool that analyzes source code and tells you how good it is. Paste or write code in the browser editor, click **Analyze**, and get a quality score, a letter grade, line-by-line issues, complexity and duplication metrics, a security scan, and AI-generated improvement suggestions, all in a few seconds.

Supports **JavaScript, Python, Java / C / C++, HTML and CSS**.

## Features

- **Code editor** with syntax highlighting (CodeMirror), dark and light themes, built-in sample snippets and language auto-detection
- **Quality score (0–100) and grade** (A+ to D) with a circular score ring and an estimated technical-debt time
- **Language-specific analyzers**: syntax errors, missing semicolons or braces, unused variables, naming conventions, accessibility problems in HTML, specificity problems in CSS, and more
- **Security scanner**: hardcoded secrets, SQL injection by string concatenation, `eval()` / `exec()`, weak randomness for tokens, unclosed Java `Scanner` resources
- **Complexity and duplication**: file and per-method cyclomatic complexity, and duplicated-line detection
- **Clickable issues**: jump to the line in the editor, with one-click auto-fix for common problems
- **AI suggestions** (Google Gemini): three rewrites of your code, ranked **weak / better / best**, each with time and space complexity and a side-by-side diff. If Gemini is slow or unavailable, a built-in rule-based engine takes over
- **Dashboard**: three Chart.js charts (issue breakdown, language breakdown, score distribution)
- **PDF report** download (jsPDF)
- **README badges**: copy-ready shields.io badges for score, grade, security and tech debt
- **Custom rules**: toggle semicolon, type, security, duplicate and naming checks and set a maximum method complexity
- **Accounts and history**: register or log in (JWT) to save every analysis to MongoDB, view past reports and mark favorites. Guests can analyze without logging in, and their history stays in the browser

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, vanilla JavaScript, CodeMirror 5, Chart.js 3, jsPDF |
| Backend | Node.js, Express 5 |
| Database | MongoDB with Mongoose |
| Auth | JSON Web Tokens, bcryptjs |
| AI | Google Gemini API |

## Project Structure

```
code-quality-evaluator/
├── backend/
│   ├── server.js            # Express app and POST /api/analyze
│   ├── analyzers/           # js, python, clike, html, css analyzers,
│   │                        # securityScanner.js, metrics.js
│   ├── routes/              # auth.js, history.js, suggest.js
│   ├── models/              # User.js, Analysis.js
│   ├── middleware/          # verifyToken.js
│   ├── config/db.js         # MongoDB connection
│   └── .env.example
└── frontend/
    ├── index.html           # Main analyzer page
    ├── login.html           # Login, register, reset password
    ├── history.html         # Saved analyses
    ├── css/style.css
    └── js/                  # app.js, auth.js, history.js
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20.19 or newer (required by Mongoose 9)
- A MongoDB database (a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster works)
- A [Google Gemini API key](https://aistudio.google.com/) (only needed for AI suggestions)

### 1. Clone

```bash
git clone https://github.com/rubbulu/code-quality-evaluator.git
cd code-quality-evaluator
```

### 2. Start the backend

```bash
cd backend
npm install
cp .env.example .env      # then fill in your values (see below)
npm run dev               # nodemon; use `npm start` for plain node
```

The API runs on `http://localhost:5000`. The server exits on startup if it cannot connect to MongoDB, so check `MONGO_URI` first.

### 3. Open the frontend

The frontend is static, so there is no build step. Serve the `frontend` folder with any static server, for example:

```bash
# from the repository root
npx serve frontend
```

or open `frontend/index.html` with the VS Code **Live Server** extension. The frontend calls the API at `http://localhost:5000`, so keep the backend on port 5000 (that address is set in `frontend/js/*.js`).

## Environment Variables

Create `backend/.env` from `backend/.env.example`:

| Variable | Description |
|---|---|
| `PORT` | API port (default `5000`) |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Long random string used to sign login tokens |
| `GEMINI_API_KEY` | Google Gemini API key for AI suggestions |
| `GEMINI_MODEL` | Gemini model name (default in the example: `gemini-flash-lite-latest`) |

Never commit `.env`. It is already listed in `.gitignore`.

## API Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/` | none | Health check |
| `POST` | `/api/analyze` | optional | Analyze code. Body: `{ language, code, options? }`. Saved to history when a valid token is sent |
| `POST` | `/api/suggest` | none | AI suggestions. Body: `{ code, language }` |
| `POST` | `/api/auth/register` | none | Create an account. Body: `{ name, email, password }` |
| `POST` | `/api/auth/login` | none | Log in. Returns a JWT (valid 90 days) |
| `POST` | `/api/auth/reset-password` | none | Set a new password. Body: `{ email, newPassword }` |
| `GET` | `/api/history` | required | List the logged-in user's saved analyses |
| `PATCH` | `/api/history/favorite/:id` | required | Toggle favorite on an analysis |

Send the token as `Authorization: Bearer <token>`.

**`language` values:** `javascript`, `python`, `clike`, `htmlmixed`, `css`

**Limits:** code up to 20,000 characters for analysis and 4,000 characters for AI suggestions.

**Example**

```bash
curl -X POST http://localhost:5000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"language":"javascript","code":"var x = 5\nif (x = 6) { eval(input) }"}'
```

## How Scoring Works

The score starts at 100 and loses points for every issue found:

| Issue | Penalty |
|---|---|
| Security issue | −15 |
| Error | −10 |
| Warning | −5 |

| Score | Grade |
|---|---|
| 95–100 | A+ (Exemplary) |
| 85–94 | A (Clean and production ready) |
| 70–84 | B (Good quality) |
| 50–69 | C (Technical debt present) |
| 0–49 | D (Critical refactoring needed) |

## Team

Built as a B.Tech Information Technology major project at Andhra University College of Engineering for Women.

- Mohammad Rubina Sultana
- Matta Krishna Veni
- Mohammed Sumaiyya Tabassum
- Munduru Jalajakshi
- Nalli Jessy Evangeli
