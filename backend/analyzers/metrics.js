/**
 * Code Quality Evaluator - Metrics, Grade, Technical Debt & Fixes Engine
 */

function calculateComplexity(code, language) {
  if (!code || typeof code !== 'string') return 1;

  // Strip multi-line comments /* ... */
  let clean = code.replace(/\/\*[\s\S]*?\*\//g, '');
  // Strip single-line comments // ... and # ...
  clean = clean.replace(/(\/\/|#)[^\n]*/g, '');
  // Strip string literals ("..." and '...') so words in strings do not count as branch keywords
  clean = clean.replace(/(["'])(?:(?=(\\?))\2.)*?\1/g, '');

  let complexity = 1;
  const branchKeywords = /\b(if|else\s+if|elif|for|while|case|catch|except)\b|(\&\&|\|\|)|\?/g;
  const matches = clean.match(branchKeywords);
  if (matches) {
    complexity += matches.length;
  }

  return complexity;
}

function calculateMethodComplexities(code, language, threshold = 15) {
  if (!code || typeof code !== 'string') return { max: 1, violatingMethods: [] };

  const lines = code.split('\n');
  const violatingMethods = [];
  let maxComplexity = 1;

  // Regex patterns for methods across languages
  const javaMethodRegex = /(?:(?:public|private|protected|static|final|synchronized|abstract|default|native)\s+)+[\w<>\[\], ?]+\s+([A-Za-z_][A-Za-z0-9_]*)\s*\([^)]*\)/;
  const javaConstructorRegex = /(?:(?:public|private|protected)\s+)+([A-Z][A-Za-z0-9_]*)\s*\([^)]*\)/;
  const jsMethodRegex = /(?:function\s+([A-Za-z_][A-Za-z0-9_]*)|([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|([A-Za-z_][A-Za-z0-9_]*)\s*\([^)]*\)\s*\{)/;
  const pyMethodRegex = /def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\([^)]*\):/;

  const methodStarts = [];
  const reservedKeywords = new Set(['class', 'interface', 'enum', 'record', 'if', 'while', 'for', 'switch', 'catch', 'finally', 'try', 'new', 'return', 'throw']);

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*')) return;

    let match = null;
    if (language === 'python') {
      match = trimmed.match(pyMethodRegex);
    } else if (language === 'javascript') {
      match = trimmed.match(jsMethodRegex);
    } else {
      match = trimmed.match(javaMethodRegex) || trimmed.match(javaConstructorRegex);
    }

    if (match) {
      const methodName = match[1] || match[2] || match[3];
      if (methodName && !reservedKeywords.has(methodName)) {
        methodStarts.push({ name: methodName, line: idx + 1, lineIdx: idx });
      }
    }
  });

  if (methodStarts.length === 0) {
    const fileComp = calculateComplexity(code, language);
    return { max: fileComp, violatingMethods: [] };
  }

  for (let i = 0; i < methodStarts.length; i++) {
    const startIdx = methodStarts[i].lineIdx;
    const endIdx = (i + 1 < methodStarts.length) ? methodStarts[i + 1].lineIdx : lines.length;
    const methodSlice = lines.slice(startIdx, endIdx).join('\n');
    const methodComp = calculateComplexity(methodSlice, language);

    if (methodComp > maxComplexity) {
      maxComplexity = methodComp;
    }

    if (methodComp > threshold) {
      violatingMethods.push({
        name: methodStarts[i].name,
        line: methodStarts[i].line,
        complexity: methodComp
      });
    }
  }

  return {
    max: maxComplexity,
    violatingMethods
  };
}

function detectDuplicates(code) {
  if (!code || typeof code !== 'string') return [];

  const lines = code.split('\n');
  const seen = new Map();
  const duplicates = [];

  lines.forEach((rawLine, index) => {
    const trimmed = rawLine.trim();

    if (
      !trimmed ||
      trimmed.length < 10 ||
      trimmed.startsWith('//') ||
      trimmed.startsWith('#') ||
      trimmed.startsWith('/*') ||
      trimmed.startsWith('*') ||
      trimmed.startsWith('import ') ||
      trimmed.startsWith('package ') ||
      trimmed === '{' ||
      trimmed === '}' ||
      trimmed === ');' ||
      trimmed === '};' ||
      /^(return|break|continue|pass|throw\s|throw;)/.test(trimmed) ||
      /\.(flush|close|newLine)\(\);?$/.test(trimmed) ||
      /^(e|err|ex)\.printStackTrace\(\);?$/.test(trimmed) ||
      /^super\([^)]*\);?$/.test(trimmed) ||
      /}?\s*(catch|finally|else|else\s+if)\b/.test(trimmed) ||
      /^(try|do)\s*\{?$/.test(trimmed) ||
      /^(case\s+[^:]+|default)\s*:/.test(trimmed) ||
      /^(let|const|var|int|float|double|long|short|byte|char|String|boolean)\s+\w+\s*=\s*(null|0|""|''|true|false|\[\]|\{\}|0\.0);?$/.test(trimmed)
    ) {
      return;
    }

    if (seen.has(trimmed)) {
      duplicates.push({
        line: index + 1,
        originalLine: seen.get(trimmed),
        text: trimmed
      });
    } else {
      seen.set(trimmed, index + 1);
    }
  });

  return duplicates;
}

const EXPLANATION_RULES = [
  {
    pattern: /missing closing parenthesis|syntaxerror.*missing \)/i,
    explanation: "Every open parenthesis '(' must have a matching closing parenthesis ')'. Add ')' and ';' before terminating the line.",
    fixType: "add_paren_semicolon"
  },
  {
    pattern: /deprecated 'var' keyword/i,
    explanation: "Use modern block-scoped 'let' or 'const' instead of legacy function-scoped 'var'.",
    fixType: "replace_var"
  },
  {
    pattern: /missing semicolon/i,
    explanation: "Statements in this language must terminate with a semicolon ';' to delimit instructions. Add ';' to the end of the statement.",
    fixType: "add_semicolon"
  },
  {
    pattern: /incompatible data types.*String.*numeric/i,
    explanation: "Cannot assign a String literal to a numeric variable. Remove quotes or parse the value numerically.",
    fixType: "strip_quotes"
  },
  {
    pattern: /incompatible data types.*numeric.*String/i,
    explanation: "Cannot assign a numeric literal directly to a String. Wrap it with quotes or String.valueOf().",
    fixType: "wrap_quotes"
  },
  {
    pattern: /assignment.*inside condition/i,
    explanation: "A single '=' assigns values rather than checking equality. Change '=' to '==' (or '===') to evaluate the condition.",
    fixType: "condition_equals"
  },
  {
    pattern: /empty catch block/i,
    explanation: "Catching exceptions without handling or logging them silently hides runtime crashes. Log the exception or handle it properly.",
    fixType: "catch_log"
  },
  {
    pattern: /declared but never used/i,
    explanation: "This variable allocates memory but is never referenced. Prefix with '_' or remove it to optimize memory and maintainability.",
    fixType: "prefix_unused"
  },
  {
    pattern: /cyclomatic complexity/i,
    explanation: "Function or method is overly complex. Refactor into smaller helper functions, or adjust complexity threshold in Rules settings.",
    fixType: "tune_complexity"
  },
  {
    pattern: /camelCase naming/i,
    explanation: "By convention, variables should use camelCase (e.g. 'studentAge') to ensure standard code readability and maintainability.",
    fixType: "camel_case"
  },
  {
    pattern: /lowercase.*naming|snake_case/i,
    explanation: "Python PEP 8 style guide recommends lowercase words separated by underscores (snake_case) for variable names.",
    fixType: "snake_case"
  },
  {
    pattern: /spaces instead of tabs/i,
    explanation: "Python PEP 8 recommends 4 spaces per indentation level rather than tabs.",
    fixType: "replace_tabs"
  },
  {
    pattern: /print\(\) function in Python 3/i,
    explanation: "In Python 3, print is a built-in function requiring parentheses: print(...).",
    fixType: "python_print_parens"
  },
  {
    pattern: /longer than 100 characters/i,
    explanation: "Long lines reduce readability in code reviews and split-screen editors. Break long statements across multiple lines.",
    fixType: "break_long_line"
  },
  {
    pattern: /unmatched.*brace|missing closing brace/i,
    explanation: "Block braces '{' and '}' are unbalanced. Ensure every open brace '{' has a matching closing brace '}'.",
    fixType: "balance_braces"
  }
];

function enrichErrors(errors) {
  if (!Array.isArray(errors)) return [];

  return errors.map(err => {
    let explanation = err.explanation;
    let fixType = err.fixType || null;

    const matched = EXPLANATION_RULES.find(rule => rule.pattern.test(err.message));
    if (matched) {
      if (!explanation) explanation = matched.explanation;
      if (!fixType) fixType = matched.fixType;
    }

    if (!explanation) {
      explanation = "Inspect this line to resolve syntax or style discrepancies and prevent unexpected runtime exceptions.";
    }

    return {
      ...err,
      explanation,
      fixType
    };
  });
}

function calculateGrade(score) {
  if (score >= 95) return { grade: "A+", label: "Exemplary" };
  if (score >= 85) return { grade: "A", label: "Clean & Production Ready" };
  if (score >= 70) return { grade: "B", label: "Good Quality" };
  if (score >= 50) return { grade: "C", label: "Technical Debt Present" };
  return { grade: "D", label: "Critical Refactoring Needed" };
}

function calculateTechnicalDebt(errors, duplicates) {
  let minutes = 0;

  (errors || []).forEach(err => {
    if (err.category === "security") {
      minutes += 10;
    } else if (err.type === "error") {
      minutes += 5;
    } else {
      minutes += 2;
    }
  });

  if (duplicates && duplicates.length) {
    minutes += duplicates.length * 3;
  }

  if (minutes === 0) {
    return { minutes: 0, formatted: "0m (Clean)" };
  }

  if (minutes < 60) {
    return { minutes, formatted: `~${minutes}m` };
  }

  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return {
    minutes,
    formatted: remainingMins ? `~${hours}h ${remainingMins}m` : `~${hours}h`
  };
}

module.exports = {
  calculateComplexity,
  calculateMethodComplexities,
  detectDuplicates,
  enrichErrors,
  calculateGrade,
  calculateTechnicalDebt
};
