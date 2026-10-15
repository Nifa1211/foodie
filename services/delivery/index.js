const express = require('express');
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

const DRIVERS = ['Ravi Kumar', 'Sunita Meena', 'Arjun Singh', 'Priya Sharma', 'Imran Khan'];

// Stateless: the same orderId always maps to the same driver.
app.post('/assign', (req, res) => {
  const { orderId } = req.body || {};
  if (!orderId) return res.status(400).json({ error: 'orderId required' });
  const n = [...orderId].reduce((a, c) => a + c.charCodeAt(0), 0);
  res.json({ driver: DRIVERS[n % DRIVERS.length], etaMinutes: 20 + (n % 15) });
});

app.listen(process.env.PORT || 3004, () => console.log('delivery-service up'));
