# Model 1

[![code style](https://img.shields.io/badge/code_style-XO-5ed9c7.svg)](https://github.com/sindresorhus/xo)
[![styled with prettier](https://img.shields.io/badge/styled_with-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![made with lass](https://img.shields.io/badge/made_with-lass-95CC28.svg)](https://lass.js.org)
[![license](https://img.shields.io/github/license/hacksur/model-one.svg)](LICENSE)
[![npm downloads](https://img.shields.io/npm/dt/model-one.svg)](https://npm.im/model-one)

Set of utility classes for Cloudflare Workers D1 with validations by Joi inspired by [reform](https://github.com/trailblazer/reform).

## Features

- Basic CRUD Model.
- UUID by default.
- Timestamps for created_at and updated_at.
- Validations by Joi.

## Table of Contents

1. Install
2. Example
3. Methods
4. Extend Methods

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

In the following example we are going to define an user with the following fields first_name and last_name.

First we need to import the Model and Schema from 'model-one' and the type for SchemaConfigI too.

1. We create a new Schema, define table name and fields 


```js
// ./models/User.ts
import { Model, Schema } from 'model-one'
import type { SchemaConfigI } from 'model-one';

const userSchema: SchemaConfigI = new Schema({
  table_name: 'users',
  columns: [
    'id',
    'first_name',
    'last_name',
  ],
})

```

2. Then we are going to define the interfaces for our User model.

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

3. Now we are going import the types and extend the User

```js
// ./models/User.ts
import { UserI, UserDataI } from '../interfaces/models'

export class User extends Model implements UserI {
  data: UserDataI

  constructor(props: UserDataI) {
    super(userSchema, props)
    this.data = props
  }
}

```

4. Final result:

```js
// ./models/User.ts
import { Model, Schema } from 'model-one'
import type { SchemaConfigI } from 'model-one';
import { UserI, UserDataI } from '../interfaces/models'

const userSchema: SchemaConfigI = new Schema({
  table_name: 'users',
  columns: [
    'id',
    'first_name',
    'last_name',
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


5. After creating the User we are going to create the form that handles the validations. And with the help of Joi we are going to define the fields.

```js
// ./forms/UserForm.ts
import { Form } from 'model-one'
import { UserI } from '../interfaces/models'
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

## Methods

### Read

Now our User model will have the following methods to query to D1:

```js
// ./controllers/UserController.ts
import { User } from '../models/User';

await User.all(binding)

await User.findById(id, binding)

await User.findOne(column, value, binding)

await User.findBy(column, value, binding)

```

### Write

For the actions that require to insert data we are need to import the UserForm and we are going to create a User and insert it in the UserForm and then we call the methods

```js
// ./controllers/UserController.ts
import { UserForm } from '../form/UserForm';
import { User } from '../models/User';

const userForm = new UserForm(new User({ id, first_name}))

await User.create(userForm, binding)

await User.update(userForm, binding)

```

### Delete

Delete an User

```js
// ./controllers/UserController.ts

import { User } from '../models/User';

await User.delete(id, binding)

```

## Extend Methods

Extend User methods.

```js
// ./models/User.ts
import { Model, Schema, NotFoundError } from 'model-one'
import type { SchemaConfigI } from 'model-one';
import { UserI, UserDataI } from '../interfaces/models'

const userSchema: SchemaConfigI = new Schema({
  table_name: 'users',
  columns: [
    'id',
    'first_name',
    'last_name',
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
    const user = await this.findBy('first_name', first_name, binding)
    return Boolean(user) ? user : NotFoundError;
  }
}

```

## Contributors
Julian Clatro

## License
MIT

##

[npm]: https://www.npmjs.com/

[yarn]: https://yarnpkg.com/

