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
        message: "Possible missing semicolon"
      });
    }
  });

  // Check variable naming conventions
  const variablePattern =
    /\b(int|float|double|char|long|short|boolean|bool|string)\s+([A-Za-z_][A-Za-z0-9_]*)/g;

  let match;
  while ((match = variablePattern.exec(code)) !== null) {
    const variableName = match[2];

    if (/^[A-Z]/.test(variableName) || variableName.includes("_")) {
      const lineNumber = code.slice(0, match.index).split("\n").length;
      errors.push({
        line: lineNumber,
        type: "warning",
        message: `Variable "${variableName}" should use camelCase naming`
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