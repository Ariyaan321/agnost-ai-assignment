import express from 'express';

const PORT = 8080;
const app = express();

app.use(express.json());

app.post('/v1/traces', (req, res) => {
  console.log('--- Incoming Trace Payload ---');
  console.dir(req.body, { depth: null });
  res.status(200).json({ message: 'Traces received' });
});

app.listen(PORT, () => {
  console.log(`agnost-server listening on http://localhost:${PORT}`);
});