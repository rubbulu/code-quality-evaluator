// Initialize CodeMirror with Error Gutter support
const editor = CodeMirror.fromTextArea(document.getElementById("codeEditor"), {
  lineNumbers: true,
  mode: "javascript",
  theme: "dracula",
  lineWrapping: true,
  gutters: ["CodeMirror-linenumbers", "error-gutter"]
});

// Toast Notification Helper
function showToast(message, type = "success") {
  let toast = document.getElementById("appToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "appToast";
    toast.className = "app-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = `app-toast visible ${type}`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.className = "app-toast";
  }, 3500);
}

// In-Editor Line Highlighting and Gutter Markers
function clearEditorHighlights() {
  editor.eachLine(lineHandle => {
    editor.removeLineClass(lineHandle, "background", "cm-error-line");
    editor.removeLineClass(lineHandle, "background", "cm-warning-line");
    editor.setGutterMarker(lineHandle, "error-gutter", null);
  });
}

function highlightEditorErrors(errors) {
  clearEditorHighlights();
  if (!Array.isArray(errors) || errors.length === 0) return;

  const totalLines = editor.lineCount();

  errors.forEach(err => {
    if (!err.line) return;
    const lineIndex = err.line - 1;
    if (lineIndex < 0 || lineIndex >= totalLines) return;

    const isError = err.type === "error";
    const lineClass = isError ? "cm-error-line" : "cm-warning-line";
    editor.addLineClass(lineIndex, "background", lineClass);

    // Add Gutter Dot / Marker
    const marker = document.createElement("div");
    marker.className = `gutter-marker ${isError ? 'error' : 'warning'}`;
    marker.textContent = isError ? "●" : "▲";
    marker.title = `Line ${err.line}: ${err.message}`;
    marker.onclick = () => jumpToLine(err.line);
    editor.setGutterMarker(lineIndex, "error-gutter", marker);
  });
}

function jumpToLine(lineNumber) {
  if (!lineNumber || isNaN(lineNumber)) lineNumber = 1;
  const maxLines = editor.lineCount();
  const clampedLine = Math.min(Math.max(1, Number(lineNumber)), maxLines);
  const lineIdx = clampedLine - 1;
  const lineContent = editor.getLine(lineIdx) || "";

  editor.focus();
  editor.setCursor({ line: lineIdx, ch: 0 });
  editor.setSelection({ line: lineIdx, ch: 0 }, { line: lineIdx, ch: lineContent.length });
  editor.scrollIntoView({ line: lineIdx, ch: 0 }, 120);
  showToast(`Jumped to Line ${clampedLine}`);
}

// Inspector Tab Switching
const inspectorTabs = document.querySelectorAll(".inspector-tab");
const inspectorPanels = document.querySelectorAll(".inspector-panel");

function switchInspectorTab(targetPanelId) {
  inspectorTabs.forEach(t => t.classList.toggle("active", t.dataset.target === targetPanelId));
  inspectorPanels.forEach(p => p.classList.toggle("active", p.id === targetPanelId));

  if (targetPanelId === "panelDashboard") {
    setTimeout(() => {
      if (errorBreakdownChartInstance) errorBreakdownChartInstance.resize();
      if (languageBreakdownChartInstance) languageBreakdownChartInstance.resize();
      if (scoreDistributionChartInstance) scoreDistributionChartInstance.resize();
    }, 60);
  }
}

inspectorTabs.forEach(tab => {
  tab.addEventListener("click", () => {
    switchInspectorTab(tab.dataset.target);
  });
});

// Theme Toggle
const themeToggle = document.getElementById("themeToggle");
function applyTheme(theme) {
  document.body.classList.toggle("light", theme === "light");
  editor.setOption("theme", theme === "light" ? "default" : "dracula");
  themeToggle.innerText = theme === "light" ? "🌙" : "☀️";
  localStorage.setItem("cqe-theme", theme);
}
applyTheme(localStorage.getItem("cqe-theme") || "dark");
themeToggle.addEventListener("click", () => {
  applyTheme(document.body.classList.contains("light") ? "dark" : "light");
});

// Language Tabs
const tabs = document.querySelectorAll("#langTabs .tab");
tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    editor.setOption("mode", tab.dataset.mode);
    document.getElementById("statusLang").innerText = tab.dataset.label;
    const titleEl = document.getElementById("editorFileTitle");
    if (titleEl) titleEl.innerText = `${tab.dataset.label} Source`;
    clearEditorHighlights();
  });
});

function currentLanguage() {
  const active = document.querySelector("#langTabs .tab.active");
  return active ? active.dataset.mode : "javascript";
}

function currentLanguageLabel() {
  const active = document.querySelector("#langTabs .tab.active");
  return active ? active.dataset.label : "JavaScript";
}

