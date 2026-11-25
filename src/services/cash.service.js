import prisma from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { assertBranchAccess, roundMoney, shapeRecord } from '../utils/billing.js';

const NOTE_VALUES = new Set([500, 200, 100, 50, 20, 10]);
const COIN_VALUES = new Set([20, 10, 5, 2, 1]);

const shiftInclude = {
  counter: { select: { id: true, counter_no: true, counter_name: true, cash_balance: true } },
  users: {
    include: { user: { select: { id: true, name: true } } },
    orderBy: { started_at: 'asc' },
  },
  denominations: { orderBy: [{ kind: 'asc' }, { denomination: 'desc' }] },
};

const emptyTotals = () => ({
  cash_sales: 0,
  upi_sales: 0,
  card_sales: 0,
  bank_sales: 0,
  upi_card_sales: 0,
  cash_refunds: 0,
});

const resolveBranchId = (user, branchId) => {
  const id = branchId || user.default_branch_id || user.branch_ids?.[0];
  if (!id) {
    throw new ApiError(400, 'branch_id is required');
  }
  assertBranchAccess(user, id);
  return Number(id);
};

const sameUser = (left, right) => Number(left) === Number(right);

const inWindow = (userId, when, windows) =>
  windows.some(
    (window) =>
      sameUser(window.user_id, userId) &&
      new Date(when).getTime() >= new Date(window.started_at).getTime() &&
      (!window.ended_at || new Date(when).getTime() <= new Date(window.ended_at).getTime())
  );

const expectedCash = (shift, totals) =>
  roundMoney(
    Number(shift.opening_cash) +
      totals.cash_sales +
      Number(shift.cash_in) -
      Number(shift.cash_out) -
      totals.cash_refunds
  );

const ensureCounters = async (branchId, db = prisma) => {
  const count = await db.counter.count({ where: { branch_id: BigInt(branchId) } });
  if (count > 0) {
    return;
  }
  await db.counter.createMany({
    data: [1, 2, 3].map((counterNo) => ({
      branch_id: BigInt(branchId),
      counter_no: counterNo,
      counter_name: `Counter ${counterNo}`,
    })),
  });
};

const collectTotals = async (shift) => {
  const windows = shift.users || [];
  if (!windows.length) {
    return emptyTotals();
  }
  const userIds = [...new Set(windows.map((window) => window.user_id))];
  const minStart = new Date(Math.min(...windows.map((window) => new Date(window.started_at).getTime())));
  const [payments, returns] = await Promise.all([
    prisma.payment.findMany({
      where: {
        branch_id: shift.branch_id,
        received_by: { in: userIds },
        payment_date: { gte: minStart },
        invoice: { invoice_status: { not: 'cancelled' } },
      },
      include: { payment_mode: { select: { mode_name: true } } },
    }),
    prisma.salesReturn.findMany({
      where: {
        branch_id: shift.branch_id,
        created_by: { in: userIds },
        return_date: { gte: minStart },
        refund_amount: { gt: 0 },
      },
      include: { refund_mode: { select: { mode_name: true } } },
    }),
  ]);

  let cash = 0;
  let upi = 0;
  let card = 0;
  let bank = 0;
  let refunds = 0;
  for (const payment of payments) {
    if (!inWindow(payment.received_by, payment.payment_date, windows)) {
      continue;
    }
    const name = String(payment.payment_mode?.mode_name || '').toLowerCase();
    const amount = Number(payment.amount);
    if (name === 'cash') cash += amount;
    else if (name === 'upi') upi += amount;
    else if (name === 'card') card += amount;
    else if (name === 'bank transfer' || name === 'bank') bank += amount;
  }
  for (const row of returns) {
    if (!inWindow(row.created_by, row.return_date, windows)) {
      continue;
    }
    if (String(row.refund_mode?.mode_name || '').toLowerCase() === 'cash') {
      refunds += Number(row.refund_amount);
    }
  }
  return {
    cash_sales: roundMoney(cash),
    upi_sales: roundMoney(upi),
    card_sales: roundMoney(card),
    bank_sales: roundMoney(bank),
    upi_card_sales: roundMoney(upi + card),
    cash_refunds: roundMoney(refunds),
  };
};

