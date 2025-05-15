import test from 'ava';
import Joi from 'joi';
import { Miniflare } from 'miniflare';

// Define a test model with various validation rules
interface IValidationTestModel {
  id?: string;
  requiredString?: string;
  optionalString?: string;
  numberField?: number;
  booleanField?: boolean;
  dateField?: Date;
  jsonField?: object;
  emailField?: string;
  constrainedString?: string;
  numberWithRange?: number;
  nestedJsonField?: { 
    item: string; 
    count: number; 
    active?: boolean; 
  };
  stringArrayField?: string[];
  numberArrayField?: number[];
  hasExtraDetails?: boolean;
  extraDetails?: string;
  customValidatedField?: string;
  fieldWithCustomMessage?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

class ValidationTestModel {
  static tableName = 'validation_tests';
  static d1Binding = 'VALIDATION_DB';

  static schemaConfig = {
    id: { type: 'TEXT', primaryKey: true },
    requiredString: { type: 'TEXT' },
    optionalString: { type: 'TEXT' },
    numberField: { type: 'INTEGER' },
    booleanField: { type: 'BOOLEAN' },
    dateField: { type: 'TEXT' }, // Store as TEXT in D1, validated as Date
    jsonField: { type: 'TEXT' }, // Original generic JSON field
    emailField: { type: 'TEXT' },
    constrainedString: { type: 'TEXT' },
    numberWithRange: { type: 'INTEGER' },
    nestedJsonField: { type: 'TEXT' },
    stringArrayField: { type: 'TEXT' },
    numberArrayField: { type: 'TEXT' },
    hasExtraDetails: { type: 'BOOLEAN' },
    extraDetails: { type: 'TEXT' },
    customValidatedField: { type: 'TEXT' },
    fieldWithCustomMessage: { type: 'INTEGER' },
    createdAt: { type: 'TEXT' }, // Usually TEXT for ISO strings
    updatedAt: { type: 'TEXT' }, // Usually TEXT for ISO strings
  };