// Smart Language Auto-Detection
function detectLanguageFromCode(code) {
  if (!code || typeof code !== "string") return null;
  const trimmed = code.trim();
  if (trimmed.length < 15) return null;

  // 1. Java / CLike indicators
  if (/\b(import\s+java\.|public\s+class\s+|public\s+static\s+void\s+main|System\.(out|err)\.print|Scanner\s+\w+\s*=|package\s+[a-z0-9_.]+;)/.test(trimmed)) {
    return "clike";
  }

  // 2. HTML indicators
  if (/<!DOCTYPE\s+html|<html[\s>]|<head[\s>]|<body[\s>]|<div[\s>]|<span[\s>]|<p[\s>]|<table[\s>]|<script[\s>]|<style[\s>]/i.test(trimmed)) {
    return "htmlmixed";
  }

  // 3. Python indicators
  if (/\b(def\s+\w+\s*\(|elif\b|import\s+sys|import\s+os|if\s+__name__\s*==\s*['"]__main__['"])/.test(trimmed) || /^\s*#\s*.*python/im.test(trimmed)) {
    return "python";
  }

  // 4. CSS indicators (without JS/Java keywords)
  const noComments = trimmed.replace(/\/\*[\s\S]*?\*\//g, "").trim();
  if (/^(\.[a-zA-Z_-][\w-]*|#[a-zA-Z_-][\w-]*|[a-zA-Z][\w-]*)\s*\{[^}]*:[^}]*(\}|;)/.test(noComments)
    && !/\b(function|const|let|var|class|def|import|public)\b/.test(noComments)) {
    return "css";
  }

  // 5. JavaScript indicators
  if (/\b(const|let|var)\s+[A-Za-z_$][\w$]*\s*=|function\s+[A-Za-z_$][\w$]*\s*\(|console\.(log|error|warn)\(|=>\s*\{|\bexport\s+default\b/.test(trimmed)) {
    return "javascript";
  }

  return null;
}

// Auto-switch tabs when code is pasted
editor.on("paste", (cm) => {
  setTimeout(() => {
    const code = cm.getValue();
    const detected = detectLanguageFromCode(code);
    if (detected && detected !== currentLanguage()) {
      const targetTab = document.querySelector(`#langTabs .tab[data-mode="${detected}"]`);
      if (targetTab) {
        targetTab.click();
        showToast(`Auto-detected ${targetTab.dataset.label} code! Switched tab.`);
      }
    }
  }, 120);
});

// Sample Code Presets
const SAMPLE_CODES = {
  java_errors: `// Java Test: Demonstrates Syntax, Types & Condition Checks
import java.util.Scanner;

public class StudentRegistry {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        System.out.println("Enter student name: ");
        String name = sc.nextLine();

        // Error 1: Missing semicolon
        System.out.println("Enrolling " + name)

        // Error 2: Incompatible data type assignment
        int marks = "85";

        int age = 18;
        // Error 3: Accidental assignment in condition
        if (age = 18) {
            System.out.println("Age is eligible");
        }

        // Error 4: Empty catch block
        try {
            int score = Integer.parseInt("invalid");
        } catch (Exception e) {}
    }
}`,
  js_scope: `// JavaScript Test: Complexity & Unused Variable
function processUserData(users) {
    let unneededToken = "xyz123"; // Unused variable
    let total = 0;

    for (let i = 0; i < users.length; i++) {
        if (users[i].active && users[i].age > 18) {
            total += users[i].score;
        } else if (users[i].pending) {
            total += 5;
        }
    }

    return total;
}`,
  python_style: `# Python Test: PEP8 Naming & Syntax
def calculateScores(scoresList):
    TotalSum = 0  # Should use lowercase snake_case
    for s in scoresList:
        TotalSum += s
    print "Scores calculated"  # Python 2 print statement
    return TotalSum
`,
  html_sample: `<!-- HTML Test: Semantic & Accessibility -->
<div id="main-content">
  <h1>Code Quality Evaluator Dashboard</h1>
  <!-- Image without alt attribute -->
  <img src="https://images.unsplash.com/photo-1555066931-4365d14bab8c">
  <!-- Inline style -->
  <p style="color: red; font-size: 14px;">Inline CSS should be replaced by classes.</p>
  <!-- Duplicate ID -->
  <div id="main-content">Duplicate Section</div>
</div>`,
  css_sample: `/* CSS Test: Style Standards & Specificity */
.container {
  color: #333333 !important; /* Avoid !important */
  padding: 10px /* Missing semicolon before closing brace */
}

/* Empty rule block */
.empty-hero-block {
}

/* Overly specific selector */
.dashboard-wrapper .main-container .section-body .card-item span {
  display: block;
}`,
  clean_example: `// Clean Compliant Implementation (100/100)
import java.util.Scanner;

public class CleanDemo {
    private static final int PASSING_SCORE = 75;

    public static void main(String[] args) {
        try (Scanner sc = new Scanner(System.in)) {
            System.out.print("Enter candidate score: ");
            if (sc.hasNextInt()) {
                int score = sc.nextInt();
                if (score >= PASSING_SCORE) {
                    System.out.println("Passed with distinction!");
                } else {
                    System.out.println("Needs improvement.");
                }
            }
        }
    }
}`
};

const snippetPicker = document.getElementById("snippetPicker");
if (snippetPicker) {
  snippetPicker.addEventListener("change", (e) => {
    const val = e.target.value;
    if (!val || !SAMPLE_CODES[val]) return;

    if (val === "java_errors" || val === "clean_example") {
      document.querySelector('[data-mode="clike"]').click();
    } else if (val === "js_scope") {
      document.querySelector('[data-mode="javascript"]').click();
    } else if (val === "python_style") {
      document.querySelector('[data-mode="python"]').click();
    } else if (val === "html_sample") {
      document.querySelector('[data-mode="htmlmixed"]').click();
    } else if (val === "css_sample") {
      document.querySelector('[data-mode="css"]').click();
    }

    editor.setValue(SAMPLE_CODES[val]);
    showToast(`Loaded "${e.target.options[e.target.selectedIndex].text}"`);
    snippetPicker.value = "";
  });
}

const clearBtn = document.getElementById("clearEditorBtn");
if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    editor.setValue("");
    clearEditorHighlights();
    showToast("Editor cleared");
  });
}

// Track Lines of Code dynamically
editor.on("change", () => {
  const code = editor.getValue();
  const loc = code.split("\n").filter(l => l.trim().length > 0).length;
  const quickLOC = document.getElementById("quickLOC");
  if (quickLOC) quickLOC.innerText = loc;
});

// Quality Score Ring & Grade
const RING_CIRCUMFERENCE = 377;
function updateRing(score, gradeObj) {
  const ring = document.getElementById("ringFill");
  const scoreLabel = document.getElementById("ringScore");
  const offset = RING_CIRCUMFERENCE - (RING_CIRCUMFERENCE * score) / 100;

  ring.style.strokeDashoffset = offset;
  scoreLabel.innerText = score;

  let color = "#8b93a7";
  let verdictText = "Needs Refactoring";
  let verdictDesc = "Critical syntax, type, or architectural issues detected.";

  if (score >= 85) {
    color = "#6fcf97";
    verdictText = "Production Ready";
    verdictDesc = "High quality code adhering to conventions and clean architecture.";
  } else if (score >= 65) {
    color = "#4fd1c5";
    verdictText = "Good Quality";
    verdictDesc = "Minor warnings or style improvements suggested before shipping.";
  } else if (score >= 40) {
    color = "#e8a33d";
    verdictText = "Moderate Quality";
    verdictDesc = "Code has warnings and syntax issues requiring attention.";
  } else {
    color = "#f2637a";
  }

  ring.style.stroke = color;
  const verdictEl = document.getElementById("scoreVerdict");
  const descEl = document.getElementById("scoreDescription");
  if (verdictEl) verdictEl.innerText = verdictText;
  if (descEl) descEl.innerText = verdictDesc;

  // Update Letter Grade Badge (A+, A, B, C, D)
  const gradeEl = document.getElementById("scoreGrade");
  if (gradeEl) {
    const letter = gradeObj && gradeObj.grade ? gradeObj.grade : (score >= 95 ? "A+" : score >= 85 ? "A" : score >= 70 ? "B" : score >= 50 ? "C" : "D");
    gradeEl.innerText = `GRADE ${letter}`;
    const cleanClass = letter.toLowerCase().replace('+', 'plus');
    gradeEl.className = `grade-badge grade-${cleanClass}`;
  }
}

// Automated One-Click Line Fixer
function autoFixIssue(lineNum, fixType, event) {
  if (event) {
    if (typeof event.stopPropagation === "function") event.stopPropagation();
    if (typeof event.preventDefault === "function") event.preventDefault();
  }
  if (!lineNum || lineNum <= 0 || lineNum > editor.lineCount()) return;

  const lineIdx = lineNum - 1;
  const currentLine = editor.getLine(lineIdx);
  if (currentLine === undefined || currentLine === null) return;
  let fixedLine = currentLine;

  const matchedErr = (lastAnalysisResult && Array.isArray(lastAnalysisResult.errors))
    ? lastAnalysisResult.errors.find(err => err.line === lineNum)
    : null;
  const errorMsg = matchedErr ? (matchedErr.message || "") : "";

  if (fixType === "add_semicolon") {
    if (/\/\*.*\*\/|\/\//.test(currentLine)) {
      fixedLine = currentLine.replace(/(\s*)(\/\*[\s\S]*?\*\/|\/\/.*)$/, '; $2');
    } else {
      fixedLine = currentLine.replace(/\s*$/, ";");
    }
  } else if (fixType === "add_paren_semicolon") {
    const opens = (currentLine.match(/\(/g) || []).length;
    const closes = (currentLine.match(/\)/g) || []).length;
    const needed = Math.max(1, opens - closes);
    const closing = ")".repeat(needed);
    fixedLine = currentLine.replace(/\s*$/, `${closing};`);
  } else if (fixType === "replace_var") {
    fixedLine = currentLine.replace(/\bvar\b/, "let");
  } else if (fixType === "strip_quotes") {
    // int marks = "85"; -> int marks = 85;
    fixedLine = currentLine.replace(/(=\s*)["'](\d+(?:\.\d+)?)["']/, "$1$2");
  } else if (fixType === "wrap_quotes") {
    // String s = 85; -> String s = "85";
    fixedLine = currentLine.replace(/(=\s*)(\d+)\s*;/, '$1"$2";');
  } else if (fixType === "condition_equals") {
    // if (age = 18) -> if (age == 18)
    fixedLine = currentLine.replace(/\b(if|while)\s*\(([^=!<>\n]*)\s*=\s*([^=!<>\n]*\))/, "$1 ($2 == $3");
  } else if (fixType === "catch_log") {
    // catch (Exception e) {} -> catch (Exception e) { e.printStackTrace(); }
    if (/catch\s*\(([^)]*)\)\s*\{\s*\}/.test(currentLine)) {
      fixedLine = currentLine.replace(/catch\s*\(([^)]*)\)\s*\{\s*\}/, "catch ($1) { e.printStackTrace(); }");
    } else {
      const fullCode = editor.getValue();
      const updated = fullCode.replace(/catch\s*\(([^)]*)\)\s*\{\s*\}/g, 'catch ($1) { e.printStackTrace(); }');
      if (updated !== fullCode) {
        editor.setValue(updated);
        showToast("🪄 Auto-fixed: Added e.printStackTrace() to empty catch block! Re-evaluating...");
        setTimeout(runAnalysis, 350);
        return;
      }
    }
  } else if (fixType === "python_print_parens") {
    // print "hello" -> print("hello")
    fixedLine = currentLine.replace(/^(\s*)print\s+([^(\s].*)$/, "$1print($2)");
  } else if (fixType === "env_var") {
    // apiKey = "secret123" -> apiKey = process.env.API_SECRET
    fixedLine = currentLine.replace(/(=\s*)["'][^"']+["']/, '$1process.env.API_SECRET');
  } else if (fixType === "remove_eval") {
    // Dangerous eval -> JSON.parse
    fixedLine = currentLine.replace(/\beval\s*\(([^)]+)\)/, 'JSON.parse($1)');
  } else if (fixType === "parameterized_query") {
    // SQL query concatenation
    fixedLine = currentLine.replace(/\+\s*([A-Za-z_][\w]*)/, ', [$1]');
  } else if (fixType === "prefix_unused") {
    // Unused variable in JS -> prefix with '_' or comment out if already prefixed
    const unusedMatch = currentLine.match(/\b(const|let|var)\s+([A-Za-z_$][\w$]*)/);
    if (unusedMatch) {
      const varName = unusedMatch[2];
      if (/^_+/.test(varName)) {
        // Already prefixed with underscore(s) -> comment out the unused declaration
        fixedLine = currentLine.replace(/^(\s*)(const|let|var)\s+/, '$1// $2 ');
      } else {
        fixedLine = currentLine.replace(new RegExp(`\\b${varName}\\b`), `_${varName}`);
      }
    }
  } else if (fixType === "close_scanner") {
    // Resource leak auto-fix: Scanner sc = new Scanner(...) -> close sc at end of method
    const scMatch = currentLine.match(/\bScanner\s+(\w+)\s*=/);
    const varName = scMatch ? scMatch[1] : "sc";

    const totalLines = editor.lineCount();
    let insertIdx = -1;
    let foundBraces = 0;

    for (let i = totalLines - 1; i > lineIdx; i--) {
      const rawLine = editor.getLine(i);
      if (rawLine.trim() === "}") {
        foundBraces++;
        if (rawLine.startsWith(" ") || rawLine.startsWith("\t") || foundBraces === 2) {
          insertIdx = i;
          break;
        }
      }
    }

    if (insertIdx !== -1) {
      const indent = editor.getLine(lineIdx).match(/^\s*/)[0];
      editor.replaceRange(`${indent}${varName}.close();\n`, { line: insertIdx, ch: 0 });
      showToast(`🪄 Auto-fixed: Added ${varName}.close() before method exit! Re-evaluating...`);
      setTimeout(runAnalysis, 350);
      return;
    }
  } else if (fixType === "snake_case" || fixType === "camel_case") {
    let oldName = null;

    // 1. Try extracting variable name directly from the error message if provided
    if (errorMsg) {
      const msgMatch = errorMsg.match(/Variable ['"]?([A-Za-z0-9_]+)['"]?/i);
      if (msgMatch) oldName = msgMatch[1];
    }

    // 2. Otherwise extract from currentLine
    if (!oldName) {
      const typedMatch = currentLine.match(/\b(int|float|double|char|long|short|boolean|bool|string|let|var|const)\s+([A-Za-z_][A-Za-z0-9_]*)/);
      const assignMatch = currentLine.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?:=|\+=|-=|\*=|\/=)/);
      if (typedMatch) {
        oldName = typedMatch[2];
      } else if (assignMatch) {
        oldName = assignMatch[1];
      } else {
        const idMatch = currentLine.match(/\b([A-Z][A-Za-z0-9_]*)\b/);
        if (idMatch) oldName = idMatch[1];
      }
    }

    if (oldName) {
      let newName = oldName;
      if (fixType === "snake_case") {
        newName = oldName
          .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
          .toLowerCase();
      } else {
        newName = oldName
          .replace(/^_+/, "")
          .replace(/_([a-zA-Z0-9])/g, (_, c) => c.toUpperCase())
          .replace(/^[A-Z]/, c => c.toLowerCase());
      }

      if (oldName !== newName) {
        const fullCode = editor.getValue();
        const updatedCode = fullCode.replace(new RegExp(`\\b${oldName}\\b`, "g"), newName);
        editor.setValue(updatedCode);
        showToast(`🪄 Auto-fixed: Renamed "${oldName}" to "${newName}"! Re-evaluating...`);
        setTimeout(runAnalysis, 350);
        return;
      }
    }
  } else if (fixType === "replace_tabs") {
    fixedLine = currentLine.replace(/\t/g, "    ");
  } else if (fixType === "tune_complexity") {
    const rules = getLinterRules();
    const currentLimit = rules.maxComplexity || 15;
    const newLimit = Math.min(30, currentLimit + 5);
    rules.maxComplexity = newLimit;
    saveLinterRules(rules);
    if (typeof initRulesModalUI === "function") {
      initRulesModalUI();
    }
    showToast(`🪄 Auto-tuned complexity threshold to ${newLimit}! Re-evaluating...`);
    setTimeout(runAnalysis, 350);
  } else if (fixType === "html_add_alt") {
    if (!/alt\s*=/i.test(currentLine)) {
      fixedLine = currentLine.replace(/(<img\b[^>]*?)(\/?>)/i, '$1 alt="Image description"$2');
    }
  } else if (fixType === "html_add_doctype") {
    editor.replaceRange("<!DOCTYPE html>\n", { line: 0, ch: 0 });
    showToast("🪄 Auto-fixed: Added <!DOCTYPE html> declaration! Re-evaluating...");
    setTimeout(runAnalysis, 350);
    return;
  } else if (fixType === "html_remove_inline_style") {
    fixedLine = currentLine.replace(/\s*style\s*=\s*"[^"]*"/i, ' class="custom-styled"');
  } else if (fixType === "html_rename_duplicate_id") {
    fixedLine = currentLine.replace(/(\bid\s*=\s*"([^"]+)")/i, 'id="$2-section"');
  } else if (fixType === "html_add_lang") {
    fixedLine = currentLine.replace(/<html(?![^>]*\blang=)/i, '<html lang="en"');
  } else if (fixType === "css_remove_important") {
    fixedLine = currentLine.replace(/\s*!important\s*(?=[;\n}]|$)/i, "");
  } else if (fixType === "css_remove_empty_rule") {
    const fullCode = editor.getValue();
    const updatedCode = fullCode.replace(/([^{};\n]+)\{\s*\}/g, (m, s) => '/* ' + s.trim() + ' (empty rule removed) */');
    if (updatedCode !== fullCode) {
      editor.setValue(updatedCode);
      showToast("🪄 Auto-fixed: Cleaned up empty CSS rule block! Re-evaluating...");
      setTimeout(runAnalysis, 350);
      return;
    }
  } else if (fixType === "css_simplify_selector") {
    if (currentLine.includes("{")) {
      fixedLine = currentLine.replace(/^([^{]+)\{/, (_, sel) => {
        const parts = sel.trim().split(/\s+/).filter(Boolean);
        const simplified = parts.length > 2 ? parts.slice(-2).join(" ") : parts.join(" ");
        const indent = currentLine.match(/^\s*/)[0];
        return `${indent}${simplified} {`;
      });
    } else {
      const parts = currentLine.trim().split(/\s+/).filter(Boolean);
      const simplified = parts.length > 2 ? parts.slice(-2).join(" ") : parts.join(" ");
      const indent = currentLine.match(/^\s*/)[0];
      fixedLine = `${indent}${simplified}`;
    }
  } else if (fixType === "html_close_tag") {
    const tagMatch = errorMsg.match(/<(\w+)>/);
    const tag = tagMatch ? tagMatch[1] : "div";
    const fullCode = editor.getValue();
    if (fullCode.includes("</body>")) {
      editor.setValue(fullCode.replace("</body>", `  </${tag}>\n</body>`));
    } else {
      editor.setValue(fullCode + `\n</${tag}>`);
    }
    showToast(`🪄 Auto-fixed: Closed missing </${tag}> tag! Re-evaluating...`);
    setTimeout(runAnalysis, 350);
    return;
  } else if (fixType === "comment_duplicate" || fixType === "css_comment_duplicate") {
    const isCss = (typeof currentLanguage === "function" && currentLanguage() === "css");
    fixedLine = isCss ? `/* [Merged duplicate] */ ${currentLine}` : `// [Extracted duplicate] ${currentLine}`;
  } else if (fixType === "crypto_random") {
    fixedLine = currentLine.replace(/Math\.random\(\)(\.toString\(\d+\))?/, "(typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'sec_' + Date.now())");
  } else if (fixType === "remove_exec") {
    fixedLine = currentLine.replace(/\bexec\s*\(/, "// exec(");
  } else if (fixType === "balance_braces") {
    const fullCode = editor.getValue();
    editor.setValue(fullCode + "\n}");
    showToast("🪄 Auto-fixed: Added missing closing brace '}'! Re-evaluating...");
    setTimeout(runAnalysis, 350);
    return;
  } else if (fixType === "break_long_line") {
    if (currentLine.length > 80) {
      const splitAt = currentLine.lastIndexOf(",", 80) !== -1 ? currentLine.lastIndexOf(",", 80) + 1 : currentLine.lastIndexOf(" ", 80);
      if (splitAt > 20) {
        const indent = currentLine.match(/^\s*/)[0] + "  ";
        fixedLine = currentLine.slice(0, splitAt) + "\n" + indent + currentLine.slice(splitAt).trimStart();
      }
    }
  }

  // Intelligent fallback if specific fixType wasn't triggered
  if (fixedLine === currentLine) {
    if (/semicolon/i.test(errorMsg)) {
      fixedLine = currentLine.replace(/\s*$/, ";");
    } else if (/incompatible.*String.*numeric/i.test(errorMsg)) {
      fixedLine = currentLine.replace(/(=\s*)["'](\d+(?:\.\d+)?)["']/, "$1$2");
    } else if (/incompatible.*numeric.*String/i.test(errorMsg)) {
      fixedLine = currentLine.replace(/(=\s*)(\d+)\s*;/, '$1"$2";');
    } else if (/condition|equals/i.test(errorMsg)) {
      fixedLine = currentLine.replace(/\b(if|while)\s*\(([^=!<>\n]*)\s*=\s*([^=!<>\n]*\))/, "$1 ($2 == $3");
    } else if (/print/i.test(errorMsg)) {
      fixedLine = currentLine.replace(/^(\s*)print\s+([^(\s].*)$/, "$1print($2)");
    } else if (/declared but never used|unused/i.test(errorMsg)) {
      fixedLine = currentLine.replace(/\b(const|let|var)\s+([A-Za-z_$][\w$]*)/, (m, kw, vn) => `${kw} _${vn}`);
    } else {
      fixedLine = currentLine + " // auto-fixed";
    }
  }

  if (fixedLine !== currentLine) {
    editor.replaceRange(fixedLine, { line: lineIdx, ch: 0 }, { line: lineIdx, ch: currentLine.length });
    showToast(`🪄 Auto-fixed Line ${lineNum}! Re-evaluating...`);
    setTimeout(runAnalysis, 350);
  } else {
    showToast("Line already modified or cannot be automatically patched.", "error");
  }
}

// Issues List with 1-2 line Explanations & Auto-Fix
function renderIssues(errors) {
  const list = document.getElementById("issuesList");
  const badgeIssueCount = document.getElementById("badgeIssueCount");
  const editorIssueBadge = document.getElementById("editorIssueBadge");

  const total = errors ? errors.length : 0;
  if (badgeIssueCount) badgeIssueCount.innerText = total;
  if (editorIssueBadge) {
    editorIssueBadge.innerText = total === 0 ? "0 issues" : `${total} issue${total > 1 ? 's' : ''}`;
    editorIssueBadge.classList.toggle("clean", total === 0);
  }

  if (!errors || errors.length === 0) {
    list.innerHTML = `
      <div class="issue-empty">
        <span class="empty-icon">✓</span>
        <p>No issues detected! Clean, compliant code.</p>
      </div>
    `;
    clearEditorHighlights();
    return;
  }

  // Highlight lines in CodeMirror with gutter markers
  highlightEditorErrors(errors);

  list.innerHTML = errors.map(e => {
    const isSecurity = e.category === "security";
    const isError = e.type === "error";
    const typeLabel = isSecurity ? "SECURITY" : (isError ? "ERROR" : "WARNING");
    const severityClass = isSecurity ? "security" : (isError ? "error" : "warning");
    const lineText = e.line ? `Line ${e.line}` : "General";

    const autoFixBtnHtml = `
      <button class="autofix-btn" onclick="event.stopPropagation(); autoFixIssue(${e.line || 1}, '${e.fixType || 'smart_fix'}', event);" title="Automatically patch this line in editor">
        <span class="btn-icon">🪄</span> Auto-Fix
      </button>
    `;

    const explanationText = e.explanation || (isError
      ? "Resolve this critical syntax or type conflict to enable code compilation and execution."
      : "Address this convention or logic pattern to improve maintainability and avoid subtle runtime bugs.");

    const cardTitle = `Line ${e.line || 1}: ${e.message}`;
    return `
      <div class="issue-card ${severityClass}" onclick="jumpToLine(${e.line || 1})" title="${cardTitle}">
        <div class="issue-card-header">
          <div class="issue-tags">
            <span class="issue-line-badge">${lineText}</span>
            <span class="issue-severity-badge ${severityClass}">${typeLabel}</span>
          </div>
          <div class="issue-actions-top">
            ${autoFixBtnHtml}
            <button class="jump-btn" onclick="event.stopPropagation(); jumpToLine(${e.line || 1})" title="Jump to Line ${e.line || 1} in editor">
              <span class="btn-icon">↗</span> Jump
            </button>
          </div>
        </div>
        <div class="issue-message">${e.message}</div>
        <div class="issue-explanation-box">
          <span class="explanation-icon">💡</span>
          <div class="explanation-content">
            <span class="explanation-label">How to fix:</span>
            <p class="explanation-text">${explanationText}</p>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

// Backend connectivity check
async function checkBackend() {
  const statusEl = document.getElementById("connStatus");
  try {
    const res = await fetch("http://localhost:5000");
    if (res.ok) {
      statusEl.innerText = "● backend connected";
      statusEl.className = "conn-status online";
    } else throw new Error();
  } catch {
    statusEl.innerText = "● backend offline";
    statusEl.className = "conn-status offline";
  }
}
checkBackend();

// Dashboard Charts
Chart.defaults.color = "#8b93a7";
Chart.defaults.borderColor = "rgba(255,255,255,0.06)";

let errorBreakdownChartInstance = null;
let languageBreakdownChartInstance = null;
let scoreDistributionChartInstance = null;
let lastAnalysisResult = null;

function destroyChart(chartInstance) {
  if (chartInstance) chartInstance.destroy();
}

function renderErrorBreakdownChart(errors) {
  const canvas = document.getElementById("errorBreakdownChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const errorCounts = {};
  (errors || []).forEach(e => {
    const type = e.type || "warning";
    errorCounts[type] = (errorCounts[type] || 0) + 1;
  });

  destroyChart(errorBreakdownChartInstance);

  errorBreakdownChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: Object.keys(errorCounts).map(k => k.charAt(0).toUpperCase() + k.slice(1)),
      datasets: [{
        data: Object.values(errorCounts),
        backgroundColor: ["#f2637a", "#e8a33d", "#4fd1c5", "#6fcf97"],
        borderColor: "#1a1f2e",
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { boxWidth: 10, padding: 8, font: { size: 10 } }
        }
      }
    }
  });
}

function renderLanguageBreakdownChart(language) {
  const canvas = document.getElementById("languageBreakdownChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  destroyChart(languageBreakdownChartInstance);

  const languages = ["JavaScript", "Python", "Java", "C", "C++", "HTML", "CSS"];
  const languageMap = { javascript: "JavaScript", python: "Python", clike: "Java", htmlmixed: "HTML", css: "CSS" };
  const selected = languageMap[language] || "Unknown";

  languageBreakdownChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: languages,
      datasets: [{
        label: "Analysis Count",
        data: languages.map(l => l === selected ? 1 : 0),
        backgroundColor: languages.map(l => l === selected ? "#4fd1c5" : "#252b3d"),
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, max: 1, ticks: { display: false }, grid: { display: false } },
        y: { ticks: { color: "#8b93a7", font: { size: 10 } }, grid: { display: false } }
      }
    }
  });
}

function renderScoreDistributionChart(score) {
  const canvas = document.getElementById("scoreDistributionChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  destroyChart(scoreDistributionChartInstance);

  const ranges = ["0-20", "21-40", "41-60", "61-80", "81-100"];
  const distribution = [0, 0, 0, 0, 0];

  if (score <= 20) distribution[0] = 1;
  else if (score <= 40) distribution[1] = 1;
  else if (score <= 60) distribution[2] = 1;
  else if (score <= 80) distribution[3] = 1;
  else distribution[4] = 1;

  scoreDistributionChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ranges,
      datasets: [{
        label: "Score Range",
        data: distribution,
        backgroundColor: "#4fd1c5",
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, max: 1, ticks: { display: false }, grid: { display: false } },
        x: { ticks: { color: "#8b93a7", font: { size: 10 } }, grid: { display: false } }
      }
    }
  });
}

function updateMetrics(result) {
  const complexity = result.complexity !== undefined ? result.complexity : 1;
  const duplicatesCount = result.duplicates ? result.duplicates.length : 0;
  const totalIssues = result.errors ? result.errors.length : 0;
  const loc = result.loc || editor.getValue().split('\n').filter(l => l.trim().length > 0).length;

  let errorCount = 0;
  let warningCount = 0;
  (result.errors || []).forEach(e => {
    if (e.type === "error") errorCount++;
    else warningCount++;
  });

  // Top score stats row
  const statErrors = document.getElementById("statErrorsCount");
  const statWarnings = document.getElementById("statWarningsCount");
  const statSecurity = document.getElementById("statSecurityPill");
  const statDebt = document.getElementById("statDebtPill");

  const securityCount = result.securityCount || 0;
  const techDebtFormatted = result.techDebt ? result.techDebt.formatted : "0m (Clean)";
  const techDebtMins = result.techDebt ? result.techDebt.minutes : 0;

  if (statErrors) statErrors.innerText = `${errorCount} Error${errorCount !== 1 ? 's' : ''}`;
  if (statWarnings) statWarnings.innerText = `${warningCount} Warning${warningCount !== 1 ? 's' : ''}`;
  if (statSecurity) {
    statSecurity.innerText = `🛡️ ${securityCount} Security`;
    statSecurity.classList.toggle("has-security-issue", securityCount > 0);
  }
  if (statDebt) {
    statDebt.innerText = `⏱️ Debt: ${techDebtFormatted}`;
  }

  // Quick stats in editor status bar
  const quickComp = document.getElementById("quickComplexity");
  const quickDup = document.getElementById("quickDuplicates");
  const quickLOC = document.getElementById("quickLOC");
  if (quickComp) quickComp.innerText = complexity;
  if (quickDup) quickDup.innerText = duplicatesCount;
  if (quickLOC) quickLOC.innerText = loc;

  // Panel 3 Metrics
  const compEl = document.getElementById("metricComplexity");
  const compDesc = document.getElementById("metricComplexityDesc");
  const dupEl = document.getElementById("metricDuplicates");
  const debtEl = document.getElementById("metricDebt");
  const debtDesc = document.getElementById("metricDebtDesc");
  const secEl = document.getElementById("metricSecurity");
  const secDesc = document.getElementById("metricSecurityDesc");
  const issuesEl = document.getElementById("metricIssues");
  const locEl = document.getElementById("metricLOC");

  if (compEl) compEl.innerText = complexity;
  if (compDesc) {
    if (complexity <= 5) compDesc.innerText = "Low risk (Simple & Clean)";
    else if (complexity <= 10) compDesc.innerText = "Moderate risk (Consider refactor)";
    else compDesc.innerText = "High risk (Complex logic paths)";
  }
  if (dupEl) dupEl.innerText = duplicatesCount;
  if (debtEl) debtEl.innerText = techDebtFormatted;
  if (debtDesc) debtDesc.innerText = techDebtMins === 0 ? "Zero technical debt" : `${techDebtMins} mins estimated fix time`;
  if (secEl) secEl.innerText = securityCount;
  if (secDesc) secDesc.innerText = securityCount === 0 ? "No secrets or leaks" : `${securityCount} vulnerability detected`;
  if (issuesEl) issuesEl.innerText = totalIssues;
  if (locEl) locEl.innerText = loc;
}

function renderDashboard(result) {
  renderErrorBreakdownChart(result.errors || []);
  renderLanguageBreakdownChart(currentLanguage());
  renderScoreDistributionChart(result.score || 0);
  updateMetrics(result);
}

// Run Analysis
async function runAnalysis() {
  const code = editor.getValue();
  const language = currentLanguage();
  const statusReady = document.getElementById("statusReady");

  if (!code || code.trim().length === 0) {
    showToast("Please enter some code to analyze.", "error");
    statusReady.innerText = "Ready";
    return;
  }

  // Auto-detect mismatched language tabs
  const detected = detectLanguageFromCode(code);
  if (detected && detected !== language) {
    const targetTab = document.querySelector(`#langTabs .tab[data-mode="${detected}"]`);
    if (targetTab) {
      targetTab.click();
      showToast(`Auto-detected ${targetTab.dataset.label} code! Switched language tab.`);
      return runAnalysis();
    }
  }

  statusReady.innerText = "Analyzing…";

  try {
    const token = localStorage.getItem('cqe-token');

    const response = await fetch("http://localhost:5000/api/analyze", {
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ language, code, options: getLinterRules() })
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('cqe-token');
        const authBox = document.getElementById('authLinks');
        if (authBox) {
          authBox.innerHTML = '<a class="auth-link" href="login.html">Log in / Sign up</a>';
        }
      }
      throw new Error(`Backend error: ${response.status}`);
    }
    const result = await response.json();

    if (result.tokenExpired) {
      localStorage.removeItem('cqe-token');
      localStorage.removeItem('cqe-userId');
      const authBox = document.getElementById('authLinks');
      if (authBox) {
        authBox.innerHTML = '<a class="auth-link" href="history.html">History</a> <a class="auth-link" href="login.html">Log in / Sign up</a>';
      }
      showToast("Session expired. Report saved locally. Log in to sync to cloud.", "warning");
    }

    // Always persist to local browser history so history is never lost
    saveLocalHistory(result, code, language);

    lastAnalysisResult = {
      score: result.score,
      grade: result.grade,
      techDebt: result.techDebt,
      securityCount: result.securityCount || 0,
      errors: result.errors || [],
      language: language,
      timestamp: new Date(),
      complexity: result.complexity,
      duplicates: result.duplicates || []
    };

    const downloadBtn = document.getElementById("downloadReportBtn");
    if (downloadBtn) downloadBtn.disabled = false;

    updateRing(result.score ?? 0, result.grade);
    renderIssues(result.errors);
    renderDashboard(result);
    updateBadgesModal();
    statusReady.innerText = "Ready";

    // Switch to Issues tab to see results immediately
    switchInspectorTab("panelIssues");
    showToast(`Analysis complete: Score ${result.score}/100 (${result.grade ? result.grade.grade : 'B'})`);

  } catch (err) {
    statusReady.innerText = "Error";
    showToast(`Analysis failed: ${err.message}`, "error");
  }
}

// Local History Persistence
function saveLocalHistory(result, code, language) {
  try {
    const raw = localStorage.getItem("cqe-local-history");
    const history = raw ? JSON.parse(raw) : [];
    const entry = {
      _id: result.analysisId || `local_${Date.now()}`,
      language: language,
      code: code,
      score: result.score,
      grade: result.grade ? result.grade.grade : (result.score >= 90 ? "A" : "B"),
      errorCount: (result.errors || []).length,
      timestamp: new Date().toISOString()
    };
    history.unshift(entry);
    if (history.length > 30) history.pop();
    localStorage.setItem("cqe-local-history", JSON.stringify(history));
  } catch (e) {
    console.warn("Could not save to local history", e);
  }
}

// Check for code restored from History page
(function checkHistoryRestore() {
  const restoreCode = localStorage.getItem("cqe-restore-code");
  const restoreLang = localStorage.getItem("cqe-restore-lang");
  if (restoreCode) {
    localStorage.removeItem("cqe-restore-code");
    localStorage.removeItem("cqe-restore-lang");
    if (restoreLang) {
      const tab = document.querySelector(`#langTabs .tab[data-mode="${restoreLang}"]`);
      if (tab) tab.click();
    }
    editor.setValue(restoreCode);
    showToast("Loaded analysis from history!");
    setTimeout(runAnalysis, 350);
  }
})();

document.getElementById("analyzeBtn").addEventListener("click", runAnalysis);
editor.setOption("extraKeys", { "Ctrl-Enter": runAnalysis });

// AI Suggestions Tabbed View
function renderSuggestions(list, note) {
  const box = document.getElementById("suggestions");
  if (!box) return;
  box.innerHTML = "";

  if (!list || list.length === 0) {
    box.innerHTML = `<div class="suggest-empty-state"><p>No suggestions returned.</p></div>`;
    return;
  }

  const headerWrap = document.createElement("div");
  headerWrap.className = "ai-tabs-header";

  const noteEl = document.createElement("div");
  noteEl.className = "ai-note";
  noteEl.textContent = note || "AI-generated tailored suggestions.";

  const toolbar = document.createElement("div");
  toolbar.className = "ai-tabs-toolbar";

  const labelEl = document.createElement("div");
  labelEl.className = "ai-toolbar-label";
  labelEl.innerHTML = `<span>Select Approach (3 Generated):</span>`;

  const tabStrip = document.createElement("div");
  tabStrip.className = "ai-tabstrip";

  const panelsWrap = document.createElement("div");
  panelsWrap.className = "ai-panels-wrap";

  const verdictIcons = { weak: "⚠️", better: "⚡", best: "🏆" };
  const panels = [];
  const tabButtons = [];

  list.forEach((s, idx) => {
    const tabBtn = document.createElement("button");
    tabBtn.className = `ai-tab-btn ${s.verdict}`;
    tabBtn.title = `Switch to ${s.verdict.toUpperCase()} approach`;
    tabBtn.innerHTML = `<span>${verdictIcons[s.verdict] || "✨"}</span><span>${s.verdict.toUpperCase()}</span>`;
    tabStrip.appendChild(tabBtn);
    tabButtons.push(tabBtn);

    const panel = document.createElement("div");
    panel.className = `ai-panel ${s.verdict}`;
    panel.style.display = "none";

    const cardTop = document.createElement("div");
    cardTop.className = "ai-card-top";

    const titleGroup = document.createElement("div");
    titleGroup.className = "ai-title-group";

    const title = document.createElement("h3");
    title.className = "ai-approach-title";
    title.textContent = s.name;

    const badge = document.createElement("span");
    badge.className = `badge ${s.verdict}`;
    badge.textContent = s.verdict === "best" ? "🏆 BEST OPTION" : s.verdict.toUpperCase();

    titleGroup.append(title, badge);

    const metaWrap = document.createElement("div");
    metaWrap.className = "ai-metrics-pills";

    const timePill = document.createElement("span");
    timePill.className = "ai-meta-pill";
    timePill.textContent = `⏱️ ${s.time}`;

    const spacePill = document.createElement("span");
    spacePill.className = "ai-meta-pill";
    spacePill.textContent = `💾 ${s.space}`;

    metaWrap.append(timePill, spacePill);
    cardTop.append(titleGroup, metaWrap);

    const reasonBox = document.createElement("div");
    reasonBox.className = "ai-reason-box";
    const reasonText = document.createElement("p");
    reasonText.textContent = s.reason;
    reasonBox.appendChild(reasonText);

    const codeContainer = document.createElement("div");
    codeContainer.className = "ai-code-container";

    const codeHeader = document.createElement("div");
    codeHeader.className = "ai-code-header";

    const langBadge = document.createElement("span");
    langBadge.className = "ai-code-lang";
    langBadge.textContent = currentLanguageLabel();

    const codeActions = document.createElement("div");
    codeActions.className = "ai-code-actions";

    const copyBtn = document.createElement("button");
    copyBtn.className = "ai-action-btn copy-btn";
    copyBtn.innerHTML = `<span>📋</span> Copy`;
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(s.code);
        copyBtn.innerHTML = `<span>✓</span> Copied!`;
        copyBtn.classList.add("copied");
        setTimeout(() => {
          copyBtn.innerHTML = `<span>📋</span> Copy`;
          copyBtn.classList.remove("copied");
        }, 2000);
      } catch (err) {
        showToast("Failed to copy code", "error");
      }
    });

    const diffBtn = document.createElement("button");
    diffBtn.className = "ai-action-btn diff-btn";
    diffBtn.innerHTML = `<span>🔀</span> Diff`;
    diffBtn.title = "View Visual Diff against current editor code";
    diffBtn.addEventListener("click", () => {
      const approachTitle = s.name || s.title || "Alternative Implementation";
      openDiffModal(editor.getValue(), s.code, `${approachTitle} (${(s.verdict || 'clean').toUpperCase()})`);
    });

    const applyBtn = document.createElement("button");
    applyBtn.className = "ai-action-btn apply-btn";
    applyBtn.innerHTML = `<span>⚡</span> Apply to Editor`;
    applyBtn.addEventListener("click", () => {
      editor.setValue(s.code);
      clearEditorHighlights();
      showToast("Applied to editor! Click Analyze to test.");
    });

    codeActions.append(diffBtn, copyBtn, applyBtn);
    codeHeader.append(langBadge, codeActions);

    const pre = document.createElement("pre");
    const codeEl = document.createElement("code");
    codeEl.textContent = s.code; // Safe textContent against XSS
    pre.appendChild(codeEl);

    codeContainer.append(codeHeader, pre);
    panel.append(cardTop, reasonBox, codeContainer);
    panelsWrap.appendChild(panel);
    panels.push(panel);

    tabBtn.addEventListener("click", () => activateTab(idx));
  });

  // "Show All (3)" Tab Button
  const allBtn = document.createElement("button");
  allBtn.className = "ai-tab-btn all";
  allBtn.title = "View all 3 versions stacked together";
  allBtn.innerHTML = `<span>📑</span><span>SHOW ALL (3)</span>`;
  tabStrip.appendChild(allBtn);
  tabButtons.push(allBtn);
  allBtn.addEventListener("click", () => activateTab(list.length));

  function activateTab(index) {
    if (index === list.length) {
      // Show all panels stacked
      tabButtons.forEach((btn, i) => btn.classList.toggle("active", i === index));
      panels.forEach(p => p.style.display = "block");
      panelsWrap.classList.add("show-all");
    } else {
      tabButtons.forEach((btn, i) => btn.classList.toggle("active", i === index));
      panels.forEach((p, i) => p.style.display = i === index ? "block" : "none");
      panelsWrap.classList.remove("show-all");
    }
  }

  const defaultIdx = list.findIndex(s => s.verdict === "best");
  activateTab(defaultIdx !== -1 ? defaultIdx : 0);

  toolbar.append(labelEl, tabStrip);
  headerWrap.append(noteEl, toolbar);
  box.append(headerWrap, panelsWrap);
}

async function getSuggestions() {
  const box = document.getElementById("suggestions");
  const btn = document.getElementById("suggestBtn");
  if (!box || !btn) return;

  const code = editor.getValue();
  if (!code || code.trim().length === 0) {
    showToast("Please enter some code to analyze first.", "error");
    return;
  }

  // Switch to suggestions tab
  switchInspectorTab("panelSuggestions");

  btn.disabled = true;
  box.innerHTML = `
    <div class="ai-loading-box">
      <span class="spinner"></span>
      <p class="ai-loading-text">Gemini is analyzing logic and synthesizing alternatives…</p>
      <span class="ai-loading-subtext">Benchmarking Naive, Clean, and High-Performance patterns</span>
    </div>
  `;

  try {
    const response = await fetch("http://localhost:5000/api/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, language: currentLanguageLabel() })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    renderSuggestions(data.suggestions, data.note);
    showToast("AI Suggestions generated!");
  } catch (err) {
    box.innerHTML = `
      <div class="ai-error-box">
        <p><strong>Could not get suggestions:</strong> ${err.message}</p>
        <button class="ai-retry-btn" id="aiRetryBtn">Try Again</button>
      </div>
    `;
    const retryBtn = document.getElementById("aiRetryBtn");
    if (retryBtn) retryBtn.addEventListener("click", getSuggestions);
  } finally {
    btn.disabled = false;
  }
}

const suggestBtnEl = document.getElementById("suggestBtn");
if (suggestBtnEl) suggestBtnEl.addEventListener("click", getSuggestions);

// PDF Export Report
function generatePDFReport() {
  if (!lastAnalysisResult) {
    showToast("Please run an analysis first.", "error");
    return;
  }

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const primaryColor = [79, 209, 197];
    const textColor = [30, 30, 30];
    const lightGray = [150, 150, 150];

    let yPosition = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const contentWidth = pageWidth - (2 * margin);

    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text('Code Quality Report', margin, 18);

    yPosition = 42;
    doc.setTextColor(...lightGray);
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Generated: ${lastAnalysisResult.timestamp.toLocaleString()}`, margin, yPosition);
    yPosition += 8;

    doc.setDrawColor(...primaryColor);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 12;

    doc.setTextColor(...textColor);
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Quality Score', margin, yPosition);
    yPosition += 8;

    doc.setFontSize(18);
    doc.setTextColor(...primaryColor);
    doc.text(`${lastAnalysisResult.score} / 100`, margin, yPosition);
    yPosition += 12;

    doc.setTextColor(...textColor);
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.text(`Language: ${lastAnalysisResult.language}`, margin, yPosition);
    yPosition += 8;

    const complexity = lastAnalysisResult.complexity || '1';
    const duplicateCount = lastAnalysisResult.duplicates ? lastAnalysisResult.duplicates.length : 0;
    const issueCount = lastAnalysisResult.errors ? lastAnalysisResult.errors.length : 0;

    doc.text(`• Cyclomatic Complexity: ${complexity}`, margin + 5, yPosition); yPosition += 6;
    doc.text(`• Duplicate Lines: ${duplicateCount}`, margin + 5, yPosition); yPosition += 6;
    doc.text(`• Total Issues: ${issueCount}`, margin + 5, yPosition); yPosition += 12;

    doc.setFont(undefined, 'bold');
    doc.text('Detailed Issues & Guides', margin, yPosition);
    yPosition += 8;

    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);

    if (!lastAnalysisResult.errors || lastAnalysisResult.errors.length === 0) {
      doc.text('No issues found. Clean code!', margin + 5, yPosition);
    } else {
      lastAnalysisResult.errors.forEach((error, index) => {
        if (yPosition > 250) {
          doc.addPage();
          yPosition = 20;
        }
        const errorType = error.type ? error.type.toUpperCase() : 'WARNING';
        const errorLine = error.line ? `Line ${error.line}` : 'Unknown';
        doc.text(`${index + 1}. [${errorType}] ${errorLine}: ${error.message}`, margin + 5, yPosition);
        yPosition += 5;

        if (error.explanation) {
          const wrapped = doc.splitTextToSize(`   Fix: ${error.explanation}`, contentWidth - 10);
          doc.text(wrapped, margin + 5, yPosition);
          yPosition += (wrapped.length * 5) + 3;
        }
      });
    }

    doc.save(`code-quality-report-${Date.now()}.pdf`);
    showToast("PDF report downloaded!");
  } catch (error) {
    showToast(`PDF generation failed: ${error.message}`, "error");
  }
}

const downloadBtn = document.getElementById("downloadReportBtn");
if (downloadBtn) downloadBtn.addEventListener("click", generatePDFReport);

/* =========================================================
   FEATURE 5: LINTER RULES & THRESHOLDS CONFIGURATOR
   ========================================================= */
const DEFAULT_RULES = {
  semicolons: true,
  strictTypes: true,
  securityScanner: true,
  duplicateDetection: true,
  namingConventions: true,
  maxComplexity: 15
};

function getLinterRules() {
  try {
    const raw = localStorage.getItem("cqe-linter-rules");
    if (!raw) return { ...DEFAULT_RULES };
    const parsed = JSON.parse(raw);
    if (parsed.maxComplexity === 10 && !parsed._userCustomizedComplexity) {
      parsed.maxComplexity = 15;
    }
    return Object.assign({}, DEFAULT_RULES, parsed);
  } catch {
    return { ...DEFAULT_RULES };
  }
}

function saveLinterRules(rules) {
  localStorage.setItem("cqe-linter-rules", JSON.stringify(rules));
}

function openModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.style.display = "flex";
}
function closeModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.style.display = "none";
}

const rulesModalBtn = document.getElementById("rulesModalBtn");
const closeRulesModalBtn = document.getElementById("closeRulesModalBtn");
const resetRulesBtn = document.getElementById("resetRulesBtn");
const saveRulesBtn = document.getElementById("saveRulesBtn");
const slider = document.getElementById("ruleMaxComplexitySlider");
const sliderVal = document.getElementById("ruleMaxComplexityVal");

function initRulesModalUI() {
  const current = getLinterRules();
  if (document.getElementById("ruleSemicolons")) document.getElementById("ruleSemicolons").checked = !!current.semicolons;
  if (document.getElementById("ruleStrictTypes")) document.getElementById("ruleStrictTypes").checked = !!current.strictTypes;
  if (document.getElementById("ruleSecurityScanner")) document.getElementById("ruleSecurityScanner").checked = !!current.securityScanner;
  if (document.getElementById("ruleDuplicateDetection")) document.getElementById("ruleDuplicateDetection").checked = !!current.duplicateDetection;
  if (document.getElementById("ruleNamingConventions")) document.getElementById("ruleNamingConventions").checked = !!current.namingConventions;
  if (slider) {
    slider.value = current.maxComplexity || 15;
    if (sliderVal) sliderVal.innerText = slider.value;
  }
}

if (rulesModalBtn) {
  rulesModalBtn.addEventListener("click", () => {
    initRulesModalUI();
    openModal("rulesModal");
  });
}
if (closeRulesModalBtn) closeRulesModalBtn.addEventListener("click", () => closeModal("rulesModal"));

if (slider) {
  slider.addEventListener("input", (e) => {
    if (sliderVal) sliderVal.innerText = e.target.value;
  });
}

if (resetRulesBtn) {
  resetRulesBtn.addEventListener("click", () => {
    saveLinterRules(DEFAULT_RULES);
    initRulesModalUI();
    showToast("Reset linter rules to default settings");
  });
}

if (saveRulesBtn) {
  saveRulesBtn.addEventListener("click", () => {
    const rules = {
      semicolons: document.getElementById("ruleSemicolons") ? document.getElementById("ruleSemicolons").checked : true,
      strictTypes: document.getElementById("ruleStrictTypes") ? document.getElementById("ruleStrictTypes").checked : true,
      securityScanner: document.getElementById("ruleSecurityScanner") ? document.getElementById("ruleSecurityScanner").checked : true,
      duplicateDetection: document.getElementById("ruleDuplicateDetection") ? document.getElementById("ruleDuplicateDetection").checked : true,
      namingConventions: document.getElementById("ruleNamingConventions") ? document.getElementById("ruleNamingConventions").checked : true,
      maxComplexity: slider ? parseInt(slider.value, 10) : 15,
      _userCustomizedComplexity: true
    };
    saveLinterRules(rules);
    closeModal("rulesModal");
    showToast("Linter rules saved! Re-evaluating quality...");
    runAnalysis();
  });
}

/* =========================================================
   FEATURE 4: SIDE-BY-SIDE VISUAL DIFF VIEWER
   ========================================================= */
let currentDiffSuggestedCode = "";
let currentDiffOriginalCode = "";

function computeLineDiff(originalText, suggestedText) {
  const a = (originalText || "").split("\n");
  const b = (suggestedText || "").split("\n");
  const m = a.length;
  const n = b.length;

  if (m * n > 250000) {
    const maxLen = Math.max(m, n);
    const diff = [];
    for (let idx = 0; idx < maxLen; idx++) {
      if (idx < m && idx < n) {
        if (a[idx] === b[idx]) {
          diff.push({ type: 'equal', textA: a[idx], textB: b[idx], lineA: idx + 1, lineB: idx + 1 });
        } else {
          diff.push({ type: 'removed', textA: a[idx], textB: null, lineA: idx + 1, lineB: null });
          diff.push({ type: 'added', textA: null, textB: b[idx], lineA: null, lineB: idx + 1 });
        }
      } else if (idx < m) {
        diff.push({ type: 'removed', textA: a[idx], textB: null, lineA: idx + 1, lineB: null });
      } else {
        diff.push({ type: 'added', textA: null, textB: b[idx], lineA: null, lineB: idx + 1 });
      }
    }
    return diff;
  }

  const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  let i = m;
  let j = n;
  const result = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      result.push({ type: 'equal', textA: a[i - 1], textB: b[j - 1], lineA: i, lineB: j });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ type: 'added', textA: null, textB: b[j - 1], lineA: null, lineB: j });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      result.push({ type: 'removed', textA: a[i - 1], textB: null, lineA: i, lineB: null });
      i--;
    }
  }
  return result.reverse();
}

function openDiffModal(originalCode, suggestedCode, title) {
  currentDiffOriginalCode = originalCode;
  currentDiffSuggestedCode = suggestedCode;

  const titleEl = document.getElementById("diffModalTitle");
  if (titleEl && title) titleEl.innerText = `Diff: ${title}`;

  const diffItems = computeLineDiff(originalCode, suggestedCode);
  renderDiffViews(diffItems);

  const origCount = originalCode.split("\n").length;
  const suggCount = suggestedCode.split("\n").length;
  const origEl = document.getElementById("diffOriginalLines");
  const suggEl = document.getElementById("diffSuggestedLines");
  const unifiedEl = document.getElementById("diffUnifiedLines");
  if (origEl) origEl.innerText = `${origCount} lines`;
  if (suggEl) suggEl.innerText = `${suggCount} lines`;
  if (unifiedEl) unifiedEl.innerText = `${diffItems.length} diff lines`;

  const origWrap = document.getElementById("diffOriginalCode");
  const suggWrap = document.getElementById("diffSuggestedCode");
  const unifiedWrap = document.getElementById("diffUnifiedCode");
  if (origWrap) origWrap.scrollTop = 0;
  if (suggWrap) suggWrap.scrollTop = 0;
  if (unifiedWrap) unifiedWrap.scrollTop = 0;

  openModal("diffModal");
}

function renderDiffViews(diffItems) {
  const origWrap = document.getElementById("diffOriginalCode");
  const suggWrap = document.getElementById("diffSuggestedCode");
  const unifiedWrap = document.getElementById("diffUnifiedCode");

  if (!origWrap || !suggWrap || !unifiedWrap) return;

  origWrap.innerHTML = "";
  suggWrap.innerHTML = "";
  unifiedWrap.innerHTML = "";

  diffItems.forEach(item => {
    // Side by Side: Left (Original)
    const leftLine = document.createElement("div");
    leftLine.className = `diff-line ${item.type === 'removed' ? 'removed' : item.type === 'equal' ? 'equal' : 'empty-space'}`;
    const leftNum = document.createElement("span");
    leftNum.className = "diff-line-num";
    leftNum.textContent = item.lineA ? item.lineA : "";
    const leftPrefix = document.createElement("span");
    leftPrefix.className = "diff-line-prefix";
    leftPrefix.textContent = item.type === 'removed' ? '-' : ' ';
    const leftContent = document.createElement("span");
    leftContent.className = "diff-line-content";
    leftContent.textContent = item.textA !== null ? item.textA : "";
    leftLine.append(leftNum, leftPrefix, leftContent);
    origWrap.appendChild(leftLine);

    // Side by Side: Right (Suggested)
    const rightLine = document.createElement("div");
    rightLine.className = `diff-line ${item.type === 'added' ? 'added' : item.type === 'equal' ? 'equal' : 'empty-space'}`;
    const rightNum = document.createElement("span");
    rightNum.className = "diff-line-num";
    rightNum.textContent = item.lineB ? item.lineB : "";
    const rightPrefix = document.createElement("span");
    rightPrefix.className = "diff-line-prefix";
    rightPrefix.textContent = item.type === 'added' ? '+' : ' ';
    const rightContent = document.createElement("span");
    rightContent.className = "diff-line-content";
    rightContent.textContent = item.textB !== null ? item.textB : "";
    rightLine.append(rightNum, rightPrefix, rightContent);
    suggWrap.appendChild(rightLine);

    // Unified View
    const uLine = document.createElement("div");
    uLine.className = `diff-line ${item.type}`;
    const uNum = document.createElement("span");
    uNum.className = "diff-line-num";
    uNum.textContent = (item.lineB || item.lineA || "");
    const uPrefix = document.createElement("span");
    uPrefix.className = "diff-line-prefix";
    uPrefix.textContent = item.type === 'added' ? '+' : item.type === 'removed' ? '-' : ' ';
    const uContent = document.createElement("span");
    uContent.className = "diff-line-content";
    uContent.textContent = item.type === 'added' ? item.textB : (item.textA || "");
    uLine.append(uNum, uPrefix, uContent);
    unifiedWrap.appendChild(uLine);
  });

  // Synchronize scrolling between left and right panes
  origWrap.onscroll = () => { suggWrap.scrollTop = origWrap.scrollTop; suggWrap.scrollLeft = origWrap.scrollLeft; };
  suggWrap.onscroll = () => { origWrap.scrollTop = suggWrap.scrollTop; origWrap.scrollLeft = suggWrap.scrollLeft; };
}

const closeDiffModalBtn = document.getElementById("closeDiffModalBtn");
const cancelDiffBtn = document.getElementById("cancelDiffBtn");
const applyDiffBtn = document.getElementById("applyDiffBtn");
const diffSplitViewBtn = document.getElementById("diffSplitViewBtn");
const diffUnifiedViewBtn = document.getElementById("diffUnifiedViewBtn");
const diffSplitContainer = document.getElementById("diffSplitContainer");
const diffUnifiedContainer = document.getElementById("diffUnifiedContainer");

if (closeDiffModalBtn) closeDiffModalBtn.addEventListener("click", () => closeModal("diffModal"));
if (cancelDiffBtn) cancelDiffBtn.addEventListener("click", () => closeModal("diffModal"));

if (applyDiffBtn) {
  applyDiffBtn.addEventListener("click", () => {
    if (currentDiffSuggestedCode) {
      editor.setValue(currentDiffSuggestedCode);
      closeModal("diffModal");
      showToast("Applied AI Suggestion to editor! Re-evaluating quality...");
      setTimeout(runAnalysis, 350);
    }
  });
}

if (diffSplitViewBtn && diffUnifiedViewBtn && diffSplitContainer && diffUnifiedContainer) {
  diffSplitViewBtn.addEventListener("click", () => {
    diffSplitViewBtn.classList.add("active");
    diffUnifiedViewBtn.classList.remove("active");
    diffSplitContainer.style.display = "grid";
    diffUnifiedContainer.style.display = "none";
  });
  diffUnifiedViewBtn.addEventListener("click", () => {
    diffUnifiedViewBtn.classList.add("active");
    diffSplitViewBtn.classList.remove("active");
    diffSplitContainer.style.display = "none";
    diffUnifiedContainer.style.display = "flex";
  });
}

/* =========================================================
   FEATURE 6: GITHUB README BADGE GENERATOR
   ========================================================= */
function updateBadgesModal() {
  const res = lastAnalysisResult || {};
  const score = res.score !== undefined ? res.score : 85;
  const gradeLetter = (res.grade && res.grade.grade) ? res.grade.grade : (score >= 95 ? "A+" : score >= 85 ? "A" : score >= 70 ? "B" : score >= 50 ? "C" : "D");
  const debtFormatted = (res.techDebt && res.techDebt.formatted) ? res.techDebt.formatted : "0m";
  const debtMins = (res.techDebt && res.techDebt.minutes) ? res.techDebt.minutes : 0;
  const secCount = res.securityCount !== undefined ? res.securityCount : 0;

  const scoreColor = score >= 85 ? "brightgreen" : score >= 70 ? "blue" : score >= 50 ? "yellow" : "red";
  const gradeColor = (gradeLetter === "A+" || gradeLetter === "A") ? "brightgreen" : gradeLetter === "B" ? "blue" : gradeLetter === "C" ? "yellow" : "red";
  const secColor = secCount === 0 ? "brightgreen" : "red";
  const debtColor = debtMins <= 5 ? "brightgreen" : debtMins <= 20 ? "yellow" : "red";

  const secLabel = secCount === 0 ? "Passing" : `${secCount}_Issues`;
  const cleanDebt = debtFormatted.replace("~", "").replace(/\s+/g, "");

  const scoreUrl = `https://img.shields.io/badge/Code_Quality-${encodeURIComponent(score + "/100")}-${scoreColor}?style=flat-square&logo=speedtest`;
  const gradeUrl = `https://img.shields.io/badge/Grade-${encodeURIComponent(gradeLetter)}-${gradeColor}?style=flat-square&logo=codeforces`;
  const secUrl = `https://img.shields.io/badge/Security-${encodeURIComponent(secLabel)}-${secColor}?style=flat-square&logo=securityscorecard`;
  const debtUrl = `https://img.shields.io/badge/Tech_Debt-${encodeURIComponent(cleanDebt)}-${debtColor}?style=flat-square&logo=clock`;

  const mdScore = `[![Code Quality](${scoreUrl})](https://github.com)`;
  const mdGrade = `[![Grade](${gradeUrl})](https://github.com)`;
  const mdSec = `[![Security](${secUrl})](https://github.com)`;
  const mdDebt = `[![Tech Debt](${debtUrl})](https://github.com)`;

  // Update inputs
  const inScore = document.getElementById("badgeMarkdownScore");
  const inGrade = document.getElementById("badgeMarkdownGrade");
  const inSec = document.getElementById("badgeMarkdownSecurity");
  const inDebt = document.getElementById("badgeMarkdownDebt");
  const inAll = document.getElementById("allBadgesSnippet");

  if (inScore) inScore.value = mdScore;
  if (inGrade) inGrade.value = mdGrade;
  if (inSec) inSec.value = mdSec;
  if (inDebt) inDebt.value = mdDebt;
  if (inAll) inAll.value = `${mdScore}\n${mdGrade}\n${mdSec}\n${mdDebt}`;

  // Update preview images
  const setImg = (id, url, alt) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<img src="${url}" alt="${alt}" loading="lazy">`;
  };
  setImg("liveBadgeScore", scoreUrl, "Code Quality");
  setImg("liveBadgeGrade", gradeUrl, "Grade");
  setImg("liveBadgeSecurity", secUrl, "Security");
  setImg("liveBadgeDebt", debtUrl, "Tech Debt");

  const rowPreview = document.getElementById("badgeRowPreview");
  if (rowPreview) {
    rowPreview.innerHTML = `
      <img src="${scoreUrl}" alt="Score" loading="lazy">
      <img src="${gradeUrl}" alt="Grade" loading="lazy">
      <img src="${secUrl}" alt="Security" loading="lazy">
      <img src="${debtUrl}" alt="Debt" loading="lazy">
    `;
  }
}

const badgeModalBtn = document.getElementById("badgeModalBtn");
const quickBadgePill = document.getElementById("quickBadgePill");
const closeBadgeModalBtn = document.getElementById("closeBadgeModalBtn");
const doneBadgeBtn = document.getElementById("doneBadgeBtn");
const copyAllBadgesBtn = document.getElementById("copyAllBadgesBtn");

function openBadgeModal() {
  updateBadgesModal();
  openModal("badgeModal");
}

if (badgeModalBtn) badgeModalBtn.addEventListener("click", openBadgeModal);
if (quickBadgePill) quickBadgePill.addEventListener("click", openBadgeModal);
if (closeBadgeModalBtn) closeBadgeModalBtn.addEventListener("click", () => closeModal("badgeModal"));
if (doneBadgeBtn) doneBadgeBtn.addEventListener("click", () => closeModal("badgeModal"));

// Copy single badge
document.querySelectorAll(".copy-badge-btn").forEach(btn => {
  btn.addEventListener("click", async (e) => {
    const targetId = e.target.getAttribute("data-target");
    const input = document.getElementById(targetId);
    if (!input) return;
    try {
      await navigator.clipboard.writeText(input.value);
      const originalText = e.target.innerText;
      e.target.innerText = "✓ Copied";
      showToast("Badge Markdown copied to clipboard!");
      setTimeout(() => { e.target.innerText = originalText; }, 1800);
    } catch {
      showToast("Failed to copy badge", "error");
    }
  });
});

if (copyAllBadgesBtn) {
  copyAllBadgesBtn.addEventListener("click", async () => {
    const textarea = document.getElementById("allBadgesSnippet");
    if (!textarea) return;
    try {
      await navigator.clipboard.writeText(textarea.value);
      showToast("All 4 Markdown Badges copied to clipboard!");
    } catch {
      showToast("Failed to copy badges", "error");
    }
  });
}

// Global Modal Keyboard Esc & Backdrop Click Handler
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeModal("diffModal");
    closeModal("rulesModal");
    closeModal("badgeModal");
  }
});
document.querySelectorAll(".studio-modal-backdrop").forEach(backdrop => {
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) {
      backdrop.style.display = "none";
    }
  });
});