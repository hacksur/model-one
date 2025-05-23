import Joi from 'joi'

const NotFoundError = () => {
  return null
}

class ModelError extends Error {
  errors: string[];
  
  constructor(message: string, errors: string[] = []) {
    super(message);
    this.name = 'ModelError';
    this.errors = errors;
  }
}

export type SQLiteType = 
  | 'TEXT' 
  | 'INTEGER' 
  | 'REAL' 
  | 'NUMERIC' 
  | 'BLOB' 
  | 'BOOLEAN' 
  | 'TIMESTAMP' 
  | 'DATE';

/**
 * Describes a single column within a database table for the ORM.
 * This definition is used by the Model to understand data types,
 * map data to/from the database, and generate validation schemas (e.g., via `getValidationSchema()`).
 */
export type ColumnType = 
  | 'string'   // SQLite: TEXT
  | 'number'   // SQLite: INTEGER or REAL
  | 'boolean'  // SQLite: INTEGER (0/1)
  | 'jsonb'    // SQLite: TEXT (JSON stringified)
  | 'date';    // SQLite: TEXT (ISO format)

/**
 * Column constraint types
 */
export type ConstraintType = 
  | 'PRIMARY KEY' 
  | 'NOT NULL' 
  | 'UNIQUE' 
  | 'CHECK' 
  | 'DEFAULT' 
  | 'FOREIGN KEY';

/**
 * Column constraint definition
 */
export interface Constraint {
  type: ConstraintType;
  value?: string | number | boolean;
}

/**
 * Describes a single column within a database table for the ORM.
 * This definition is used by the Model to understand data types,
 * map data to/from the database, and generate validation schemas (e.g., via `getValidationSchema()`).
 */
export interface Column {
  /** The name of the column in the database table. */
  name: string;
  /**
   * The JavaScript/TypeScript type this column should be mapped to in the application code
   * (e.g., 'string', 'number', 'boolean', 'Date', 'Object' for JSON).
   * This is typically defined using the `ColumnType` enum or a similar type definition.
   */
  type: ColumnType;
  /**
   * The underlying SQLite data type for this column (e.g., 'TEXT', 'INTEGER', 'REAL', 'BLOB').
   * This can be used by the ORM for type casting or if it assists in DDL generation.
   * However, DDL for specific constraints (like UNIQUE, CHECK) is generally managed
   * separately from this schema property when creating tables.
   */
  sqliteType?: SQLiteType;
  /**
   * Indicates if the column is required (i.e., cannot be null).
   * Primarily used to generate validation rules (e.g., making a field mandatory in Joi schemas).
   * While this could inform a `NOT NULL` DDL property if `model-one` handles table creation,
   * this schema property's main effect is on application-level validation.
   */
  required?: boolean;
  /**
   * Defines specific constraints or rules for the column, intended for ORM or application-level logic.
   * These are primarily used to generate validation rules (e.g., for Joi schemas via `getValidationSchema()`).
   * IMPORTANT: These `constraints` typically DO NOT directly translate into SQL DDL
   * constraints (like `UNIQUE`, `CHECK`, or `FOREIGN KEY`) automatically managed by `model-one`.
   * Such database-level constraints should usually be defined within the `CREATE TABLE` SQL statement.
   */
  constraints?: Constraint[];
}

type Columns = Column[]

/**
 * Defines the structure and properties of a database table for a Model.
 * This configuration is the blueprint used by a Model to interact with the database,
 * manage data serialization/deserialization, and generate validation schemas.
 * It dictates how the Model interprets and handles the table's data and structure.
 */
export interface SchemaConfigI {
  /** The actual name of the database table (e.g., 'users', 'products'). */
  table_name: string;
  /** An array of `Column` definitions describing each column in the table. */
  columns: Columns;
  /**
   * A list of column names (or sets of column names for composite uniques) that should hold unique values.
   * This is primarily leveraged for generating application-level validation logic
   * (e.g., informing uniqueness checks in Joi schemas or custom validation routines within the ORM).
   * IMPORTANT: This `uniques` property typically DOES NOT directly create SQL `UNIQUE` constraints
   * on the database table through `model-one`. Database-level unique constraints should generally be
   * defined within the `CREATE TABLE` SQL statement.
   */
  uniques?: string[]; // This might represent single column names or groups for composite uniqueness.
  /**
   * If true, the Model will automatically manage `created_at` and `updated_at` timestamp columns.
   * These columns are typically of a DATETIME or TIMESTAMP compatible type and are updated by the ORM.
   */
  timestamps?: boolean;
  /**
   * If true, the Model will employ a soft-delete strategy, usually by managing a `deleted_at` column.
   * Records are marked as deleted (by setting `deleted_at`) rather than being physically removed,
   * allowing for potential recovery or historical tracking.
   */
  softDeletes?: boolean;
}

