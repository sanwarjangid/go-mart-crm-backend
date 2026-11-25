import jwt from 'jsonwebtoken';
import prisma from '../src/config/db.js';
import { env } from '../src/config/env.js';

const user = await prisma.user.findFirst({
  where: { is_active: true, default_branch_id: { not: null } },
  orderBy: { id: 'asc' },
});
if (!user) {
  console.error('FAIL no active user with a branch');
  process.exit(1);
}

const token = jwt.sign({ user_id: Number(user.id) }, env.jwtSecret, { expiresIn: '10m' });
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const branchId = Number(user.default_branch_id);

const unauth = await fetch('http://localhost:4000/api/counters');
const countersResponse = await fetch(`http://localhost:4000/api/counters?branch_id=${branchId}`, { headers });
const counters = await countersResponse.json();
if (unauth.status !== 401 || countersResponse.status !== 200) {
  console.error('FAIL list', unauth.status, countersResponse.status, counters.message);
  process.exit(1);
}
const counter = counters.data.find((row) => row.counter_no === 1);
const opened = await fetch('http://localhost:4000/api/cash-shifts/open', {
  method: 'POST',
  headers,
  body: JSON.stringify({ branch_id: branchId, counter_id: counter.id, opening_cash: 80 }),
});
const openBody = await opened.json();
if (opened.status !== 201) {
  console.error('FAIL open', opened.status, openBody.message);
  process.exit(1);
}
const closed = await fetch(`http://localhost:4000/api/cash-shifts/${openBody.data.id}/close`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    closing_note: 'http check',
    denominations: [{ kind: 'note', denomination: 50, quantity: 1 }, { kind: 'note', denomination: 20, quantity: 1 }, { kind: 'coin', denomination: 10, quantity: 1 }],
  }),
});
const closeBody = await closed.json();
if (closed.status !== 200 || Number(closeBody.data.closing_cash) !== 80 || Number(closeBody.data.counter_no) !== 1) {
  console.error('FAIL close', closed.status, closeBody.message, closeBody.data?.closing_cash);
  process.exit(1);
}
const after = await fetch(`http://localhost:4000/api/counters?branch_id=${branchId}`, { headers });
const afterBody = await after.json();
const balance = afterBody.data.find((row) => row.counter_no === 1)?.cash_balance;
console.log('PASS http', unauth.status, 'open', opened.status, 'close', closed.status, 'counter balance', balance);

await prisma.cashShiftDenomination.deleteMany({});
await prisma.cashShiftUser.deleteMany({});
await prisma.cashShift.deleteMany({});
await prisma.counter.updateMany({ data: { cash_balance: 0 } });
await prisma.$disconnect();
