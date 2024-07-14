import { expect, test } from 'vitest'

import { JB_BIGINT, JB_DATE, JB_JSON, JB_NULL, JB_NUMBER, JB_STRING, jbObject, jbOrUndefined, jbUnion, Json, JsonBinding, JsonParseException } from './index';

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

const JB_USER: JsonBinding<User> = jbObject({
  name: JB_STRING,
  birthday: JB_DATE,
  phoneNumber: jbOrUndefined(JB_STRING),
});

const JB_JOB: JsonBinding<Job> = jbObject({
  title: JB_STRING,
  level: JB_NUMBER,
});

const JB_USER_OR_JOB: JsonBinding<UserOrJob> = jbUnion([
  { kind: 'user', value: JB_USER },
  { kind: 'job', value: JB_JOB },
]);




test('primitives', () => {
  expect(roundTrip(JB_STRING, "astring")).toEqual("astring");
  expect(roundTrip(JB_NUMBER, 42)).toEqual(42);
  expect(roundTrip(JB_NULL, null)).toEqual(null);
  expect(roundTrip(JB_JSON, { 'a': 'b', 'c': 27 })).toStrictEqual({ 'a': 'b', 'c': 27 });
  {
    const now = new Date();
    expect(roundTrip(JB_DATE, now)).toEqual(now);
  }
  expect(roundTrip(JB_BIGINT, 42n)).toEqual(42n);
});


function roundTrip<T>(jb: JsonBinding<T>, v: T): T {
  return jb.fromJson(jb.toJson(v))
}
