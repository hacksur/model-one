import { Model, Schema } from '../src/index';

// Define the User schema with validation rules
const userSchema = new Schema({
  table_name: 'users',
  columns: [
    { 
      name: 'id', 
      type: 'string',
      required: true,
      validation: {
        uuid: true
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
      name: 'name', 
      type: 'string',
      required: true,
      validation: {
        min: 2,
        max: 100
      }
    },
    { 
      name: 'age', 
      type: 'number',
      validation: {
        min: 18
      }
    },
    { 
      name: 'languages', 
      type: 'jsonb',
      validation: {
        // Custom validation can be added here
      }
    },
  ],
  timestamps: true,
  softDeletes: true
});

// Define the User model class that extends the base Model
export class User extends Model {
  constructor(props?: any) {
    super(userSchema, props);
    // All validation will happen automatically
  }

  // You can add custom methods specific to User
  static async findByEmail(email: string, env: any) {
    const query = `SELECT * FROM ${userSchema.table_name} WHERE email = ? AND deleted_at IS NULL`;
    const { results } = await env.prepare(query).bind(email).all();
    
    if (!results || results.length === 0) {
      return null;
    }
    
    return results[0];
  }
}

// Usage example:
/*
const createUser = async (env) => {
  try {
    // Data will be automatically validated according to schema
    const user = await User.create({
      data: {
        name: 'John Doe',
        email: 'john@example.com',
        age: 25,
        languages: ['en', 'es']
      }
    }, env);
    
    return user;
  } catch (error) {
    // Handle validation errors
    console.error('Validation error:', error);
    throw error;
  }
};
*/
