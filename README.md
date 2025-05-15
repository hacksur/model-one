# Model One

[![code style](https://img.shields.io/badge/code_style-XO-5ed9c7.svg)](https://github.com/sindresorhus/xo)
[![styled with prettier](https://img.shields.io/badge/styled_with-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![made with lass](https://img.shields.io/badge/made_with-lass-95CC28.svg)](https://lass.js.org)
[![license](https://img.shields.io/github/license/hacksur/model-one.svg)](LICENSE)
[![npm downloads](https://img.shields.io/npm/dt/model-one.svg)](https://npm.im/model-one)

A powerful ORM-like library (v0.3.0) for Cloudflare Workers D1 with validation support via Joi.

## Features

- **Type-safe models** with TypeScript support
- **Basic CRUD operations** with a PostgreSQL-like interface
- **Enhanced column types** including string, number, boolean, date, and JSON
- **UUID generation** by default for primary keys
- **Automatic timestamps** for created_at and updated_at fields
- **Soft delete functionality** for non-destructive record removal
- **Data serialization and deserialization** for complex data types
- **Form validation** powered by Joi
- **Raw SQL query support** for complex operations
- **Proper data encapsulation** through the data property pattern

## Table of Contents

1. [Installation](#installation)
2. [Quick Start](#quick-start)
3. [Model Definition](#model-definition)
4. [Schema Configuration](#schema-configuration)
5. [Column Types and Constraints](#column-types-and-constraints)
6. [Form Validation](#form-validation)
7. [CRUD Operations](#crud-operations)
8. [Soft Delete](#soft-delete)
9. [Extending Models](#extending-models)
10. [TypeScript Support](#typescript-support)

## Installation

[npm][]:

```sh
npm install model-one joi
```

[yarn][]:

```sh
yarn add model-one joi
```

## Quick Start

```typescript
import { Model, Schema, Form } from 'model-one';
import Joi from 'joi';

// Define schema
const userSchema = new Schema({
  table_name: 'users',
  columns: [
    { name: 'id', type: 'string' },
    { name: 'name', type: 'string' },
    { name: 'email', type: 'string' },
    { name: 'preferences', type: 'jsonb' }
  ],
  timestamps: true,
  softDeletes: true
});

// Define validation schema
const joiSchema = Joi.object({
  id: Joi.string(),
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  preferences: Joi.object()
});

// Define interfaces
interface UserDataI {
  id?: string;
  name?: string;
  email?: string;
  preferences?: Record<string, any>;
}

interface UserI extends Model {
  data: UserDataI;
}

// Create form class
class UserForm extends Form {
  constructor(data: UserI) {
    super(joiSchema, data);
  }
}

// Create model class
class User extends Model implements UserI {
  data: UserDataI;

  constructor(props: UserDataI = {}) {
    super(userSchema);
    this.data = props || {};
  }
}

// Usage example
async function createUser(env) {
  const userData = { name: 'John Doe', email: 'john@example.com', preferences: { theme: 'dark' } };
  const user = new User(userData);
  const form = new UserForm(user);
  
  const createdUser = await User.create(form, env.DB);
  console.log(createdUser.data.id); // Auto-generated UUID
  console.log(createdUser.data.name); // 'John Doe'
  console.log(createdUser.data.preferences.theme); // 'dark'
}
```

## Model Definition

Models in Model-One follow a specific pattern to ensure type safety and proper data encapsulation:

```typescript
// Define your data interface
interface EntityDataI {
  id?: string;
  // Add your custom properties here
  name?: string;
  // etc...
}

// Define your model interface that extends the base Model
interface EntityI extends Model {
  data: EntityDataI;
}

// Create your model class
class Entity extends Model implements EntityI {
  data: EntityDataI;

  constructor(props: EntityDataI = {}) {
    super(entitySchema);
    this.data = props || {};
  }
}
```

### Important Note on Data Access

In Model-One v0.2.0 and above, all entity properties must be accessed through the `data` property:

```typescript
// Correct way to access properties
const user = await User.findById(id, env.DB);
if (user) {
  console.log(user.data.name); // Correct
  console.log(user.data.email); // Correct
}

// Incorrect way (will not work)
console.log(user.name); // Incorrect
console.log(user.email); // Incorrect
```

```sh
yarn add model-one joi
```

## Schema Configuration

The Schema class is used to define your database table structure:

```typescript
const entitySchema = new Schema({
  table_name: 'entities',  // Name of the database table
  columns: [
    { name: 'id', type: 'string' },  // Primary key (UUID by default)
    { name: 'title', type: 'string' },
    { name: 'count', type: 'number' },
    { name: 'is_active', type: 'boolean' },
    { name: 'metadata', type: 'jsonb' },
    { name: 'published_at', type: 'date' }
  ],
  timestamps: true,  // Adds created_at and updated_at columns
  softDeletes: true  // Adds deleted_at column for soft deletes
});
```

## Column Types and Constraints

Model-One supports the following column types:

| Type | JavaScript Type | Description |
|------|----------------|-------------|
| `string` | `string` | Text data |
| `number` | `number` | Numeric data |
| `boolean` | `boolean` | Boolean values (true/false) |
| `date` | `Date` | Date and time values |
| `jsonb` | `object` or `array` | JSON data that is automatically serialized/deserialized |

## Form Validation

Model-One uses Joi for form validation:

```typescript
import Joi from 'joi';
import { Form } from 'model-one';

// Define validation schema
const joiSchema = Joi.object({
  id: Joi.string(),
  title: Joi.string().required().min(3).max(100),
  count: Joi.number().integer().min(0),
  is_active: Joi.boolean(),
  metadata: Joi.object(),
  published_at: Joi.date()
});

// Create form class
class EntityForm extends Form {
  constructor(data: EntityI) {
    super(joiSchema, data);
  }
}

// Usage
const entity = new Entity({ title: 'Test' });
const form = new EntityForm(entity);

// Validation happens automatically when creating or updating
const createdEntity = await Entity.create(form, env.DB);
```

## CRUD Operations

Model-One provides the following CRUD operations:

### Create

```typescript
// Create a new entity
const entity = new Entity({ title: 'New Entity', count: 42 });
const form = new EntityForm(entity);
const createdEntity = await Entity.create(form, env.DB);

// Access the created entity's data
console.log(createdEntity.data.id); // Auto-generated UUID
console.log(createdEntity.data.title); // 'New Entity'
```

### Read (Finding Records)

Model-One provides several static methods on your model class to retrieve records from the database. All these methods return model instances (or `null` / an array of instances), and you should access their properties via the `.data` object.

*   `YourModel.findById(id: string, env: any, includeDeleted?: boolean): Promise<YourModel | null>`

    Finds a single record by its ID. Returns a model instance or `null` if not found.

    ```typescript
    const user = await User.findById('some-uuid', env.DB);
    if (user) {
      console.log(user.data.name); // Access data via .data
    }
    ```
    If `softDeletes` is enabled for the model, you can pass `true` as the third argument (`includeDeleted`) to also find soft-deleted records.

*   `YourModel.findOne(column: string, value: string, env: any, includeDeleted?: boolean): Promise<YourModel | null>`

    Finds the first record that matches a given column-value pair. Returns a model instance or `null`.

    ```typescript
    const adminUser = await User.findOne('email', 'admin@example.com', env.DB);
    if (adminUser) {
      console.log(adminUser.data.id);
    }
    ```
    The optional fourth argument `includeDeleted` works the same as in `findById`.

*   `YourModel.findBy(column: string, value: string, env: any, includeDeleted?: boolean): Promise<YourModel[]>`

    Finds all records that match a given column-value pair. Returns an array of model instances (can be empty).

    ```typescript
    const activeUsers = await User.findBy('status', 'active', env.DB);
    activeUsers.forEach(user => {
      console.log(user.data.email);
    });
    ```
    The optional fourth argument `includeDeleted` works the same as in `findById`.

*   `YourModel.all(env: any, includeDeleted?: boolean): Promise<YourModel[]>`

    Retrieves all records for the model. Returns an array of model instances.

    ```typescript
    const allUsers = await User.all(env.DB);
    console.log(`Total users: ${allUsers.length}`);
    allUsers.forEach(user => {
      console.log(user.data.name); // Access data via .data
    });
    ```
    The optional second argument `includeDeleted` works the same as in `findById`.

### Update

```typescript
// Update an entity
const updatedData = {
  id: 'existing-uuid',  // Required for updates
  title: 'Updated Title',
  count: 100
};
const updatedEntity = await Entity.update(updatedData, env.DB);

// Access the updated entity's data
console.log(updatedEntity.data.title); // 'Updated Title'
console.log(updatedEntity.data.updated_at); // Current timestamp
```

### Delete (Soft Delete)

```typescript
// Soft delete an entity using the static Model.delete() method (still supported)
await Entity.delete('entity-uuid', env.DB);

// Entity will no longer be returned in queries by default
const notFound = await Entity.findById('entity-uuid', env.DB);
console.log(notFound); // null

// New: Soft delete an entity using the instance delete() method
const entityToDelete = await Entity.findById('another-entity-uuid', env.DB);
if (entityToDelete) {
  await entityToDelete.delete(env.DB);
  console.log('Entity soft deleted via instance method.');
}
```

## Raw SQL Queries

For more complex operations, you can use raw SQL queries:

```typescript
// Execute a raw SQL query
const { results } = await Entity.raw(
  'SELECT * FROM entities WHERE count > 50 ORDER BY created_at DESC LIMIT 10',
  env.DB
);

console.log(results); // Array of raw database results
```

## TypeScript Support

Model-One is built with TypeScript and provides full type safety. To get the most out of it, define proper interfaces for your models:

```typescript
// Define your data interface
interface EntityDataI {
  id?: string;
  title?: string;
  count?: number;
  is_active?: boolean;
  metadata?: Record<string, any>;
  published_at?: Date;
  created_at?: Date;
  updated_at?: Date;
}

// Define your model interface
interface EntityI extends Model {
  data: EntityDataI;
}

// Implement your model class
class Entity extends Model implements EntityI {
  data: EntityDataI;

  constructor(props: EntityDataI = {}) {
    super(entitySchema);
    this.data = props || {};
  }
}
```

## Breaking Changes in v0.2.0

### Data Property Access

In v0.2.0, all entity properties must be accessed through the `data` property:

```typescript
// v0.1.x (no longer works)
const user = await User.findById(id, env.DB);
console.log(user.name); // Undefined

// v0.2.0 and above
const user = await User.findById(id, env.DB);
console.log(user.data.name); // Works correctly
```

### Model Initialization

Models now require proper initialization of the `data` property:

```typescript
// Correct initialization in v0.2.0
class User extends Model implements UserI {
  data: UserDataI;

  constructor(props: UserDataI = {}) {
    super(userSchema);
    this.data = props || {}; // Initialize with empty object if props is undefined
  }
}
```

1. Create a new database.

Create a local file schema.sql

```sql
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id text PRIMARY KEY,
  first_name text,
  last_name text,
  deleted_at datetime,
  created_at datetime,
  updated_at datetime
);
```
Creates a new D1 database and provides the binding and UUID that you will put in your wrangler.toml file. 
```sh
npx wrangler d1 create example-db
```

Create the tables from schema.sql

```sh
npx wrangler d1 execute example-db --file ./schema.sql
```

2. We need to import the Model and Schema from 'model-one' and the type SchemaConfigI. Then create a new Schema, define table name and fields 


```js
// ./models/User.ts
import { Model, Schema } from 'model-one'
import type { SchemaConfigI, Column } from 'model-one';

const userSchema: SchemaConfigI = new Schema({
  table_name: 'users',
  columns: [
    { name: 'id', type: 'string', constraints: [{ type: 'PRIMARY KEY' }] },
    { name: 'first_name', type: 'string' },
    { name: 'last_name', type: 'string' }
  ],
  timestamps: true, // Optional, defaults to true
  softDeletes: false // Optional, defaults to false
})

```

3. Then we are going to define the interfaces for our User model.

```js
// ./interfaces/index.ts
export interface UserDataI {
  id?: string
  first_name?: string
  last_name?: string
}

export interface UserI extends Model {
  data: UserDataI
}
```

4. Now we are going import the types and extend the User

```js
// ./models/User.ts
import { UserI, UserDataI } from '../interfaces'

export class User extends Model implements UserI {
  data: UserDataI

  constructor(props: UserDataI) {
    super(userSchema, props)
    this.data = props
  }
}

```

5. Final result of the User model

```js
// ./models/User.ts
import { Model, Schema } from 'model-one'
import type { SchemaConfigI } from 'model-one';
import { UserI, UserDataI } from '../interfaces'

const userSchema: SchemaConfigI = new Schema({
  table_name: 'users',
  columns: [
    { name: 'id', type: 'string' },
    { name: 'first_name', type: 'string' },
    { name: 'last_name', type: 'string' }
  ],
})

export class User extends Model implements UserI {
  data: UserDataI

  constructor(props: UserDataI) {
    super(userSchema, props)
    this.data = props
  }
}

```


6. After creating the User we are going to create the form that handles the validations. And with the help of Joi we are going to define the fields.

```js
// ./forms/UserForm.ts
import { Form } from 'model-one'
import { UserI } from '../interfaces'
import Joi from 'joi'

const schema = Joi.object({
  id: Joi.string(),
  first_name: Joi.string(),
  last_name: Joi.string(),
})

export class UserForm extends Form {
  constructor(data: UserI) {
    super(schema, data)
  }
}


```

## Column Types and Constraints

### Column Types

model-one supports the following column types that map to SQLite types:

```typescript
// JavaScript column types
type ColumnType = 
  | 'string'   // SQLite: TEXT
  | 'number'   // SQLite: INTEGER or REAL
  | 'boolean'  // SQLite: INTEGER (0/1)
  | 'jsonb'    // SQLite: TEXT (JSON stringified)
  | 'date';    // SQLite: TEXT (ISO format)

// SQLite native types
type SQLiteType = 
  | 'TEXT' 
  | 'INTEGER' 
  | 'REAL' 
  | 'NUMERIC' 
  | 'BLOB' 
  | 'JSON' 
  | 'BOOLEAN' 
  | 'TIMESTAMP' 
  | 'DATE';
```

Example usage:

```typescript
const columns = [
  { name: 'id', type: 'string', sqliteType: 'TEXT' },
  { name: 'name', type: 'string' },
  { name: 'age', type: 'number', sqliteType: 'INTEGER' },
  { name: 'active', type: 'boolean' },
  { name: 'metadata', type: 'jsonb' },
  { name: 'created', type: 'date' }
];
```

### Column Constraints

You can add constraints to your columns:

```typescript
type ConstraintType = 
  | 'PRIMARY KEY' 
  | 'NOT NULL' 
  | 'UNIQUE' 
  | 'CHECK' 
  | 'DEFAULT' 
  | 'FOREIGN KEY';

interface Constraint {
  type: ConstraintType;
  value?: string | number | boolean;
}
```

Example:

```typescript
const columns = [
  { 
    name: 'id', 
    type: 'string', 
    constraints: [{ type: 'PRIMARY KEY' }] 
  },
  { 
    name: 'email', 
    type: 'string', 
    constraints: [{ type: 'UNIQUE' }, { type: 'NOT NULL' }] 
  },
  { 
    name: 'status', 
    type: 'string', 
    constraints: [{ type: 'DEFAULT', value: 'active' }] 
  }
];
```

## Schema Configuration

You can configure your schema with additional options:

```typescript
const schema = new Schema({
  table_name: 'users',
  columns: [...],
  uniques: ['email', 'username'], // Composite unique constraints
  timestamps: true,  // Adds created_at and updated_at columns (default: true)
  softDeletes: true  // Enables soft delete functionality (default: false)
});
```

## Methods

### Create

To insert data we need to import the UserForm and we are going start a new User and insert it inside the UserForm, then we can call the method create.

```js
// ./controllers/UserController.ts
import { UserForm } from '../form/UserForm';
import { User } from '../models/User';

const userForm = new UserForm(new User({ first_name, last_name }))

await User.create(userForm, binding)

```

### Read

By importing the User model will have the following methods to query to D1:

```js
// ./controllers/UserController.ts
import { User } from '../models/User';

await User.all(binding)

await User.findById(id, binding)

await User.findOne(column, value, binding)

await User.findBy(column, value, binding)

```

### Update

Include the ID and the fields you want to update inside the data object.

```js
// ./controllers/UserController.ts

import { User } from '../models/User';

// User.update(data, binding)
await User.update({ id, first_name: 'John' }, binding)

```

### Delete

Delete a User

```js
// ./controllers/UserController.ts

import { User } from '../models/User';

await User.delete(id, binding)

```

### Raw SQL Queries

Execute raw SQL queries with the new raw method:

```js
// ./controllers/UserController.ts
import { User } from '../models/User';

const { success, results } = await User.raw(
  `SELECT * FROM users WHERE first_name LIKE '%John%'`, 
  binding
);

if (success) {
  console.log(results);
}
```

## Soft Delete

When enabled in your schema configuration, soft delete will set the `deleted_at` timestamp instead of removing the record:

```typescript
const userSchema = new Schema({
  table_name: 'users',
  columns: [...],
  softDeletes: true // Enable soft delete
});
```

When soft delete is enabled:
- `delete()` will update the `deleted_at` field instead of removing the record
- `all()`, `findById()`, `findOne()`, and `findBy()` will automatically filter out soft-deleted records
- You can still access soft-deleted records with raw SQL queries if needed

## Extend Methods

Extend User methods.

```js
// ./models/User.ts
import { Model, Schema, NotFoundError } from 'model-one'
import type { SchemaConfigI } from 'model-one';
import { UserI, UserDataI } from '../interfaces'

const userSchema: SchemaConfigI = new Schema({
  table_name: 'users',
  columns: [
    { name: 'id', type: 'string' },
    { name: 'first_name', type: 'string' },
    { name: 'last_name', type: 'string' }
  ],
})

export class User extends Model implements UserI {
  data: UserDataI

  constructor(props: UserDataI) {
    super(userSchema, props)
    this.data = props
  }

  static async findByFirstName(first_name: string, binding: any) {
    // this.findBy(column, value, binding)
    return await this.findBy('first_name', first_name, binding)
  }

  static async rawAll(binding: any) {
    const { results, success } = await binding.prepare(`SELECT * FROM ${userSchema.table_name};`).all()
    return Boolean(success) ? results : NotFoundError
  }
}

```

## To do:

- [x] Support JSONB
- [x] Enhanced column types and constraints
- [x] Soft and hard delete
- [x] Basic tests
- [ ] Associations: belongs_to, has_one, has_many
- [ ] Complex Forms for multiple Models

## Contributors
Julian Clatro

## License
MIT

[npm]: https://www.npmjs.com/

[yarn]: https://yarnpkg.com/
