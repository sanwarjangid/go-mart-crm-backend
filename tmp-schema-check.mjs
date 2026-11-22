import { createBusinessSchema } from './src/schemas/business.schema.js';
import { createBranchSchema } from './src/schemas/branch.schema.js';

const ok = createBusinessSchema.safeParse({
  body: { business_name: '  GO  ', email: '', GSTIN: null },
});
console.log('ok', ok.success, ok.success ? ok.data.body : ok.error.issues);

const missing = createBusinessSchema.safeParse({ body: {} });
console.log('missing', missing.success ? missing.data : missing.error.issues.map((i) => i.message));

const uuid = createBranchSchema.safeParse({
  body: { business_id: 'not-uuid', branch_code: 'A', branch_name: 'B' },
});
console.log('uuid', uuid.success ? uuid.data : uuid.error.issues.map((i) => i.message));
