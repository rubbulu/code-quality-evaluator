/**
 * Security & Vulnerability Static Analyzer
 * Detects hardcoded secrets, injection risks, resource leaks, and dangerous APIs.
 */

function scanSecurity(code, language) {
  if (!code || typeof code !== "string") return [];

  const errors = [];
  const lines = code.split("\n");

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("/*")) {
      return;
    }

    const lineNum = index + 1;

    // 1. Hardcoded Secrets & Credentials
    const secretPattern = /\b(api_key|apikey|secret|password|passwd|auth_token|jwt_secret|private_key)\s*[:=]\s*["']([^"']{6,})["']/i;
    const secretMatch = trimmed.match(secretPattern);
    if (secretMatch && !secretMatch[2].includes("placeholder") && !secretMatch[2].includes("test")) {
      errors.push({
        line: lineNum,
        type: "error",
        category: "security",
        message: `Security: Hardcoded credential or API secret found ("${secretMatch[1]}")`,
        explanation: "Never store plaintext credentials, secrets, or passwords in source files. Move sensitive tokens to environment variables (e.g., process.env).",
        fixType: "env_var"
      });
    }

    // 2. SQL / Query Injection via raw string concatenation
    const sqlPattern = /\b(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER)\b.*?\+\s*([A-Za-z_][\w]*)/i;
    if (sqlPattern.test(trimmed)) {
      errors.push({
        line: lineNum,
        type: "error",
        category: "security",
        message: "Security: Potential SQL Injection via raw string concatenation",
        explanation: "Directly concatenating dynamic parameters into SQL statements permits SQL injection attacks. Use parameterized queries or prepared statements.",
        fixType: "parameterized_query"
      });
    }

    // 3. Dangerous APIs (eval, exec)
    if (/\beval\s*\(/.test(trimmed)) {
      errors.push({
        line: lineNum,
        type: "error",
        category: "security",
        message: "Security: Dangerous use of 'eval()' allows arbitrary code execution",
        explanation: "The 'eval()' function executes input strings with caller privileges, creating severe security vulnerabilities. Use JSON.parse() or structured logic instead.",
        fixType: "remove_eval"
      });
    }

    if (/\bexec\s*\(/.test(trimmed) && (language === "python" || language === "javascript")) {
      errors.push({
        line: lineNum,
        type: "error",
        category: "security",
        message: "Security: 'exec()' function permits untrusted dynamic code execution",
        explanation: "Dynamically executing code via 'exec()' can lead to remote code execution (RCE) if inputs are controlled by untrusted sources.",
        fixType: "remove_exec"
      });
    }

    // 4. Insecure Randomness for sensitive data
    if (/(token|nonce|salt|password|pin|otp)\s*[:=].*?Math\.random\(\)/i.test(trimmed)) {
      errors.push({
        line: lineNum,
        type: "warning",
        category: "security",
        message: "Security: Cryptographically weak random generator used for sensitive token",
        explanation: "Math.random() is pseudo-random and predictable. For authentication tokens or salts, use a CSPRNG like crypto.getRandomValues() or crypto.randomBytes().",
        fixType: "crypto_random"
      });
    }
  });

  // 5. Unclosed Scanner / Resource Leaks (Java)
  if (language === "clike" || language === "java") {
    const hasScanner = /Scanner\s+(\w+)\s*=\s*new\s+Scanner/.exec(code);
    if (hasScanner) {
      const varName = hasScanner[1];
      const hasClose = new RegExp(`\\b${varName}\\.close\\(\\)`).test(code);
      const hasTryWithResources = /try\s*\(\s*Scanner/.test(code);

      if (!hasClose && !hasTryWithResources) {
        const lineNum = code.slice(0, hasScanner.index).split("\n").length;
        errors.push({
          line: lineNum,
          type: "warning",
          category: "security",
          message: `Resource Leak: Scanner "${varName}" is created but never closed`,
          explanation: "Unclosed I/O streams and Scanners leak operating system file descriptors. Close the resource using .close() or wrap in try-with-resources.",
          fixType: "close_scanner"
        });
      }
    }
  }

  return errors;
}

module.exports = scanSecurity;
