const express = require('express');
const cors = require('cors');
require('dotenv').config();
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const analyzeHTML = require('./analyzers/htmlAnalyzer');
const analyzeCSS = require('./analyzers/cssAnalyzer');
const analyzeJS = require('./analyzers/jsAnalyzer');
const analyzePython = require('./analyzers/pythonAnalyzer');
const analyzeClike = require('./analyzers/clikeAnalyzer');
const historyRoutes = require('./routes/history');
const jwt = require('jsonwebtoken');
const verifyToken = require('./middleware/verifyToken');
const Analysis = require('./models/Analysis');
const suggestRoute = require('./routes/suggest');
const { calculateComplexity, calculateMethodComplexities, detectDuplicates, enrichErrors, calculateGrade, calculateTechnicalDebt } = require('./analyzers/metrics');
const scanSecurity = require('./analyzers/securityScanner');

const app = express();
app.use(cors());
app.use(express.json());
connectDB();

app.use('/api/auth', authRoutes);
app.use('/api/history', historyRoutes);

const PORT = process.env.PORT || 5000;

app.get('/', (req, res) => {
  res.send('Code Quality Evaluator backend is running');
});

// Login is optional: only attach userId if a valid token is provided.
// If the token is expired or invalid, continue as guest instead of blocking analysis with 403.
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return next();

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (!err && decoded) {
      req.userId = decoded.userId;
    } else if (err) {
      req.tokenExpired = true;
    }
    next();
  });
};

const ALLOWED_LANGUAGES = ["javascript", "python", "clike", "htmlmixed", "css"];
const MAX_CODE_LENGTH = 20000;

app.post('/api/analyze', optionalAuth, async (req, res) => {
  const { language, code, options } = req.body;

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

  const rules = Object.assign({
    semicolons: true,
    strictTypes: true,
    securityScanner: true,
    duplicateDetection: true,
    namingConventions: true,
    maxComplexity: 15
  }, options || {});

  let result;
  try {
    if (language === "htmlmixed") {
      result = analyzeHTML(code);
    } else if (language === "css") {
      result = analyzeCSS(code);
    } else if (language === "javascript") {
      result = analyzeJS(code);
    } else if (language === "python") {
      result = analyzePython(code);
    } else if (language === "clike") {
      result = analyzeClike(code);
    } else {
      result = { score: 85, errors: [], message: "Placeholder response (real analysis coming soon)" };
    }

    // Apply rule filters on static analyzer issues
    if (result.errors && Array.isArray(result.errors)) {
      if (!rules.semicolons) {
        result.errors = result.errors.filter(e => !e.message.toLowerCase().includes("semicolon"));
      }
      if (!rules.strictTypes) {
        result.errors = result.errors.filter(e => 
          !e.message.toLowerCase().includes("incompatible data types") && 
          !e.message.toLowerCase().includes("inside condition")
        );
      }
      if (!rules.namingConventions) {
        result.errors = result.errors.filter(e => 
          !e.message.toLowerCase().includes("camelcase") &&
          !e.message.toLowerCase().includes("naming") &&
          !e.message.toLowerCase().includes("snake_case")
        );
      }
    }

    // Run security and vulnerability scan if enabled
    let securityIssues = [];
    if (rules.securityScanner) {
      securityIssues = scanSecurity(code, language);
      if (securityIssues.length) {
        result.errors = [...(result.errors || []), ...securityIssues];
      }
    }

    result.complexity = calculateComplexity(code, language);
    result.duplicates = rules.duplicateDetection ? detectDuplicates(code) : [];

    const methodLimit = rules.maxComplexity || 15;
    const methodCheck = calculateMethodComplexities(code, language, methodLimit);
    result.maxMethodComplexity = methodCheck.max;

    // Check method-level complexity violations
    if (methodCheck.violatingMethods && methodCheck.violatingMethods.length > 0) {
      methodCheck.violatingMethods.forEach(vm => {
        result.errors.push({
          line: vm.line,
          type: "warning",
          category: "complexity",
          message: `Method "${vm.name}" has high Cyclomatic Complexity (${vm.complexity}) exceeding limit (${methodLimit})`,
          explanation: "Refactor nested loops and branching logic in this method into dedicated modular helper functions.",
          fixType: "tune_complexity"
        });
      });
    } else {
      // Whole-file complexity check: only trigger if the file as a whole is excessively complex
      const fileLimit = Math.max(25, Math.round(methodLimit * 2.2));
      if (result.complexity > fileLimit) {
        result.errors.push({
          line: 1,
          type: "warning",
          category: "complexity",
          message: `High File Cyclomatic Complexity (${result.complexity}) exceeds threshold (${fileLimit})`,
          explanation: "This file contains numerous branching paths across multiple routines. Split unrelated logic into modular helper classes or functions.",
          fixType: "tune_complexity"
        });
      }
    }

    // Surface duplicate code lines in issues so user can see them
    if (result.duplicates && result.duplicates.length > 0) {
      result.duplicates.forEach(dup => {
        result.errors.push({
          line: dup.line,
          type: "warning",
          category: "duplication",
          message: `Duplicated code line: "${dup.text.slice(0, 50)}${dup.text.length > 50 ? '...' : ''}" (matches line ${dup.originalLine})`,
          explanation: "Extract repeated statements into a reusable helper method or constant to maintain DRY principles.",
          fixType: "comment_duplicate"
        });
      });
    }

    result.loc = code.split('\n').filter(l => l.trim().length > 0).length;
    result.errors = enrichErrors(result.errors);

    // Compute final balanced score based on all identified issues
    const errorPenalties = (result.errors || []).reduce((acc, err) => {
      if (err.category === 'security') return acc + 15;
      if (err.type === 'error') return acc + 10;
      return acc + 5;
    }, 0);
    result.score = Math.max(0, 100 - errorPenalties);

    result.grade = calculateGrade(result.score);
    result.techDebt = calculateTechnicalDebt(result.errors, result.duplicates);
    result.securityCount = securityIssues.length;
    result.appliedRules = rules;
  } catch (err) {
    console.error("Analysis error:", err);
    return res.status(500).json({ score: 0, errors: [], message: "Something went wrong while analyzing your code" });
  }

  // Save to history only when the user is logged in
  if (req.userId) {
    try {
      const saved = await Analysis.create({
        userId: req.userId,
        language,
        code,
        score: result.score
      });
      result.analysisId = saved._id;
      result.savedToHistory = true;
    } catch (err) {
      console.error("History save failed:", err.message);
      result.savedToHistory = false;
    }
  } else {
    result.savedToHistory = false;
  }

  if (req.tokenExpired) {
    result.tokenExpired = true;
  }

  res.json(result);
});

app.use('/api', suggestRoute);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});