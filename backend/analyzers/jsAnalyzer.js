const vm = require('vm');

function getLineNumber(code, index) {
  return code.slice(0, index).split('\n').length;
}

function analyzeJS(code) {
  const errors = [];
  const lines = code.split('\n');

  // 1. Overall Syntax Compilation Check via Node's native vm.Script
  try {
    new vm.Script(code, { filename: 'editor.js' });
  } catch (syntaxErr) {
    if (syntaxErr.name === 'SyntaxError') {
      let errLine = 1;
      const stackMatch = syntaxErr.stack.match(/editor\.js:(\d+)/);
      if (stackMatch) {
        errLine = parseInt(stackMatch[1], 10);
      }
      errors.push({
        line: errLine,
        type: "error",
        category: "syntax",
        message: `SyntaxError: ${syntaxErr.message}`,
        explanation: "This statement violates JavaScript grammar rules. Fix the syntax error to allow script execution.",
        fixType: "add_paren_semicolon"
      });
    }
  }

  // 2. Line-by-line detailed syntax & convention audits
  let braceBalance = 0;
  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) return;

    for (const ch of line) {
      if (ch === '{') braceBalance++;
      if (ch === '}') braceBalance--;
    }

    // Strip strings & regex to safely inspect code structure
    const noStrings = trimmed
      .replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, '""')
      .replace(/\/[^/\\]*(?:\\.[^/\\]*)*\/[gimsuy]*/g, '""');

    // Check unclosed parentheses on statement line
    const opens = (noStrings.match(/\(/g) || []).length;
    const closes = (noStrings.match(/\)/g) || []).length;
    if (opens > closes && !trimmed.endsWith("{") && !trimmed.endsWith(",")) {
      if (!errors.some(e => e.line === lineNum && (e.message.includes("parenthesis") || e.message.includes("SyntaxError")))) {
        errors.push({
          line: lineNum,
          type: "error",
          category: "syntax",
          message: `Missing closing parenthesis ')' in expression`,
          explanation: "Every open parenthesis '(' must have a matching closing parenthesis ')'. Add ')' and ';' before terminating the line.",
          fixType: "add_paren_semicolon"
        });
      }
    }

    // Check missing semicolon
    if (
      !trimmed.endsWith(";") &&
      !trimmed.endsWith("{") &&
      !trimmed.endsWith("}") &&
      !trimmed.endsWith(":") &&
      !trimmed.endsWith(",") &&
      !trimmed.startsWith("if") &&
      !trimmed.startsWith("else") &&
      !trimmed.startsWith("for") &&
      !trimmed.startsWith("while") &&
      !trimmed.startsWith("switch") &&
      !trimmed.startsWith("function") &&
      !trimmed.startsWith("class") &&
      !trimmed.startsWith("try") &&
      !trimmed.startsWith("catch") &&
      !trimmed.startsWith("finally") &&
      !trimmed.startsWith("import") &&
      !trimmed.startsWith("export")
    ) {
      if (opens <= closes) {
        errors.push({
          line: lineNum,
          type: "warning",
          category: "syntax",
          message: "Possible missing semicolon",
          explanation: "Statements in JavaScript should terminate with a semicolon ';' to prevent Automatic Semicolon Insertion (ASI) bugs.",
          fixType: "add_semicolon"
        });
      }
    }

    // Accidental assignment inside condition
    if (/\b(if|while)\s*\([^=!<>\n]*=[^=!<>\n]*\)/.test(noStrings)) {
      errors.push({
        line: lineNum,
        type: "error",
        category: "syntax",
        message: "Accidental assignment in condition statement",
        explanation: "Using a single '=' assigns a value instead of checking equality. Use '===' or '==' to compare values.",
        fixType: "condition_equals"
      });
    }

    // Deprecated 'var' keyword
    if (/\bvar\s+[A-Za-z_$]/.test(noStrings)) {
      errors.push({
        line: lineNum,
        type: "warning",
        category: "maintainability",
        message: "Use of deprecated 'var' keyword — prefer 'let' or 'const'",
        explanation: "'var' has function scope and hoists unpredictably. Modern ES6 JavaScript recommends 'const' or 'let' for block scoping.",
        fixType: "replace_var"
      });
    }

    // Empty catch blocks
    if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(trimmed)) {
      errors.push({
        line: lineNum,
        type: "warning",
        category: "maintainability",
        message: "Empty catch block silently ignores exceptions",
        explanation: "Uncaught or silently ignored exceptions make debugging difficult. Log the error or handle it appropriately.",
        fixType: "catch_log"
      });
    }
  });

  if (braceBalance > 0) {
    errors.push({
      line: lines.length,
      type: "error",
      category: "syntax",
      message: "Missing closing brace '}' — one or more blocks are unclosed",
      explanation: "Ensure every opening brace '{' has a matching closing brace '}'.",
      fixType: "balance_braces"
    });
  }

  // 3. Find const/let/var declarations and check if unused
  const regex = /\b(const|let|var)\s+([A-Za-z_$][\w$]*)/g;
  let match;
  while ((match = regex.exec(code)) !== null) {
    const variableName = match[2];
    if (variableName.startsWith('_')) continue;

    const remainingCode = code.slice(match.index + match[0].length);
    const used = new RegExp(`\\b${variableName}\\b`).test(remainingCode);

    if (!used) {
      errors.push({
        line: getLineNumber(code, match.index),
        type: "warning",
        category: "maintainability",
        message: `Variable "${variableName}" is declared but never used`,
        explanation: `Variable "${variableName}" is never referenced. Prefix with '_' if intentional to mark as unused or remove it.`,
        fixType: "prefix_unused"
      });
    }
  }

  // Deduplicate errors by line and category
  const uniqueErrors = [];
  const seen = new Set();
  for (const err of errors) {
    const key = `${err.line}:${err.category}:${err.message.slice(0, 25)}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueErrors.push(err);
    }
  }

  uniqueErrors.sort((a, b) => a.line - b.line);

  const score = Math.max(0, 100 - uniqueErrors.length * 8);
  return {
    score,
    errors: uniqueErrors,
    message: uniqueErrors.length === 0 ? "No problems found" : `${uniqueErrors.length} issue(s) found`
  };
}

module.exports = analyzeJS;