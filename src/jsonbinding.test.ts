import { assertEquals, assertStrictEquals, fail } from "jsr:@std/assert";

import { JsonBinding, JsonParseException } from "./jsonbinding.ts";
import * as jb from './jsonbinding.ts';

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

const JB_USER_2 = jb.object({
  name: jb.string(),
  birthday: jb.date(),
  phoneNumber: jb.orUndefined(jb.string()),
});

type InferredUser = jb.Infer<typeof JB_USER_2>;

Deno.test('primitives', () => {

  // Basic roundtripping of primitive types

  assertEquals(roundTrip(jb.string(), "astring"), "astring");
  assertEquals(roundTrip(jb.number(), 42), 42);
  assertEquals(roundTrip(jb.boolean(), true), true);
  assertEquals(roundTrip(jb.boolean(), false), false);
  assertEquals(roundTrip(jb.nullv(), null), null);
  assertEquals(roundTrip(jb.json(), { 'a': 'b', 'c': 27 }), { 'a': 'b', 'c': 27 });
  {
    const now = new Date();
    assertEquals(roundTrip(jb.date(), now).getTime(), now.getTime());
  }
  assertStrictEquals(roundTrip(jb.bigint(), 42n), 42n);
});


Deno.test('objects', () => {
  const u1: User = { name: 'Francis', phoneNumber: "951234", birthday: new Date("2000-01-01") };
  const u2: User = { name: 'Robin', birthday: new Date("2000-01-01"), phoneNumber: undefined };

  // Round tripping of simple objects

  assertEquals(roundTrip(JB_USER, u1), u1);
  assertEquals(roundTrip(JB_USER, u2), u2);

  // Errors for incorrect types, missing fields, or incorrect nested types

  assertThrowsJsonParseException(
    () => JB_USER.fromJson("xxxx"),
    "expected an object at $"
  );
  assertThrowsJsonParseException(
    () => JB_USER.fromJson({ name: "Jem" }),
    "expected an object with field birthday at $"
  );
  assertThrowsJsonParseException(
    () => JB_USER.fromJson({ name: "Jem", birthday: null }),
    "expected a number at $.birthday"
  );

  // Fields with defaults

  assertEquals(JB_JOB.fromJson({ title: "engineer" }), { title: "engineer", level: 1 });
});


Deno.test('unions', () => {
  const uj1: UserOrJob = {
    kind: 'user',
    value: { name: 'Francis', phoneNumber: "951234", birthday: new Date("2000-01-01") },
  };

  const uj2: UserOrJob = {
    kind: 'job',
    value: { title: 'Mike', level: 1 },
  };

  // Round tripping of unions
  assertEquals(roundTrip(JB_USER_OR_JOB, uj1), uj1);
  assertEquals(roundTrip(JB_USER_OR_JOB, uj2), uj2);

  // Error for incorrect discriminator or incorrect nested types
  assertThrowsJsonParseException(
    () => JB_USER_OR_JOB.fromJson({ xxxx: null }),
    "invalid union kind: xxxx at $"
  );

  assertThrowsJsonParseException(
    () => JB_USER_OR_JOB.fromJson({ job: { title: 'Sarah', level: "42" } }),
    "expected a number at $.job.level"
  );
});

Deno.test('arrays', () => {
  const u1: User = { name: 'Francis', phoneNumber: "951234", birthday: new Date("2000-01-01") };
  const u2: User = { name: 'Robin', birthday: new Date("2000-01-01"), phoneNumber: undefined };

  const JB_USER_ARRAY = jb.array(JB_USER);
  const users = [u1, u2];

  // Round tripping of array of objects
  assertEquals(roundTrip(JB_USER_ARRAY, []), []);
  assertEquals(roundTrip(JB_USER_ARRAY, users,), users);

  // Errors for incorrect object and incorrect elements
  assertThrowsJsonParseException(
    () => JB_USER_ARRAY.fromJson(null),
    "expected an array at $"
  );
  assertThrowsJsonParseException(
    () => JB_USER_ARRAY.fromJson([{ x: 1 }]),
    "expected an object with field name at $.[0]"
  );
});

Deno.test('stringmaps', () => {
  const u1: User = { name: 'Francis', phoneNumber: "951234", birthday: new Date("2000-01-01") };
  const u2: User = { name: 'Robin', birthday: new Date("2000-01-01"), phoneNumber: undefined };

  const JB_USER_SMAP = jb.stringMap(JB_USER);
  const users = {
    u1, u2
  };

  // Round tripping of stringmap of objects
  assertEquals(roundTrip(JB_USER_SMAP, {}), {});
  assertEquals(roundTrip(JB_USER_SMAP, users,), users);

  // Errors for incorrect object and incorrect elements
  assertThrowsJsonParseException(
    () => JB_USER_SMAP.fromJson(null),
    "expected an object at $"
  );
  assertThrowsJsonParseException(
    () => JB_USER_SMAP.fromJson({ x: 1 }),
    "expected an object at $.x"
  );
});

Deno.test('pairs', () => {
  const JB_PAIR = jb.pair(jb.string(), jb.date());

  const p1: [string,Date] = ["sometime", new Date()];

  assertEquals(roundTrip(JB_PAIR, p1), p1);
});

Deno.test('maps', () => { 
  const JB_MAP = jb.map(jb.string(), jb.date());

  const d1 = new Date();
  const d2 = new Date(d1.getTime() + 10000);
  const m = new Map<string,Date>();
  m.set("t1", d1);
  m.set("t2", d2);

  assertEquals(roundTrip(JB_MAP, m), m);
});

Deno.test('sets', () => {
  const JB_SET = jb.set(jb.number());

  const s = new Set<number>();
  s.add(7);
  s.add(37);
  s.add(19);

   assertEquals(roundTrip(JB_SET, s).values(), s.values());
});


Deno.test('recursive types', () => {
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

  const c: Category = {
    name:"budget",
    subcategories: [
      {
        name: "cheap",
        subcategories: []
      }
    ]
  };

  assertEquals(roundTrip(jbCategory(), c), c);
    
});



function roundTrip<T>(jb: JsonBinding<T>, v: T): T {
  return jb.fromJson(jb.toJson(v))
}

export function assertThrowsJsonParseException(
  thunk: () => unknown,
  expectedMessage: string,
) {
  try {
    thunk();
    fail("exception expected, but didn't occur");
  } catch (e: unknown) {
    if (!(e instanceof JsonParseException)) {
      fail("expected a JsonParseException to be thrown");
    }
    const message = (e as JsonParseException).message;
    if (message !== expectedMessage) {
      fail(`expected JsonParseException with message "${expectedMessage}", actual message was "${message}"`);
    }
  }
}

