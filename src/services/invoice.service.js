import { randomUUID } from 'node:crypto';
import { ApiError } from '../utils/ApiError.js';
import { assertBranchAccess, roundMoney, shapeRecord } from '../utils/billing.js';
import {
  changeBranchStock,
  createActivityRecord,
  createInvoiceRecord,
  createPaymentRecord,
  findInvoiceByNumber,
  findOfferByCode,
  getBranchRecord,
  getCustomerRecord,
  getInvoiceRecord,
  getPaymentModeRecord,
  getUserRecord,
  getVariantForSale,
  listReturnItemsForInvoice,
  nextInvoiceNumber,
  createReturnRecord,
  updateReturnNumber,
  runTransaction,
  updateInvoiceRecord,
  upsertEntityVersion,
} from '../models/billing.model.js';

const round3 = (value) => Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;

const paymentStatus = (paid, grand) => {
  if (paid <= 0) {
    return 'unpaid';
  }
  if (paid + 0.001 >= grand) {
    return 'paid';
  }
  return 'partial';
};

const lineDiscount = (gross, type, value) => {
  if (!type || !value) {
    return 0;
  }
  if (type === 'percent') {
    if (value > 100) {
      throw new ApiError(400, 'Percent discount cannot exceed 100');
    }
    return roundMoney((gross * value) / 100);
  }
  if (value > gross) {
    throw new ApiError(400, 'Discount cannot exceed the line amount');
  }
  return roundMoney(value);
};

const prepareLines = async (payload, tx) => {
  const lines = [];
  for (const item of payload.items) {
    const variant = await getVariantForSale(item.product_variant_id, tx);
    if (!variant || !variant.is_active || !variant.product.is_active) {
      throw new ApiError(400, 'Product variant not found or inactive');
    }
    const branchPrice = variant.branch_prices.find((price) => Number(price.branch_id) === Number(payload.branch_id));
    const unitPrice = item.unit_price ?? Number(branchPrice?.selling_price ?? variant.selling_price);
    const taxRate = item.tax_rate ?? Number(branchPrice?.tax_rate?.tax_percentage ?? 0);
    const quantity = round3(item.quantity);
    const gross = roundMoney(quantity * unitPrice);
    const discount = lineDiscount(gross, item.discount_type, item.discount_value || 0);
    lines.push({
      product_variant_id: variant.id,
      product_name: `${variant.product.product_name} ${variant.variant_name}`.slice(0, 180),
      sku: variant.sku,
      hsn_code: variant.product.hsn_code,
      quantity,
      unit_price: roundMoney(unitPrice),
      discount_type: item.discount_type || null,
      discount_value: roundMoney(item.discount_value || 0),
      line_discount: discount,
      taxable: roundMoney(gross - discount),
      tax_rate: taxRate,
    });
  }
  return lines;
};

const applyOffer = async (payload, lines, tx) => {
  if (!payload.offer_code) {
    return lines.map((line) => ({ ...line, offer_discount: 0 }));
  }
  const offer = await findOfferByCode(payload.offer_code, tx);
  if (!offer || !offer.is_active) {
    throw new ApiError(400, 'Offer is not active');
  }
  const now = payload.invoice_date || new Date();
  if (now < offer.start_date || now > offer.end_date) {
    throw new ApiError(400, 'Offer is outside its date range');
  }
  if (offer.offer_branches.length && !offer.offer_branches.some((row) => Number(row.branch_id) === Number(payload.branch_id))) {
    throw new ApiError(400, 'Offer does not apply to this branch');
  }
  const restricted = offer.offer_products.map((row) => Number(row.product_variant_id));
  const eligible = lines.map((line) => restricted.length === 0 || restricted.includes(Number(line.product_variant_id)));
  const eligibleTotal = roundMoney(lines.reduce((sum, line, index) => sum + (eligible[index] ? line.taxable : 0), 0));
  if (eligibleTotal < Number(offer.minimum_purchase)) {
    throw new ApiError(400, 'Offer minimum purchase is not met');
  }
  let offerDiscount = offer.discount_type === 'percent' ? roundMoney((eligibleTotal * Number(offer.discount_value)) / 100) : roundMoney(offer.discount_value);
  if (offer.maximum_discount != null) {
    offerDiscount = Math.min(offerDiscount, Number(offer.maximum_discount));
  }
  offerDiscount = Math.min(offerDiscount, eligibleTotal);
  let remaining = offerDiscount;
  return lines.map((line, index) => {
    if (!eligible[index] || eligibleTotal === 0) {
      return { ...line, offer_discount: 0 };
    }
    const share = index === lines.length - 1 ? remaining : roundMoney((offerDiscount * line.taxable) / eligibleTotal);
    remaining = roundMoney(remaining - share);
    return { ...line, offer_discount: Math.min(share, line.taxable) };
  });
};

