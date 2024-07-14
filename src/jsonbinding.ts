
export type Json = JsonPrimitive | JsonObject | JsonArray;
export type JsonPrimitive = string | number | boolean | null;
export type JsonArray = Json[];
export type JsonObject = { [key: string]: Json };

export interface JsonBinding<T> {
  // Convert an object of type T to Json
  toJson(t: T): Json;

  // Parse an object of type T from JSON. Throws a JsonParseException on failure
  fromJson(json: Json): T;
};

// Exceptions thrown during json parsing
// Simple context information is tracked so that the location of an error in the
// source json is captured.

export class JsonParseException {
  context: string[] = []
  constructor(readonly text: string) {
  }

  get message() {
    return this.text + ' at ' + this.createContextString();
  }

  pushField(fieldName: string): void {
    this.context.push(fieldName);
  }

  pushIndex(index: number): void {
    this.context.push('[' + index + ']');
  }

  createContextString(): string {
    const rcontext: string[] = this.context.slice(0);
    rcontext.push('$');
    rcontext.reverse();
    return rcontext.join('.');
  };

}

/**
 * Check if a javascript error is of the json parse exception type.
 * @param exception The exception to check.
 */
export function isJsonParseException(exception: unknown): exception is JsonParseException {
  return exception instanceof JsonParseException;
}


// Map a JsonException to an Error value
export function mapJsonException(exception: unknown): unknown {
  if (isJsonParseException(exception)) {
    return new Error(exception.message);
  } else {
    return exception;
  }
}

export function asJsonObject(jv: Json): JsonObject | undefined {
  if (jv instanceof Object && !(jv instanceof Array)) {
    return jv as JsonObject;
  }
  return undefined;
}

export function asJsonArray(jv: Json): JsonArray | undefined {
  if (jv instanceof Array) {
    return jv as JsonArray;
  }
  return undefined;
}


function identityJsonBinding<T>(expected: string, predicate: (json: Json) => boolean): JsonBinding<T> {

  function toJson(v: T): Json {
    return (v as unknown as Json);
  }

  function fromJson(json: Json): T {
    if (!predicate(json)) {
      throw new JsonParseException("expected " + expected);
    }
    return json as unknown as T;
  }

  return { toJson, fromJson };
}



// Given a JsonBinding for a value of type T, construct a JsonBinding
// for an array of T
export function array<T>(jbt: JsonBinding<T>): JsonBinding<T[]> {
  function toJson(v: T[]): Json {
    return v.map(jbt.toJson);
  }

  function fromJson(json: Json): T[] {
    const jarr = asJsonArray(json);
    if (jarr == undefined) {
      throw new JsonParseException('expected an array');
    }
    let result: T[] = [];
    jarr.forEach((eljson: Json, i: number) => {
      try {
        result.push(jbt.fromJson(eljson));
      } catch (e) {
        if (isJsonParseException(e)) {
          e.pushIndex(i);
        }
        throw e;
      }
    });
    return result;
  }

  return { toJson, fromJson };
}

export type StringMap<T> = { [key: string]: T };

// Given a JsonBinding for a value of type T, construct a JsonBinding
// for an string indexed map of T values
export function stringMap<T>(jbt: JsonBinding<T>): JsonBinding<StringMap<T>> {

  function toJson(v: StringMap<T>): Json {
    const result: JsonObject = {};
    for (let k in v) {
      result[k] = jbt.toJson(v[k]);
    }
    return result;
  }

  function fromJson(json: Json): StringMap<T> {
    const jobj = asJsonObject(json);
    if (!jobj) {
      throw new JsonParseException('expected an object');
    }
    let result: Record<string, T> = {};
    for (let k in jobj) {
      try {
        result[k] = jbt.fromJson(jobj[k]);
      } catch (e) {
        if (isJsonParseException(e)) {
          e.pushField(k);
        }
        throw e;
      }
    }
    return result;
  }

  return { toJson, fromJson };
}

export type JsonBindingFields<T> = {
  [Property in keyof T]: JsonBinding<T[Property]>
}


// Construct a JsonBinding for an object from a JSON Binding for each
// of its fields. eg
//
// interface Person {
//    name: string,
//    birthday: Date,
// };
//
// const JB_PERSON: JsonBindng0<Person> = jbObject({
//    name: JB_STRING,
//    birthday: JB_DATE,
// };

export function object<T extends {}>(jbfields: JsonBindingFields<T>): JsonBinding<T> {

  function toJson(v: T): Json {
    const vu = v as { [key: string]: unknown };
    const jbfieldsu = jbfields as { [key: string]: JsonBinding<unknown> };

    const json: { [key: string]: Json } = {};
    for (const key of Object.keys(jbfields)) {
      json[key] = jbfieldsu[key].toJson(vu[key]);
    }
    return json;
  }

  function fromJson(jv: Json): T {
    const jvu = asJsonObject(jv);
    if (!jvu) {
      throw new JsonParseException('expected an object');
    }
    const jbfieldsu = jbfields as { [key: string]: JsonBinding<unknown> };
    const result: { [key: string]: unknown } = {};
    for (const key of Object.keys(jbfields)) {
      try {
        const v = jbfieldsu[key].fromJson(jvu[key]);
        result[key] = v;
      } catch (e) {
        if (isJsonParseException(e)) {
          e.pushField(key);
        }
        throw e;
      }
    }
    return result as T;
  }

  return { toJson, fromJson }
}



