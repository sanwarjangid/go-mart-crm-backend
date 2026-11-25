import prisma from '../src/config/db.js';

const tables = ['counters', 'cash_shifts', 'cash_shift_users', 'cash_shift_denominations'];

for (const table of tables) {
  const columns = await prisma.$queryRawUnsafe(`SHOW COLUMNS FROM \`${table}\``);
  const indexes = await prisma.$queryRawUnsafe(`SHOW INDEX FROM \`${table}\``);
  console.log(`\nTABLE ${table}`);
  for (const column of columns) {
    console.log(
      [
        column.Field,
        column.Type,
        column.Null,
        column.Key,
        column.Default,
        column.Extra,
      ].join(' | ')
    );
  }
  console.log('INDEXES');
  for (const index of indexes) {
    console.log(`${index.Key_name} ${index.Non_unique} ${index.Column_name}`);
  }
}

const counters = await prisma.$queryRawUnsafe(
  'SELECT id, branch_id, counter_no, counter_name, cash_balance, is_active FROM counters'
);
console.log('\nCOUNTER ROWS', JSON.stringify(counters, (_key, value) => (typeof value === 'bigint' ? Number(value) : value)));

await prisma.$disconnect();
