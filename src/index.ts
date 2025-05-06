import Joi from 'joi'

const NotFoundError = () => {
  return null
}

export type SQLiteType = 
  | 'TEXT' 
  | 'INTEGER' 
  | 'REAL' 
  | 'NUMERIC' 
  | 'BLOB' 
  | 'JSON' 
  | 'BOOLEAN' 
  | 'TIMESTAMP' 
  | 'DATE';

/**
 * Column definition for database tables mapped to JavaScript types
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
 * Column definition for database tables
 */
export interface Column {
  name: string;
  type: ColumnType;
  sqliteType?: SQLiteType;
  required?: boolean;
  constraints?: Constraint[];
}

type Columns = Column[]

/**
 * Schema configuration interface
 */
export interface SchemaConfigI {
  table_name: string;
  columns: Columns;
  uniques?: string[];
  timestamps?: boolean;
  softDeletes?: boolean;
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
      throw new Error(error.message)
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
  id: string
  schema: SchemaConfigI
  
  constructor(schema?: any, props?: any) {
    this.id = props?.id || null
    this.schema = schema
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
        return typeof value === 'string' ? JSON.parse(value) : value;
      case 'date':
        return value; // Client code can convert to Date if needed
      default:
        return value;
    }
  }

  private static deserializeData(data: any, schema: SchemaConfigI): any {
    const { id }: { id: string | null } = data;
    
    // Creating a new record
    if (!Boolean(id)) {
      const keys: string[] = ['id'];
      const values: any[] = [`${crypto.randomUUID()}`];
      
      // Process each column according to its type
      schema.columns.forEach((column) => {
        if (data[column.name] !== undefined) {
          keys.push(column.name);
          const processedValue = this.processValueForStorage(data[column.name], column.type);
          
          // Handle different types for SQL statement
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

      // Format values for SQL
      const formattedValues = values.map(v => {
        return v === 'NULL' ? v : `'${v}'`;
      }).join(", ");

      return { values: formattedValues, keys: keys.join(", ")};
    } 
    // Updating an existing record
    else {
      const attributes: string[] = [];
      
      schema.columns.forEach((column) => {
        if (column.name === 'id' || data[column.name] === undefined) return;
        
        const processedValue = this.processValueForStorage(data[column.name], column.type);
        
        if (processedValue === null) {
          attributes.push(`${column.name} = NULL`);
        } else if (typeof processedValue === 'number') {
          attributes.push(`${column.name} = ${processedValue}`);
        } else {
          attributes.push(`${column.name} = '${processedValue}'`);
        }
      });
      
      return { attributes: attributes.join(", ") };
    }
  }
  
  private static serializeData(data: any, schema: SchemaConfigI): any {
    const result = { ...data };
    
    // Process each column according to its type
    schema.columns.forEach((column) => {
      if (data[column.name] !== undefined) {
        result[column.name] = this.processValueFromStorage(data[column.name], column.type);
      }
    });
    
    return result;
  }

  static async create({ data }: any, env: any) {
    const { schema } = new this();
    const { keys, values } = this.deserializeData(data, schema);
    
    let query = `INSERT INTO ${schema.table_name} (${keys}`;
    let valuesPart = `VALUES(${values}`;
    
    // Add timestamps if enabled
    if (schema.timestamps) {
      query += `, created_at, updated_at`;
      valuesPart += `, datetime('now'), datetime('now')`;
    }
    
    query += `) ${valuesPart}) RETURNING *;`;
    
    const { results, success} = await env.prepare(query).all();
    
    if (success) {
      // Filter out timestamps and soft delete fields unless needed
      const { deleted_at, created_at, updated_at, ...output } = results[0];
      return this.serializeData(output, schema);
    } else {
      return NotFoundError();
    }
  }

  static async update(data: any, env: any) {
    const { schema } = new this();
    const { id } = data;
    
    if (!Boolean(id)) return { message: 'No ID present for update.'};
    
    const { attributes } = this.deserializeData(data, schema);
    let query = `UPDATE ${schema.table_name} SET ${attributes}`;
    
    // Add updated_at timestamp if enabled
    if (schema.timestamps) {
      query += `, updated_at = datetime('now')`;
    }
    
    query += ` WHERE id='${id}' RETURNING *;`;
    
    const { results, success} = await env.prepare(query).all();
    
    if (!success) return;
    
    if (Boolean(results)) {
      const { deleted_at, created_at, updated_at, ...result } = results[0];
      return this.serializeData(result, schema);
    }
  }

  static async delete(id: string, env: any) {
    const { schema } = new this();
    
    if (!Boolean(id)) return { message: 'ID is missing.'};
    
    // Use soft delete if enabled
    if (schema.softDeletes) {
      const query = `UPDATE ${schema.table_name} 
                    SET deleted_at = datetime('now')
                    WHERE id='${id}';`;
      const { success } = await env.prepare(query).all();
      
      return success ?
        { message: `The ID ${id} from table "${schema.table_name}" has been soft deleted.` }
        : { message: `The ID ${id} has not been found at table "${schema.table_name}"` };
    } 
    // Otherwise perform hard delete
    else {
      const query = `DELETE FROM ${schema.table_name} WHERE id='${id}';`;
      const { success } = await env.prepare(query).all();
      
      return success ?
        { message: `The ID ${id} from table "${schema.table_name}" has been successfully deleted.` }
        : { message: `The ID ${id} has not been found at table "${schema.table_name}"` };
    }
  }

  static async all(env: any) {
    const { schema } = new this();
    
    let query = `SELECT * FROM ${schema.table_name}`;
    
    // Skip soft-deleted records if enabled
    if (schema.softDeletes) {
      query += ` WHERE deleted_at IS NULL`;
    }
    
    query += `;`;
    
    const { results, success} = await env.prepare(query).all();
    
    if(!success) return;
    
    if (Boolean(results)) {
      return results.map((result: any) => {
        const { deleted_at, created_at, updated_at, ...data } = result;
        return this.serializeData(data, schema);
      });
    }
  }

  // Find one record by column and value
  static async findOne(column: string, value: string, env: any, complete?: Boolean) {
    const { schema } = new this();
    
    let query = `SELECT * FROM ${schema.table_name} WHERE ${column}='${value}'`;
    
    // Skip soft-deleted records if enabled
    if (schema.softDeletes) {
      query += ` AND deleted_at IS NULL`;
    }
    
    query += ` LIMIT 1;`;
    
    const { results, success} = await env.prepare(query).all();
    
    if (!success) return;
    
    if (Boolean(results[0])) {
      if (complete) {
        return results[0];
      } else {
        const { deleted_at, created_at, updated_at, ...data } = results[0];
        return this.serializeData(data, schema);
      }
    } else {
      return NotFoundError();
    }
  }

  // Find records by column and value
  static async findBy(column: string, value: string, env: any, complete?: Boolean) {
    const { schema } = new this();
    
    let query = `SELECT * FROM ${schema.table_name} WHERE ${column}='${value}'`;
    
    // Skip soft-deleted records if enabled
    if (schema.softDeletes) {
      query += ` AND deleted_at IS NULL`;
    }
    
    query += `;`;
    
    const { results, success } = await env.prepare(query).all();
    
    if (!success) return;
    
    if (Boolean(results)) {
      return results.map((result: any) => {
        if (complete) {
          return result;
        } else {
          const { deleted_at, created_at, updated_at, ...data } = result;
          return this.serializeData(data, schema);
        }
      });
    } else {
      return NotFoundError();
    }
  }

  // Find by ID
  static async findById(id: string, env: any, complete?: Boolean) {
    const { schema } = new this();
    
    let query = `SELECT * FROM ${schema.table_name} WHERE id='${id}'`;
    
    // Skip soft-deleted records if enabled
    if (schema.softDeletes) {
      query += ` AND deleted_at IS NULL`;
    }
    
    query += `;`;
    
    const { results, success} = await env.prepare(query).all();
    
    if (!success) return;
    
    if (Boolean(results[0])) {
      if (complete) {
        return results[0];
      } else {
        const { deleted_at, created_at, updated_at, ...data } = results[0];
        return this.serializeData(data, schema);
      }
    } else {
      return NotFoundError();
    }
  }

  /**
   * Execute raw SQL query
   */
  static async raw(query: string, env: any) {
    const { results, success } = await env.prepare(query).all();
    if (!success) return { success: false, message: 'Query failed' };
    return { success: true, results };
  }
}

// Export the classes and interfaces
export {
  Form,
  Schema,
  Model,
  NotFoundError
}