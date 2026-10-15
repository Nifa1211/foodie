const express = require('express');
const crypto = require('crypto');
const app = express();
app.use(express.json());
const client = require('prom-client');
client.collectDefaultMetrics();
const httpCount = new client.Counter({ name: 'http_requests_total', help: 'HTTP requests', labelNames: ['method', 'route', 'status'] });
app.use((req, res, next) => {
  res.on('finish', () => {
    if (req.path === '/metrics' || req.path === '/health') return;
    httpCount.inc({ method: req.method, route: req.route ? req.route.path : req.path, status: res.statusCode });
  });
  next();
});
app.get('/metrics', async (_req, res) => { res.set('Content-Type', client.register.contentType); res.end(await client.register.metrics()); });
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Mock payment gateway: approves everything up to Rs 10,000.
app.post('/pay', (req, res) => {
  const { orderId, amount } = req.body || {};
  if (!orderId || !(amount > 0)) return res.status(400).json({ status: 'INVALID' });
  if (amount > 10000) return res.json({ status: 'DECLINED', reason: 'limit exceeded' });
  res.json({ status: 'PAID', txnId: 'TXN-' + crypto.randomBytes(4).toString('hex').toUpperCase() });
});

app.listen(process.env.PORT || 3003, () => console.log('payment-service up'));
