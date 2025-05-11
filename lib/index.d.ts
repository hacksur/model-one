import Joi from 'joi';
declare const NotFoundError: () => null;
declare class ModelError extends Error {
    errors: string[];
    constructor(message: string, errors?: string[]);
}
export type SQLiteType = 'TEXT' | 'INTEGER' | 'REAL' | 'NUMERIC' | 'BLOB' | 'BOOLEAN' | 'TIMESTAMP' | 'DATE';
/**
 * Column definition for database tables mapped to JavaScript types
 */
export type ColumnType = 'string' | 'number' | 'boolean' | 'jsonb' | 'date';
/**
 * Column constraint types
 */
export type ConstraintType = 'PRIMARY KEY' | 'NOT NULL' | 'UNIQUE' | 'CHECK' | 'DEFAULT' | 'FOREIGN KEY';
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
type Columns = Column[];
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
/**
 * Model data interface
 */
interface ModelDataI {
    id?: string;
    [key: string]: any;
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
    timestamps: boolean;
    softDeletes: boolean;
    constructor(props: {
        table_name: string;
        columns: Columns;
        uniques?: string[];
        timestamps?: boolean;
        softDeletes?: boolean;
    });
}
declare class Model {
    id: string | null;
    schema: SchemaConfigI;
    data: ModelDataI;
    constructor(schema?: SchemaConfigI, props?: ModelDataI);
    /**
     * Maps JavaScript types to SQLite types
     */
    private static getDefaultSQLiteType;
    /**
     * Processes a value based on its column type for database storage
     */
    private static processValueForStorage;
    /**
     * Processes a database value based on column type for JavaScript usage
     */
    private static processValueFromStorage;
    private static deserializeData;
    private static serializeData;
    /**
     * Creates a new instance of the Model class from raw data
     * @param data The data to create the model from
     * @param includeSchema Whether to include schema information in the returned model (default: false)
     * @returns A model instance with or without schema information
     */
    private static createModelInstance;
    static create({ data }: any, env: any): Promise<any>;
    static update({ data }: any, env: any): Promise<any>;
    static delete(id: string, env: any): Promise<{
        message: string;
    }>;
    /**
     * Restores a soft-deleted record by setting deleted_at to NULL
     * @param id The ID of the record to restore
     * @param env The database environment
     * @returns A message indicating success or failure
     */
    static restore(id: string, env: any): Promise<{
        message: string;
        data?: undefined;
    } | {
        message: string;
        data: any;
    }>;
    static all(env: any): Promise<any>;
    static findOne(column: string, value: string, env: any, complete?: Boolean, includeDeleted?: Boolean): Promise<any>;
    static findBy(column: string, value: string, env: any, complete?: Boolean, includeDeleted?: Boolean): Promise<any>;
    static findById(id: string, env: any, complete?: Boolean, includeDeleted?: Boolean): Promise<any>;
    /**
     * Execute raw SQL query
     */
    static raw(query: string, env: any): Promise<{
        success: boolean;
        message: string;
        results?: undefined;
    } | {
        success: boolean;
        results: any;
        message?: undefined;
    }>;
}
export { Form, Schema, Model, NotFoundError, ModelDataI, ModelError };