/**
 * Model data interface
 */
interface ModelDataI {
  id?: string;
  [key: string]: any;
}

class Form {
  schema: Joi.ObjectSchema<any>
  data: any

  constructor(
    schema: Joi.ObjectSchema<any>,
    data: any
  ) {
    this.schema = schema
    this.data = data.data
    this.validate()
  }

  // Validate if props contains at least the declared fields
  validate() {
    const { error } = this.schema.validate(this.data)
    if (error !== undefined) {
      throw new ModelError(error.message, error.details.map(detail => detail.message))
    }
  }
}

class Schema implements SchemaConfigI {
  table_name: string
  columns: Columns
  uniques: string[] | undefined
  timestamps: boolean
  softDeletes: boolean

  constructor(props: { 
    table_name: string; 
    columns: Columns;
    uniques?: string[];
    timestamps?: boolean;
    softDeletes?: boolean;
  }) {
    this.table_name = props.table_name
    this.columns = props.columns
    this.uniques = props.uniques
    this.timestamps = props.timestamps ?? true // Default to true for backward compatibility
    this.softDeletes = props.softDeletes ?? false
  }
}

class Model {
  id: string | null
  schema: SchemaConfigI
  data: ModelDataI
  
  constructor(schema?: SchemaConfigI, props?: ModelDataI) {
    this.id = props?.id || null
    this.schema = schema || {} as SchemaConfigI // Ensure schema is initialized
    this.data = props || {}
  }

  async update(partialData: Partial<ModelDataI>, env: any): Promise<this | null> {
    if (!this.data?.id) {
      throw new ModelError('Instance data is missing an ID, cannot update.');
    }

    const updatePayload = { ...this.data, ...partialData };
    const arg1 = { data: updatePayload };

    const ModelCtor = this.constructor as typeof Model;
    const resultFromStaticUpdate = await ModelCtor.update(arg1, env) as this | null;

    if (resultFromStaticUpdate && resultFromStaticUpdate.data) {
      this.data = { ...resultFromStaticUpdate.data }; 
      this.id = resultFromStaticUpdate.data.id || this.id; 
      return this;
    } else {
      console.error('Instance update failed: static update did not return expected data or failed.', resultFromStaticUpdate);
      return null;
    }
  }

  /**
   * Deletes the current model instance from the database.
   * @param env - The database environment/connection object
   * @returns The result of the delete operation
   * @throws {ModelError} If the instance is missing an ID
   */
  async delete(env: any): Promise<any> {
    if (!this.data?.id) {
      throw new ModelError('Instance data is missing an ID, cannot delete.');
    }

    const ModelCtor = this.constructor as typeof Model;
    const result = await ModelCtor.delete(this.data.id, env);
    
    // Return the result from the static delete method
    return result;
  }

  /**
   * Maps JavaScript types to SQLite types
   */
  private static getDefaultSQLiteType(columnType: ColumnType): SQLiteType {
    switch (columnType) {
      case 'string':
        return 'TEXT';
      case 'number':
        return 'REAL';
      case 'boolean':
        return 'INTEGER'; // SQLite stores booleans as 0/1
      case 'jsonb':
        return 'TEXT'; // JSON is stored as stringified TEXT
      case 'date':
        return 'TEXT'; // Dates stored as ISO strings
      default:
        return 'TEXT';
    }
  }

  /**
   * Processes a value based on its column type for database storage
   */
  private static processValueForStorage(value: any, columnType: ColumnType): any {
    if (value === null || value === undefined) {
      if (columnType === 'jsonb') {
        return 'null';
      }
      return null;
    }

    switch (columnType) {
      case 'boolean':
        return value ? 1 : 0;
      case 'jsonb':
        return JSON.stringify(value);
      case 'date':
        return value instanceof Date ? value.toISOString() : value;
      default:
        return value;
    }
  }