  static getValidationSchema(joi: typeof Joi): Joi.ObjectSchema {
    // Custom Joi validation method
    const customStringValidation = (value: string, helpers: Joi.CustomHelpers) => {
      if (value && !value.includes('valid_substring')) {
        return helpers.error('string.customValidation', { v: value });
      }
      return value;
    };

    return joi.object({
      id: joi.string().uuid(),
      requiredString: joi.string().required(),
      optionalString: joi.string().allow(null, ''),
      numberField: joi.number(),
      booleanField: joi.boolean(),
      dateField: joi.date().iso(),
      jsonField: joi.object(), // Original generic JSON field validation
      emailField: joi.string().email(),
      constrainedString: joi.string().min(3).max(10),
      numberWithRange: joi.number().min(5).max(100),
      nestedJsonField: joi.object({
        item: joi.string().required(),
        count: joi.number().integer().positive().required(),
        active: joi.boolean().optional()
      }).optional(), // Making the whole nested object optional for now
      stringArrayField: joi.array().items(joi.string()).optional(),
      numberArrayField: joi.array().items(joi.number()).optional(),
      hasExtraDetails: joi.boolean().optional(),
      extraDetails: joi.string().when('hasExtraDetails', {
        is: true,
        then: joi.required(),
        otherwise: joi.optional()
      }),
      customValidatedField: joi.string().custom(customStringValidation, 'custom string validation').optional()
        .messages({
          'string.customValidation': '{#label} must contain "valid_substring", but received "{#v}"'
        }),
      fieldWithCustomMessage: joi.number().min(10).max(20).optional()
        .messages({
          'number.min': '{#label} must be at least 10, pal!',
          'number.max': 'Whoa there, {#label} cannot be more than 20.',
          'number.base': '{#label} needs to be a number, friend.'
        }),
      createdAt: joi.date().iso().optional(),
      updatedAt: joi.date().iso().optional(),
    });
  }
}

// Test setup for Miniflare
const mf = new Miniflare({
  modules: true,
  script: "", // No worker script, just D1
  d1Databases: { [ValidationTestModel.d1Binding]: ':memory:' },
});

// Helper to get DB instance
async function getDb() {
  return mf.getD1Database(ValidationTestModel.d1Binding);
}

// Initialize schema before tests
test.before(async t => {
  const db = await getDb();
  // Manually construct SQL as generateSchemaSQL is not available in the current Model version
  const columns = Object.entries(ValidationTestModel.schemaConfig)
    .map(([name, config_item]) => {
      const config = config_item as any; // Cast to any to access potential properties
      let columnDef = `${name} ${config.type}`;
      if (config.primaryKey) columnDef += ' PRIMARY KEY';
      // Add other constraints like NOT NULL if defined in config.required, etc.
      // For now, keeping it simple based on current schemaConfig structure.
      return columnDef;
    })
    .join(', ');
  const schemaSql = `CREATE TABLE IF NOT EXISTS ${ValidationTestModel.tableName} (${columns});`;

  if (typeof schemaSql === 'string') {
    await db.exec(schemaSql.trim());
  } else {
    console.error('Schema SQL is not in expected format (string).');
  }
});

test.after.always(async () => {
  await mf.dispose();
});

// --- Basic Validation Tests (With Assertions) ---

test.serial('Basic Validations: Required Fields', async t => {
  const schema = ValidationTestModel.getValidationSchema(Joi);
  const commonFields = {
    numberField: 123,
    booleanField: true,
    dateField: new Date().toISOString(),
    jsonField: { data: 'test' },
    emailField: 'test@example.com',
    constrainedString: 'valid',
    numberWithRange: 10,
  };

  // Test missing required field
  const dataMissingRequired = { ...commonFields }; // requiredString is missing
  const resultMissing = schema.validate(dataMissingRequired, { abortEarly: false });
  t.truthy(resultMissing.error, 'Error should exist when requiredString is missing');
  t.is(resultMissing.error?.details.length, 1, 'Should have one error detail');
  t.is(resultMissing.error?.details[0].message, '"requiredString" is required', 'Correct error message for missing requiredString');
  t.deepEqual(resultMissing.error?.details[0].path, ['requiredString'], 'Correct error path for missing requiredString');
  t.is(resultMissing.error?.details[0].type, 'any.required', 'Correct error type for missing requiredString');

  // Test with required field present
  const dataWithRequired = { ...commonFields, requiredString: 'Hello' };
  const resultWith = schema.validate(dataWithRequired, { abortEarly: false });
  t.falsy(resultWith.error, 'Error should not exist when requiredString is present');
});

test.serial('Basic Validations: Data Types', async t => {
  const schema = ValidationTestModel.getValidationSchema(Joi);
  const baseData: any = { requiredString: 'test' }; // satisfy required field

  // String (optionalString)
  let data: any = { ...baseData, optionalString: 123 }; // Invalid type
  let result = schema.validate(data, { abortEarly: false });
  t.truthy(result.error, 'Error for number as optionalString');
  t.is(result.error?.details[0].message, '"optionalString" must be a string');
  t.deepEqual(result.error?.details[0].path, ['optionalString']);
  t.is(result.error?.details[0].type, 'string.base');

  data = { ...baseData, optionalString: 'valid string' }; // Valid type
  result = schema.validate(data, { abortEarly: false });
  t.falsy(result.error, 'No error for valid optionalString');

  // Number (numberField)
  data = { ...baseData, numberField: 'not a number' }; // Invalid type
  result = schema.validate(data, { abortEarly: false });
  t.truthy(result.error, 'Error for string as numberField');
  t.is(result.error?.details[0].message, '"numberField" must be a number');
  t.deepEqual(result.error?.details[0].path, ['numberField']);
  t.is(result.error?.details[0].type, 'number.base');

  data = { ...baseData, numberField: 42 }; // Valid type
  result = schema.validate(data, { abortEarly: false });
  t.falsy(result.error, 'No error for valid numberField');

  // Boolean (booleanField)
  data = { ...baseData, booleanField: 'not a boolean' }; // Invalid type
  result = schema.validate(data, { abortEarly: false });
  t.truthy(result.error, 'Error for string as booleanField');
  t.is(result.error?.details[0].message, '"booleanField" must be a boolean');
  t.deepEqual(result.error?.details[0].path, ['booleanField']);
  t.is(result.error?.details[0].type, 'boolean.base');

  data = { ...baseData, booleanField: true }; // Valid type
  result = schema.validate(data, { abortEarly: false });
  t.falsy(result.error, 'No error for valid booleanField');

  // Date (dateField)
  data = { ...baseData, dateField: 'not a date' }; // Invalid format
  result = schema.validate(data, { abortEarly: false });
  t.truthy(result.error, 'Error for invalid date string for dateField');
  t.is(result.error?.details[0].message, '"dateField" must be in ISO 8601 date format');
  t.deepEqual(result.error?.details[0].path, ['dateField']);
  t.is(result.error?.details[0].type, 'date.format');

  data = { ...baseData, dateField: new Date().toISOString() }; // Valid ISO string
  result = schema.validate(data, { abortEarly: false });
  t.falsy(result.error, 'No error for valid ISO date string for dateField');

  data = { ...baseData, dateField: new Date() }; // Valid Date object
  result = schema.validate(data, { abortEarly: false });
  t.falsy(result.error, 'No error for valid Date object for dateField');

  // JSON (jsonField - basic object)
  data = { ...baseData, jsonField: 'not an object' }; // Invalid type
  result = schema.validate(data, { abortEarly: false });
  t.truthy(result.error, 'Error for string as jsonField');
  t.is(result.error?.details[0].message, '"jsonField" must be of type object');
  t.deepEqual(result.error?.details[0].path, ['jsonField']);
  t.is(result.error?.details[0].type, 'object.base');
  
  data = { ...baseData, jsonField: { key: 'value' } }; // Valid object
  result = schema.validate(data, { abortEarly: false });
  t.falsy(result.error, 'No error for valid object for jsonField');
});

test.serial('Basic Validations: Field Constraints', async t => {
  const schema = ValidationTestModel.getValidationSchema(Joi);
  const baseData: any = { requiredString: 'constraints test' }; // satisfy required field

  // constrainedString (min:3, max:10)
  let data: any = { ...baseData, constrainedString: 'hi' }; // Too short
  let result = schema.validate(data, { abortEarly: false });
  t.truthy(result.error, 'Error for too short constrainedString');
  t.is(result.error?.details[0].message, '"constrainedString" length must be at least 3 characters long');
  t.deepEqual(result.error?.details[0].path, ['constrainedString']);
  t.is(result.error?.details[0].type, 'string.min');
  
  data = { ...baseData, constrainedString: 'waytoolongstring' }; // Too long
  result = schema.validate(data, { abortEarly: false });
  t.truthy(result.error, 'Error for too long constrainedString');
  t.is(result.error?.details[0].message, '"constrainedString" length must be less than or equal to 10 characters long');
  t.deepEqual(result.error?.details[0].path, ['constrainedString']);
  t.is(result.error?.details[0].type, 'string.max');

  data = { ...baseData, constrainedString: 'valid' }; // Valid length
  result = schema.validate(data, { abortEarly: false });
  t.falsy(result.error, 'No error for valid length constrainedString');

  // numberWithRange (min:5, max:100)
  data = { ...baseData, numberWithRange: 4 }; // Too small
  result = schema.validate(data, { abortEarly: false });
  t.truthy(result.error, 'Error for too small numberWithRange');
  t.is(result.error?.details[0].message, '"numberWithRange" must be greater than or equal to 5');
  t.deepEqual(result.error?.details[0].path, ['numberWithRange']);
  t.is(result.error?.details[0].type, 'number.min');

  data = { ...baseData, numberWithRange: 101 }; // Too large
  result = schema.validate(data, { abortEarly: false });
  t.truthy(result.error, 'Error for too large numberWithRange');
  t.is(result.error?.details[0].message, '"numberWithRange" must be less than or equal to 100');
  t.deepEqual(result.error?.details[0].path, ['numberWithRange']);
  t.is(result.error?.details[0].type, 'number.max');

  data = { ...baseData, numberWithRange: 50 }; // Valid range
  result = schema.validate(data, { abortEarly: false });
  t.falsy(result.error, 'No error for valid range numberWithRange');

  // emailField
  data = { ...baseData, emailField: 'notanemail' }; // Invalid email
  result = schema.validate(data, { abortEarly: false });
  t.truthy(result.error, 'Error for invalid emailField');
  t.is(result.error?.details[0].message, '"emailField" must be a valid email');
  t.deepEqual(result.error?.details[0].path, ['emailField']);
  t.is(result.error?.details[0].type, 'string.email');
  
  data = { ...baseData, emailField: 'valid@email.com' }; // Valid email
  result = schema.validate(data, { abortEarly: false });
  t.falsy(result.error, 'No error for valid emailField');
});

// --- Complex Schema Validation Tests (With Assertions) ---

test.serial('Complex Schema: Nested JSON Object', async t => {
  const schema = ValidationTestModel.getValidationSchema(Joi);
  const baseData: any = { requiredString: 'nested_json_test' }; 

  // Valid nested JSON
  let data: any = {
    ...baseData,
    nestedJsonField: { item: 'Test Item', count: 5, active: true }
  };
  let result = schema.validate(data, { abortEarly: false });
  t.falsy(result.error, 'Valid nested JSON should not have an error');

  // Invalid nested JSON - missing required 'item'
  data = {
    ...baseData,
    nestedJsonField: { count: 10 } // 'item' is missing
  };
  result = schema.validate(data, { abortEarly: false });
  t.truthy(result.error, 'Error for missing required item in nested JSON');
  t.is(result.error?.details[0].message, '"nestedJsonField.item" is required');
  t.deepEqual(result.error?.details[0].path, ['nestedJsonField', 'item']);
  t.is(result.error?.details[0].type, 'any.required');

  // Invalid nested JSON - 'count' wrong type
  data = {
    ...baseData,
    nestedJsonField: { item: 'Another Item', count: 'five' } // 'count' is a string
  };
  result = schema.validate(data, { abortEarly: false });
  t.truthy(result.error, 'Error for wrong type of count in nested JSON');
  t.is(result.error?.details[0].message, '"nestedJsonField.count" must be a number');
  t.deepEqual(result.error?.details[0].path, ['nestedJsonField', 'count']);
  t.is(result.error?.details[0].type, 'number.base');

  // Invalid nested JSON - 'count' not positive
  data = {
    ...baseData,
    nestedJsonField: { item: 'Item C', count: 0 } // 'count' is 0
  };
  result = schema.validate(data, { abortEarly: false });
  t.truthy(result.error, 'Error for non-positive count in nested JSON');
  t.is(result.error?.details[0].message, '"nestedJsonField.count" must be a positive number');
  t.deepEqual(result.error?.details[0].path, ['nestedJsonField', 'count']);
  t.is(result.error?.details[0].type, 'number.positive');

  // Optional 'active' field missing (should be valid)
  data = {
    ...baseData,
    nestedJsonField: { item: 'Test Item Optional', count: 1 } // 'active' is missing
  };
  result = schema.validate(data, { abortEarly: false });
  t.falsy(result.error, 'Valid nested JSON (optional active missing) should not have an error');
});

test.serial('Complex Schema: Array Validation', async t => {
  const schema = ValidationTestModel.getValidationSchema(Joi);
  const baseData: any = { requiredString: 'array_test' };

  // stringArrayField - Valid
  let data: any = { ...baseData, stringArrayField: ['apple', 'banana', 'cherry'] };
  let result = schema.validate(data, { abortEarly: false });
  t.falsy(result.error, 'Valid string array should not have an error');

  // stringArrayField - Invalid (contains number)
  data = { ...baseData, stringArrayField: ['apple', 123, 'cherry'] }; 
  result = schema.validate(data, { abortEarly: false });
  t.truthy(result.error, 'Error for string array containing a number');
  t.is(result.error?.details[0].message, '"stringArrayField[1]" must be a string');
  t.deepEqual(result.error?.details[0].path, ['stringArrayField', 1]);
  t.is(result.error?.details[0].type, 'string.base');

  // stringArrayField - Invalid (not an array)
  data = { ...baseData, stringArrayField: 'not an array' }; 
  result = schema.validate(data, { abortEarly: false });
  t.truthy(result.error, 'Error for non-array type for stringArrayField');
  t.is(result.error?.details[0].message, '"stringArrayField" must be an array');
  t.deepEqual(result.error?.details[0].path, ['stringArrayField']);
  t.is(result.error?.details[0].type, 'array.base');

  // numberArrayField - Valid
  data = { ...baseData, numberArrayField: [1, 2, 3, 4] };
  result = schema.validate(data, { abortEarly: false });
  t.falsy(result.error, 'Valid number array should not have an error');

  // numberArrayField - Invalid (contains string)
  data = { ...baseData, numberArrayField: [1, 'two', 3] }; 
  result = schema.validate(data, { abortEarly: false });
  t.truthy(result.error, 'Error for number array containing a string');
  t.is(result.error?.details[0].message, '"numberArrayField[1]" must be a number');
  t.deepEqual(result.error?.details[0].path, ['numberArrayField', 1]);
  t.is(result.error?.details[0].type, 'number.base');
});

test.serial('Complex Schema: Conditional Validation (when)', async t => {
  const schema = ValidationTestModel.getValidationSchema(Joi);
  const baseData: any = { requiredString: 'conditional_test' };

  // Case 1: hasExtraDetails is true, extraDetails is provided (valid)
  let data: any = { ...baseData, hasExtraDetails: true, extraDetails: 'These are the details.' };
  let result = schema.validate(data, { abortEarly: false });
  t.falsy(result.error, 'Case 1 (hasExtraDetails: true, extraDetails provided) should be valid');

  // Case 2: hasExtraDetails is true, extraDetails is missing (invalid)
  data = { ...baseData, hasExtraDetails: true }; // extraDetails is missing
  result = schema.validate(data, { abortEarly: false });
  t.truthy(result.error, 'Case 2 (hasExtraDetails: true, extraDetails missing) should be invalid');
  t.is(result.error?.details[0].message, '"extraDetails" is required');
  t.deepEqual(result.error?.details[0].path, ['extraDetails']);
  t.is(result.error?.details[0].type, 'any.required');

  // Case 3: hasExtraDetails is false, extraDetails is not provided (valid)
  data = { ...baseData, hasExtraDetails: false };
  result = schema.validate(data, { abortEarly: false });
  t.falsy(result.error, 'Case 3 (hasExtraDetails: false, extraDetails not provided) should be valid');

  // Case 4: hasExtraDetails is false, extraDetails is provided (still valid, as 'otherwise' is optional)
  data = { ...baseData, hasExtraDetails: false, extraDetails: 'Optional details provided anyway.' };
  result = schema.validate(data, { abortEarly: false });
  t.falsy(result.error, 'Case 4 (hasExtraDetails: false, extraDetails provided) should be valid');

  // Case 5: hasExtraDetails is undefined (treated as false by Joi default), extraDetails not provided (valid)
  data = { ...baseData }; // hasExtraDetails is undefined
  result = schema.validate(data, { abortEarly: false });
  t.falsy(result.error, 'Case 5 (hasExtraDetails: undefined, extraDetails not provided) should be valid');
});

// --- Custom Validation Tests (With Assertions) ---

test.serial('Custom Validation: Custom Function', async t => {
  const schema = ValidationTestModel.getValidationSchema(Joi);
  const baseData: any = { requiredString: 'custom_func_test' };

  // Valid: contains 'valid_substring'
  let data: any = { ...baseData, customValidatedField: 'this is a valid_substring here' };
  let result = schema.validate(data, { abortEarly: false });
  t.falsy(result.error, 'Valid custom field (contains substring) should not have an error');

  // Invalid: does not contain 'valid_substring'
  data = { ...baseData, customValidatedField: 'this is not right' };
  result = schema.validate(data, { abortEarly: false });
  t.truthy(result.error, 'Invalid custom field (missing substring) should have an error');
  t.is(result.error?.details[0].message, '"customValidatedField" must contain "valid_substring", but received "this is not right"');
  t.deepEqual(result.error?.details[0].path, ['customValidatedField']);
  t.is(result.error?.details[0].type, 'string.customValidation');

  // Optional: field not provided (should be valid)
  data = { ...baseData }; // customValidatedField is not provided
  result = schema.validate(data, { abortEarly: false });
  t.falsy(result.error, 'Valid custom field (not provided) should not have an error');
});

test.serial('Custom Validation: Custom Error Messages', async t => {
  const schema = ValidationTestModel.getValidationSchema(Joi);
  const baseData: any = { requiredString: 'custom_msg_test' };

  // Valid number within range
  let data: any = { ...baseData, fieldWithCustomMessage: 15 };
  let result = schema.validate(data, { abortEarly: false });
  t.falsy(result.error, 'Valid number for custom message field (15) should not have an error');

  // Invalid: below min (10)
  data = { ...baseData, fieldWithCustomMessage: 5 };
  result = schema.validate(data, { abortEarly: false });
  t.truthy(result.error, 'Invalid (below min) for custom message field (5) should have an error');
  t.is(result.error?.details[0].message, '"fieldWithCustomMessage" must be at least 10, pal!');
  t.deepEqual(result.error?.details[0].path, ['fieldWithCustomMessage']);
  t.is(result.error?.details[0].type, 'number.min');

  // Invalid: above max (20)
  data = { ...baseData, fieldWithCustomMessage: 25 };
  result = schema.validate(data, { abortEarly: false });
  t.truthy(result.error, 'Invalid (above max) for custom message field (25) should have an error');
  t.is(result.error?.details[0].message, 'Whoa there, "fieldWithCustomMessage" cannot be more than 20.');
  t.deepEqual(result.error?.details[0].path, ['fieldWithCustomMessage']);
  t.is(result.error?.details[0].type, 'number.max');

  // Invalid: wrong type
  data = { ...baseData, fieldWithCustomMessage: 'not a number' };
  result = schema.validate(data, { abortEarly: false });
  t.truthy(result.error, 'Invalid (wrong type) for custom message field should have an error');
  t.is(result.error?.details[0].message, '"fieldWithCustomMessage" needs to be a number, friend.');
  t.deepEqual(result.error?.details[0].path, ['fieldWithCustomMessage']);
  t.is(result.error?.details[0].type, 'number.base');

  // Optional: field not provided (should be valid)
  data = { ...baseData }; // fieldWithCustomMessage is not provided
  result = schema.validate(data, { abortEarly: false });
  t.falsy(result.error, 'Valid custom message field (not provided) should not have an error');
});


// TODO: Add more test categories as per the plan:
// - Model Validation Integration Tests (Validation on .save(), .update() etc.)
// - Error Handling and Reporting Tests
// - Performance Considerations (Instructions/Tests)
