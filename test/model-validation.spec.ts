import test from "ava";
import { createSQLiteDB } from '@miniflare/shared';
import { D1Database, D1DatabaseAPI } from '@miniflare/d1';
import { Model, Schema } from '../src';

// Create a simple database schema
const schema = [
  `
  CREATE TABLE products (
    id text PRIMARY KEY,
    name text,
    price real,
    category text,
    created_at datetime,
    updated_at datetime
  );`
];

// Define a schema with validation rules
const productSchema = new Schema({
  table_name: 'products',
  columns: [
    { 
      name: 'id', 
      type: 'string',
      required: true
    },
    { 
      name: 'name', 
      type: 'string',
      required: true,
      validation: {
        min: 3,
        max: 100
      }
    },
    { 
      name: 'price', 
      type: 'number',
      required: true,
      validation: {
        min: 0.01
      }
    },
    { 
      name: 'category', 
      type: 'string',
      validation: {
        min: 2
      }
    }
  ]
});

// Create a Product model
class Product extends Model {
  constructor(props?: any) {
    super(productSchema, props);
  }
}

// Setup test database
test.beforeEach(async (t) => {
  const sqliteDb = await createSQLiteDB(':memory:');
  const db = new D1Database(new D1DatabaseAPI(sqliteDb));
  await db.batch(schema.map((item: string) => db.prepare(item)));
  t.context = { db };
});

// Test creating a valid product
test('Create valid product', async t => {
  const { db: env }: any = t.context;
  
  const product = await Product.create({
    data: {
      name: 'Test Product',
      price: 19.99,
      category: 'Electronics'
    }
  }, env);
  
  t.truthy(product.id);
  t.is(product.name, 'Test Product');
  t.is(product.price, 19.99);
});

// Test product name validation
test('Product name validation', async t => {
  const { db: env }: any = t.context;
  
  // Test name too short
  const nameError = await t.throwsAsync<Error>(() => {
    return Product.create({
      data: {
        name: 'AB', // Too short (min: 3)
        price: 29.99,
        category: 'Books'
      }
    }, env);
  });
  
  t.truthy(nameError);
  t.regex(String(nameError), /name/i);
});

// Test price validation
test('Product price validation', async t => {
  const { db: env }: any = t.context;
  
  // Test price too low
  const priceError = await t.throwsAsync<Error>(() => {
    return Product.create({
      data: {
        name: 'Cheap Product',
        price: 0, // Too low (min: 0.01)
        category: 'Misc'
      }
    }, env);
  });
  
  t.truthy(priceError);
  t.regex(String(priceError), /price/i);
});

// Test update with validation
test('Update with validation', async t => {
  const { db: env }: any = t.context;
  
  // Create a valid product first
  const product = await Product.create({
    data: {
      name: 'Original Product',
      price: 15.99,
      category: 'Home'
    }
  }, env);
  
  // Valid update
  const updated = await Product.update({
    id: product.id,
    name: 'Updated Product',
    price: 18.99
  }, env);
  
  t.is(updated.name, 'Updated Product');
  t.is(updated.price, 18.99);
  
  // Invalid update (name too short)
  const updateError = await t.throwsAsync<Error>(() => {
    return Product.update({
      id: product.id,
      name: 'AB', // Too short
      price: 18.99
    }, env);
  });
  
  t.truthy(updateError);
  t.regex(String(updateError), /name/i);
});
