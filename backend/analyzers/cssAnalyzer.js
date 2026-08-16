function getLineNumber(code, index) {
  return code.slice(0, index).split('\n').length;
}

function analyzeCSS(code) {
  const errors = [];

  // !important
  for (const match of code.matchAll(/!important/gi)) {
    errors.push({
      line: getLineNumber(code, match.index),
      type: "warning",
      message: "Use of !important — avoid when possible, indicates specificity issues"
    });
  }

  // Empty rule blocks
  for (const match of code.matchAll(/([^{}]+)\{\s*\}/g)) {
    const selector = match[1].trim();
    errors.push({
      line: getLineNumber(code, match.index),
      type: "warning",
      message: `Empty rule block for "${selector}"`
    });
  }

  // Duplicate selectors
  const selectorMatches = [...code.matchAll(/([^{}]+)\{/g)];
  const seen = new Map();
  selectorMatches.forEach(m => {
    const sel = m[1].trim();
    if (seen.has(sel)) {
      errors.push({
        line: getLineNumber(code, m.index),
        type: "warning",
        message: `Duplicate selector "${sel}" defined more than once`
      });
    }
    seen.set(sel, true);
  });

  // Overly specific selectors
  selectorMatches.forEach(m => {
    const sel = m[1].trim();
    const parts = sel.split(/\s+/).filter(Boolean);
    if (parts.length > 3) {
      errors.push({
        line: getLineNumber(code, m.index),
        type: "warning",
        message: `Overly specific selector "${sel}" — consider simplifying`
      });
    }
  });

  // Missing semicolons before closing brace
  for (const match of code.matchAll(/[a-zA-Z0-9%)\]"']\s*\n\s*\}/g)) {
    errors.push({
      line: getLineNumber(code, match.index),
      type: "error",
      message: "Possible missing semicolon before closing brace"
    });
  }

  const score = Math.max(0, 100 - errors.length * 8);
  return {
    score,
    errors,
    message: errors.length ? `${errors.length} issue(s) found` : "Clean CSS — no issues found"
  };
}

module.exports = analyzeCSS;