const priceLines = (lines, taxMode) =>
  lines.map((line) => {
    const taxable = roundMoney(line.taxable - line.offer_discount);
    const tax = roundMoney((taxable * Number(line.tax_rate)) / 100);
    const half = roundMoney(tax / 2);
    const cgst = taxMode === 'intra' ? half : 0;
    const sgst = taxMode === 'intra' ? roundMoney(tax - half) : 0;
    const igst = taxMode === 'inter' ? tax : 0;
    return {
      ...line,
      taxable_amount: taxable,
      discount_amount: roundMoney(line.line_discount + line.offer_discount),
      tax_amount: tax,
      cgst_amount: cgst,
      sgst_amount: sgst,
      igst_amount: igst,
      total_amount: roundMoney(taxable + tax),
    };
  });

const sumField = (rows, field) => roundMoney(rows.reduce((total, row) => total + Number(row[field]), 0));

export const getInvoiceForUser = async (id, user) => {
  const invoice = await getInvoiceRecord(id);
  if (!invoice) {
    throw new ApiError(404, 'Invoice not found');
  }
  assertBranchAccess(user, invoice.branch_id);
  return shapeRecord(invoice);
};

export const createSalesInvoice = async (payload, user, deviceId) => {
  assertBranchAccess(user, payload.branch_id);
  const invoice = await runTransaction(async (tx) => {
    const branch = await getBranchRecord(payload.branch_id, tx);
    if (!branch || !branch.is_active) {
      throw new ApiError(400, 'Branch not found or inactive');
    }
    if (payload.customer_id) {
      const customer = await getCustomerRecord(payload.customer_id, tx);
      if (!customer) {
        throw new ApiError(400, 'Customer not found');
      }
    }
    if (payload.salesperson_id) {
      const salesperson = await getUserRecord(payload.salesperson_id, tx);
      if (!salesperson || !salesperson.is_active) {
        throw new ApiError(400, 'Salesperson not found or inactive');
      }
    }
    for (const payment of payload.payments) {
      const mode = await getPaymentModeRecord(payment.payment_mode_id);
      if (!mode || !mode.is_active) {
        throw new ApiError(400, 'Payment mode not found or inactive');
      }
    }

    const invoiceDate = payload.invoice_date || new Date();
    const invoiceNumber = payload.invoice_number || (await nextInvoiceNumber(tx, branch, invoiceDate));
    const existing = await findInvoiceByNumber(payload.branch_id, invoiceNumber, tx);
    if (existing) {
      throw new ApiError(409, 'Invoice number already exists for this branch');
    }

    const prepared = priceLines(await applyOffer({ ...payload, invoice_date: invoiceDate }, await prepareLines(payload, tx), tx), payload.tax_mode);
    const soldByVariant = new Map();
    for (const line of prepared) {
      const key = String(line.product_variant_id);
      soldByVariant.set(key, (soldByVariant.get(key) || 0) + Number(line.quantity));
    }
    for (const [variantId, quantity] of soldByVariant) {
      await changeBranchStock(payload.branch_id, variantId, -quantity, tx);
    }
    const subtotal = roundMoney(prepared.reduce((total, line) => total + line.quantity * line.unit_price, 0));
    const exactTotal = sumField(prepared, 'total_amount');
    const grandTotal = Math.round(exactTotal);
    const paid = sumField(payload.payments, 'amount');
    if (paid - grandTotal > 0.001) {
      throw new ApiError(400, 'Paid amount cannot exceed the invoice total');
    }

    const created = await createInvoiceRecord(
      {
        invoice_number: invoiceNumber,
        branch_id: BigInt(payload.branch_id),
        customer_id: payload.customer_id ? BigInt(payload.customer_id) : null,
        salesperson_id: payload.salesperson_id ? BigInt(payload.salesperson_id) : null,
        invoice_date: invoiceDate,
        subtotal,
        discount_amount: sumField(prepared, 'discount_amount'),
        taxable_amount: sumField(prepared, 'taxable_amount'),
        cgst_amount: sumField(prepared, 'cgst_amount'),
        sgst_amount: sumField(prepared, 'sgst_amount'),
        igst_amount: sumField(prepared, 'igst_amount'),
        tax_amount: sumField(prepared, 'tax_amount'),
        round_off: roundMoney(grandTotal - exactTotal),
        grand_total: grandTotal,
        paid_amount: paid,
        due_amount: roundMoney(grandTotal - paid),
        payment_status: paymentStatus(paid, grandTotal),
        invoice_status: 'completed',
        notes: payload.notes,
        created_by: BigInt(user.id),
        items: {
          create: prepared.map((line) => ({
            product_variant_id: line.product_variant_id,
            product_name: line.product_name,
            sku: line.sku,
            hsn_code: line.hsn_code,
            quantity: line.quantity,
            unit_price: line.unit_price,
            discount_type: line.discount_type,
            discount_value: line.discount_value,
            discount_amount: line.discount_amount,
            taxable_amount: line.taxable_amount,
            tax_rate: line.tax_rate,
            cgst_amount: line.cgst_amount,
            sgst_amount: line.sgst_amount,
            igst_amount: line.igst_amount,
            tax_amount: line.tax_amount,
            total_amount: line.total_amount,
          })),
        },
        payments: {
          create: payload.payments.map((payment) => ({
            branch_id: BigInt(payload.branch_id),
            payment_mode_id: BigInt(payment.payment_mode_id),
            amount: payment.amount,
            transaction_reference: payment.transaction_reference,
            payment_date: invoiceDate,
            notes: payment.notes,
            received_by: BigInt(user.id),
          })),
        },
      },
      tx,
    );
    await createActivityRecord(
      {
        user_id: BigInt(user.id),
        branch_id: BigInt(payload.branch_id),
        action: 'create',
        module: 'sales_invoices',
        record_id: String(created.id),
        description: `Created invoice ${created.invoice_number}`,
      },
      tx,
    );
    await upsertEntityVersion('sales_invoice', created.id, deviceId, tx);
    return created;
  });
  return shapeRecord(invoice);
};

