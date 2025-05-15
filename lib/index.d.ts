import Joi from 'joi';
declare const NotFoundError: () => null;
declare class ModelError extends Error {
    errors: string[];
    constructor(message: string, errors?: string[]);
}
export type SQLiteType = 'TEXT' | 'INTEGER' | 'REAL' | 'NUMERIC' | 'BLOB' | 'BOOLEAN' | 'TIMESTAMP' | 'DATE';
/**
 * Describes a single column within a database table for the ORM.
 * This definition is used by the Model to understand data types,
 * map data to/from the database, and generate validation schemas (e.g., via `getValidationSchema()`).
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
type Columns = Column[];
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
    uniques?: string[];
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
    update(partialData: Partial<ModelDataI>, env: any): Promise<this | null>;
    /**
     * Deletes the current model instance from the database.
     * @param env - The database environment/connection object
     * @returns The result of the delete operation
     * @throws {ModelError} If the instance is missing an ID
     */
    delete(env: any): Promise<any>;
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
    private static createModelInstance;
    static create({ data }: any, env: any): Promise<any>;
    static update({ data }: any, env: any): Promise<any>;
    static delete(id: string, env: any): Promise<{
        message: string;
    }>;
    static restore(id: string, env: any): Promise<{
        message: string;
        data?: undefined;
    } | {
        message: string;
        data: any;
    }>;
    static all(env: any, includeDeleted?: Boolean): Promise<any>;
    static findOne(column: string, value: string, env: any, includeDeleted?: Boolean): Promise<any>;
    static findBy(column: string, value: string, env: any, includeDeleted?: Boolean): Promise<any>;
    static findById(id: string, env: any, includeDeleted?: Boolean): Promise<any>;
    static query(sql: string, env: any, params?: any[]): Promise<{
        success: boolean;
        message: string;
        results?: undefined;
    } | {
        success: boolean;
        results: any;
        message?: undefined;
    }>;
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
    save(env: any): Promise<this | null>;
}
export { Form, Schema, Model, NotFoundError, ModelDataI, ModelError };
