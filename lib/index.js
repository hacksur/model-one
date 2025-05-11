"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotFoundError = exports.Model = exports.Schema = exports.Form = void 0;
const NotFoundError = () => {
    return null;
};
exports.NotFoundError = NotFoundError;
class Form {
    constructor(schema, data) {
        this.schema = schema;
        this.data = data.data;
        this.validate();
    }
    // Validate if props contains at least the declared fields
    validate() {
        const { error } = this.schema.validate(this.data);
        if (error !== undefined) {
            throw new Error(error.message);
        }
    }
}
exports.Form = Form;
class Schema {
    constructor(props) {
        this.table_name = props.table_name;
        this.columns = props.columns;
        this.uniques = props.uniques;
        this.timestamps = props.timestamps ?? true; // Default to true for backward compatibility
        this.softDeletes = props.softDeletes ?? false;
    }
}
exports.Schema = Schema;
class Model {
    constructor(schema, props) {
        this.id = props?.id || null;
        this.schema = schema || {};
        this.data = props || {};
    }
    /**
     * Maps JavaScript types to SQLite types
     */
    static getDefaultSQLiteType(columnType) {
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
    static processValueForStorage(value, columnType) {
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
    static processValueFromStorage(value, columnType) {
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
    static deserializeData(data, schema) {
        const { id } = data;
        // Creating a new record
        if (!Boolean(id)) {
            const keys = ['id'];
            const values = [`${crypto.randomUUID()}`];
            // Process each column according to its type
            schema.columns.forEach((column) => {
                if (data[column.name] !== undefined) {
                    keys.push(column.name);
                    const processedValue = this.processValueForStorage(data[column.name], column.type);
                    // Handle different types for SQL statement
                    if (processedValue === null) {
                        values.push('NULL');
                    }
                    else if (typeof processedValue === 'number') {
                        values.push(processedValue.toString());
                    }
                    else if (typeof processedValue === 'string') {
                        values.push(processedValue);
                    }
                    else {
                        values.push(JSON.stringify(processedValue));
                    }
                }
            });
            // Format values for SQL
            const formattedValues = values.map(v => {
                return v === 'NULL' ? v : `'${v}'`;
            }).join(", ");
            return { values: formattedValues, keys: keys.join(", ") };
        }
        // Updating an existing record
        else {
            const attributes = [];
            schema.columns.forEach((column) => {
                if (column.name === 'id' || data[column.name] === undefined)
                    return;
                const processedValue = this.processValueForStorage(data[column.name], column.type);
                if (processedValue === null) {
                    attributes.push(`${column.name} = NULL`);
                }
                else if (typeof processedValue === 'number') {
                    attributes.push(`${column.name} = ${processedValue}`);
                }
                else {
                    attributes.push(`${column.name} = '${processedValue}'`);
                }
            });
            return { attributes: attributes.join(", ") };
        }
    }
    static serializeData(data, schema) {
        const result = { ...data };
        // Process each column according to its type
        schema.columns.forEach((column) => {
            if (data[column.name] !== undefined) {
                result[column.name] = this.processValueFromStorage(data[column.name], column.type);
            }
        });
        return result;
    }
    /**
     * Creates a new instance of the Model class from raw data
     */
    static createModelInstance(data) {
        const instance = new this();
        instance.id = data.id;
        // Copy all properties from data to the instance's data property
        Object.keys(data).forEach(key => {
            instance.data[key] = data[key];
        });
        return instance;
    }
    static async create({ data }, env) {
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
        const { results, success } = await env.prepare(query).all();
        if (success) {
            // Filter out timestamps and soft delete fields unless needed
            const { deleted_at, created_at, updated_at, ...output } = results[0];
            const serializedData = this.serializeData(output, schema);
            // Return a new Model instance with the serialized data
            return this.createModelInstance(serializedData);
        }
        else {
            return NotFoundError();
        }
    }
    static async update(data, env) {
        const { schema } = new this();
        const { id } = data;
        if (!Boolean(id))
            return { message: 'No ID present for update.' };
        const { attributes } = this.deserializeData(data, schema);
        let query = `UPDATE ${schema.table_name} SET ${attributes}`;
        // Add updated_at timestamp if enabled
        if (schema.timestamps) {
            query += `, updated_at = datetime('now')`;
        }
        query += ` WHERE id='${id}' RETURNING *;`;
        const { results, success } = await env.prepare(query).all();
        if (!success)
            return;
        if (Boolean(results)) {
            const { deleted_at, created_at, updated_at, ...result } = results[0];
            const serializedData = this.serializeData(result, schema);
            // Return a new Model instance with the serialized data
            return this.createModelInstance(serializedData);
        }
    }
    static async delete(id, env) {
        const { schema } = new this();
        if (!Boolean(id))
            return { message: 'ID is missing.' };
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
    static async all(env) {
        const { schema } = new this();
        let query = `SELECT * FROM ${schema.table_name}`;
        // Skip soft-deleted records if enabled
        if (schema.softDeletes) {
            query += ` WHERE deleted_at IS NULL`;
        }
        query += `;`;
        const { results, success } = await env.prepare(query).all();
        if (!success)
            return;
        if (Boolean(results)) {
            return results.map((result) => {
                const { deleted_at, created_at, updated_at, ...data } = result;
                const serializedData = this.serializeData(data, schema);
                // Return a new Model instance with the serialized data
                return this.createModelInstance(serializedData);
            });
        }
    }
    // Find one record by column and value
    static async findOne(column, value, env, complete) {
        const { schema } = new this();
        let query = `SELECT * FROM ${schema.table_name} WHERE ${column}='${value}'`;
        // Skip soft-deleted records if enabled
        if (schema.softDeletes) {
            query += ` AND deleted_at IS NULL`;
        }
        query += ` LIMIT 1;`;
        const { results, success } = await env.prepare(query).all();
        if (!success)
            return;
        if (Boolean(results[0])) {
            if (complete) {
                return results[0];
            }
            else {
                const { deleted_at, created_at, updated_at, ...data } = results[0];
                const serializedData = this.serializeData(data, schema);
                // Return a new Model instance with the serialized data
                return this.createModelInstance(serializedData);
            }
        }
        else {
            return NotFoundError();
        }
    }
    // Find records by column and value
    static async findBy(column, value, env, complete) {
        const { schema } = new this();
        let query = `SELECT * FROM ${schema.table_name} WHERE ${column}='${value}'`;
        // Skip soft-deleted records if enabled
        if (schema.softDeletes) {
            query += ` AND deleted_at IS NULL`;
        }
        query += `;`;
        const { results, success } = await env.prepare(query).all();
        if (!success)
            return;
        if (Boolean(results)) {
            return results.map((result) => {
                if (complete) {
                    return result;
                }
                else {
                    const { deleted_at, created_at, updated_at, ...data } = result;
                    const serializedData = this.serializeData(data, schema);
                    // Return a new Model instance with the serialized data
                    return this.createModelInstance(serializedData);
                }
            });
        }
        else {
            return NotFoundError();
        }
    }
    // Find by ID
    static async findById(id, env, complete) {
        const { schema } = new this();
        let query = `SELECT * FROM ${schema.table_name} WHERE id='${id}'`;
        // Skip soft-deleted records if enabled
        if (schema.softDeletes) {
            query += ` AND deleted_at IS NULL`;
        }
        query += `;`;
        const { results, success } = await env.prepare(query).all();
        if (!success)
            return;
        if (Boolean(results[0])) {
            if (complete) {
                return results[0];
            }
            else {
                const { deleted_at, created_at, updated_at, ...data } = results[0];
                const serializedData = this.serializeData(data, schema);
                // Return a new Model instance with the serialized data
                return this.createModelInstance(serializedData);
            }
        }
        else {
            return NotFoundError();
        }
    }
    /**
     * Execute raw SQL query
     */
    static async raw(query, env) {
        const { results, success } = await env.prepare(query).all();
        if (!success)
            return { success: false, message: 'Query failed' };
        return { success: true, results };
    }
}
exports.Model = Model;
//# sourceMappingURL=index.js.map