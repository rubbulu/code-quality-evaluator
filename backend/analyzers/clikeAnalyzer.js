function analyzeCLike(code) {
  const errors = [];
  let balance = 0;
  let firstImbalanceLine = null;

  const lines = code.split("\n");

  // Check braces (line-by-line so we can report where it goes wrong)
  lines.forEach((line, index) => {
    for (const char of line) {
      if (char === "{") balance++;
      if (char === "}") balance--;

      if (balance < 0 && firstImbalanceLine === null) {
        firstImbalanceLine = index + 1;
      }
    }
  });

  if (firstImbalanceLine !== null) {
    errors.push({
      line: firstImbalanceLine,
      type: "error",
      message: "Unmatched closing brace }"
    });
  }

  if (balance > 0) {
    errors.push({
      line: lines.length,
      type: "error",
      message: "Missing closing brace } — one or more braces are never closed"
    });
  }

  // Check missing semicolons
  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (
      trimmed &&
      !trimmed.startsWith("//") &&
      !trimmed.startsWith("#") &&
      !trimmed.startsWith("import") &&
      !trimmed.startsWith("public class") &&
      !trimmed.endsWith(";") &&
      !trimmed.endsWith("{") &&
      !trimmed.endsWith("}") &&
      !trimmed.endsWith(":") 
    ) {
      errors.push({
        line: index + 1,
        type: "warning",
        message: "Possible missing semicolon",
        explanation: "Statements in Java/C/C++ must terminate with a semicolon ';' to delimit instructions.",
        fixType: "add_semicolon"
      });
    }
  });

  // Check type mismatches and logical patterns
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) return;

    // Numeric variable assigned to string literal (e.g., int marks = "85";)
    const numStringMismatch = /\b(int|long|short|byte|float|double)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"[^"]*"/;
    if (numStringMismatch.test(trimmed)) {
      errors.push({
        line: index + 1,
        type: "error",
        message: "Incompatible data types: cannot assign String literal to numeric variable",
        explanation: "Cannot assign a String literal to a numeric variable. Remove quotes or parse the value numerically.",
        fixType: "strip_quotes"
      });
    }

    // String assigned to numeric literal without quotes (e.g., String s = 85;)
    const strNumMismatch = /\b(String|string)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\d+\s*;/;
    if (strNumMismatch.test(trimmed)) {
      errors.push({
        line: index + 1,
        type: "error",
        message: "Incompatible data types: cannot assign numeric literal to String",
        explanation: "Cannot assign a numeric literal directly to a String. Wrap it with quotes or String.valueOf().",
        fixType: "wrap_quotes"
      });
    }

    // Accidental assignment inside condition (e.g., if (age = 18) instead of ==)
    if (/if\s*\([^=!<>\n]*=[^=!<>\n]*\)/.test(trimmed)) {
      errors.push({
        line: index + 1,
        type: "warning",
        message: "Possible assignment '=' inside condition instead of comparison '=='",
        explanation: "A single '=' assigns values rather than checking equality. Change '=' to '==' to evaluate the condition.",
        fixType: "condition_equals"
      });
    }

    // Empty catch block
    if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(trimmed)) {
      errors.push({
        line: index + 1,
        type: "warning",
        message: "Empty catch block: exceptions should not be silenced",
        explanation: "Catching exceptions without handling or logging them silently hides runtime crashes. Log the exception or handle it properly.",
        fixType: "catch_log"
      });
    }
  });

  // Check variable naming conventions
  const variablePattern =
    /\b(int|float|double|char|long|short|boolean|bool|string)\s+([A-Za-z_][A-Za-z0-9_]*)/g;

  let match;
  while ((match = variablePattern.exec(code)) !== null) {
    const variableName = match[2];

    const lineStart = code.lastIndexOf("\n", match.index) + 1;
    const lineEnd = code.indexOf("\n", match.index);
    const lineText = code.slice(lineStart, lineEnd === -1 ? code.length : lineEnd);

    // In Java/C/C++, constants (final/const) conventionally use UPPER_SNAKE_CASE (e.g. ELIGIBLE_AGE)
    const isConstant = /\b(final|const)\b/.test(lineText);
    const isUpperSnake = /^[A-Z0-9_]+$/.test(variableName);

    if (isConstant && isUpperSnake) {
      continue;
    }

    if (/^[A-Z]/.test(variableName) || variableName.includes("_")) {
      const lineNumber = code.slice(0, match.index).split("\n").length;
      errors.push({
        line: lineNumber,
        type: "warning",
        message: `Variable "${variableName}" should use camelCase naming`,
        fixType: "camel_case"
      });
    }
  }

  const score = Math.max(0, 100 - errors.length * 10);

  return {
    score,
    errors,
    message: errors.length ? `${errors.length} issue(s) found` : "No problems found"
  };
}

module.exports = analyzeCLike;