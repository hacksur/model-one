import test from "ava";
import Joi from 'joi';
import { Miniflare } from 'miniflare';
import { Model, Schema, type SchemaConfigI, Form } from '../lib';

// Test database schema
export const schema = [
  `CREATE TABLE users (id text PRIMARY KEY, name text, languages text, deleted_at datetime, created_at datetime, updated_at datetime);`
];

// Define validation schema for the form
const joiSchema = Joi.object({
  id: Joi.string(),
  name: Joi.string(),
  languages: Joi.array(),
});

// Schema configuration
const userSchema: SchemaConfigI = new Schema({
  table_name: 'users',
  columns: [
    { name: 'id', type: 'string' },
    { name: 'name', type: 'string' },
    { name: 'languages', type: 'jsonb' },
  ],
  timestamps: true,
  softDeletes: true
});

// Define interfaces for our model
interface UserDataI {
  id?: string;
  name?: string;
  languages?: string[];
}

interface UserI extends Model {
  data: UserDataI;
}

// Form class for validation
export class UserForm extends Form {
  constructor(data: UserI) {
    super(joiSchema, data);
  }
}

// Model class that extends the base Model
class User extends Model implements UserI {
  data: UserDataI;

  constructor(props: UserDataI = {}) {
    super(userSchema);
    this.data = props || {};
  }
}

// Helper function to create a user with the given data
async function createUser(data: UserDataI, binding: any): Promise<any> {
  const entity = new User(data);
  const form = new UserForm(entity);
  const createdUser = await User.create(form, binding);
  console.log('createdUser', createdUser);
  return createdUser;
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


// User CRUD Tests
test('Create a user with basic data', async (t) => {
  const { db: binding }: any = t.context;
  const user = await createUser({ name: 'John' }, binding);

  // Verify user was created with correct data
  t.is(user.data.name, 'John');
  t.truthy(user.data.id, 'User should have an auto-generated ID');
});

test('Create a user with JSON data (languages array)', async (t) => {
  const { db: binding }: any = t.context;
  const languages = ['es', 'en'];
  const user = await createUser({ name: 'John', languages }, binding);

  // Verify user was created with correct data
  t.is(user.data.name, 'John');
  t.deepEqual(user.data.languages, languages);
  t.is(typeof user.data.languages, 'object');
  t.true(Array.isArray(user.data.languages), 'Languages should be an array');
});

test('Create and update user with JSON data', async (t) => {
  const { db: binding }: any = t.context;
  
  // Create initial user
  const initialLanguages = ['es', 'en'];
  const user = await createUser({ name: 'John', languages: initialLanguages }, binding);
  
  // Verify initial data
  t.is(user.data.name, 'John');
  t.deepEqual(user.data.languages, initialLanguages);
  
  // Update the user
  const updatedLanguages = ['es', 'en', 'fr'];
  const updatedData = {
    id: user.data.id,
    name: 'Mochis',
    languages: updatedLanguages
  };
  
  const updatedUser = await User.update({ data: updatedData }, binding);
  
  // Verify updated data
  t.truthy(updatedUser, 'Update should return a user');
  if (updatedUser && typeof updatedUser === 'object') {
    // Cast to any to access properties safely
    const result: any = updatedUser;
    
    t.is(result.data.name, 'Mochis');
    t.is(typeof result.data.languages, 'object');
    t.deepEqual(result.data.languages, updatedLanguages);
    
    // Verify retrieval of updated user
    const retrieved = await User.findById(user.data.id, binding);
    t.not(retrieved, null);
    if (retrieved) {
      t.is(retrieved.data.name, 'Mochis');
      t.deepEqual(retrieved.data.languages, updatedLanguages);
    }
  }
});

test('Find user by ID', async (t) => {
  const { db: binding }: any = t.context;
  
  // Create a user to find
  const user = await createUser({ name: 'FindMe', languages: ['en'] }, binding);
  
  // Find the user by ID
  const foundUser = await User.findById(user.data.id, binding);
  
  // Verify the user was found with correct data
  t.not(foundUser, null);
  if (foundUser) {
    t.is(foundUser.data.name, 'FindMe');
    t.deepEqual(foundUser.data.languages, ['en']);
  }
});

test('Delete a user (soft delete)', async (t) => {
  const { db: binding }: any = t.context;
  
  // Create a user to delete
  const user = await createUser({ name: 'ToDelete' }, binding);
  
  // Soft delete the user
  await User.delete(user.data.id, binding);
  
  // Try to find the user - should return null due to soft delete
  const notFound = await User.findById(user.data.id, binding);
  t.is(notFound, null, 'User should not be found after deletion');
  
  // Verify it still exists in DB by running a raw query that ignores deleted_at
  const { results } = await User.raw(
    `SELECT * FROM users WHERE id='${user.data.id}'`, 
    binding
  );
  
  // Should have exactly one result and deleted_at should be set
  t.is(results.length, 1, 'User should still exist in the database');
  t.truthy(results[0].deleted_at, 'User should have deleted_at timestamp set');
});
