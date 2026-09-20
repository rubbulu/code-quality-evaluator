const express = require('express');
const cors = require('cors');
require('dotenv').config();
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const historyRoutes = require('./routes/history');
const verifyToken = require('./middleware/verifyToken');
const Analysis = require('./models/Analysis');

const app = express();
app.use(cors());
app.use(express.json());
connectDB();

app.use('/api/auth', authRoutes);
app.use('/api/history', historyRoutes);

const PORT = process.env.PORT || 5000;

app.get('/', (req, res) => {
  res.send('Code Quality Evaluator backend is running');
});

app.post('/api/analyze', verifyToken, async (req, res) => {
  const { language, code } = req.body;
  const score = 85; // placeholder until Person 3's real analysis engine is plugged in

  try {
    const analysis = await Analysis.create({
      userId: req.userId,
      language,
      code,
      score
    });

    res.json({
      score: analysis.score,
      errors: [],
      message: "Placeholder response",
      analysisId: analysis._id
    });
  } catch (err) {
    res.status(500).json({ message: 'Error saving analysis', error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});