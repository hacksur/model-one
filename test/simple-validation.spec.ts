import test from "ava";
import { Schema } from '../src';

// Test that focuses only on the Schema validation without database operations
test('Simple schema validation', t => {
  // Create a simple schema
  const schema = new Schema({
    table_name: 'test_table',
    columns: [
      { name: 'name', type: 'string', required: true }
    ]
  });
  
  // Test that the schema was created
  t.truthy(schema);
  t.is(schema.table_name, 'test_table');
  t.pass('Schema created successfully');
});
