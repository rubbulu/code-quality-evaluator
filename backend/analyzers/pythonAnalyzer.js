function stripCommentsAndStrings(code) {
    // Replace string literal contents and comments with spaces (preserving
    // line structure) so pattern checks don't false-positive on them.
    let result = "";
    let i = 0;
    const n = code.length;
    let inString = false;
    let stringChar = "";

    while (i < n) {
        const ch = code[i];

        if (inString) {
            if (ch === "\\") {
                result += "  ";
                i += 2;
                continue;
            }
            if (ch === stringChar) {
                inString = false;
                result += " ";
                i++;
                continue;
            }
            result += ch === "\n" ? "\n" : " ";
            i++;
            continue;
        }

        if (ch === "'" || ch === '"') {
            inString = true;
            stringChar = ch;
            result += " ";
            i++;
            continue;
        }

        if (ch === "#") {
            while (i < n && code[i] !== "\n") {
                result += " ";
                i++;
            }
            continue;
        }

        result += ch;
        i++;
    }

    return result;
}

function lineNumberAt(code, index) {
    return code.substring(0, index).split("\n").length;
}

function analyzePython(code) {
    if (typeof code !== "string") {
        return { score: 0, errors: [{ line: 0, message: "No code provided." }] };
    }

    const errors = [];
    const cleaned = stripCommentsAndStrings(code);

    // 1. Check for print statement without parentheses
    const oldPrintRegex = /^\s*print\s+[^(\s]/gm;
    let printMatch;
    while ((printMatch = oldPrintRegex.exec(cleaned)) !== null) {
        errors.push({
            line: lineNumberAt(cleaned, printMatch.index),
            message: "Use print() function in Python 3."
        });
    }

    // 2. Check variable naming convention (skip ==, !=, <=, >=, and ALL_CAPS constants)
    const variableRegex = /^\s*([A-Z][A-Za-z0-9_]*)\s*=(?!=)/gm;
    let match;
    while ((match = variableRegex.exec(cleaned)) !== null) {
        const name = match[1];
        const isConstant = name === name.toUpperCase();
        if (!isConstant) {
            errors.push({
                line: lineNumberAt(cleaned, match.index),
                message: `Variable '${name}' should use lowercase naming.`
            });
        }
    }

    const lines = code.split("\n");

    // 3. Check very long lines
    lines.forEach((line, index) => {
        if (line.length > 100) {
            errors.push({
                line: index + 1,
                message: "Line is longer than 100 characters."
            });
        }
    });

    // 4. Check tabs used for indentation
    lines.forEach((line, index) => {
        if (/^\s*\t/.test(line) || line.startsWith("\t")) {
            errors.push({
                line: index + 1,
                message: "Use spaces instead of tabs for indentation."
            });
        }
    });

    return {
        score: Math.max(0, 100 - errors.length * 10),
        errors: errors
    };
}

module.exports = analyzePython;