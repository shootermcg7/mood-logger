require('dotenv').config();
const express = require('express');
const fs = require('fs');
const { OpenAI } = require('openai');

const app = express();
app.use(express.json());
app.use(express.static('public'));

let comments = [];

// Load existing comments
if (fs.existsSync('log.json')) {
  comments = JSON.parse(fs.readFileSync('log.json', 'utf8'));
}

// Save helper
function saveCommentsToFile(data) {
  fs.writeFileSync('log.json', JSON.stringify(data, null, 2), 'utf8');
}

// Routes
app.post('/comments', (req, res) => {
  const { comment, mood } = req.body;
  if (!comment || typeof mood !== 'number' || mood < 1 || mood > 5) {
    return res.status(400).send({ error: 'Comment and mood (1–5) are required.' });
  }
  const newEntry = { comment, mood, timestamp: new Date().toISOString() };
  comments.push(newEntry);
  saveCommentsToFile(comments);
  res.status(201).send({ message: 'Comment added successfully.' });
});

app.get('/comments', (req, res) => {
  res.json(comments);
});

app.delete('/comments/:timestamp', (req, res) => {
  const { timestamp } = req.params;
  const originalLength = comments.length;
  comments = comments.filter(entry => entry.timestamp !== timestamp);
  if (comments.length === originalLength) {
    return res.status(404).send({ error: 'Comment not found.' });
  }
  saveCommentsToFile(comments);
  res.send({ message: 'Comment deleted.' });
});

app.get('/summary', (req, res) => {
  if (comments.length === 0) return res.json({ count: 0 });
  const total = comments.length;
  const sum = comments.reduce((acc, entry) => acc + entry.mood, 0);
  const avg = (sum / total).toFixed(2);
  const freq = {};
  comments.forEach(entry => {
    freq[entry.mood] = (freq[entry.mood] || 0) + 1;
  });
  const mostCommonMood = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
  res.json({ count: total, average: avg, mostCommon: parseInt(mostCommonMood) });
});

// OpenAI Setup
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.get('/agent-feedback', async (req, res) => {
  try {
    const recent = comments.slice(-5);
    const messages = [
      { role: 'system', content: "You're very funny. Give feedback based on recent moods. Keep it short" },
      { role: 'user', content: `Here are my recent moods:\n${recent.map(e => `Mood ${e.mood}: \"${e.comment}\"`).join('\n')}` }
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages,
      max_tokens: 100
    });

    const aiMessage = completion.choices[0].message.content;
    res.json({ message: aiMessage });
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: 'Failed to get agent feedback.' });
  }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
