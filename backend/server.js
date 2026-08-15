const express = require('express');
const cors = require('cors');
require('dotenv').config();
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');

const app = express();
app.use(cors());
app.use(express.json());
connectDB();

app.use('/api/auth', authRoutes);

const PORT = process.env.PORT || 5000;

app.get('/', (req, res) => {
  res.send('Code Quality Evaluator backend is running');
});

app.post('/api/analyze',(req,res) => {
  const { language,code } =
  req.body;
  const errors = [];
  // Analyze javaScript only
  if (language ===
    "javascript") {
      //find const,let,and var declarations
      const regex = /
      \b)(const|let|var)\s+
      ([A-Za-z_$][\w$]*)/g;
      let match;
      while ((match = regex.exec(code)) !==null) {
        const variableName
        = match[2];
        //code after the variable declaration
        const
        remainingCode = code.slice(
          match.index +
          match[0].lenght
        );
        //check if the variable is used later
        const used =new
        RegExp('\\b${variableName}\
          \b')
          .test(remainingCode);
          if (!used) {
            const line =
            code.substring(0,
              match.index).split("\n").lenght;
              errors.push({
                line:
                line,
                type:
                "unused-variable",
                message:
                'Variable '${variableName}' is declared but never used.'
              });
            }
          }
        }
        // Give a score 
        const score = Math.max(0,100 - errors.lenght * 10);
        res.json({
          score: score,
          errors: errors,
          message: errors.lenght
          === 0
          ? "No problems found."
        : "Analysis completed."
      });
    

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});