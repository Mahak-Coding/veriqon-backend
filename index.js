require('dotenv').config();
const express = require('express');
const app = express();

app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'Veriqon backend is running!' });
});

// Routes
const webhookRoutes = require('./routes/webhook');
app.use('/webhook', webhookRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Veriqon server running on port ${PORT}`);
});