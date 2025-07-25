# A typescript library for JSON serialization

Key features:
* bidirectional (ie serialization and deserialization)
* handles builtin types like `bigint`, `Date`, `Map<K,V>` and `Set<T>`
* extensible
* errors that describe the location of parse failures
* support for unions, generics and custom types
* typescript implementation

Here's a brief [comparison with zod](#comparisons).

## Overview

The core of the library is the type:

```
interface JsonBinding<T> {
  toJson(t: T): Json;
  fromJson(json: Json): T;
};
```

A `JsonBinding` of type `T` captures the ability to serialize
a value of type `T` to JSON, and to deserialize a value of
type `T` from JSON. `JsonBinding`s can be easily constructed
via library functions. For example

```
import { JsonBinding } from "@adllang/jsonbinding";
import * as jb from '@adllang/jsonbinding';

interface User {
  name: string,
  birthday: Date,
}

const JB_USER: JsonBinding<User> = jb.object({
  name: jb.string(),
  birthday: jb.date(),
});
````

Then usage is:

```
> JB_USER.toJson({name: "Robin", birthday:new Date()})
{"birthday": 1720998670768, "name": "Robin"}
> JB_USER.fromJson({"birthday": 1720998670768, "name": "Robin"})
{ "birthday": 2024-07-14T23:11:10.768Z, "name": "Robin"}
> JB_USER.fromJson({"name": "Robin"})
UncaughtError: expected an object with field birthday at $
```

## Inference

In the previous example, I like having the `User` interface explicit
in the code. But you can infer it from the JsonBinding, in the
style of [zod](https://github.com/colinhacks/zod):


```
import { JsonBinding } from "@adllang/jsonbinding";
import * as jb from '@adllang/jsonbinding';

const JB_USER = jb.object({
  name: jb.string(),
  birthday: jb.date(),
});

type User = jb.Infer<typeof JB_USER>;
````

## Primitives

The following primitives are provided:

```
function string(): JsonBinding<string>;
function number(): JsonBinding<number>;
function boolean(): JsonBinding<boolean>;
function nullv(): JsonBinding<null>;
function json(): JsonBinding<Json>;
function date(): JsonBinding<Date>;     # serialized as number of ms after unix epoch
function bigint(): JsonBinding<bigint>; # serialized as a string to maintain precision
```

Technically, `date()` and `bigint()` are implemented as mapped bindings (see below)


## Objects

The libraries `object()` functions builds JSON bindings for typescript objects and interfaces. A simple example:

```
interface User {
  name: string,
  birthday: Date,
  roles: string[],
}

const JB_USER: JsonBinding<User> = jb.object({
  name: jb.string(),
  birthday: jb.date(),
  roles: jb.array(jb.string()),
});
```

Default values for fields can also be specified, and these will be used when deserialising json streams that lack
these fields. Hence, in this example:

```
interface User {
  name: string,
  roles: string[],
}

const JB_ROLE_ARRAY = jb.array(jb.string());

const JB_USER: JsonBinding<User> = jb.object({
  name: jb.string(),
  roles: jb.withDefault(JB_ROLE_ARRAY, []),
});
```

the roles field need not be present for successful deserialization:

```
> const u = JB_USER.fromJson({name:"Fred"});
> u.name
'Fred'
> u.roles
[]
```

## Discriminated Unions

The library has support for discriminated unions, using the `union()` function.

```
interface Rectangle {
  width: number,
  height: number
};

interface Circle {
  radius: number;
};

type Shape
  = {kind: 'rectangle', value: Rectangle}
  | {kind: 'circle', value: Circle};


const JB_RECTANGLE = jb.object({
  width: jb.number(),
  height: jb.number(),
});

const JB_CIRCLE = jb.object({
  radius : jb.number(),
});

const JB_SHAPE: JsonBinding<Shape> = jb.union([
  {kind: 'rectangle', value: JB_RECTANGLE},
  {kind: 'circle', value: JB_CIRCLE},
]);
```

## String enums

```
const JB_FOOBAR: JsonBinding<'foo' | 'bar'> = jb.enum([
  'foo',
  'bar',
]);
```

