function getLineNumber(code, index) {
  return code.slice(0, index).split('\n').length;
}

function analyzeJS(code) {
  const errors = [];

  // Find const/let/var declarations and check if the variable is used again later
  const regex = /\b(const|let|var)\s+([A-Za-z_$][\w$]*)/g;
  let match;

  while ((match = regex.exec(code)) !== null) {
    const variableName = match[2];
    const remainingCode = code.slice(match.index + match[0].length);
    const used = new RegExp(`\\b${variableName}\\b`).test(remainingCode);

    if (!used) {
      errors.push({
        line: getLineNumber(code, match.index),
        type: "warning",
        message: `Variable "${variableName}" is declared but never used`
      });
    }
  }

  const score = Math.max(0, 100 - errors.length * 10);
  return {
    score,
    errors,
    message: errors.length === 0 ? "No problems found" : `${errors.length} issue(s) found`
  };
}

module.exports = analyzeJS;