const shapeShift = (shift, totals, userId) => {
  const figures = totals || {
    cash_sales: Number(shift.cash_sales),
    upi_sales: Number(shift.upi_card_sales),
    card_sales: 0,
    bank_sales: 0,
    upi_card_sales: Number(shift.upi_card_sales),
    cash_refunds: Number(shift.cash_refunds),
  };
  const cashiers = (shift.users || []).map((row) => ({
    user_id: row.user_id,
    name: row.user?.name || 'Cashier',
    started_at: row.started_at,
    ended_at: row.ended_at,
  }));
  return shapeRecord({
    id: shift.id,
    branch_id: shift.branch_id,
    counter_id: shift.counter_id,
    counter_no: shift.counter?.counter_no ?? null,
    counter_name: shift.counter?.counter_name ?? null,
    cash_balance: shift.counter?.cash_balance ?? 0,
    shift_code: shift.shift_code,
    status: shift.status,
    opened_at: shift.opened_at,
    closed_at: shift.closed_at,
    opening_cash: shift.opening_cash,
    cash_sales: figures.cash_sales ?? shift.cash_sales,
    cash_in: shift.cash_in,
    cash_out: shift.cash_out,
    upi_sales: figures.upi_sales,
    card_sales: figures.card_sales,
    bank_sales: figures.bank_sales,
    upi_card_sales: figures.upi_card_sales ?? shift.upi_card_sales,
    cash_refunds: figures.cash_refunds ?? shift.cash_refunds,
    expected_cash: shift.expected_cash,
    closing_cash: shift.closing_cash,
    variance: shift.variance,
    closing_note: shift.closing_note,
    assigned_to_me:
      shift.status === 'open' && cashiers.some((cashier) => sameUser(cashier.user_id, userId) && !cashier.ended_at),
    cashiers,
    denominations: (shift.denominations || []).map((row) => ({
      kind: row.kind,
      denomination: row.denomination,
      quantity: row.quantity,
      line_total: row.line_total,
    })),
  });
};

const loadShift = (id, db = prisma) =>
  db.cashShift.findUnique({
    where: { id: BigInt(id) },
    include: shiftInclude,
  });

const refreshOpenShift = async (shift) => {
  if (!shift || shift.status !== 'open') {
    return { shift, totals: null };
  }
  const totals = await collectTotals(shift);
  const expected = expectedCash(shift, totals);
  const updated = await prisma.cashShift.update({
    where: { id: shift.id },
    data: {
      cash_sales: totals.cash_sales,
      upi_card_sales: totals.upi_card_sales,
      cash_refunds: totals.cash_refunds,
      expected_cash: expected,
    },
    include: shiftInclude,
  });
  return { shift: updated, totals };
};

const presentShift = async (shift, user) => {
  const refreshed = await refreshOpenShift(shift);
  return shapeShift(refreshed.shift, refreshed.totals, user.id);
};

const nextShiftCode = async (tx, branchId, counter, now) => {
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const base = `SHF-${day}${month}-C${counter.counter_no}`;
  let code = base;
  let sequence = 2;
  while (
    await tx.cashShift.findFirst({
      where: { branch_id: BigInt(branchId), counter_id: counter.id, shift_code: code },
      select: { id: true },
    })
  ) {
    code = `${base}-${sequence}`;
    sequence += 1;
  }
  return code;
};

const normalizeDenominations = (rows) => {
  const merged = new Map();
  for (const row of rows) {
    const kind = row.kind;
    const denomination = Number(row.denomination);
    const quantity = Math.floor(Number(row.quantity));
    if (quantity <= 0) {
      continue;
    }
    const allowed = kind === 'note' ? NOTE_VALUES : COIN_VALUES;
    if (!allowed.has(denomination)) {
      throw new ApiError(400, `${kind} denomination ${denomination} is not used on the cash register`);
    }
    const key = `${kind}:${denomination.toFixed(2)}`;
    const current = merged.get(key) || { kind, denomination, quantity: 0 };
    current.quantity += quantity;
    merged.set(key, current);
  }
  return [...merged.values()].map((row) => ({
    kind: row.kind,
    denomination: row.denomination.toFixed(2),
    quantity: row.quantity,
    line_total: roundMoney(row.denomination * row.quantity).toFixed(2),
  }));
};

export const listCounters = async (user, branchId) => {
  const id = resolveBranchId(user, branchId);
  await ensureCounters(id);
  const rows = await prisma.counter.findMany({
    where: { branch_id: BigInt(id), is_active: true },
    orderBy: { counter_no: 'asc' },
    include: {
      cash_shifts: {
        where: { status: 'open' },
        select: { id: true, shift_code: true },
        take: 1,
      },
    },
  });
  return shapeRecord(
    rows.map((row) => ({
      id: row.id,
      branch_id: row.branch_id,
      counter_no: row.counter_no,
      counter_name: row.counter_name,
      cash_balance: row.cash_balance,
      is_active: row.is_active,
      open_shift_id: row.cash_shifts[0]?.id ?? null,
      open_shift_code: row.cash_shifts[0]?.shift_code ?? null,
    }))
  );
};

export const listCashShifts = async (user, branchId) => {
  const id = resolveBranchId(user, branchId);
  const rows = await prisma.cashShift.findMany({
    where: { branch_id: BigInt(id) },
    include: shiftInclude,
    orderBy: { opened_at: 'desc' },
    take: 100,
  });
  const shifts = [];
  for (const row of rows) {
    shifts.push(await presentShift(row, user));
  }
  return shifts;
};

export const getCashShift = async (user, shiftId) => {
  const shift = await loadShift(shiftId);
  if (!shift) {
    throw new ApiError(404, 'Shift not found');
  }
  assertBranchAccess(user, shift.branch_id);
  return presentShift(shift, user);
};

