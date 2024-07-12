import { JB_DATE, JB_NUMBER, JB_STRING, jbObject, jbOrUndefined, jbUnion, Json, JsonBinding, JsonParseException }  from './index';

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
  {kind: 'user', value: JB_USER},
  {kind: 'job', value: JB_JOB},
]);

