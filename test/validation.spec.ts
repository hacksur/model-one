import test from "ava";
import { Schema } from '../src';

// Simple test for the validation system without database dependencies
test('Schema validation works', t => {
  // Create a schema instance with validation rules
  const schema = new Schema({
    table_name: 'test_table',
    columns: [
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
          min: 18
        }
      }
    ]
  });
  
  // Test valid data
  try {
    const validData = {
      name: 'John Doe',
      email: 'john@example.com',
      age: 30
    };
    
    const result = schema.validate(validData);
    t.deepEqual(result, validData);
    t.pass('Valid data passes validation');
  } catch (error) {
    t.fail(`Valid data should pass validation: ${error}`);
  }
  
  // Test invalid email
  try {
    const invalidEmail = {
      name: 'John Doe',
      email: 'invalid-email',
      age: 30
    };
    
    schema.validate(invalidEmail);
    t.fail('Invalid email should fail validation');
  } catch (error) {
    t.pass('Invalid email correctly fails validation');
    t.regex(String(error), /email/i);
  }
  
  // Test name too short
  try {
    const shortName = {
      name: 'J', // Too short (min: 2)
      email: 'john@example.com',
      age: 30
    };
    
    schema.validate(shortName);
    t.fail('Short name should fail validation');
  } catch (error) {
    t.pass('Short name correctly fails validation');
    t.regex(String(error), /name/i);
  }
  
  // Test age below minimum
  try {
    const youngAge = {
      name: 'John Doe',
      email: 'john@example.com',
      age: 17 // Below minimum (18)
    };
    
    schema.validate(youngAge);
    t.fail('Age below minimum should fail validation');
  } catch (error) {
    t.pass('Age below minimum correctly fails validation');
    t.regex(String(error), /age/i);
  }
});
