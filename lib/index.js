"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotFoundError = exports.Form = exports.Schema = exports.Model = void 0;
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
    }
}
exports.Schema = Schema;
class Model {
    // TODO: schema, props must be mandatory and apply interfaces. task remove the '?'
    constructor(schema, props) {
        this.id = props?.id || null;
        this.schema = schema;
    }
    static deserializeData(data) {
        const { id } = data;
        if (!Boolean(id)) {
            const keys = ['id'];
            const values = [`${crypto.randomUUID()}`];
            Object.keys(data).map((key) => {
                if (typeof data[key] === 'object') {
                    keys.push(key);
                    values.push(JSON.stringify(data[key]));
                }
                else if (typeof data[key] === 'number') {
                    keys.push(key);
                    values.push(data[key].toString());
                }
                else if (typeof data[key] === 'string') {
                    keys.push(key);
                    values.push(data[key]);
                }
            });
            return { values: `'${values.join("', '")}'`, keys: keys.join(", ") };
        }
        else {
            const attributes = [];
            Object.keys(data).map((key) => {
                if (key === 'id')
                    return;
                if (typeof data[key] === 'object') {
                    attributes.push(key + " = '" + JSON.stringify(data[key]) + "'");
                }
                else if (typeof data[key] === 'string') {
                    attributes.push(key + " = '" + data[key] + "'");
                }
            });
            const updated = { attributes: "" + attributes.join(", ") };
            return updated;
        }
    }
    static serializeData(data) {
        const { schema } = new this();
        let output = {};
        schema.columns.map((column) => {
            if (column.type === 'jsonb' && typeof data[column.name] === 'string') {
                output = { ...output, [column.name]: JSON.parse(data[column.name]) };
            }
        });
        const result = { ...data, ...output };
        return result;
    }
    static async create({ data }, env) {
        let { schema } = new this();
        const { keys, values } = this.deserializeData(data);
        const { results, success } = await env.prepare(`INSERT INTO ${schema.table_name} (${keys}, created_at, updated_at)
        VALUES(${values}, datetime('now'), datetime('now')) RETURNING *;`).all();
        if (success) {
            const { deleted_at, created_at, updated_at, ...output } = results[0];
            return this.serializeData(output);
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
        const { attributes } = this.deserializeData(data);
        const { results, success } = await env.prepare(`UPDATE ${schema.table_name}
      SET ${attributes}
      WHERE id='${id}'
      RETURNING *;`).all();
        if (!success)
            return;
        if (Boolean(results)) {
            const { deleted_at, created_at, updated_at, ...result } = results[0];
            return this.serializeData(result);
        }
    }
    static async delete(id, env) {
        const { schema } = new this();
        if (!Boolean(id))
            return { message: 'ID is missing.' };
        const { success } = await env.prepare(`DELETE FROM ${schema.table_name}
      WHERE id='${id}';`).all();
        return success ?
            { message: `The ID ${id} from table "${schema.table_name} has been successfully deleted.` }
            : { message: `The ID ${id} has not been found at table "${schema.table_name}"` };
    }
    static async all(env) {
        const { schema } = new this();
        const { results, success } = await env.prepare(`SELECT * FROM ${schema.table_name};`).all();
        if (!success)
            return;
        if (Boolean(results)) {
            return results.map((result) => {
                const { deleted_at, created_at, updated_at, ...data } = result;
                return data;
            });
        }
    }
    // TODO: detect if the column exists
    static async findOne(column, value, env, complete) {
        const { schema } = new this();
        const { results, success } = await env.prepare(`SELECT * FROM ${schema.table_name} WHERE ${column}='${value}';`).all();
        if (!success)
            return;
        if (Boolean(results[0])) {
            const { deleted_at, created_at, updated_at, ...data } = results[0];
            return complete ? results[0] : this.serializeData(data);
        }
        else {
            return NotFoundError();
        }
    }
    static async findBy(column, value, env, complete) {
        const { schema } = new this();
        const { results, success } = await env.prepare(`SELECT * FROM ${schema.table_name} WHERE ${column}='${value}';`).all();
        if (!success)
            return;
        if (Boolean(results)) {
            return results.map((result) => {
                const { deleted_at, created_at, updated_at, ...data } = result;
                return complete ? result : this.serializeData(data);
            });
        }
        else {
            return NotFoundError();
        }
    }
    static async findById(id, env, complete) {
        const { schema } = new this();
        const { results, success } = await env.prepare(`SELECT * FROM ${schema.table_name} WHERE id='${id}';`).all();
        if (!success)
            return;
        if (Boolean(results[0])) {
            const { deleted_at, created_at, updated_at, ...data } = results[0];
            return complete ? results[0] : this.serializeData(data);
        }
        else {
            return NotFoundError();
        }
    }
}
exports.Model = Model;
//# sourceMappingURL=index.js.map