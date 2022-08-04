# model-one

[![build status](https://img.shields.io/travis/com/hacksur/model-one.svg)](https://travis-ci.com/hacksur/model-one)
[![code coverage](https://img.shields.io/codecov/c/github/hacksur/model-one.svg)](https://codecov.io/gh/hacksur/model-one)
[![code style](https://img.shields.io/badge/code_style-XO-5ed9c7.svg)](https://github.com/sindresorhus/xo)
[![styled with prettier](https://img.shields.io/badge/styled_with-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![made with lass](https://img.shields.io/badge/made_with-lass-95CC28.svg)](https://lass.js.org)
[![license](https://img.shields.io/github/license/hacksur/model-one.svg)](LICENSE)
[![npm downloads](https://img.shields.io/npm/dt/model-one.svg)](https://npm.im/model-one)

> Model 1 is a set of utility classes for Cloudflare Workers D1 with validations by Joi.

## Table of Contents


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

First we need to import the Model an Schema from 'model-one' and the type for SchemaConfigI too.

We create a new Schema 


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

Then we are going to define the interfaces for our User model.

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

Now we are going import the types and extend the User

```js
import { UserI, UserDataI } from '../interfaces/models'

export class User extends Model implements UserI {
  data: UserDataI

  constructor(props: UserDataI) {
    super(userSchema, props)
    this.data = props
  }
}

```
After creating the User we are going to create the form that handles the validations. And with the help of Joi we are going to define the fields.

```js

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


Now our User model will have the following methods to query to D1:

```js
import { User } from '../models/User';

await User.delete(id, binding)

await User.all(binding)

await User.findById(id, binding)

await User.findOne(column, value, binding)

await User.findBy(column, value, binding)

```

For the actions that require to insert data we are need to import the UserForm and we are going to create a User and insert it in the UserForm and then we call the methods

```js
import { UserForm } from '../form/UserForm';
import { User } from '../models/User';

const userForm = new UserForm(new User({ id, first_name}))

await User.create(userForm, binding)

await User.update(userForm, binding)

```


## Contributors


## License


##

[npm]: https://www.npmjs.com/

[yarn]: https://yarnpkg.com/


export class User extends Model implements UserI {
  data: UserDataI

  constructor(props: UserDataI) {
    super(userSchema, props)
    this.data = props
  }
}

