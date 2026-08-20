const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

app.get('/', (req, res) => {
  res.send('Code Quality Evaluator backend is running');
});

app.post('/api/analyze', (req, res) => {
  const { language, code } = req.body;
  res.json({ score: 85, errors: [], message: "Placeholder response" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});