# Model 1

[![code style](https://img.shields.io/badge/code_style-XO-5ed9c7.svg)](https://github.com/sindresorhus/xo)
[![styled with prettier](https://img.shields.io/badge/styled_with-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![made with lass](https://img.shields.io/badge/made_with-lass-95CC28.svg)](https://lass.js.org)
[![license](https://img.shields.io/github/license/hacksur/model-one.svg)](LICENSE)
[![npm downloads](https://img.shields.io/npm/dt/model-one.svg)](https://npm.im/model-one)

Set of utility classes for Cloudflare Workers D1 with validations by Joi inspired by [reform](https://github.com/trailblazer/reform).

Note: This package is still considered experimental. Breaking changes should be expected.

## Features

- Basic CRUD Model with PostgreSQL-like interface
- Enhanced column types and constraints
- UUID by default
- Support for SQLite data types with JavaScript type mapping
- Timestamps for created_at and updated_at
- Soft delete functionality
- Data serialization and deserialization
- Validations by Joi
- Raw SQL queries

## Table of Contents

1. Install
2. Example
3. Column Types and Constraints
4. Schema Configuration
5. Methods
6. Soft Delete
7. Extend Methods

## Install

[npm][]:

```sh
npm install model-one joi
```

[yarn][]:

```sh
yarn add model-one joi
```

## Example

In the following example we are going to define a user with the following fields: first_name and last_name.

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
import type { SchemaConfigI, Column } from 'model-one';
import { UserI, UserDataI } from '../interfaces'

const userSchema: SchemaConfigI = new Schema({
  table_name: 'users',
  columns: [
    { name: 'id', type: 'string', constraints: [{ type: 'PRIMARY KEY' }] },
    { name: 'first_name', type: 'string' },
    { name: 'last_name', type: 'string' }
  ],
  timestamps: true,
  softDeletes: false
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
