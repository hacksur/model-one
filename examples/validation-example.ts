/**
 * Example demonstrating the automatic validation in Model-one
 */
import { Model, Schema } from '../src/index';

// Define a schema with validation rules
const userSchema = new Schema({
  table_name: 'users',
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
        min: 2,
        max: 50
      }
    },
    { 
      name: 'email', 
      type: 'string',
      required: true,
      validation: {
        email: true
      }
    },
    { 
      name: 'age', 
      type: 'number',
      validation: {
        min: 18,
        max: 120
      }
    },
    { 
      name: 'preferences', 
      type: 'jsonb'
    },
  ],
  timestamps: true,
  softDeletes: true
});

// Create a User model with automatic validation
class User extends Model {
  constructor(props?: any) {
    super(userSchema, props);
    // Validation happens automatically in the Model class
  }
  
  // Custom methods can be added
  static async findByEmail(email: string, env: any) {
    const query = `SELECT * FROM ${userSchema.table_name} WHERE email = ? AND deleted_at IS NULL`;
    const { results } = await env.prepare(query).bind(email).all();
    return results?.[0] || null;
  }
}

// Usage example
async function main(env: any) {
  try {
    // Valid user - will pass validation
    const validUser = await User.create({
      data: {
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
        preferences: { theme: 'dark', notifications: true }
      }
    }, env);
    
    console.log('Valid user created:', validUser);
    
    // Invalid email - will fail validation
    try {
      await User.create({
        data: {
          name: 'Jane Smith',
          email: 'invalid-email',  // Invalid email format
          age: 25
        }
      }, env);
    } catch (error) {
      console.error('Email validation error:', error.message);
    }
    
    // Name too short - will fail validation
    try {
      await User.create({
        data: {
          name: 'J',  // Too short (min: 2)
          email: 'jane@example.com',
          age: 25
        }
      }, env);
    } catch (error) {
      console.error('Name validation error:', error.message);
    }
    
    // Age below minimum - will fail validation
    try {
      await User.create({
        data: {
          name: 'Alex Johnson',
          email: 'alex@example.com',
          age: 17  // Below minimum (18)
        }
      }, env);
    } catch (error) {
      console.error('Age validation error:', error.message);
    }
    
    // Update with valid data
    const updated = await User.update({
      id: validUser.id,
      name: 'John Smith',
      email: 'john.smith@example.com'
    }, env);
    
    console.log('Updated user:', updated);
    
    // Update with invalid data - will fail validation
    try {
      await User.update({
        id: validUser.id,
        name: 'J',  // Too short
        email: 'john@example.com'
      }, env);
    } catch (error) {
      console.error('Update validation error:', error.message);
    }
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// This is just an example - in a real application, you would call main with your database environment
// main(env);
