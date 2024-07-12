import { JB_DATE, JB_NUMBER, JB_STRING, JB_UNION_VALUE, jbObject, Json, JsonBinding, JsonParseException }  from './index';

interface User {
  name: string,
  birthday: Date,
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
});

const JB_JOB: JsonBinding<Job> = jbObject({
  title: JB_STRING,
  level: JB_NUMBER,
});


const JB_USER_OR_JOB: JsonBinding<UserOrJob> = {
  toJson: (v: UserOrJob) => {
    switch (v.kind) {
      case 'user': return JB_UNION_VALUE.toJson({ kind: v.kind, value: JB_USER.toJson(v.value) });
      case 'job': return JB_UNION_VALUE.toJson({ kind: v.kind, value: JB_JOB.toJson(v.value) });
    }
  },

  fromJson: (json: Json) => {
    const uv = JB_UNION_VALUE.fromJson(json);
    switch (uv.kind) {
      case 'user': return { kind: uv.kind, value: JB_USER.fromJson(uv.value) };
      case 'job': return { kind: uv.kind, value: JB_JOB.fromJson(uv.value) };
      default:
        throw new JsonParseException(`unxpected union kind ${uv.kind}`)
    }
  },
}