export const cancelSalesInvoice = async (id, user) => {
  const current = await getInvoiceRecord(id);
  if (!current) {
    throw new ApiError(404, 'Invoice not found');
  }
  assertBranchAccess(user, current.branch_id);
  if (current.invoice_status === 'cancelled') {
    throw new ApiError(400, 'Invoice is already cancelled');
  }
  const invoice = await runTransaction(async (tx) => {
    const returned = await listReturnItemsForInvoice(id, tx);
    const remainingByVariant = new Map();
    for (const item of current.items) {
      const key = String(item.product_variant_id);
      remainingByVariant.set(key, (remainingByVariant.get(key) || 0) + Number(item.quantity));
    }
    for (const row of returned) {
      const key = String(row.product_variant_id);
      remainingByVariant.set(key, (remainingByVariant.get(key) || 0) - Number(row.quantity));
    }
    for (const [variantId, quantity] of remainingByVariant) {
      if (quantity > 0.0001) {
        await changeBranchStock(current.branch_id, variantId, quantity, tx);
      }
    }
    const updated = await updateInvoiceRecord(id, { invoice_status: 'cancelled' }, tx);
    await createActivityRecord(
      {
        user_id: BigInt(user.id),
        branch_id: current.branch_id,
        action: 'cancel',
        module: 'sales_invoices',
        record_id: String(current.id),
        description: `Cancelled invoice ${current.invoice_number}`,
      },
      tx,
    );
    await upsertEntityVersion('sales_invoice', current.id, null, tx);
    return updated;
  });
  return shapeRecord(invoice);
};

