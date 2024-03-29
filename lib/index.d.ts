import Joi from 'joi';
declare const NotFoundError: () => null;
type Column = {
    name: string;
    type: 'string' | 'jsonb' | 'boolean';
};
type Columns = Column[];
interface SchemaConfigI {
    table_name: string;
    columns: Columns;
    uniques?: string[];
}
declare class Form {
    schema: Joi.ObjectSchema<any>;
    data: any;
    constructor(schema: Joi.ObjectSchema<any>, data: any);
    validate(): void;
}
declare class Schema implements SchemaConfigI {
    table_name: string;
    columns: Columns;
    uniques: string[] | undefined;
    constructor(props: {
        table_name: string;
        columns: Columns;
        uniques?: string[];
    });
}
declare class Model {
    id: string;
    schema: SchemaConfigI;
    constructor(schema?: any, props?: any);
    private static deserializeData;
    private static serializeData;
    static create({ data }: any, env: any): Promise<any>;
    static update(data: any, env: any): Promise<any>;
    static delete(id: string, env: any): Promise<{
        message: string;
    }>;
    static all(env: any): Promise<any>;
    static findOne(column: string, value: string, env: any, complete?: Boolean): Promise<any>;
    static findBy(column: string, value: string, env: any, complete?: Boolean): Promise<any>;
    static findById(id: string, env: any, complete?: Boolean): Promise<any>;
}
export { Model, Schema, Form, NotFoundError };
export type { SchemaConfigI };