  /**
   * Processes a database value based on column type for JavaScript usage
   */
  private static processValueFromStorage(value: any, columnType: ColumnType): any {
    if (value === null || value === undefined) {
      return null;
    }

    switch (columnType) {
      case 'boolean':
        return Boolean(value);
      case 'number':
        return Number(value);
      case 'jsonb':
        if (value === '' || value === 'null') {
          return null;
        }
        return typeof value === 'string' ? JSON.parse(value) : value;
      case 'date':
        return value; // Client code can convert to Date if needed
      default:
        return value;
    }
  }

  private static deserializeData(data: any, schema: SchemaConfigI): any {
    const { id }: { id: string | null } = data;
    
    if (!Boolean(id)) {
      const keys: string[] = ['id'];
      const values: any[] = [`${crypto.randomUUID()}`];
      
      schema.columns.forEach((column) => {
        if (data[column.name] !== undefined) {
          keys.push(column.name);
          const processedValue = this.processValueForStorage(data[column.name], column.type);
          
          if (processedValue === null) {
            values.push('NULL');
          } else if (typeof processedValue === 'number') {
            values.push(processedValue.toString());
          } else if (typeof processedValue === 'string') {
            values.push(processedValue);
          } else {
            values.push(JSON.stringify(processedValue));
          }
        }
      });

      const formattedValues = values.map(v => {
        return v === 'NULL' ? v : `'${v}'`;
      }).join(", ");

      return { values: formattedValues, keys: keys.join(", ")};
    } 
    else {
      const attributes: string[] = [];
      
      schema.columns.forEach((column) => {
        if (column.name === 'id') return;
        
        if (Object.prototype.hasOwnProperty.call(data, column.name)) {
          const processedValue = this.processValueForStorage(data[column.name], column.type);
          
          if (processedValue === null) {
            attributes.push(`${column.name} = NULL`);
          } else if (typeof processedValue === 'number') {
            attributes.push(`${column.name} = ${processedValue}`);
          } else {
            attributes.push(`${column.name} = '${processedValue}'`);
          }
        }
      });
      
      return { attributes: attributes.join(", ") };
    }
  }
  
  private static serializeData(data: any, schema: SchemaConfigI): any {
    const result = { ...data };
    
    schema.columns.forEach((column) => {
      if (data[column.name] !== undefined) {
        result[column.name] = this.processValueFromStorage(data[column.name], column.type);
      } else {
        result[column.name] = null;
      }
    });
    
    Object.keys(result).forEach(key => {
      if (result[key] === undefined) {
        result[key] = null;
      }
    });
    
    return result;
  }

  private static createModelInstance(data: any, schemaForInstance: SchemaConfigI): any {
    const instance = new this(schemaForInstance);
    instance.id = data.id; 

    instance.data = {};
    Object.keys(data).forEach(key => {
      instance.data[key] = data[key];
    });
    if (data.id) {
      instance.data.id = data.id; 
    }

    return instance;
  }

  static async create({ data }: any, env: any) {
    const { schema } = new this(); 
    const { keys, values } = this.deserializeData(data, schema);
    
    let query = `INSERT INTO ${schema.table_name} (${keys}`;
    let valuesPart = `VALUES(${values}`;
    
    if (schema.timestamps) {
      query += `, created_at, updated_at`;
      valuesPart += `, datetime('now'), datetime('now')`;
    }
    
    query += `) ${valuesPart}) RETURNING *;`;
    
    const { results, success} = await env.prepare(query).all();
    
    if (success && results && results[0]) {
      const dbRecord = { ...results[0] }; 
      const serializedData = this.serializeData(dbRecord, schema);
      return this.createModelInstance(serializedData, schema); 
    } else {
      console.error('Create operation failed or returned no results.');
      return null; 
    }
  }