export const createSalesReturn = async (invoiceId, payload, user) => {
  const salesReturn = await runTransaction(async (tx) => {
    const invoice = await getInvoiceRecord(invoiceId, tx);
    if (!invoice) {
      throw new ApiError(404, 'Invoice not found');
    }
    assertBranchAccess(user, invoice.branch_id);
    if (invoice.invoice_status === 'cancelled') {
      throw new ApiError(400, 'Cancelled invoice cannot be returned');
    }
    if (payload.refund_mode_id) {
      const mode = await getPaymentModeRecord(payload.refund_mode_id);
      if (!mode || !mode.is_active) {
        throw new ApiError(400, 'Payment mode not found or inactive');
      }
    }

    const requestedIds = payload.items.map((item) => item.invoice_item_id);
    if (new Set(requestedIds).size !== requestedIds.length) {
      throw new ApiError(400, 'Return items must not contain duplicates');
    }
    const previous = await listReturnItemsForInvoice(invoiceId, tx);
    const returnedByItem = new Map();
    const refundedReturnIds = new Set();
    let refunded = 0;
    for (const row of previous) {
      const key = String(row.invoice_item_id);
      returnedByItem.set(key, (returnedByItem.get(key) || 0) + Number(row.quantity));
      if (!refundedReturnIds.has(String(row.sales_return.id))) {
        refundedReturnIds.add(String(row.sales_return.id));
        refunded += Number(row.sales_return.refund_amount);
      }
    }

    const lines = [];
    for (const requested of payload.items) {
      const item = invoice.items.find((row) => Number(row.id) === Number(requested.invoice_item_id));
      if (!item) {
        throw new ApiError(400, 'Invoice item not found on this invoice');
      }
      const already = returnedByItem.get(String(item.id)) || 0;
      const remaining = Number(item.quantity) - already;
      if (requested.quantity - remaining > 0.0001) {
        throw new ApiError(400, 'Return quantity exceeds the quantity sold');
      }
      const ratio = requested.quantity / Number(item.quantity);
      lines.push({
        invoice_item_id: item.id,
        product_variant_id: item.product_variant_id,
        quantity: requested.quantity,
        total_amount: roundMoney(Number(item.total_amount) * ratio),
        tax_amount: roundMoney(Number(item.tax_amount) * ratio),
        restock: requested.restock !== false,
      });
    }

    const totalAmount = roundMoney(lines.reduce((sum, line) => sum + line.total_amount, 0));
    const taxAmount = roundMoney(lines.reduce((sum, line) => sum + line.tax_amount, 0));
    let refundAmount = roundMoney(payload.refund_amount || 0);
    if (refundAmount - totalAmount > 0.001) {
      throw new ApiError(400, 'Refund cannot exceed the return total');
    }
    const paidRemaining = roundMoney(Number(invoice.paid_amount) - refunded);
    if (refundAmount - paidRemaining > 0.001) {
      if (refundAmount - paidRemaining < 1) {
        refundAmount = paidRemaining;
      } else {
        throw new ApiError(400, 'Refund cannot exceed the amount paid on the invoice');
      }
    }

    for (const line of lines) {
      if (!line.restock) continue;
      await changeBranchStock(invoice.branch_id, line.product_variant_id, line.quantity, tx);
    }

    const created = await createReturnRecord(
      {
        return_number: `TMP-${randomUUID()}`,
        invoice_id: invoice.id,
        branch_id: invoice.branch_id,
        return_date: new Date(),
        total_amount: totalAmount,
        tax_amount: taxAmount,
        refund_amount: refundAmount,
        refund_mode_id: payload.refund_mode_id ? BigInt(payload.refund_mode_id) : null,
        notes: payload.notes,
        created_by: BigInt(user.id),
        items: {
          create: lines.map((line) => ({
            invoice_item_id: line.invoice_item_id,
            product_variant_id: line.product_variant_id,
            quantity: line.quantity,
            total_amount: line.total_amount,
          })),
        },
      },
      tx,
    );
    const numbered = await updateReturnNumber(created.id, `RET${String(created.id).padStart(6, '0')}`, tx);
    const fullyReturned = invoice.items.every((item) => {
      const already = returnedByItem.get(String(item.id)) || 0;
      const added = lines.find((line) => Number(line.invoice_item_id) === Number(item.id));
      return already + (added ? added.quantity : 0) + 0.0001 >= Number(item.quantity);
    });
    if (fullyReturned) {
      await updateInvoiceRecord(invoice.id, { invoice_status: 'returned' }, tx);
    }
    await createActivityRecord(
      {
        user_id: BigInt(user.id),
        branch_id: invoice.branch_id,
        action: 'return',
        module: 'sales_returns',
        record_id: String(numbered.id),
        description: `Returned invoice ${invoice.invoice_number}`,
      },
      tx,
    );
    await upsertEntityVersion('sales_return', numbered.id, null, tx);
    return numbered;
  });
  return shapeRecord(salesReturn);
};

