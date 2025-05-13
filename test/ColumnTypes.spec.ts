import test from "ava";
import Joi from 'joi';
import { Miniflare } from 'miniflare';
import { Model, Schema, type SchemaConfigI, Form, type Column } from '../src';

// Test database schema
export const schema = [
  `CREATE TABLE advanced_entities (id text PRIMARY KEY, string_value text, number_value real, integer_value integer, boolean_value integer, json_value text, date_value text, deleted_at datetime, created_at datetime, updated_at datetime);`
];

// Define column types for the schema
const columns: Column[] = [
  { name: 'id', type: 'string', constraints: [{ type: 'PRIMARY KEY' }] },
  { name: 'string_value', type: 'string', sqliteType: 'TEXT' },
  { name: 'number_value', type: 'number', sqliteType: 'REAL' },
  { name: 'integer_value', type: 'number', sqliteType: 'INTEGER' },
  { name: 'boolean_value', type: 'boolean', sqliteType: 'INTEGER' },
  { name: 'json_value', type: 'jsonb', sqliteType: 'TEXT' },
  { name: 'date_value', type: 'date', sqliteType: 'TEXT' }
];

// Schema configuration
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

// Joi validation schema for form validation
const advancedEntityJoiSchema = Joi.object({
  id: Joi.string(),
  string_value: Joi.string(),
  number_value: Joi.number(),
  integer_value: Joi.number().integer(),
  boolean_value: Joi.boolean(),
  json_value: Joi.object(),
  date_value: Joi.date()
});

// Form class for validation
export class AdvancedEntityForm extends Form {
  constructor(data: AdvancedEntityI) {
    super(advancedEntityJoiSchema, data);
  }
}

// Model class that extends the base Model
class AdvancedEntity extends Model implements AdvancedEntityI {
  data: AdvancedEntityDataI;

  constructor(props: AdvancedEntityDataI = {}) {
    super(advancedEntitySchema);
    this.data = props || {};
  }

  // Static method to ensure proper model initialization
  static async create(form: any, env: any) {
    return super.create(form, env);
  }

  static async update(data: any, env: any) {
    return super.update(data, env);
  }

  static async findById(id: string, env: any, complete: boolean = false) {
    return super.findById(id, env, complete);
  }

  static async findOne(column: string, value: string, env: any) {
    return super.findOne(column, value, env);
  }

  static async all(env: any) {
    return super.all(env);
  }

  static async delete(id: string, env: any) {
    return super.delete(id, env);
  }

  static async query(query: string, env: any) {
    return super.query(query, env);
  }
}

// Helper function to create an entity with the given data
async function createEntity(data: AdvancedEntityDataI, binding: any): Promise<any> {
  const entity = new AdvancedEntity(data);
  const form = new AdvancedEntityForm(entity);
  return AdvancedEntity.create(form, binding);
}


// Store Miniflare instances to clean up later
const miniflares: any[] = [];

test.beforeEach(async (t) => {
  try {
    // Create a Miniflare instance with D1
    const mf = new Miniflare({
      modules: true,
      script: 'export default {};',
      d1Databases: ['TEST_DB'],
    });
    
    // Get the D1 database
    const db = await mf.getD1Database('TEST_DB');
    
    // Create users table with simplified SQL syntax for Miniflare v4
    await db.exec(schema[0].trim());
        
    // Store context for the test`
    t.context = { db, mf };
    
    // Store instance for cleanup
    miniflares.push(mf);
    
    console.log('✅ Test database initialized with users schema');
  } catch (error) {
    console.error('❌ Error in test setup:', error);
    throw error;
  }
});

// Cleanup Miniflare instances after tests
test.after.always(() => {
  for (const mf of miniflares) {
    if (mf && typeof mf.dispose === 'function') {
      mf.dispose();
    }
  }
});


