function getLineNumber(code, index) {
  return code.slice(0, index).split('\n').length;
}

function stripCSSComments(code) {
  return (code || "").replace(/\/\*[\s\S]*?\*\//g, m => ' '.repeat(m.length));
}

function analyzeCSS(code) {
  const errors = [];
  const cleaned = stripCSSComments(code);

  // !important
  for (const match of cleaned.matchAll(/!important/gi)) {
    errors.push({
      line: getLineNumber(code, match.index),
      type: "warning",
      category: "style",
      message: "Use of !important — avoid when possible, indicates specificity issues",
      explanation: "Avoid !important to maintain natural CSS cascade and prevent difficult-to-override rules.",
      fixType: "css_remove_important"
    });
  }

  // Empty rule blocks
  for (const match of cleaned.matchAll(/([^{};]+)\{\s*\}/g)) {
    const rawSel = match[1];
    const selector = rawSel.trim();
    if (!selector || /\b(public|private|protected|static|void|class|interface|def|function)\b/.test(selector) || selector.includes("(")) continue;
    const leadingWsLen = rawSel.length - rawSel.trimStart().length;
    const selIndex = match.index + match[0].indexOf(rawSel) + leadingWsLen;
    errors.push({
      line: getLineNumber(code, selIndex),
      type: "warning",
      category: "style",
      message: `Empty rule block for "${selector}"`,
      explanation: `Empty rule blocks add dead weight to stylesheets. Remove "${selector}" or populate its declarations.`,
      fixType: "css_remove_empty_rule"
    });
  }

  // Duplicate and Overly specific selectors
  const selectorMatches = [...cleaned.matchAll(/(?:^|[;{}])\s*([^;{}]+)\{/g)];
  const seen = new Map();
  const nonSelectorKeywords = /\b(public|private|protected|static|void|package|import|interface|abstract|def|function|return|switch|while|for|if|else|try|catch|finally|throw|new|const|let|var|int|float|double|boolean|char|String|class)\b/;

  selectorMatches.forEach(m => {
    const rawSel = m[1];
    const sel = rawSel.trim();
    if (!sel || nonSelectorKeywords.test(sel) || sel.includes("(")) return;

    const leadingWsLen = rawSel.length - rawSel.trimStart().length;
    const selIndex = m.index + m[0].indexOf(rawSel) + leadingWsLen;
    const selLine = getLineNumber(code, selIndex);

    if (seen.has(sel)) {
      errors.push({
        line: selLine,
        type: "warning",
        category: "duplication",
        message: `Duplicate selector "${sel}" defined more than once`,
        explanation: "Consolidate duplicate selector declarations into a single CSS rule block to avoid redundancy.",
        fixType: "css_comment_duplicate"
      });
    }
    seen.set(sel, true);

    const parts = sel.split(/\s+/).filter(Boolean);
    if (parts.length > 3) {
      errors.push({
        line: selLine,
        type: "warning",
        category: "style",
        message: `Overly specific selector "${sel}" — consider simplifying`,
        explanation: "Deeply nested selectors increase specificity and make styles difficult to override. Simplify selector.",
        fixType: "css_simplify_selector"
      });
    }
  });

  // Missing semicolons before closing brace
  for (const match of cleaned.matchAll(/[a-zA-Z0-9%)\]"']\s*\n\s*\}/g)) {
    errors.push({
      line: getLineNumber(code, match.index),
      type: "error",
      category: "syntax",
      message: "Possible missing semicolon before closing brace",
      explanation: "CSS declarations must terminate with a semicolon ';' before the closing brace.",
      fixType: "add_semicolon"
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