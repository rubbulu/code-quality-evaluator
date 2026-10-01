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
      category: "accessibility",
      message: "Image missing alt attribute (bad for accessibility)",
      explanation: "Add an alt attribute describing the image content to support screen readers and enhance accessibility.",
      fixType: "html_add_alt"
    });
  }

  // Missing DOCTYPE
  if (!/<!DOCTYPE\s+html>/i.test(code)) {
    errors.push({
      line: 1,
      type: "warning",
      category: "standards",
      message: "Missing <!DOCTYPE html> declaration",
      explanation: "A <!DOCTYPE html> declaration ensures web browsers render pages in standards-compliant HTML5 mode.",
      fixType: "html_add_doctype"
    });
  }

  // Inline styles
  for (const match of code.matchAll(/style\s*=\s*"[^"]*"/gi)) {
    errors.push({
      line: getLineNumber(code, match.index),
      type: "warning",
      category: "style",
      message: "Inline style found — prefer external CSS classes",
      explanation: "Inline CSS reduces maintainability and increases specificity wars. Extract inline styles into CSS classes.",
      fixType: "html_remove_inline_style"
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
        category: "syntax",
        message: `Duplicate id "${id}" used more than once`,
        explanation: `HTML element IDs must be unique across the document. Rename duplicate ID "${id}" or use a class.`,
        fixType: "html_rename_duplicate_id"
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
        category: "syntax",
        message: `Mismatched <${tag}> tags: ${openMatches.length} opened, ${closeMatches.length} closed`,
        explanation: `Ensure every opened <${tag}> tag has an exact corresponding closing </${tag}> tag.`,
        fixType: "html_close_tag"
      });
    }
  });

  // Missing lang attribute
  const htmlTagMatch = code.match(/<html(?![^>]*\blang=)[^>]*>/i);
  if (htmlTagMatch) {
    errors.push({
      line: getLineNumber(code, htmlTagMatch.index),
      type: "warning",
      category: "accessibility",
      message: "Missing lang attribute on <html> tag",
      explanation: "Declare document language with lang=\"en\" on <html> to assist screen readers and search engines.",
      fixType: "html_add_lang"
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