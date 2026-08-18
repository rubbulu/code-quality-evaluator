function getLineNumber(code, index) {
  return code.slice(0, index).split('\n').length;
}

function analyzeHTML(code) {
  const errors = [];

  // Missing alt on images
  for (const match of code.matchAll(/<img(?![^>]*\balt=)[^>]*>/gi)) {
    errors.push({
      line: getLineNumber(code, match.index),
      type: "warning",
      message: "Image missing alt attribute (bad for accessibility)"
    });
  }

  // Missing DOCTYPE
  if (!/<!DOCTYPE\s+html>/i.test(code)) {
    errors.push({ line: 1, type: "warning", message: "Missing <!DOCTYPE html> declaration" });
  }

  // Inline styles
  for (const match of code.matchAll(/style\s*=\s*"[^"]*"/gi)) {
    errors.push({
      line: getLineNumber(code, match.index),
      type: "warning",
      message: "Inline style found — prefer external CSS classes"
    });
  }

  // Duplicate IDs
  const idMatches = [...code.matchAll(/\bid\s*=\s*"([^"]+)"/gi)];
  const seenIds = new Map();
  idMatches.forEach(m => {
    const id = m[1];
    if (seenIds.has(id)) {
      errors.push({
        line: getLineNumber(code, m.index),
        type: "error",
        message: `Duplicate id "${id}" used more than once`
      });
    }
    seenIds.set(id, true);
  });

  // Mismatched tags
  const checkTags = ["div", "span", "p", "ul", "li", "a", "section", "header", "footer", "table", "tr", "td"];
  checkTags.forEach(tag => {
    const openMatches = [...code.matchAll(new RegExp(`<${tag}(\\s[^>]*)?>`, "gi"))];
    const closeMatches = [...code.matchAll(new RegExp(`</${tag}>`, "gi"))];
    if (openMatches.length !== closeMatches.length) {
      const line = openMatches.length ? getLineNumber(code, openMatches[0].index) : 1;
      errors.push({
        line,
        type: "error",
        message: `Mismatched <${tag}> tags: ${openMatches.length} opened, ${closeMatches.length} closed`
      });
    }
  });

  // Missing lang attribute
  const htmlTagMatch = code.match(/<html(?![^>]*\blang=)[^>]*>/i);
  if (htmlTagMatch) {
    errors.push({
      line: getLineNumber(code, htmlTagMatch.index),
      type: "warning",
      message: "Missing lang attribute on <html> tag"
    });
  }

  const score = Math.max(0, 100 - errors.length * 8);
  return {
    score,
    errors,
    message: errors.length ? `${errors.length} issue(s) found` : "Clean HTML — no issues found"
  };
}

module.exports = analyzeHTML;