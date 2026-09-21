const express = require('express');
const router = express.Router();

const MAX_CODE_LENGTH = 4000;

function buildPrompt(code, language) {
  return `You are a senior ${language} code reviewer.
Given the code below, write 3 different implementations that do the SAME job:
1. a brute-force / naive approach
2. a cleaner, more readable approach
3. the most optimized approach

For each approach give:
- "name": short approach name
- "code": complete working code in ${language}
- "time": time complexity in Big-O
- "space": space complexity in Big-O
- "verdict": exactly one of "weak", "better", "best"
- "reason": one short sentence explaining the verdict

Exactly one approach must have verdict "best" (the one with the best time and space trade-off).
Return ONLY a JSON array of these objects. No markdown, no extra text.

CODE:
${code}`;
}

router.post('/suggest', async (req, res) => {
  try {
    const { code, language } = req.body;

    if (typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({ error: 'Code is required.' });
    }
    if (code.length > MAX_CODE_LENGTH) {
      return res.status(400).json({ error: `Code too long (max ${MAX_CODE_LENGTH} characters).` });
    }
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'AI service is not configured.' });
    }

    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(code, language || 'code') }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.4 }
      })
    });

    if (response.status === 429) {
      return res.status(429).json({ error: 'AI rate limit reached. Please wait a minute and try again.' });
    }
    if (!response.ok) {
      console.error('Gemini error:', response.status, await response.text());
      return res.status(502).json({ error: 'AI service failed. Try again later.' });
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();

    let suggestions;
    try {
      suggestions = JSON.parse(clean);
    } catch (e) {
      return res.status(502).json({ error: 'AI returned an unreadable response. Try again.' });
    }

    if (!Array.isArray(suggestions)) {
      return res.status(502).json({ error: 'AI returned an unexpected format.' });
    }

    const allowed = ['weak', 'better', 'best'];
    suggestions = suggestions.slice(0, 5).map(s => ({
      name: String(s.name || 'Approach'),
      code: String(s.code || ''),
      time: String(s.time || 'N/A'),
      space: String(s.space || 'N/A'),
      verdict: allowed.includes(s.verdict) ? s.verdict : 'better',
      reason: String(s.reason || '')
    }));

    res.json({ suggestions, note: 'AI-generated suggestions. Verify complexity before relying on it.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong generating suggestions.' });
  }
});

module.exports = router;