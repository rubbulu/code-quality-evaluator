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

router.patch('/favorite/:id', verifyToken, async (req, res) => {
  try {
    const analysis = await Analysis.findOne({ _id: req.params.id, userId: req.userId });

    if (!analysis) {
      return res.status(404).json({ message: 'Analysis not found' });
    }

    analysis.favorite = !analysis.favorite;
    await analysis.save();

    res.json({ message: 'Favorite status updated', favorite: analysis.favorite, analysisId: analysis._id });
  } catch (err) {
    res.status(500).json({ message: 'Error updating favorite', error: err.message });
  }
});

module.exports = router;