function analyzeCLike(code) {
    const errors = [];
    let balance = 0;

    // Check braces
    for (const char of code) {
        if (char === "{") balance++;
        if (char === "}") balance--;

        if (balance < 0) {
            errors.push("Unmatched closing brace }");
            break;
        }
    }

    if (balance > 0) {
        errors.push("Missing closing brace }");
    }

    // Check missing semicolons
    const lines = code.split("\n");

    lines.forEach((line, index) => {
        const trimmed = line.trim();

        if (
            trimmed &&
            !trimmed.startsWith("//") &&
            !trimmed.startsWith("#") &&
            !trimmed.endsWith(";") &&
            !trimmed.endsWith("{") &&
            !trimmed.endsWith("}") &&
            !trimmed.endsWith(":")
        ) {
            errors.push(`Possible missing semicolon at line ${index + 1}`);
        }
    });

    // Check variable naming conventions
    const variablePattern =
        /\b(int|float|double|char|long|short|boolean|bool|string)\s+([A-Za-z_][A-Za-z0-9_]*)/g;

    let match;

    while ((match = variablePattern.exec(code)) !== null) {
        const variableName = match[2];

        // Variables should normally use camelCase
        if (
            /^[A-Z]/.test(variableName) ||
            variableName.includes("_")
        ) {
            errors.push(
                `Variable "${variableName}" should use camelCase naming`
            );
        }
    }

    const score = Math.max(0, 100 - errors.length * 10);

    return {
        score,
        errors
    };
}

module.exports = analyzeCLike;