export const addPayment = async (invoiceId, payload, user) => {
  const invoice = await runTransaction(async (tx) => {
    const current = await getInvoiceRecord(invoiceId, tx);
    if (!current) {
      throw new ApiError(404, 'Invoice not found');
    }
    assertBranchAccess(user, current.branch_id);
    if (current.invoice_status === 'cancelled') {
      throw new ApiError(400, 'Cancelled invoice cannot accept payment');
    }
    const mode = await getPaymentModeRecord(payload.payment_mode_id);
    if (!mode || !mode.is_active) {
      throw new ApiError(400, 'Payment mode not found or inactive');
    }
    const paid = roundMoney(Number(current.paid_amount) + Number(payload.amount));
    const grand = Number(current.grand_total);
    if (paid - grand > 0.001) {
      throw new ApiError(400, 'Paid amount cannot exceed the invoice total');
    }
    await createPaymentRecord(
      {
        invoice_id: current.id,
        branch_id: current.branch_id,
        payment_mode_id: BigInt(payload.payment_mode_id),
        amount: payload.amount,
        transaction_reference: payload.transaction_reference,
        payment_date: new Date(),
        notes: payload.notes,
        received_by: BigInt(user.id),
      },
      tx,
    );
    const updated = await updateInvoiceRecord(
      invoiceId,
      {
        paid_amount: paid,
        due_amount: roundMoney(grand - paid),
        payment_status: paymentStatus(paid, grand),
      },
      tx,
    );
    await createActivityRecord(
      {
        user_id: BigInt(user.id),
        branch_id: current.branch_id,
        action: 'payment',
        module: 'payments',
        record_id: String(current.id),
        description: `Received payment for invoice ${current.invoice_number}`,
      },
      tx,
    );
    await upsertEntityVersion('sales_invoice', current.id, null, tx);
    return updated;
  });
  return shapeRecord(invoice);
};