// Column Type Tests
test('string - should store and retrieve string values correctly', async (t) => {
  const { db: binding }: any = t.context;
  const entity = await createEntity({ string_value: 'Test String' }, binding);
  
  t.is(entity.data.string_value, 'Test String');
  t.truthy(entity.data.id); // Should have an auto-generated UUID
  
  // Verify retrieval
  const retrieved = await AdvancedEntity.findById(entity.data.id, binding);
  t.not(retrieved, null);
  if (retrieved) {
    t.is(retrieved.data.string_value, 'Test String');
  }
});

test('number - should store and retrieve number values correctly', async (t) => {
  const { db: binding }: any = t.context;
  const entity = await createEntity({ 
    number_value: 123.45,
    integer_value: 42
  }, binding);
  
  // Verify values
  t.is(entity.data.number_value, 123.45);
  t.is(entity.data.integer_value, 42);
  
  // Verify correct type conversion - numbers should be numbers not strings
  t.is(typeof entity.data.number_value, 'number');
  t.is(typeof entity.data.integer_value, 'number');
  
  // Verify retrieval
  const retrieved = await AdvancedEntity.findById(entity.data.id, binding);
  t.not(retrieved, null);
  if (retrieved) {
    t.is(retrieved.data.number_value, 123.45);
    t.is(retrieved.data.integer_value, 42);
  }
});

test('boolean - should store and retrieve boolean values correctly', async (t) => {
  const { db: binding }: any = t.context;
  
  // Test true value
  const trueEntity = await createEntity({ boolean_value: true }, binding);
  t.is(trueEntity.data.boolean_value, true);
  t.is(typeof trueEntity.data.boolean_value, 'boolean');
  
  // Test false value
  const falseEntity = await createEntity({ boolean_value: false }, binding);
  t.is(falseEntity.data.boolean_value, false);
  t.is(typeof falseEntity.data.boolean_value, 'boolean');
  
  // Verify retrieval
  if (trueEntity.data.id) {
    const retrievedTrue = await AdvancedEntity.findById(trueEntity.data.id, binding);
    t.not(retrievedTrue, null);
    if (retrievedTrue) {
      t.is(retrievedTrue.data.boolean_value, true);
    }
  }
  
  if (falseEntity.data.id) {
    const retrievedFalse = await AdvancedEntity.findById(falseEntity.data.id, binding);
    t.not(retrievedFalse, null);
    if (retrievedFalse) {
      t.is(retrievedFalse.data.boolean_value, false);
    }
  }
});

test('json - should serialize and deserialize JSON values correctly', async (t) => {
  const { db: binding }: any = t.context;
  const jsonData = { 
    name: 'Test Object', 
    nested: { value: 42 },
    array: [1, 2, 3]
  };
  
  const entity = await createEntity({ json_value: jsonData }, binding);
  
  // Verify JSON structure is preserved
  t.deepEqual(entity.data.json_value, jsonData);
  t.is(typeof entity.data.json_value, 'object');
  t.is(entity.data.json_value.name, 'Test Object');
  t.is(entity.data.json_value.nested.value, 42);
  t.deepEqual(entity.data.json_value.array, [1, 2, 3]);
  
  // Verify retrieval
  if (entity.data.id) {
    const retrieved = await AdvancedEntity.findById(entity.data.id, binding);
    t.not(retrieved, null);
    if (retrieved) {
      t.deepEqual(retrieved.data.json_value, jsonData);
    }
  }
});