  static async update({ data }: any, env: any) {
    const { schema } = new this();
    const { id } = data;
    
    if (!Boolean(id)) { 
      console.error('Update failed: No ID present in data.');
      return null; 
    }
    
    const { attributes } = this.deserializeData(data, schema);
    if (!attributes || attributes.length === 0) {
      console.warn('Update called with no attributes to update for ID:', id);
      // Return the existing record as a full model instance if no actual changes are made.
      // 'complete' should be false (or omitted) to get a model instance.
      return this.findById(id, env, false); // Corrected: pass false for 'complete'
    }

    let query = `UPDATE ${schema.table_name} SET ${attributes}`;
    
    if (schema.timestamps) {
      query += `, updated_at = datetime('now')`;
    }
    
    query += ` WHERE id='${id}' RETURNING *;`;
    
    const { results, success} = await env.prepare(query).all();
    
    if (success && results && results[0]) {
      const dbRecord = { ...results[0] }; 
      const serializedData = this.serializeData(dbRecord, schema);
      return this.createModelInstance(serializedData, schema); 
    } else {
      console.error(`Update failed for ID ${id} or record not found.`);
      return null;
    }
  }

  static async delete(id: string, env: any) {
    const { schema } = new this();
    
    if (!Boolean(id)) return { message: 'ID is missing.'};
    
    if (schema.softDeletes) {
      const query = `UPDATE ${schema.table_name} 
                    SET deleted_at = datetime('now')
                    WHERE id='${id}';`;
      const { success } = await env.prepare(query).all();
      
      return success ?
        { message: `The ID ${id} from table "${schema.table_name}" has been soft deleted.` }
        : { message: `The ID ${id} has not been found at table "${schema.table_name}"` };
    } 
    else {
      const query = `DELETE FROM ${schema.table_name} WHERE id='${id}';`;
      const { success } = await env.prepare(query).all();
      
      return success ?
        { message: `The ID ${id} from table "${schema.table_name}" has been successfully deleted.` }
        : { message: `The ID ${id} has not been found at table "${schema.table_name}"` };
    }
  }
  
  static async restore(id: string, env: any) {
    const { schema } = new this();
    
    if (!Boolean(id)) return { message: 'ID is missing.'};
    
    if (!schema.softDeletes) {
      return { message: `Soft deletes are not enabled for table "${schema.table_name}"` };
    }
    
    const query = `UPDATE ${schema.table_name} 
                  SET deleted_at = NULL
                  WHERE id='${id}' RETURNING *;`;
    const { results, success } = await env.prepare(query).all();
    
    if (!success || !results || results.length === 0) {
      return { message: `The ID ${id} has not been found at table "${schema.table_name}"` };
    }
    
    const dbRecord = { ...results[0] }; 
    const serializedData = this.serializeData(dbRecord, schema);
    
    return {
      message: `The ID ${id} from table "${schema.table_name}" has been successfully restored.`,
      data: this.createModelInstance(serializedData, schema) 
    };
  }

  static async all(env: any, includeDeleted?: Boolean) { 
    const { schema } = new this();
    
    let query = `SELECT * FROM ${schema.table_name}`;
    
    if (schema.softDeletes && !includeDeleted) {
      query += ` WHERE deleted_at IS NULL`;
    }
    
    query += `;`;
    
    const { results, success} = await env.prepare(query).all();
    
    if(!success) return [];
    
    if (results && results.length > 0) {
      return results.map((result: any) => {
        const dbRecord = { ...result }; 
        const serializedData = this.serializeData(dbRecord, schema);
        return this.createModelInstance(serializedData, schema); 
      });
    } else {
      return [];
    }
  }

  static async findOne(column: string, value: string, env: any, includeDeleted?: Boolean) {
    const { schema } = new this();
    
    let query = `SELECT * FROM ${schema.table_name} WHERE ${column}='${value}'`;
    
    if (schema.softDeletes && !includeDeleted) {
      query += ` AND deleted_at IS NULL`;
    }
    
    query += ` LIMIT 1;`;
    
    const { results, success} = await env.prepare(query).all();
    
    if (!success || !results || results.length === 0) {
        return null;
    }
    
    const dbRecord = { ...results[0] }; 
    const serializedData = this.serializeData(dbRecord, schema);
    return this.createModelInstance(serializedData, schema); 
  }

