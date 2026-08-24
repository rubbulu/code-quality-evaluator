function analyzeCLike(code) {
    const errors = [];
    const variablePattern = /\b(int|float|double|char|String)\s+([A-Za-z_][A-Za-z0-9_]*)/g;

let match;

while ((match = variablePattern.exec(code)) !== null) {
    const name = match[2];

    if (!/^[a-z][A-Za-z0-9]*$/.test(name)) {
        errors.push("Variable name should use camelCase: " + name);
    }
}

    // Check braces
    const open = (code.match(/{/g) || []).length;
    const close = (code.match(/}/g) || []).length;

    if (open !== close) {
        errors.push("Mismatched braces");
    }

    // Score
    let score = 100 - (errors.length * 10);

    if (score < 0) {
        score = 0;
    }

    return {
        score,
        errors
    };
}

module.exports = analyzeCLike;