export const openCashShift = async (user, payload) => {
  const branchId = resolveBranchId(user, payload.branch_id);
  const openingCash = roundMoney(payload.opening_cash);
  const now = new Date();
  let shiftId;
  try {
    shiftId = await prisma.$transaction(async (tx) => {
      await ensureCounters(branchId, tx);
      const counter = await tx.counter.findFirst({
        where: { id: BigInt(payload.counter_id), branch_id: BigInt(branchId), is_active: true },
      });
      if (!counter) {
        throw new ApiError(400, 'Counter not found');
      }

      const activeAssignment = await tx.cashShiftUser.findFirst({
        where: {
          user_id: BigInt(user.id),
          ended_at: null,
          shift: { status: 'open', branch_id: BigInt(branchId) },
        },
        include: { shift: true },
      });
      if (activeAssignment && sameUser(activeAssignment.shift.counter_id, counter.id)) {
        return activeAssignment.shift_id;
      }
      if (activeAssignment) {
        await tx.cashShiftUser.update({
          where: { id: activeAssignment.id },
          data: { ended_at: now },
        });
      }

      const openShift = await tx.cashShift.findFirst({
        where: { counter_id: counter.id, status: 'open' },
      });
      if (openShift) {
        await tx.cashShiftUser.create({
          data: { shift_id: openShift.id, user_id: BigInt(user.id), started_at: now },
        });
        return openShift.id;
      }

      const created = await tx.cashShift.create({
        data: {
          branch_id: BigInt(branchId),
          counter_id: counter.id,
          shift_code: await nextShiftCode(tx, branchId, counter, now),
          status: 'open',
          opened_at: now,
          opening_cash: openingCash,
          expected_cash: openingCash,
          open_counter_id: counter.id,
          users: {
            create: { user_id: BigInt(user.id), started_at: now },
          },
        },
      });
      await tx.counter.update({
        where: { id: counter.id },
        data: { cash_balance: openingCash },
      });
      return created.id;
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error?.code === 'P2002') {
      throw new ApiError(409, 'This counter already has an open shift. Try again to join it.');
    }
    throw error;
  }
  return getCashShift(user, shiftId);
};

export const addCashMovement = async (user, shiftId, payload) => {
  const shift = await loadShift(shiftId);
  if (!shift) {
    throw new ApiError(404, 'Shift not found');
  }
  assertBranchAccess(user, shift.branch_id);
  if (shift.status !== 'open') {
    throw new ApiError(400, 'Cash can be added only while the counter shift is open');
  }
  const assigned = (shift.users || []).some((row) => sameUser(row.user_id, user.id) && !row.ended_at);
  if (!assigned) {
    throw new ApiError(403, 'Join this counter before recording cash in or cash out');
  }
  const amount = roundMoney(payload.amount);
  const field = payload.entry_type === 'cash_in' ? 'cash_in' : 'cash_out';
  await prisma.cashShift.update({
    where: { id: shift.id },
    data: { [field]: roundMoney(Number(shift[field]) + amount) },
  });
  return getCashShift(user, shift.id);
};

export const closeCashShift = async (user, shiftId, payload) => {
  const shift = await loadShift(shiftId);
  if (!shift) {
    throw new ApiError(404, 'Shift not found');
  }
  assertBranchAccess(user, shift.branch_id);
  if (shift.status !== 'open') {
    throw new ApiError(400, 'This shift is already closed');
  }
  const assigned = (shift.users || []).some((row) => sameUser(row.user_id, user.id) && !row.ended_at);
  if (!assigned) {
    throw new ApiError(403, 'Join this counter before closing its shift');
  }

  const totals = await collectTotals(shift);
  const expected = expectedCash(shift, totals);
  const lines = normalizeDenominations(payload.denominations || []);
  const closingCash = roundMoney(lines.reduce((sum, line) => sum + Number(line.line_total), 0));
  if (expected > 0 && lines.length === 0) {
    throw new ApiError(400, 'Enter the note and coin counts before closing the shift');
  }
  const variance = roundMoney(closingCash - expected);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    if (lines.length) {
      await tx.cashShiftDenomination.createMany({
        data: lines.map((line) => ({ shift_id: shift.id, ...line })),
      });
    }
    await tx.cashShiftUser.updateMany({
      where: { shift_id: shift.id, ended_at: null },
      data: { ended_at: now },
    });
    await tx.cashShift.update({
      where: { id: shift.id },
      data: {
        status: 'closed',
        closed_at: now,
        open_counter_id: null,
        cash_sales: totals.cash_sales,
        upi_card_sales: totals.upi_card_sales,
        cash_refunds: totals.cash_refunds,
        expected_cash: expected,
        closing_cash: closingCash,
        variance,
        closing_note: payload.closing_note,
      },
    });
    await tx.counter.update({
      where: { id: shift.counter_id },
      data: { cash_balance: closingCash },
    });
  });

  return getCashShift(user, shift.id);
};
