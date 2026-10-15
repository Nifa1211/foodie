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

const MENU = [
  { id: 1, name: 'Paneer Butter Masala', price: 220 },
  { id: 2, name: 'Dal Baati Churma', price: 180 },
  { id: 3, name: 'Veg Biryani', price: 190 },
  { id: 4, name: 'Masala Dosa', price: 120 },
  { id: 5, name: 'Pav Bhaji', price: 140 },
  { id: 6, name: 'Chole Bhature', price: 130 },
  { id: 7, name: 'Gulab Jamun', price: 60 },
  { id: 8, name: 'Masala Chai', price: 30 },
];

app.get('/menu', (_req, res) => res.json(MENU));
app.get('/menu/:id', (req, res) => {
  const item = MENU.find(m => m.id === Number(req.params.id));
  item ? res.json(item) : res.status(404).json({ error: 'item not found' });
});

app.listen(process.env.PORT || 3001, () => console.log('restaurant-service up'));
