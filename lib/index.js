"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModelError = exports.NotFoundError = exports.Model = exports.Schema = exports.Form = void 0;
const NotFoundError = () => {
    return null;
};
exports.NotFoundError = NotFoundError;
class ModelError extends Error {
    constructor(message, errors = []) {
        super(message);
        this.name = 'ModelError';
        this.errors = errors;
    }
}
exports.ModelError = ModelError;
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
            throw new ModelError(error.message, error.details.map(detail => detail.message));
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
        this.schema = schema || {}; // Ensure schema is initialized
        this.data = props || {};
    }
    async update(partialData, env) {
        if (!this.data?.id) {
            throw new ModelError('Instance data is missing an ID, cannot update.');
        }
        const updatePayload = { ...this.data, ...partialData };
        const arg1 = { data: updatePayload };
        const ModelCtor = this.constructor;
        const resultFromStaticUpdate = await ModelCtor.update(arg1, env);
        if (resultFromStaticUpdate && resultFromStaticUpdate.data) {
            this.data = { ...resultFromStaticUpdate.data };
            this.id = resultFromStaticUpdate.data.id || this.id;
            return this;
        }
        else {
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
    async delete(env) {
        if (!this.data?.id) {
            throw new ModelError('Instance data is missing an ID, cannot delete.');
        }
        const ModelCtor = this.constructor;
        const result = await ModelCtor.delete(this.data.id, env);
        // Return the result from the static delete method
        return result;
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
    static deserializeData(data, schema) {
        const { id } = data;
        if (!Boolean(id)) {
            const keys = ['id'];
            const values = [`${crypto.randomUUID()}`];
            schema.columns.forEach((column) => {
                if (data[column.name] !== undefined) {
                    keys.push(column.name);
                    const processedValue = this.processValueForStorage(data[column.name], column.type);
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
            const formattedValues = values.map(v => {
                return v === 'NULL' ? v : `'${v}'`;
            }).join(", ");
            return { values: formattedValues, keys: keys.join(", ") };
        }
        else {
            const attributes = [];
            schema.columns.forEach((column) => {
                if (column.name === 'id')
                    return;
                if (Object.prototype.hasOwnProperty.call(data, column.name)) {
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
                }
            });
            return { attributes: attributes.join(", ") };
        }
    }
    static serializeData(data, schema) {
        const result = { ...data };
        schema.columns.forEach((column) => {
            if (data[column.name] !== undefined) {
                result[column.name] = this.processValueFromStorage(data[column.name], column.type);
            }
            else {
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
    static createModelInstance(data, schemaForInstance) {
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
    static async create({ data }, env) {
        const { schema } = new this();
        const { keys, values } = this.deserializeData(data, schema);
        let query = `INSERT INTO ${schema.table_name} (${keys}`;
        let valuesPart = `VALUES(${values}`;
        if (schema.timestamps) {
            query += `, created_at, updated_at`;
            valuesPart += `, datetime('now'), datetime('now')`;
        }
        query += `) ${valuesPart}) RETURNING *;`;
        const { results, success } = await env.prepare(query).all();
        if (success && results && results[0]) {
            const dbRecord = { ...results[0] };
            const serializedData = this.serializeData(dbRecord, schema);
            return this.createModelInstance(serializedData, schema);
        }
        else {
            console.error('Create operation failed or returned no results.');
            return null;
        }
    }
    static async update({ data }, env) {
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
        const { results, success } = await env.prepare(query).all();
        if (success && results && results[0]) {
            const dbRecord = { ...results[0] };
            const serializedData = this.serializeData(dbRecord, schema);
            return this.createModelInstance(serializedData, schema);
        }
        else {
            console.error(`Update failed for ID ${id} or record not found.`);
            return null;
        }
    }
    static async delete(id, env) {
        const { schema } = new this();
        if (!Boolean(id))
            return { message: 'ID is missing.' };
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
    static async restore(id, env) {
        const { schema } = new this();
        if (!Boolean(id))
            return { message: 'ID is missing.' };
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
    static async all(env, includeDeleted) {
        const { schema } = new this();
        let query = `SELECT * FROM ${schema.table_name}`;
        if (schema.softDeletes && !includeDeleted) {
            query += ` WHERE deleted_at IS NULL`;
        }
        query += `;`;
        const { results, success } = await env.prepare(query).all();
        if (!success)
            return [];
        if (results && results.length > 0) {
            return results.map((result) => {
                const dbRecord = { ...result };
                const serializedData = this.serializeData(dbRecord, schema);
                return this.createModelInstance(serializedData, schema);
            });
        }
        else {
            return [];
        }
    }
    static async findOne(column, value, env, includeDeleted) {
        const { schema } = new this();
        let query = `SELECT * FROM ${schema.table_name} WHERE ${column}='${value}'`;
        if (schema.softDeletes && !includeDeleted) {
            query += ` AND deleted_at IS NULL`;
        }
        query += ` LIMIT 1;`;
        const { results, success } = await env.prepare(query).all();
        if (!success || !results || results.length === 0) {
            return null;
        }
        const dbRecord = { ...results[0] };
        const serializedData = this.serializeData(dbRecord, schema);
        return this.createModelInstance(serializedData, schema);
    }
    static async findBy(column, value, env, includeDeleted) {
        const { schema } = new this();
        let query = `SELECT * FROM ${schema.table_name} WHERE ${column}='${value}'`;
        if (schema.softDeletes && !includeDeleted) {
            query += ` AND deleted_at IS NULL`;
        }
        query += `;`;
        const { results, success } = await env.prepare(query).all();
        if (!success || !results)
            return [];
        return results.map((result) => {
            const dbRecord = { ...result };
            const serializedData = this.serializeData(dbRecord, schema);
            return this.createModelInstance(serializedData, schema);
        }).filter((p) => p !== null);
    }
    static async findById(id, env, includeDeleted) {
        const { schema } = new this();
        let query = `SELECT * FROM ${schema.table_name} WHERE id='${id}'`;
        if (schema.softDeletes && !includeDeleted) {
            query += ` AND deleted_at IS NULL`;
        }
        query += ` LIMIT 1;`;
        const { results, success } = await env.prepare(query).all();
        if (!success || !results || results.length === 0) {
            return null;
        }
        const dbRecord = { ...results[0] };
        const serializedData = this.serializeData(dbRecord, schema);
        return this.createModelInstance(serializedData, schema);
    }
    static async query(sql, env, params) {
        const { results, success } = await env.prepare(sql, params).all();
        if (!success)
            return { success: false, message: 'Query failed' };
        return { success: true, results };
    }
}
exports.Model = Model;
//# sourceMappingURL=index.js.map