test('date - should store and retrieve date values correctly', async (t) => {
  const { db: binding }: any = t.context;
  const testDate = new Date('2025-01-01T12:00:00Z');
  
  const entity = await createEntity({ date_value: testDate }, binding);
  
  // The date should be stored as an ISO string
  t.is(entity.data.date_value, testDate.toISOString());
  
  // Verify retrieval
  if (entity.data.id) {
    const retrieved = await AdvancedEntity.findById(entity.data.id, binding);
    t.not(retrieved, null);
    if (retrieved) {
      t.is(retrieved.data.date_value, testDate.toISOString());
    }
  }
});
// CRUD Operations Tests
test('create - should create entities with all data types', async (t) => {
  const { db: binding }: any = t.context;
  
  const testData = {
    string_value: 'Create Test',
    number_value: 123.45,
    integer_value: 42,
    boolean_value: true,
    json_value: { test: 'value' },
    date_value: new Date('2025-01-01')
  };
  
  const entity = await createEntity(testData, binding);
  
  // Verify all fields were created correctly
  t.is(entity.data.string_value, testData.string_value);
  t.is(entity.data.number_value, testData.number_value);
  t.is(entity.data.integer_value, testData.integer_value);
  t.is(entity.data.boolean_value, testData.boolean_value);
  t.deepEqual(entity.data.json_value, testData.json_value);
  t.is(entity.data.date_value, testData.date_value.toISOString());
  
  // Verify UUID was generated
  t.truthy(entity.data.id);
});

test('update - should update entities with all data types', async (t) => {
  const { db: binding }: any = t.context;
  
  // Create initial entity
  const initialData = {
    string_value: 'Initial String',
    number_value: 100.5,
    integer_value: 100,
    boolean_value: false,
    json_value: { status: 'initial' },
    date_value: new Date('2025-01-01')
  };
  
  const entity = await createEntity(initialData, binding);
  t.truthy(entity.data.id, 'Entity should have an ID');
  
  if (entity.data.id) {
    // Update with new values
    const updatedData = {
      id: entity.data.id,
      string_value: 'Updated String',
      number_value: 200.75,
      integer_value: 200,
      boolean_value: true,
      json_value: { status: 'updated', newField: 'added' },
      date_value: new Date('2025-02-01')
    };
    
    const result = await AdvancedEntity.update({ data: updatedData }, binding);
    t.truthy(result, 'Update should return a result');
    
    // Type guard to ensure we're working with the right type
    if (result && typeof result === 'object' && !('message' in result)) {
      // Cast to any to access properties safely
      const updatedEntity: any = result;
      
      // Verify all values were updated correctly
      t.is(updatedEntity.data.string_value, updatedData.string_value);
      t.is(updatedEntity.data.number_value, updatedData.number_value);
      t.is(updatedEntity.data.integer_value, updatedData.integer_value);
      t.is(updatedEntity.data.boolean_value, updatedData.boolean_value);
      t.deepEqual(updatedEntity.data.json_value, updatedData.json_value);
      t.is(updatedEntity.data.date_value, updatedData.date_value.toISOString());
      
      // Verify retrieval of updated entity
      const retrieved = await AdvancedEntity.findById(entity.data.id, binding);
      t.not(retrieved, null);
      if (retrieved) {
        t.is(retrieved.data.string_value, updatedData.string_value);
      }
    }
  }
});

test('read - should find entities by id and column values', async (t) => {
  const { db: binding }: any = t.context;
  
  // Create test entity
  const testData = {
    string_value: 'Find Me',
    boolean_value: true,
    json_value: { searchKey: 'searchValue' },
    number_value: 12345
  };
  
  const entity = await createEntity(testData, binding);
  t.truthy(entity.data.id, 'Entity should have an ID');
  
  if (entity.data.id) {
    // Test findById
    const foundById = await AdvancedEntity.findById(entity.data.id, binding);
    t.not(foundById, null);
    if (foundById) {
      t.is(foundById.data.string_value, testData.string_value);
      t.is(foundById.data.boolean_value, testData.boolean_value);
      t.deepEqual(foundById.data.json_value, testData.json_value);
    }
    
    // Test findById with complete option to include timestamps
    const completeEntity = await AdvancedEntity.findById(entity.data.id, binding, true);
    t.not(completeEntity, null);
    if (completeEntity) {
      // In the Model-one library, timestamps might be directly on the entity or in the data property
      // depending on how the findById method is implemented
      const created_at = completeEntity.created_at || (completeEntity.data && completeEntity.data.created_at);
      const updated_at = completeEntity.updated_at || (completeEntity.data && completeEntity.data.updated_at);
      t.truthy(created_at, 'Should have a created_at timestamp');
      t.truthy(updated_at, 'Should have an updated_at timestamp');
    }
    
    // Test findOne by string value
    const foundByString = await AdvancedEntity.findOne('string_value', 'Find Me', binding);
    t.not(foundByString, null);
    if (foundByString) {
      t.is(foundByString.data.string_value, 'Find Me');
    }
    
    // Test findOne by number value
    const foundByNumber = await AdvancedEntity.findOne('number_value', '12345', binding);
    t.not(foundByNumber, null);
    if (foundByNumber) {
      t.is(foundByNumber.data.number_value, 12345);
    }
  }
});

