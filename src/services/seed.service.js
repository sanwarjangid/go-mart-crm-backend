import bcrypt from 'bcryptjs';
import prisma from '../config/db.js';
import { createPermissionRecord, findRoleByName } from '../models/role.model.js';
import { findUserByEmail } from '../models/user.model.js';

const PERMISSIONS = [
  ['Create users', 'users.create', 'users'],
  ['Read users', 'users.read', 'users'],
  ['Update users', 'users.update', 'users'],
  ['Change user status', 'users.status', 'users'],
  ['Assign user branches', 'users.assign_branches', 'users'],
  ['Read roles', 'roles.read', 'roles'],
  ['Create roles', 'roles.create', 'roles'],
  ['Update roles', 'roles.update', 'roles'],
  ['Assign role permissions', 'roles.assign_permissions', 'roles'],
  ['Read permissions', 'permissions.read', 'permissions'],
  ['Read branches', 'branches.read', 'branches'],
  ['Create branches', 'branches.create', 'branches'],
  ['Update branches', 'branches.update', 'branches'],
  ['Access all branches', 'branches.access_all', 'branches'],
  ['Create customers', 'customers.create', 'customers'],
  ['Read customers', 'customers.read', 'customers'],
  ['Update customers', 'customers.update', 'customers'],
  ['Create products', 'products.create', 'products'],
  ['Read products', 'products.read', 'products'],
  ['Update products', 'products.update', 'products'],
  ['Create payment modes', 'payment_modes.create', 'payments'],
  ['Read payment modes', 'payment_modes.read', 'payments'],
  ['Update payment modes', 'payment_modes.update', 'payments'],
  ['Create offers', 'offers.create', 'offers'],
  ['Read offers', 'offers.read', 'offers'],
  ['Update offers', 'offers.update', 'offers'],
  ['Create invoices', 'invoices.create', 'invoices'],
  ['Read invoices', 'invoices.read', 'invoices'],
  ['Cancel invoices', 'invoices.cancel', 'invoices'],
  ['Return invoices', 'invoices.return', 'invoices'],
  ['Create payments', 'payments.create', 'payments'],
  ['Read payments', 'payments.read', 'payments'],
  ['Read cash shifts', 'cash_shifts.read', 'payments'],
  ['Manage cash shifts', 'cash_shifts.manage', 'payments'],
  ['Read reports', 'reports.read', 'reports'],
  ['Read activity logs', 'activity_logs.read', 'activity'],
  ['Push sync', 'sync.push', 'sync'],
  ['Pull sync', 'sync.pull', 'sync'],
];

const ROLE_PERMISSIONS = {
  'Super Admin': PERMISSIONS.map((item) => item[1]),
  'Branch Manager': [
    'users.read',
    'users.update',
    'users.assign_branches',
    'branches.read',
    'branches.update',
    'customers.create',
    'customers.read',
    'customers.update',
    'products.create',
    'products.read',
    'products.update',
    'payment_modes.read',
    'offers.create',
    'offers.read',
    'offers.update',
    'invoices.create',
    'invoices.read',
    'invoices.cancel',
    'invoices.return',
    'payments.create',
    'payments.read',
    'cash_shifts.read',
    'cash_shifts.manage',
    'reports.read',
    'activity_logs.read',
    'sync.push',
    'sync.pull',
  ],
  Cashier: [
    'branches.read',
    'customers.create',
    'customers.read',
    'customers.update',
    'products.read',
    'payment_modes.read',
    'offers.read',
    'invoices.create',
    'invoices.read',
    'invoices.return',
    'payments.create',
    'payments.read',
    'cash_shifts.read',
    'cash_shifts.manage',
    'sync.push',
    'sync.pull',
  ],
};

const JAIPUR_BRANCH = {
  branch_code: 'JPR01',
  branch_name: 'GO CART Vaishali Store',
  address: 'C-42, Vaishali Nagar',
  city: 'Jaipur',
  state: 'Rajasthan',
  pincode: '302021',
  phone: '01414001100',
  email: 'jaipur@gocartretail.in',
  gstin: '08AABCG1234K1Z5',
  is_active: true,
};

const STAFF_ACCOUNTS = [
  { name: 'Super Admin', email: 'superadmin@gmail.com', employee_code: 'SA-001', role: 'Super Admin', phone: '01414001101' },
  { name: 'Branch Manager', email: 'branchmanager@gmail.com', employee_code: 'BM-001', role: 'Branch Manager', phone: '01414001102' },
  { name: 'Cashier', email: 'cashier@gmail.com', employee_code: 'CSH-001', role: 'Cashier', phone: '01414001103' },
];

const ensurePermission = async (name, permissionKey, moduleName) => {
  const existing = await prisma.permission.findUnique({ where: { permission_key: permissionKey } });
  if (existing) {
    return existing;
  }
  return createPermissionRecord({ name, permission_key: permissionKey, module: moduleName });
};

export const seedAuthData = async () => {
  for (const [name, permissionKey, moduleName] of PERMISSIONS) {
    await ensurePermission(name, permissionKey, moduleName);
  }

  const permissions = await prisma.permission.findMany();
  const permissionByKey = new Map(permissions.map((item) => [item.permission_key, item.id]));

  for (const [roleName, keys] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await findRoleByName(roleName);
    if (!role) {
      continue;
    }

    const permissionIds = keys.map((key) => permissionByKey.get(key)).filter(Boolean);
    await prisma.rolePermission.deleteMany({ where: { role_id: role.id } });
    if (permissionIds.length) {
      await prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ role_id: role.id, permission_id: permissionId })),
      });
    }
  }

  const branch = await prisma.branch.upsert({
    where: { branch_code: JAIPUR_BRANCH.branch_code },
    update: JAIPUR_BRANCH,
    create: JAIPUR_BRANCH,
  });

  const password = await bcrypt.hash('System@123', 12);
  for (const account of STAFF_ACCOUNTS) {
    const role = await findRoleByName(account.role);
    if (!role) continue;
    const existing = await findUserByEmail(account.email);
    if (existing) continue;
    await prisma.user.create({
      data: {
        name: account.name,
        email: account.email,
        phone: account.phone,
        employee_code: account.employee_code,
        password,
        role_id: role.id,
        default_branch_id: branch.id,
        is_active: true,
        user_branches: { create: [{ branch_id: branch.id }] },
      },
    });
  }

  const paymentModes = ['Cash', 'UPI', 'Card'];
  for (const modeName of paymentModes) {
    const existing = await prisma.paymentMode.findUnique({ where: { mode_name: modeName } });
    if (!existing) {
      await prisma.paymentMode.create({ data: { mode_name: modeName, is_active: true } });
    }
  }

};
