import test from "ava";
import Joi from 'joi';
import { createSQLiteDB } from '@miniflare/shared';
import { D1Database, D1DatabaseAPI } from '@miniflare/d1';
import { Model, Schema, type SchemaConfigI, Form, type Column } from '../lib';

// Create a test table with all supported column types
export const schema = [
  `
  CREATE TABLE advanced_entities (
    id text PRIMARY KEY,
    string_value text,
    number_value real,
    integer_value integer,
    boolean_value integer,
    json_value text,
    date_value text,
    deleted_at datetime,
    created_at datetime,
    updated_at datetime
  );`
];

// Define Joi validation schema for the form
const advancedEntityJoiSchema = Joi.object({
  id: Joi.string(),
  string_value: Joi.string(),
  number_value: Joi.number(),
  integer_value: Joi.number().integer(),
  boolean_value: Joi.boolean(),
  json_value: Joi.object(),
  date_value: Joi.date()
});

// Define columns with the new enhanced column types
const columns: Column[] = [
  { name: 'id', type: 'string', constraints: [{ type: 'PRIMARY KEY' }] },
  { name: 'string_value', type: 'string', sqliteType: 'TEXT' },
  { name: 'number_value', type: 'number', sqliteType: 'REAL' },
  { name: 'integer_value', type: 'number', sqliteType: 'INTEGER' },
  { name: 'boolean_value', type: 'boolean', sqliteType: 'INTEGER' },
  { name: 'json_value', type: 'jsonb', sqliteType: 'TEXT' },
  { name: 'date_value', type: 'date', sqliteType: 'TEXT' }
];

// Create schema configuration with timestamps and softDeletes
const advancedEntitySchema: SchemaConfigI = new Schema({
  table_name: 'advanced_entities',
  columns,
  timestamps: true,
  softDeletes: true
});

// Define interfaces for our model
interface AdvancedEntityDataI {
  id?: string;
  string_value?: string;
  number_value?: number;
  integer_value?: number;
  boolean_value?: boolean;
  json_value?: Record<string, any>;
  date_value?: Date | string;
}

interface AdvancedEntityI extends Model {
  data: AdvancedEntityDataI;
}

// Form class for validation
export class AdvancedEntityForm extends Form {
  constructor(data: AdvancedEntityI) {
    super(advancedEntityJoiSchema, data);
  }
}

// Model class that extends the base Model
class AdvancedEntity extends Model implements AdvancedEntityI {
  data: AdvancedEntityDataI;

  constructor(props: AdvancedEntityDataI) {
    super(advancedEntitySchema, props);
    this.data = props;
  }
}

// Setup test database before each test
test.beforeEach(async (t) => {
  const sqliteDb = await createSQLiteDB(':memory:');
  const db = new D1Database(new D1DatabaseAPI(sqliteDb));
  await db.batch(schema.map((item: string) => db.prepare(item)));
  t.context = { db };
});

// Test creating an entity with string value
test('Create an entity with string value', async (t) => {
  const { db: binding }: any = t.context;
  const form = new AdvancedEntityForm(new AdvancedEntity({ 
    string_value: 'Test String' 
  }));

  const entity = await AdvancedEntity.create(form, binding);

  t.is(entity.string_value, 'Test String');
  t.truthy(entity.id); // Should have an auto-generated UUID
});

// Test creating an entity with number value
test('Create an entity with number values', async (t) => {
  const { db: binding }: any = t.context;
  const form = new AdvancedEntityForm(new AdvancedEntity({ 
    number_value: 123.45,
    integer_value: 42
  }));

  const entity = await AdvancedEntity.create(form, binding);

  t.is(entity.number_value, 123.45);
  t.is(entity.integer_value, 42);
  // Verify correct type conversion - numbers should be numbers not strings
  t.is(typeof entity.number_value, 'number');
  t.is(typeof entity.integer_value, 'number');
});

// Test boolean value handling
test('Create an entity with boolean value', async (t) => {
  const { db: binding }: any = t.context;
  const form = new AdvancedEntityForm(new AdvancedEntity({ 
    boolean_value: true
  }));

  const entity = await AdvancedEntity.create(form, binding);

  t.is(entity.boolean_value, true);
  t.is(typeof entity.boolean_value, 'boolean');
  
  // Test with false value
  const form2 = new AdvancedEntityForm(new AdvancedEntity({ 
    boolean_value: false
  }));
  
  const entity2 = await AdvancedEntity.create(form2, binding);
  t.is(entity2.boolean_value, false);
  t.is(typeof entity2.boolean_value, 'boolean');
});

// Test JSON value serialization/deserialization
test('Create an entity with JSON value', async (t) => {
  const { db: binding }: any = t.context;
  const jsonData = { 
    name: 'Test Object', 
    nested: { value: 42 },
    array: [1, 2, 3]
  };
  
  const form = new AdvancedEntityForm(new AdvancedEntity({ 
    json_value: jsonData
  }));

  const entity = await AdvancedEntity.create(form, binding);

  t.deepEqual(entity.json_value, jsonData);
  t.is(typeof entity.json_value, 'object');
  t.is(entity.json_value.name, 'Test Object');
  t.is(entity.json_value.nested.value, 42);
  t.deepEqual(entity.json_value.array, [1, 2, 3]);
});

// Test date value handling
test('Create an entity with date value', async (t) => {
  const { db: binding }: any = t.context;
  const testDate = new Date('2025-01-01T12:00:00Z');
  
  const form = new AdvancedEntityForm(new AdvancedEntity({ 
    date_value: testDate
  }));

  const entity = await AdvancedEntity.create(form, binding);

  // The date should be stored as an ISO string
  t.is(entity.date_value, testDate.toISOString());
});