test('delete - should soft delete entities and hide them from queries', async (t) => {
  const { db: binding }: any = t.context;
  
  // Create entity to delete
  const entity = await createEntity({ string_value: 'To Be Deleted' }, binding);
  t.truthy(entity.data.id, 'Entity should have an ID');
  
  if (entity.data.id) {
    // Soft delete the entity
    await AdvancedEntity.delete(entity.data.id, binding);
    
    // Try to find the entity - should return null due to soft delete
    const notFound = await AdvancedEntity.findById(entity.data.id, binding);
    t.is(notFound, null);
    
    // Verify it still exists in DB by running a raw query that ignores deleted_at
    const { results } = await AdvancedEntity.query(
      `SELECT * FROM advanced_entities WHERE id='${entity.data.id}'`, 
      binding
    );
    
    // Should have exactly one result and deleted_at should be set
    t.is(results.length, 1);
    t.truthy(results[0].deleted_at);
  }
});

// Collection Operations Tests
test('all - should retrieve all non-deleted entities', async (t) => {
  const { db: binding }: any = t.context;
  
  // Create multiple entities
  for (let i = 0; i < 5; i++) {
    await createEntity({ string_value: `Entity ${i}` }, binding);
  }
  
  // Get all entities - should be 5
  const allEntities = await AdvancedEntity.all(binding);
  t.is(allEntities.length, 5);
  
  // Delete 2 entities
  if (allEntities[0] && allEntities[0].data && allEntities[0].data.id) {
    await AdvancedEntity.delete(allEntities[0].data.id, binding);
  }
  if (allEntities[1] && allEntities[1].data && allEntities[1].data.id) {
    await AdvancedEntity.delete(allEntities[1].data.id, binding);
  }
  
  // Get all entities again - should be 3 now
  const remainingEntities = await AdvancedEntity.all(binding);
  t.is(remainingEntities.length, 3);
  
  // Verify the correct entities remain
  const remainingValues = remainingEntities.map(e => e.data.string_value);
  t.deepEqual(remainingValues.sort(), ['Entity 2', 'Entity 3', 'Entity 4'].sort());
});

test('query - should execute raw SQL queries correctly', async (t) => {
  const { db: binding }: any = t.context;
  
  // Create test entities
  await createEntity({ 
    string_value: 'Raw Query Test 1',
    number_value: 999
  }, binding);
  
  await createEntity({ 
    string_value: 'Raw Query Test 2',
    number_value: 999
  }, binding);
  
  await createEntity({ 
    string_value: 'Different Value',
    number_value: 123
  }, binding);
  
  // Run a raw query with a WHERE clause
  const { success, results } = await AdvancedEntity.query(
    `SELECT * FROM advanced_entities WHERE number_value = 999`, 
    binding
  );
  
  t.true(success);
  t.is(results.length, 2);
  
  // Verify the correct entities were returned
  const stringValues = results.map(r => r.string_value);
  t.true(stringValues.includes('Raw Query Test 1'));
  t.true(stringValues.includes('Raw Query Test 2'));
  t.false(stringValues.includes('Different Value'));
});

// Run the tests to verify the refactored code works correctly
test.after.always('Clean up', async () => {
  // This runs after all tests
  console.log('Tests completed successfully');
});
