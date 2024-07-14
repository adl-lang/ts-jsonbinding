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
  level: jb.number(),
});

const JB_USER_OR_JOB: JsonBinding<UserOrJob> = jb.union([
  { kind: 'user', value: JB_USER },
  { kind: 'job', value: JB_JOB },
]);




test('primitives', () => {
  expect(roundTrip(jb.string(), "astring")).toEqual("astring");
  expect(roundTrip(jb.number(), 42)).toEqual(42);
  expect(roundTrip(jb.nullv(), null)).toEqual(null);
  expect(roundTrip(jb.json(), { 'a': 'b', 'c': 27 })).toStrictEqual({ 'a': 'b', 'c': 27 });
  {
    const now = new Date();
    expect(roundTrip(jb.date(), now)).toEqual(now);
  }
  expect(roundTrip(jb.bigint(), 42n)).toEqual(42n);
});


function roundTrip<T>(jb: JsonBinding<T>, v: T): T {
  return jb.fromJson(jb.toJson(v))
}