export function orNull<T>(jbt: JsonBinding<T>): JsonBinding<T | null> {
  function toJson(v: T | null): Json {
    if (v === null) {
      return null;
    }
    return jbt.toJson(v);
  }

  function fromJson(json: Json): T | null {
    if (json === null) {
      return null;
    }
    return jbt.fromJson(json);
  }

  return { toJson, fromJson };
}

// Construct a JsonBinding for optional values, where undefined is serialized as null
export function orUndefined<T>(jbt: JsonBinding<T>): JsonBinding<T | undefined> {
  function toJson(v: T | undefined): Json {
    if (v === undefined) {
      return null;
    }
    return jbt.toJson(v);
  }

  function fromJson(json: Json): T | undefined {
    if (json === null) {
      return undefined;
    }
    return jbt.fromJson(json);
  }

  return { toJson, fromJson };
}

// Construct a JsonBinding for type A given a JsonBinding for some other type B and functions
// to map values of A <-> values of B. fnAB should not throw exceptions. fnBA may throw JsonParseExceptions.
//
export function mapped<A, B>(jbb: JsonBinding<B>, fnAB: (a: A) => B, fnBA: (b: B) => A): JsonBinding<A> {
  function toJson(v: A): Json {
    return jbb.toJson(fnAB(v));
  }

  function fromJson(json: Json): A {
    return fnBA(jbb.fromJson(json));
  }

  return { toJson, fromJson };
}

export function string(): JsonBinding<string> {
  return identityJsonBinding("a string", (v) => typeof (v) === 'string');
}
export function number(): JsonBinding<number> {
  return identityJsonBinding("a number", (v) => typeof (v) === 'number');
}
export function nullv(): JsonBinding<null> {
  return identityJsonBinding("a null", (v) => v === null);
}
export function json(): JsonBinding<Json> {
  return identityJsonBinding("a json value", (_v) => true);
}

// A JsonBinding that serializes a javscript Date as the number of milliseconds past the epoch
export function date(): JsonBinding<Date> {
  return mapped(number(), d => d.getTime(), n => new Date(n));
}

// A JsonBinding that serializes a javascript bigint as a string;
export function bigint(): JsonBinding<bigint> {
  return mapped(string(), bi => bi.toString(), s => {
    try {
      return BigInt(s);
    } catch (e) {
      if (e instanceof SyntaxError) {
        throw new JsonParseException('expected a string containing a bigint');
      } else {
        throw e;
      }
    }
  });
}

export type TypedUnionValue<K extends string, T> = { kind: K, value: T };

export type UnionBranch<K extends string, T> = TypedUnionValue<K, JsonBinding<T>>

export function union<
  K1 extends string, T1,
>(jbs: [
  UnionBranch<K1, T1>
]): JsonBinding<
  TypedUnionValue<K1, T1>
>

export function union<
  K1 extends string, T1,
  K2 extends string, T2,
>(jbs: [
  UnionBranch<K1, T1>,
  UnionBranch<K2, T2>,
]): JsonBinding<
  TypedUnionValue<K1, T1>
  | TypedUnionValue<K2, T2>
>

export function union<
  K1 extends string, T1,
  K2 extends string, T2,
  K3 extends string, T3,
>(jbs: [
  UnionBranch<K1, T1>,
  UnionBranch<K2, T2>,
  UnionBranch<K3, T3>,
]): JsonBinding<
  TypedUnionValue<K1, T1>
  | TypedUnionValue<K2, T2>
  | TypedUnionValue<K3, T3>
>

export function union<
  K1 extends string, T1,
  K2 extends string, T2,
  K3 extends string, T3,
  K4 extends string, T4,
>(jbs: [
  UnionBranch<K1, T1>,
  UnionBranch<K2, T2>,
  UnionBranch<K3, T3>,
  UnionBranch<K4, T4>,
]): JsonBinding<
  TypedUnionValue<K1, T1>
  | TypedUnionValue<K2, T2>
  | TypedUnionValue<K3, T3>
  | TypedUnionValue<K4, T4>
>

export function union<
  K1 extends string, T1,
  K2 extends string, T2,
  K3 extends string, T3,
  K4 extends string, T4,
  K5 extends string, T5,
>(jbs: [
  UnionBranch<K1, T1>,
  UnionBranch<K2, T2>,
  UnionBranch<K3, T3>,
  UnionBranch<K4, T4>,
  UnionBranch<K5, T5>,
]): JsonBinding<
  TypedUnionValue<K1, T1>
  | TypedUnionValue<K2, T2>
  | TypedUnionValue<K3, T3>
  | TypedUnionValue<K4, T4>
  | TypedUnionValue<K5, T5>
>

export function union(ubs: UnionBranch<string, unknown>[]): JsonBinding<{ kind: string, value: unknown }> {
  function toJson(v: { kind: string, value: unknown }): Json {
    for (const ub of ubs) {
      if (v.kind === ub.kind) {
        return { [ub.kind]: ub.value.toJson(v.value) };
      }
    }
    throw new Error("BUG: invalid kind passed to union toJson");
  }

  function fromJson(json: Json): { kind: string, value: unknown } {
    const o = asJsonObject(json);
    if (o) {
      const keys = Object.keys(o);
      if (keys.length === 1) {
        const kind = keys[0];
        for (const ub of ubs) {
          if (kind === ub.kind) {
            return { kind, value: ub.value.fromJson(o[kind]) };
          }
        }
        throw new JsonParseException(`invalid union kind: ${kind}`);
      }
    }
    throw new JsonParseException("expected a union value as a single keyed object");
  }

  return { toJson, fromJson };
}
