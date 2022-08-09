import Joi from 'joi'

const NotFoundError = () => {
  return null
}

interface SchemaConfigI {
  table_name: string;
  columns: string[];
  select: string;
  uniques?: string[];
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
  columns: string[]
  select: string
  uniques: string[] | undefined

  constructor(props: { table_name: string; columns: string[], uniques?: string[] }) {
    this.table_name = props.table_name
    this.columns = props.columns
    this.select = props.columns.join(', ')
    this.uniques = props.uniques
  }
}

class Model {
  id: string
  schema: SchemaConfigI
  // TODO: schema, props must be mandatory and apply interfaces. task remove the '?'
  constructor(schema?: any, props?: any) {
    this.id = props?.id || null
    this.schema = schema
  }

  private static deserializeData(data: any): any {
    const { id }: { id: string | null } = data;
    if (!Boolean(id)) {
      const keys: string[] = ['id'];
      const values: string[] = [`${crypto.randomUUID()}`];

      Object.keys(data).map((key) => {
        if (typeof data[key] === 'object') {
          keys.push(key); values.push(JSON.stringify(data[key]))
        } else if (typeof data[key] === 'number')  {
          keys.push(key); values.push(data[key].toString())
        } else if (typeof data[key] === 'string')  {
          keys.push(key); values.push(data[key])
        }
      });

      return { values: `'${values.join("', '")}'`, keys: keys.join(", ")};
    } else {
      const attributes: string[] = [];
      Object.keys(data).map((key) => {
        if (key === 'id') return;
        attributes.push(key + " = '" + data[key] + "'");
      });
      return { attributes: "" + attributes.join(", ")};
    }
  }


  static async create({ data }: any, env: any) {
    let { schema } = new this();
    // const idExists = await this.findById(id, env, ctx)
    const idExists = false;

    // if (schema.uniques) {
    //   const hasDuplicates = schema.uniques.map(async (value: string) => {
    //     return await this.findOne(value, data[value], env, ctx)
    //   })
    //   const promises = await Promise.all(hasDuplicates)
    //   if(!promises.some(e => !e)) {
    //     return null
    //   }
    // }

    if (!idExists) {
      const { keys, values } = this.deserializeData(data)
      const { results, success} = await env.prepare(
        `INSERT INTO ${schema.table_name} (${keys}, created_at, updated_at)
          VALUES(${values}, datetime('now'), datetime('now')) RETURNING *;`
      ).all()
      if (!Boolean(success)) return;
      return results[0]
    } else {
      return NotFoundError() 
    }
  }

  static async update({ data }: any, env: any) {
    const { schema } = new this()
    const { id } = data;
    if (!Boolean(id)) return { message: 'No ID present for update.'};
    const { attributes } = this.deserializeData(data);
    const { results, success} = await env.prepare(
      `UPDATE ${schema.table_name}
      SET ${attributes}
      WHERE id='${id}'
      RETURNING *;`
    ).all()

    if (!success) return;
    if (Boolean(results)) {
      const { deleted_at, created_at, updated_at, ...result } = results[0];
      return result
    }
  }

  static async delete(id: string, env: any) {
    const { schema } = new this()
    if (!Boolean(id)) return { message: 'ID is missing.'};
    const { success, ...more} = await env.prepare(
      `DELETE FROM ${schema.table_name}
      WHERE id='${id}';`
    ).all()
    return success ?
      { message: `The ID ${id} from table "${schema.table_name} has been successfully deleted.` }
      : { message: `The ID ${id} has not been found at table "${schema.table_name}"` }
  }

  static async all(env: any) {
    const { schema } = new this()
    const { results, success} = await env.prepare(`SELECT * FROM ${schema.table_name};`).all()
    if(!success) return;
    if (Boolean(results)) {
      return results.map((result: any) => {
        const { deleted_at, created_at, updated_at, ...data } = result;
        return data;
      })
    }
  }

  // TODO: detect if the column exists
  static async findOne(column: string, value: string, env: any) {
    const { schema } = new this()
    const { results, success} = await env.prepare(`SELECT * FROM ${schema.table_name} WHERE ${column}='${value}';`).all()
    if (!success) return;
    if (Boolean(results[0])) {
      const { deleted_at, created_at, updated_at, ...result } = results[0];
      return result
    } else {
      return NotFoundError();
    }
  }

  static async findBy(column: string, value: string, env: any, complete?: Boolean ) {
    const { schema } = new this()
    const { results, success} = await env.prepare(`SELECT * FROM ${schema.table_name} WHERE ${column}='${value}';`).all()
    if (!success) return;
    if (Boolean(results)) {
      return results.map((result: any) => {
        const { deleted_at, created_at, updated_at, ...data } = result;
        return complete ? result : data;
      })
    } else {
      return NotFoundError();
    }
  }

  static async findById(id: string, env: any, complete?: Boolean) {
    const { schema } = new this()
    const { results, success} = await env.prepare(`SELECT * FROM ${schema.table_name} WHERE id='${id}';`).all()
    if (!success) return;
    if (Boolean(results)) {
      const { deleted_at, created_at, updated_at, ...data } = results[0];
      return complete ? results[0] : data;
    } else {
      return NotFoundError();
    }
  }
}

export { Model, Schema, Form, NotFoundError }
export type { SchemaConfigI }