## Maps, Sets and Pairs

are supported via the following functions:

```
function map<K, V>(jbk: JsonBinding<K>, jbv: JsonBinding<V>): JsonBinding<Map<K, V>>
function set<T>(jbt: JsonBinding<T>): JsonBinding<Set<T>>
function pair<A, B>(jba: JsonBinding<A>, jbb: JsonBinding<B>): JsonBinding<[A, B]>
```

## Mapped types

Mapped types in this library support conversions on serialization and deserialization. One constructs a `JsonBinding` for
a mapped type by providing a `JsonBinding` for the underlying type, and a pair of conversion functions to convert the
underlying type from/to the mapped type.

The serialisation of typescript `Date` objects is an example of this. We want the in memory presentation to be a `Date`
object, but we wish to serialize it as the number of milliseconds since the epoch. This is written as:


```
const JB_DATE: JsonBinding<Date> = jb.mapped(
  jb.number(),                                  // serialize as a number
  d => d.getTime(),                             // convert a Date to a number
  n => new Date(n),                             // convert a number to a Date
);
```

Mapped types can also be used to create JsonBindings for typescript classes. For example

```
class Point2D {
  constructor(readonly x: number, readonly y: number) {
  }

  add(offset: Point2D): Point2D {
    return new Point2D(this.x + offset.x, this.y + offset.y);
  }
}

const JB_POINT_2D: JsonBinding<Point2D> = jb.mapped(
  jb.object({x: jb.number(), y: jb.number()}),
  p => p,
  p => new Point2D(p.x, p.y)
);
```


## Generic types

A `JsonBinding` for a generic type can be constructed by writing a function to build the `JsonBinding` that takes as parameters the `JsonBinding`s of
the generic type parameters. Referencing the Point2D example:

```
interface Path<P> {
  points: P[]
};
  
function jbPath<P>(jbPoint: JsonBinding<P>): JsonBinding<Path<P>> {
  return jb.object({
    points: jb.array(jbPoint),
  });
}

const JB_PATH_2D: JsonBinding<Path<Point2D>> = jbPath(JB_POINT_2D);
```

## Recursive types

A `lazy()` combinator is available to facilitate creating `JsonBinding`s for recursive
types.

```
interface Category {
  name: string,
  subcategories: Category[]
}

function jbCategory(): JsonBinding<Category> {
  return jb.object({
    name: jb.string(),
    subcategories: jb.array(jb.lazy(() => jbCategory())),
  });
}
```

## Other helpers

The library includes `JsonBinding` helpers

for string keyed maps:

```
export type StringMap<T> = { [key: string]: T };

export function stringMap<T>(jbt: JsonBinding<T>): JsonBinding<StringMap<T>>;
```

for values that may be null or some other type:

```
export function orNull<T>(jbt: JsonBinding<T>): JsonBinding<T | null>;
```

for values that may be undefined or some other type:

```
export function orUndefined<T>(jbt: JsonBinding<T>): JsonBinding<T | undefined> {
```

# Comparisons

## Zod

[Zod](https://zod.dev/) deserves credit for introducing robust typescript defined
schema validations. It's widespread use reflects it's value. The `ts-jsonbinding`
library was built primarily to address the following key limitation of Zod:

**zod is validation/deserialization only**. It can take accept external input, validate it, and
then map it to internal typescript types. But it has no direct support for the opposite
serialization path. As a concrete example zod has no equivalent for the `JB_USER.toJson` method
[here](#overview)

For my needs writing data to JSON (ie serialisation) is just as important as validation
and parsing (ie deserialization). `JSON.stringify()` only does the right thing for a
small fraction of possible data types, and various other libraries try and help
with this (eg [superjson](https://github.com/flightcontrolhq/superjson)). 

`ts-jsonbinding` is a single library to deal with both serialization and deserialization
needs, with complete flexibility of the mapping between runtime values and their
representation in JSON.


# Development

Build and test:

```
deno test
```

Publish to JSR:

```
deno publish
```

Publish to NPM:

```
deno task build_npm
cd npm
npm login
npm publish
```

