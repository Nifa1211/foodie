import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '3m',  target: 60 },
    { duration: '30s', target: 0 },
  ],
};

const BASE = __ENV.BASE_URL || 'http://localhost:8080';

export default function () {
  const res = http.post(`${BASE}/api/orders`,
    JSON.stringify({ customer: 'LoadTest', items: [{ id: 1, qty: 2 }, { id: 8, qty: 1 }] }),
    { headers: { 'Content-Type': 'application/json' } });
  check(res, { 'order created': r => r.status === 201 });
  sleep(0.2);
}
