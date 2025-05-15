import test from "ava";
import Joi from 'joi';
import { Miniflare } from 'miniflare';
import { Model, Schema, type SchemaConfigI, Form } from '../src';

// Helper function for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Test database schema
export const schema = [
  `CREATE TABLE users (id text PRIMARY KEY, name text UNIQUE, languages text, deleted_at datetime, created_at datetime, updated_at datetime);`
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
    { name: 'name', type: 'string', constraints: [{ type: 'UNIQUE' }] },
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
  created_at?: string;
  updated_at?: string;
  deleted_at?: string;
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

test('Create and update user with JSON data using instance.update()', async (t) => {
  const { db: binding }: any = t.context;
  
  // Create initial user - this should be a full User instance now
  const initialLanguages = ['es', 'en'];
  const userInstance = await createUser({ name: 'John', languages: initialLanguages }, binding) as User;
  
  // Verify initial data on the instance
  t.truthy(userInstance, 'createUser should return a User instance.');
  if (!userInstance) return t.fail('User instance not created.');

  t.is(userInstance.data.name, 'John');
  t.deepEqual(userInstance.data.languages, initialLanguages);
  t.truthy(userInstance.id, 'User instance should have an ID.');
  const originalCreatedAt = userInstance.data.created_at; // Assuming created_at is populated

  // Introduce a delay to ensure updated_at can differ from created_at
  await delay(1100); 

  // Define changes for the update - no ID needed here for instance.update()
  const updatedLanguages = ['es', 'en', 'fr'];
  const changesToApply: Partial<UserDataI> = {
    name: 'Mochis Deluxe',
    languages: updatedLanguages
  };
  
  // Call instance.update()
  const updatedUser = await userInstance.update(changesToApply, binding);
  
  // 1. Verify the instance returned by update()
  t.truthy(updatedUser, 'instance.update() should return the updated instance.');
  if (!updatedUser) return t.fail('instance.update() did not return an instance.');
  
  t.is(updatedUser.data.name, 'Mochis Deluxe', 'Returned instance name should be updated.');
  t.deepEqual(updatedUser.data.languages, updatedLanguages, 'Returned instance languages should be updated.');
  t.truthy(updatedUser.data.updated_at, 'Returned instance should have updated_at timestamp.');
  if (originalCreatedAt && updatedUser.data.updated_at) {
    t.not(updatedUser.data.updated_at, originalCreatedAt, 'updated_at should be different from created_at.');
  }

  // 2. Verify the original userInstance is also mutated
  t.is(userInstance.data.name, 'Mochis Deluxe', 'Original instance name should reflect update.');
  t.deepEqual(userInstance.data.languages, updatedLanguages, 'Original instance languages should reflect update.');
  t.is(userInstance.data.updated_at, updatedUser.data.updated_at, 'Original instance updated_at should match returned instance.');

  // 3. Verify retrieval of updated user from DB
  const retrievedAfterUpdate = await User.findById(userInstance.id!, binding) as User;
  t.truthy(retrievedAfterUpdate, 'Should be able to retrieve user after update.');
  if (!retrievedAfterUpdate) return t.fail('Failed to retrieve user after update.');

  t.is(retrievedAfterUpdate.data.name, 'Mochis Deluxe', 'Persisted name should be updated.');
  t.deepEqual(retrievedAfterUpdate.data.languages, updatedLanguages, 'Persisted languages should be updated.');
  t.is(retrievedAfterUpdate.data.created_at, originalCreatedAt, 'created_at should remain unchanged after update.');
  t.is(retrievedAfterUpdate.data.updated_at, updatedUser.data.updated_at, 'Persisted updated_at should match.');
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
  const { results } = await User.query(
    `SELECT * FROM users WHERE id='${user.data.id}'`, 
    binding
  );
  
  // Should have exactly one result and deleted_at should be set
  t.is(results.length, 1, 'User should still exist in the database');
  t.truthy(results[0].deleted_at, 'User should have deleted_at timestamp set');
});

// Instance Delete Method Tests
test('Instance can call delete() successfully (soft delete)', async (t) => {
  const { db: binding }: any = t.context;
  const userData = { name: 'DeleteMeInstance' };
  const userInstance = await createUser(userData, binding) as User;

  t.truthy(userInstance, 'User instance should be created.');
  t.truthy(userInstance.id, 'User instance should have an ID.');
  const userId = userInstance.id!;

  // Call instance delete()
  const deleteResult = await userInstance.delete(binding);
  t.truthy(deleteResult.message.includes('soft deleted'), 'Instance delete should confirm soft deletion.');

  // Verify the instance data is not nulled out immediately by instance.delete()
  // The static delete method, which instance.delete() calls, doesn't modify the instance itself
  t.is(userInstance.data.name, 'DeleteMeInstance', 'Instance data should remain after calling delete.');

  // Try to find the user by ID using static User.findById, it should not be found (due to soft delete)
  const notFoundUser = await User.findById(userId, binding);
  t.is(notFoundUser, null, 'User should not be found without includeDeleted flag after soft delete.');

  // Verify soft delete by querying with includeDeleted: true
  const softDeletedUser = await User.findById(userId, binding, true) as User; 
  t.truthy(softDeletedUser, 'User should be retrievable when includeDeleted is true.');
  const softDeletedUser2 = await User.findById(userId, binding, true) as User; 
  t.truthy(softDeletedUser2, 'User (softDeletedUser2, includeDeleted: true) should be retrievable.'); 

  // Assertions for softDeletedUser - now a model instance
  t.truthy(softDeletedUser!.data.deleted_at, 'softDeletedUser.data.deleted_at should have a timestamp.');
  t.is(softDeletedUser!.id, userId, 'softDeletedUser.id should match.');
  t.is(softDeletedUser!.data.id, userId, 'softDeletedUser.data.id should match.');

  // Assertions for softDeletedUser2 - now also a model instance
  t.truthy(softDeletedUser2!.data.deleted_at, 'softDeletedUser2.data.deleted_at should have a timestamp.');
  t.is(softDeletedUser2!.id, userId, 'softDeletedUser2.id should match.');
  t.is(softDeletedUser2!.data.id, userId, 'softDeletedUser2.data.id should match.');
});

test('Instance delete() throws error if ID is missing', async (t) => {
  const { db: binding }: any = t.context;
  const userInstance = new User({ name: 'NoIDUser' });
  // Ensure ID is not set
  userInstance.data.id = undefined;
  userInstance.id = null;

  try {
    await userInstance.delete(binding);
    t.fail('Should have thrown an error because ID is missing.');
  } catch (error: any) {
    t.true(error instanceof Error, 'Error should be an instance of Error.'); // Or ModelError if ModelError is exported and used
    t.is(error.message, 'Instance data is missing an ID, cannot delete.', 'Error message not as expected.');
  }
});

test('Instance delete() performs soft delete when schema is configured', async (t) => {
  const { db: binding }: any = t.context;
  // User schema in this test file is already configured for softDeletes: true
  const userData = { name: 'SoftDeleteTestInstance' };
  const userInstance = await createUser(userData, binding) as User;

  t.truthy(userInstance, 'User instance should be created for soft delete test.');
  t.truthy(userInstance.id, 'User instance should have an ID.');
  const userId = userInstance.id!;

  const deleteResult = await userInstance.delete(binding);
  t.truthy(deleteResult.message.includes('soft deleted'), 'Confirmation message should indicate soft delete.');

  // Attempt to find the user normally - should not be found.
  const foundNormally = await User.findById(userId, binding);
  t.is(foundNormally, null, 'User should not be found with default findById after soft delete.');

  // Attempt to find including deleted - should be found.
  const foundWithSoftDelete = await User.findById(userId, binding, true) as User;
  t.truthy(foundWithSoftDelete, 'User should be found when including deleted records.');
  t.truthy(foundWithSoftDelete!.data.deleted_at, 'User data should have a deleted_at timestamp.');
  t.is(foundWithSoftDelete!.id, userId, 'Found user ID should match original ID.');

  // Also, verify that a direct query for the ID still returns the row, but with deleted_at set
  const queryResponse = await User.query(`SELECT * FROM users WHERE id = '${userId}'`, binding);
  t.truthy(queryResponse.success && queryResponse.results && queryResponse.results.length > 0, 'Raw query should find the user.');
  if (queryResponse.success && queryResponse.results && queryResponse.results.length > 0) {
    t.truthy(queryResponse.results[0].deleted_at, 'Raw query result should have deleted_at populated.');
  }
});

// Unique Constraint and FindOne Tests
test('Unique constraint on name', async (t) => {
  const { db: binding }: any = t.context;
  const uniqueName = 'UniqueName';
  const user1 = await createUser({ name: uniqueName }, binding);
  try {
    await createUser({ name: uniqueName }, binding);
    t.fail('Should have thrown an error due to unique constraint violation.');
  } catch (error: any) {
    t.true(error instanceof Error, 'Error should be an instance of Error.'); // Or ModelError if ModelError is exported and used
    t.is(error.message, 'D1_ERROR: UNIQUE constraint failed: users.name: SQLITE_CONSTRAINT', 'Error message not as expected.');
  }
});

test('Find one user by name', async (t) => {
  const { db: binding }: any = t.context;
  const name = 'FindOneUser';
  const user = await createUser({ name }, binding);
  const foundUser = await User.findOne('name', name, binding);
  t.truthy(foundUser, 'User should be found.');
  t.is(foundUser!.data.name, name, 'Found user name should match.');
});

// --- Test Suite for Model.instance.save() ---
test.serial('instance.save() correctly dispatches to create() for new records and updates instance', async (t) => {
  const { db: binding }: any = t.context;
  const initialName = 'SaveCreate Test User';
  const initialLanguages = ['typescript', 'javascript'];

  const userInstance = new User({ name: initialName, languages: initialLanguages });
  console.log('[Test: save->create] Initial userInstance.id:', userInstance.id);
  console.log('[Test: save->create] Initial userInstance.data:', JSON.stringify(userInstance.data));

  // Call save() on the new instance
  const savedUserInstance = await userInstance.save(binding);
  console.log('[Test: save->create] userInstance.save() returned:', JSON.stringify(savedUserInstance));

  // Log state of the original instance (it should be updated)
  console.log('[Test: save->create] Original userInstance.id after save:', userInstance.id);
  console.log('[Test: save->create] Original userInstance.data after save:', JSON.stringify(userInstance.data));
  console.log('[Test: save->create] Returned savedUserInstance.id after save:', savedUserInstance?.id);
  console.log('[Test: save->create] Returned savedUserInstance.data after save:', JSON.stringify(savedUserInstance?.data));

  // --- EXPECTED CONSOLE OUTPUT (for manual verification before assertions) ---
  console.log(`[Test: save->create] EXPECTED: savedUserInstance to be the same object as userInstance.`);
  console.log(`[Test: save->create] EXPECTED: userInstance.id to be a non-null string (newly created ID).`);
  console.log(`[Test: save->create] EXPECTED: userInstance.data.name to be '${initialName}'.`);
  console.log(`[Test: save->create] EXPECTED: userInstance.data.languages to be ${JSON.stringify(initialLanguages)}.`);
  console.log(`[Test: save->create] EXPECTED: userInstance.data.created_at to be a non-null string.`);
  console.log(`[Test: save->create] EXPECTED: userInstance.data.updated_at to be a non-null string.`);

  // Assertions
  t.truthy(savedUserInstance, 'save() should return the instance for a new record.');
  t.is(savedUserInstance, userInstance, 'save() should return the same instance (this).');
  t.truthy(userInstance.id, 'Instance ID (userInstance.id) should be populated after save (create).');
  t.is(userInstance.data.name, initialName, 'Instance data.name should be correct after save (create).');
  t.deepEqual(userInstance.data.languages, initialLanguages, 'Instance data.languages should be correct after save (create).');
  t.truthy(userInstance.data.created_at, 'created_at should be populated on userInstance.data.');
  t.truthy(userInstance.data.updated_at, 'updated_at should be populated on userInstance.data.');

  // Verify data in DB
  if (userInstance.id) {
    const retrievedUser = await User.findById(userInstance.id, binding);
    console.log('[Test: save->create] Retrieved user from DB by ID:', JSON.stringify(retrievedUser));
    t.truthy(retrievedUser, 'User should be findable in DB after save (create).');
    if (retrievedUser) {
      t.is(retrievedUser.data.name, initialName, 'DB: Name should match.');
      t.deepEqual(retrievedUser.data.languages, initialLanguages, 'DB: Languages should match.');
      t.is(retrievedUser.data.id, userInstance.id, 'DB: ID should match.');
    }
  } else {
    console.error('[Test: save->create] CRITICAL: userInstance.id is not set after save, cannot verify DB state.');
    t.fail('User ID not set after save, cannot verify DB state.');
  }
  t.pass('Create test finished. Review logs.');
});

test.serial('instance.save() correctly dispatches to update() for existing records and updates instance', async (t) => {
  const { db: binding }: any = t.context;
  const initialName = 'SaveUpdate Test User Initial';
  const initialLanguages = ['go', 'python'];

  // Step 1: Create an initial user (can use .save() for this as it's tested above)
  const userInstance = new User({ name: initialName, languages: initialLanguages });
  console.log('[Test: save->update] Before initial save - userInstance.id:', userInstance.id);
  console.log('[Test: save->update] Before initial save - userInstance.data:', JSON.stringify(userInstance.data));
  await userInstance.save(binding); // Create the record

  const originalId = userInstance.id;
  const originalCreatedAt = userInstance.data.created_at;
  console.log('[Test: save->update] After initial save (create) - userInstance.id:', originalId);
  console.log('[Test: save->update] After initial save (create) - userInstance.data:', JSON.stringify(userInstance.data));

  t.truthy(originalId, 'Pre-condition: User must have an ID after initial save.');
  if (!originalId) {
    console.error('[Test: save->update] CRITICAL: Failed to create user for update test.');
    return t.fail('Failed to create user for update test.');
  }

  // Introduce a delay to ensure updated_at can differ from created_at if system is too fast
  await delay(1100);

  // Step 2: Modify the instance's data
  const updatedName = 'SaveUpdate Test User Updated';
  const updatedLanguages = ['go', 'rust', 'c++'];
  userInstance.data.name = updatedName;
  userInstance.data.languages = updatedLanguages;
  // DO NOT change userInstance.id here, it should remain the same for an update.
  console.log('[Test: save->update] Instance data before calling save() for update - userInstance.id:', userInstance.id);
  console.log('[Test: save->update] Instance data before calling save() for update - userInstance.data:', JSON.stringify(userInstance.data));

  // Step 3: Call save() on the existing, modified instance
  const savedUserInstance = await userInstance.save(binding);
  console.log('[Test: save->update] userInstance.save() returned for update:', JSON.stringify(savedUserInstance));

  // Log state of the original instance (it should be updated)
  console.log('[Test: save->update] Original userInstance.id after save (update):', userInstance.id);
  console.log('[Test: save->update] Original userInstance.data after save (update):', JSON.stringify(userInstance.data));
  console.log('[Test: save->update] Returned savedUserInstance.id after save (update):', savedUserInstance?.id);
  console.log('[Test: save->update] Returned savedUserInstance.data after save (update):', JSON.stringify(savedUserInstance?.data));

  // --- EXPECTED CONSOLE OUTPUT (for manual verification before assertions) ---
  console.log(`[Test: save->update] EXPECTED: savedUserInstance to be the same object as userInstance.`);
  console.log(`[Test: save->update] EXPECTED: userInstance.id to be '${originalId}' (ID should not change on update).`);
  console.log(`[Test: save->update] EXPECTED: userInstance.data.name to be '${updatedName}'.`);
  console.log(`[Test: save->update] EXPECTED: userInstance.data.languages to be ${JSON.stringify(updatedLanguages)}.`);
  console.log(`[Test: save->update] EXPECTED: userInstance.data.created_at to be '${originalCreatedAt}' (created_at should not change).`);
  console.log(`[Test: save->update] EXPECTED: userInstance.data.updated_at to be a new timestamp, different from created_at.`);

  // Assertions
  t.truthy(savedUserInstance, 'save() should return the instance for an update.');
  t.is(savedUserInstance, userInstance, 'save() should return the same instance (this) for update.');
  t.is(userInstance.id, originalId, 'Instance ID (userInstance.id) should remain the same after save (update).');
  t.is(userInstance.data.name, updatedName, 'Instance data.name should be updated.');
  t.deepEqual(userInstance.data.languages, updatedLanguages, 'Instance data.languages should be updated.');
  t.is(userInstance.data.created_at, originalCreatedAt, 'created_at should not change on update.');
  t.truthy(userInstance.data.updated_at, 'updated_at should be populated on userInstance.data.');
  if (originalCreatedAt && userInstance.data.updated_at) {
    t.not(userInstance.data.updated_at, originalCreatedAt, 'updated_at should be different from original created_at.');
  }

  // Verify data in DB
  if (userInstance.id) {
    const retrievedUser = await User.findById(userInstance.id, binding);
    console.log('[Test: save->update] Retrieved user from DB by ID:', JSON.stringify(retrievedUser));
    t.truthy(retrievedUser, 'User should be findable in DB after save (update).');
    if (retrievedUser) {
      t.is(retrievedUser.data.name, updatedName, 'DB: Name should be updated.');
      t.deepEqual(retrievedUser.data.languages, updatedLanguages, 'DB: Languages should be updated.');
      t.is(retrievedUser.data.id, originalId, 'DB: ID should remain the same.');
      t.is(retrievedUser.data.created_at, originalCreatedAt, 'DB: created_at should remain the same.');
    }
  } else {
    console.error('[Test: save->update] CRITICAL: userInstance.id is not set, cannot verify DB state for update.');
    t.fail('User ID not set, cannot verify DB state for update.');
  }
  t.pass('Update test finished. Review logs.');
});
