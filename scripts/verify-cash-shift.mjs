import prisma from '../src/config/db.js';
import { addCashMovement, closeCashShift, listCounters, openCashShift } from '../src/services/cash.service.js';

const fail = (message) => {
  console.error('FAIL', message);
  process.exitCode = 1;
};

const userRow = await prisma.user.findFirst({
  where: { is_active: true },
  include: { user_branches: true, role: { include: { role_permissions: { include: { permission: true } } } } },
});
if (!userRow) {
  fail('no user');
  await prisma.$disconnect();
  process.exit(1);
}

const user = {
  id: userRow.id,
  default_branch_id: userRow.default_branch_id,
  branch_ids: userRow.user_branches.map((row) => Number(row.branch_id)),
  permissions: (userRow.role?.role_permissions || []).map((row) => row.permission.permission_key),
};
if (!user.permissions.includes('branches.access_all') && user.branch_ids.length === 0 && user.default_branch_id) {
  user.branch_ids = [Number(user.default_branch_id)];
}

const branchId = Number(user.default_branch_id || user.branch_ids[0]);
let counters;
try {
counters = await listCounters(user, branchId);
const counter1 = counters.find((row) => row.counter_no === 1);
const counter2 = counters.find((row) => row.counter_no === 2);
if (!counter1 || !counter2) {
  fail('counters 1 and 2 were not created');
} else {
  const first = await openCashShift(user, { branch_id: branchId, counter_id: counter1.id, opening_cash: 500 });
  const second = await openCashShift(user, { branch_id: branchId, counter_id: counter2.id, opening_cash: 200 });
  const moved = await addCashMovement(user, second.id, { entry_type: 'cash_out', amount: 50 });
  const stillOpen = await prisma.cashShift.findFirst({
    where: { id: BigInt(first.id), status: 'open' },
  });
  const leftCounter = await prisma.cashShiftUser.findFirst({
    where: { shift_id: BigInt(first.id), user_id: userRow.id, ended_at: { not: null } },
  });
  if (!stillOpen || !leftCounter) fail('leaving counter 1 closed its cash or kept the cashier assigned');
  if (Number(moved.cash_out) !== 50 || Number(moved.expected_cash) !== 150) {
    fail(`counter 2 expected 150 after cash out, got cash_out=${moved.cash_out} expected=${moved.expected_cash}`);
  }
  const closed2 = await closeCashShift(user, second.id, {
    denominations: [{ kind: 'note', denomination: 100, quantity: 1 }, { kind: 'note', denomination: 50, quantity: 1 }],
  });
  await openCashShift(user, { branch_id: branchId, counter_id: counter1.id, opening_cash: 500 });
  const closed1 = await closeCashShift(user, first.id, {
    closing_note: 'verify',
    denominations: [{ kind: 'note', denomination: 500, quantity: 1 }],
  });
  const after = await listCounters(user, branchId);
  const balance1 = after.find((row) => row.counter_no === 1)?.cash_balance;
  const balance2 = after.find((row) => row.counter_no === 2)?.cash_balance;
  if (Number(closed1.closing_cash) !== 500 || Number(balance1) !== 500) fail(`counter 1 balance ${balance1}`);
  if (Number(closed2.closing_cash) !== 150 || Number(closed2.variance) !== 0 || Number(balance2) !== 150) {
    fail(`counter 2 closing ${closed2.closing_cash} variance ${closed2.variance} balance ${balance2}`);
  }
  if (!process.exitCode) console.log('PASS counter balances', balance1, balance2);
}
} catch (error) {
  console.error('FAIL', error?.message || error);
  process.exitCode = 1;
} finally {
await prisma.cashShiftDenomination.deleteMany({});
await prisma.cashShiftUser.deleteMany({});
await prisma.cashShift.deleteMany({});
await prisma.counter.updateMany({ data: { cash_balance: 0 } });
await prisma.$disconnect();
}