// Test updating an entity with all types
test('Create and update entity with all value types', async (t) => {
  const { db: binding }: any = t.context;
  
  // Create initial entity
  const form = new AdvancedEntityForm(new AdvancedEntity({ 
    string_value: 'Initial String',
    number_value: 100.5,
    integer_value: 100,
    boolean_value: false,
    json_value: { status: 'initial' },
    date_value: new Date('2025-01-01')
  }));

  const entity = await AdvancedEntity.create(form, binding);
  
  // Update with new values of each type
  const updatedData = {
    id: entity.id,
    string_value: 'Updated String',
    number_value: 200.75,
    integer_value: 200,
    boolean_value: true,
    json_value: { status: 'updated', newField: 'added' },
    date_value: new Date('2025-02-01')
  };
  
  const updatedEntity = await AdvancedEntity.update(updatedData, binding);
  
  // Verify all values were updated correctly
  t.is(updatedEntity.string_value, 'Updated String');
  t.is(updatedEntity.number_value, 200.75);
  t.is(updatedEntity.integer_value, 200);
  t.is(updatedEntity.boolean_value, true);
  t.deepEqual(updatedEntity.json_value, { status: 'updated', newField: 'added' });
  t.is(updatedEntity.date_value, new Date('2025-02-01').toISOString());
});

// Test findById with complete data retrieval
test('Find entity by ID with complete data', async (t) => {
  const { db: binding }: any = t.context;
  
  // Create entity
  const form = new AdvancedEntityForm(new AdvancedEntity({ 
    string_value: 'Find Me',
    boolean_value: true,
    json_value: { searchKey: 'searchValue' }
  }));

  const entity = await AdvancedEntity.create(form, binding);
  
  // Find the entity by ID
  const foundEntity = await AdvancedEntity.findById(entity.id, binding);
  
  // Verify the entity was found with correct data
  t.truthy(foundEntity);
  t.is(foundEntity.string_value, 'Find Me');
  t.is(foundEntity.boolean_value, true);
  t.deepEqual(foundEntity.json_value, { searchKey: 'searchValue' });
  
  // Test with complete option to include timestamps
  const completeEntity = await AdvancedEntity.findById(entity.id, binding, true);
  t.truthy(completeEntity.created_at);
  t.truthy(completeEntity.updated_at);
});

// Test findOne functionality
test('Find entity by column value', async (t) => {
  const { db: binding }: any = t.context;
  
  // Create entity
  const form = new AdvancedEntityForm(new AdvancedEntity({ 
    string_value: 'Unique Value',
    number_value: 12345
  }));

  await AdvancedEntity.create(form, binding);
  
  // Find by string value
  const foundByString = await AdvancedEntity.findOne('string_value', 'Unique Value', binding);
  t.is(foundByString.string_value, 'Unique Value');
  
  // Find by number value (converting to string for the query)
  const foundByNumber = await AdvancedEntity.findOne('number_value', '12345', binding);
  t.is(foundByNumber.number_value, 12345);
});

// Test soft delete functionality
test('Soft delete and verify records are hidden', async (t) => {
  const { db: binding }: any = t.context;
  
  // Create entity
  const form = new AdvancedEntityForm(new AdvancedEntity({ 
    string_value: 'To Be Deleted',
  }));

  const entity = await AdvancedEntity.create(form, binding);
  
  // Soft delete the entity
  await AdvancedEntity.delete(entity.id, binding);
  
  // Try to find the entity - should return null due to soft delete
  const notFound = await AdvancedEntity.findById(entity.id, binding);
  t.is(notFound, null);
  
  // Verify it still exists in DB by running a raw query that ignores deleted_at
  const { results } = await AdvancedEntity.raw(
    `SELECT * FROM advanced_entities WHERE id='${entity.id}'`, 
    binding
  );
  
  // Should have exactly one result and deleted_at should be set
  t.is(results.length, 1);
  t.truthy(results[0].deleted_at);
});

// Test all() method with filtering of soft-deleted records
test('All method excludes soft-deleted records', async (t) => {
  const { db: binding }: any = t.context;
  
  // Create multiple entities
  for (let i = 0; i < 5; i++) {
    const form = new AdvancedEntityForm(new AdvancedEntity({ 
      string_value: `Entity ${i}`,
    }));
    await AdvancedEntity.create(form, binding);
  }
  
  // Get all entities - should be 5
  const allEntities = await AdvancedEntity.all(binding);
  t.is(allEntities.length, 5);
  
  // Delete 2 entities
  await AdvancedEntity.delete(allEntities[0].id, binding);
  await AdvancedEntity.delete(allEntities[1].id, binding);
  
  // Get all entities again - should be 3 now
  const remainingEntities = await AdvancedEntity.all(binding);
  t.is(remainingEntities.length, 3);
});

// Test the raw SQL query method
test('Execute raw SQL query', async (t) => {
  const { db: binding }: any = t.context;
  
  // Create entity
  const form = new AdvancedEntityForm(new AdvancedEntity({ 
    string_value: 'Raw Query Test',
    number_value: 999
  }));

  await AdvancedEntity.create(form, binding);
  
  // Run a raw query with a WHERE clause
  const { success, results } = await AdvancedEntity.raw(
    `SELECT * FROM advanced_entities WHERE number_value = 999`, 
    binding
  );
  
  t.true(success);
  t.is(results.length, 1);
  t.is(results[0].string_value, 'Raw Query Test');
});
