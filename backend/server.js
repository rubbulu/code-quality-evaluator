const express = require('express');
const cors = require('cors');
require('dotenv').config();
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const analyzeHTML = require('./analyzers/htmlAnalyzer');
const analyzeCSS = require('./analyzers/cssAnalyzer');
const analyzeJS = require('./analyzers/jsAnalyzer');

const app = express();
app.use(cors());
app.use(express.json());
connectDB();

app.use('/api/auth', authRoutes);

const PORT = process.env.PORT || 5000;

app.get('/', (req, res) => {
  res.send('Code Quality Evaluator backend is running');
});

const ALLOWED_LANGUAGES = ["javascript", "python", "clike", "htmlmixed", "css"];
const MAX_CODE_LENGTH = 20000;

app.post('/api/analyze', (req, res) => {
  const { language, code } = req.body;

  if (language === undefined || code === undefined) {
    return res.status(400).json({ score: 0, errors: [], message: "Request must include both 'language' and 'code' fields" });
  }
  if (typeof language !== "string" || typeof code !== "string") {
    return res.status(400).json({ score: 0, errors: [], message: "'language' and 'code' must both be text" });
  }
  if (code.trim() === "") {
    return res.status(400).json({ score: 0, errors: [], message: "No code submitted — paste some code before analyzing" });
  }
  if (!ALLOWED_LANGUAGES.includes(language)) {
    return res.status(400).json({ score: 0, errors: [], message: `Unsupported language "${language}"` });
  }
  if (code.length > MAX_CODE_LENGTH) {
    return res.status(413).json({ score: 0, errors: [], message: `Code is too long (${code.length} characters)` });
  }

  let result;
  try {
    if (language === "htmlmixed") {
      result = analyzeHTML(code);
    } else if (language === "css") {
      result = analyzeCSS(code);
    } else if (language === "javascript") {
      result = analyzeJS(code);
    } else {
      result = { score: 85, errors: [], message: "Placeholder response (real analysis coming soon)" };
    }
  } catch (err) {
    console.error("Analysis error:", err);
    return res.status(500).json({ score: 0, errors: [], message: "Something went wrong while analyzing your code" });
  }

  res.json(result);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});