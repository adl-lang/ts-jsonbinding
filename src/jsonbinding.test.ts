import { expect, test } from 'vitest'

import { JsonBinding } from "./jsonbinding";
import * as jb from './jsonbinding';

interface User {
  name: string,
  birthday: Date,
  phoneNumber?: string,
}

interface Job {
  title: string,
  level: number,
}

type UserOrJob
  = { kind: 'user', value: User }
  | { kind: 'job', value: Job }
  ;

const JB_USER: JsonBinding<User> = jb.object({
  name: jb.string(),
  birthday: jb.date(),
  phoneNumber: jb.orUndefined(jb.string()),
});

const JB_JOB: JsonBinding<Job> = jb.object({
  title: jb.string(),
  level: jb.withDefault(jb.number(), 1),
});

const JB_USER_OR_JOB: JsonBinding<UserOrJob> = jb.union([
  { kind: 'user', value: JB_USER },
  { kind: 'job', value: JB_JOB },
]);




test('primitives', () => {

  // Basic roundtripping of primitive types

  expect(roundTrip(jb.string(), "astring")).toEqual("astring");
  expect(roundTrip(jb.number(), 42)).toEqual(42);
  expect(roundTrip(jb.boolean(), true)).toEqual(true);
  expect(roundTrip(jb.boolean(), false)).toEqual(false);
  expect(roundTrip(jb.nullv(), null)).toEqual(null);
  expect(roundTrip(jb.json(), { 'a': 'b', 'c': 27 })).toStrictEqual({ 'a': 'b', 'c': 27 });
  {
    const now = new Date();
    expect(roundTrip(jb.date(), now)).toEqual(now);
  }
  expect(roundTrip(jb.bigint(), 42n)).toEqual(42n);
});


test('objects', () => {
  const u1: User = { name: 'Francis', phoneNumber: "951234", birthday: new Date("2000-01-01") };
  const u2: User = { name: 'Robin', birthday: new Date("2000-01-01"), phoneNumber: undefined };

  // Round tripping of simple objects

  expect(roundTrip(JB_USER, u1)).toStrictEqual(u1);
  expect(roundTrip(JB_USER, u2)).toStrictEqual(u2);

  // Errors for incorrect types, missing fields, or incorrect nested types

  expect(() => JB_USER.fromJson("xxxx")).toThrowError(
    /^expected an object at \$$/
  );
  expect(() => JB_USER.fromJson({ name: "Jem" })).toThrowError(
    /^expected an object with field birthday at \$$/
  );
  expect(() => JB_USER.fromJson({ name: "Jem", birthday: null })).toThrowError(
    /^expected a number at \$\.birthday$/
  );

  // Fields with defaults

  expect(JB_JOB.fromJson({ title: "engineer" })).toStrictEqual({ title: "engineer", level: 1 });
});


test('unions', () => {
  const uj1: UserOrJob = {
    kind: 'user',
    value: { name: 'Francis', phoneNumber: "951234", birthday: new Date("2000-01-01") },
  };

  const uj2: UserOrJob = {
    kind: 'job',
    value: { title: 'Mike', level: 1 },
  };

  // Round tripping of unions
  expect(roundTrip(JB_USER_OR_JOB, uj1)).toStrictEqual(uj1);
  expect(roundTrip(JB_USER_OR_JOB, uj2)).toStrictEqual(uj2);

  // Error for incorrect discriminator or incorrect nested types
  expect(() => JB_USER_OR_JOB.fromJson({ xxxx: null })).toThrowError(
    /^invalid union kind: xxxx at \$$/
  );

  expect(() => JB_USER_OR_JOB.fromJson({ job: { title: 'Sarah', level: "42" } })).toThrowError(
    /^expected a number at \$\.job\.level$/
  );
});

test('arrays', () => {
  const u1: User = { name: 'Francis', phoneNumber: "951234", birthday: new Date("2000-01-01") };
  const u2: User = { name: 'Robin', birthday: new Date("2000-01-01"), phoneNumber: undefined };

  const JB_USER_ARRAY = jb.array(JB_USER);
  const users = [u1, u2];

  // Round tripping of array of objects
  expect(roundTrip(JB_USER_ARRAY, [])).toStrictEqual([]);
  expect(roundTrip(JB_USER_ARRAY, users,)).toStrictEqual(users);

  // Errors for incorrect object and incorrect elements
  expect(() => JB_USER_ARRAY.fromJson(null)).toThrowError(
    /^expected an array at \$$/
  );
  expect(() => JB_USER_ARRAY.fromJson([{ x: 1 }])).toThrowError(
    /^expected an object with field name at \$\.\[0\]$/
  );
});

test('stringmaps', () => {
  const u1: User = { name: 'Francis', phoneNumber: "951234", birthday: new Date("2000-01-01") };
  const u2: User = { name: 'Robin', birthday: new Date("2000-01-01"), phoneNumber: undefined };

  const JB_USER_SMAP = jb.stringMap(JB_USER);
  const users = {
    u1, u2
  };

  // Round tripping of stringmap of objects
  expect(roundTrip(JB_USER_SMAP, {})).toStrictEqual({});
  expect(roundTrip(JB_USER_SMAP, users,)).toStrictEqual(users);

  // Errors for incorrect object and incorrect elements
  expect(() => JB_USER_SMAP.fromJson(null)).toThrowError(
    /^expected an object at \$$/
  );
  expect(() => JB_USER_SMAP.fromJson({ x: 1 })).toThrowError(
    /^expected an object at \$\.x$/
  );
});

test('pairs', () => {
  const JB_PAIR = jb.pair(jb.string(), jb.date());

  const p1: [string,Date] = ["sometime", new Date()];

  expect(roundTrip(JB_PAIR, p1)).toStrictEqual(p1);
});

test('maps', () => {
  const JB_MAP = jb.map(jb.string(), jb.date());

  const d1 = new Date();
  const d2 = new Date(d1.getTime() + 10000);
  const m = new Map<string,Date>();
  m.set("t1", d1);
  m.set("t2", d2);

  expect(roundTrip(JB_MAP, m)).toStrictEqual(m);
});

test('sets', () => {
  const JB_SET = jb.set(jb.number());

  const s = new Set<number>();
  s.add(7);
  s.add(37);
  s.add(19);

  expect(roundTrip(JB_SET, s)).toStrictEqual(s);
});


test('recursive types', () => {
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

  let c: Category = {
    name:"budget",
    subcategories: [
      {
        name: "cheap",
        subcategories: []
      }
    ]
  };

  expect(roundTrip(jbCategory(), c)).toStrictEqual(c);
    
});



function roundTrip<T>(jb: JsonBinding<T>, v: T): T {
  return jb.fromJson(jb.toJson(v))
}
