import test from "ava";
import { Model, Schema, type Column } from '../lib';

// Define a minimal schema for testing
const columns: Column[] = [
  { name: 'id', type: 'string', constraints: [{ type: 'PRIMARY KEY' }] }
];

const testSchema = new Schema({
  table_name: 'test_table',
  columns,
  timestamps: false,
  softDeletes: false
});

test.beforeEach((t: any) => {
  const model = new Model(testSchema);
  Object.assign(t.context, { model });
});

test('returns itself', (t: any) => {
  t.true(t.context.model instanceof Model);
});