const express = require('express');
const verifyToken = require('../middleware/verifyToken');
const Analysis = require('../models/Analysis');

const router = express.Router();

router.get('/', verifyToken, async (req, res) => {
  try {
    const analyses = await Analysis.find({ userId: req.userId }).sort({ timestamp: -1 });
    res.json(analyses);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching history', error: err.message });
  }
});

module.exports = router;