  static async findBy(column: string, value: string, env: any, includeDeleted?: Boolean) {
    const { schema } = new this();
    
    let query = `SELECT * FROM ${schema.table_name} WHERE ${column}='${value}'`;
    
    if (schema.softDeletes && !includeDeleted) {
      query += ` AND deleted_at IS NULL`;
    }
    
    query += `;`;
    
    const { results, success } = await env.prepare(query).all();

    if (!success || !results) return [];

    return results.map((result: any) => {
      const dbRecord = { ...result }; 
      const serializedData = this.serializeData(dbRecord, schema);
      return this.createModelInstance(serializedData, schema); 
    }).filter((p:any) => p !== null); 
  }

  static async findById(id: string, env: any, includeDeleted?: Boolean) {
    const { schema } = new this(); 
    
    let query = `SELECT * FROM ${schema.table_name} WHERE id='${id}'`;
    
    if (schema.softDeletes && !includeDeleted) {
      query += ` AND deleted_at IS NULL`;
    }
    
    query += ` LIMIT 1;`; 
    
    const { results, success} = await env.prepare(query).all();
    
    if (!success || !results || results.length === 0) {
        return null;
    }
    
    const dbRecord = { ...results[0] }; 
    const serializedData = this.serializeData(dbRecord, schema);
    return this.createModelInstance(serializedData, schema); 
  }

  static async query(sql: string, env: any, params?: any[]) {
    const { results, success } = await env.prepare(sql, params).all();
    if (!success) return { success: false, message: 'Query failed' };
    return { success: true, results };
  }

  /**
   * Saves the current model instance to the database.
   * If the instance has an ID (from `this.id` or `this.data.id`), it dispatches to the static `update()` method.
   * Otherwise, it dispatches to the static `create()` method.
   * The instance's `data` and `id` properties are updated with the result from the database operation.
   * @param env - The database environment/connection object.
   * @returns {Promise<this | null>} A promise that resolves to the current instance (this) after being updated, 
   *                                or null if the operation fails or returns no data.
   * @throws {ModelError} Can be thrown by underlying create/update operations (e.g., validation).
   */
  async save(env: any): Promise<this | null> {
    console.log('[Model.save] Input this.id:', this.id);
    console.log('[Model.save] Input this.data:', JSON.stringify(this.data));

    const ModelCtor = this.constructor as typeof Model;

    // Ensure this.data has the most current ID if this.id is set, and this.id is primary
    if (this.id && (!this.data.id || this.data.id !== this.id)) {
      console.log('[Model.save] Syncing this.data.id from this.id.');
      this.data.id = this.id;
    }
    
    // Prepare the payload. Assumes static create/update can handle { data: ModelDataI }
    const payload = { data: { ...this.data } }; // Use a shallow copy of data
    console.log('[Model.save] Payload for static method:', JSON.stringify(payload));

    let resultInstance: Model | null = null;
    let operationType: 'create' | 'update' | 'none' = 'none';

    if (this.data.id) { // ID exists, dispatch to static update
      operationType = 'update';
      console.log(`[Model.save] Instance has ID ${this.data.id}. Calling static update.`);
      resultInstance = await ModelCtor.update(payload, env);
    } else { // No ID, dispatch to static create
      operationType = 'create';
      console.log('[Model.save] Instance has no ID. Calling static create.');
      // Ensure no 'id' field is accidentally sent if it's null/undefined in this.data,
      // as static create should generate the ID.
      if (payload.data.hasOwnProperty('id') && (payload.data.id === null || payload.data.id === undefined)) {
        console.log('[Model.save] Removing null/undefined id from create payload.');
        delete payload.data.id;
      }
      resultInstance = await ModelCtor.create(payload, env);
    }
    
    console.log(`[Model.save] Result from static ${operationType}:`, JSON.stringify(resultInstance));

    if (resultInstance && resultInstance.data) {
      console.log('[Model.save] Operation successful. Syncing instance data with result.');
      // Sync current instance's data and id with the returned data
      this.data = { ...resultInstance.data }; // Update internal data
      this.id = resultInstance.data.id || null; // Update internal id
      
      console.log('[Model.save] Synced this.id:', this.id);
      console.log('[Model.save] Synced this.data:', JSON.stringify(this.data));
      return this; // Return the current, updated instance
    } else {
      console.error(`[Model.save] Static ${operationType} operation failed or returned no data.`);
      return null;
    }
  }
}

export {
  Form,
  Schema,
  Model,
  NotFoundError,
  ModelDataI,
  ModelError
}