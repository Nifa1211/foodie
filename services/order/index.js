const express = require('express');
const crypto = require('crypto');
const os = require('os');
const { createClient } = require('redis');
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

const RESTAURANT = process.env.RESTAURANT_URL || 'http://restaurant-service:3001';
const PAYMENT = process.env.PAYMENT_URL || 'http://payment-service:3003';
const DELIVERY = process.env.DELIVERY_URL || 'http://delivery-service:3004';
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
// Simulated CPU cost per order so the autoscaler has something to react to.
const CPU_WORK_MS = Number(process.env.CPU_WORK_MS || 40);

const redis = createClient({ url: REDIS_URL });
redis.on('error', e => console.error('redis error:', e.message));

function burnCpu(ms) {
  const end = Date.now() + ms;
  let h = 'seed';
  while (Date.now() < end) h = crypto.createHash('sha256').update(h).digest('hex');
}

const post = async (url, body) =>
  (await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();

function statusOf(o) {
  if (!o.paid) return 'PAYMENT_FAILED';
  const s = (Date.now() - o.createdAt) / 1000;
  if (s < 10) return 'PREPARING';
  if (s < 25) return 'OUT_FOR_DELIVERY';
  return 'DELIVERED';
}

app.post('/orders', async (req, res) => {
  try {
    const { customer, items } = req.body || {};
    if (!customer || !Array.isArray(items) || items.length === 0)
      return res.status(400).json({ error: 'customer and items are required' });

    const menu = await (await fetch(`${RESTAURANT}/menu`)).json();
    let total = 0;
    const lines = [];
    for (const i of items) {
      const m = menu.find(x => x.id === i.id);
      if (!m || !(i.qty > 0)) return res.status(400).json({ error: `invalid item ${i.id}` });
      total += m.price * i.qty;
      lines.push({ id: m.id, name: m.name, qty: i.qty, price: m.price });
    }

    burnCpu(CPU_WORK_MS);
    const id = crypto.randomUUID().slice(0, 8);
    const pay = await post(`${PAYMENT}/pay`, { orderId: id, amount: total });
    const paid = pay.status === 'PAID';
    const delivery = paid ? await post(`${DELIVERY}/assign`, { orderId: id }) : {};

    const order = {
      id, customer, items: lines, total, paid, txnId: pay.txnId || null,
      driver: delivery.driver || null, eta: delivery.etaMinutes || null,
      createdAt: Date.now(), servedBy: os.hostname(),
    };
    await redis.set(`order:${id}`, JSON.stringify(order));
    await redis.lPush('orders', id);
    await redis.lTrim('orders', 0, 49);
    res.status(201).json({ ...order, status: statusOf(order) });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: 'downstream service failure', detail: e.message });
  }
});

app.get('/orders', async (_req, res) => {
  const ids = await redis.lRange('orders', 0, 9);
  if (!ids.length) return res.json([]);
  const vals = await redis.mGet(ids.map(i => `order:${i}`));
  res.json(vals.filter(Boolean).map(v => { const o = JSON.parse(v); return { ...o, status: statusOf(o) }; }));
});

app.get('/orders/:id', async (req, res) => {
  const v = await redis.get(`order:${req.params.id}`);
  if (!v) return res.status(404).json({ error: 'order not found' });
  const o = JSON.parse(v);
  res.json({ ...o, status: statusOf(o) });
});

(async () => {
  await redis.connect();
  app.listen(process.env.PORT || 3002, () => console.log('order-service up, served by', os.hostname()));
})();
