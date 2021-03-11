import { mtrim } from "js-trim-multiline-string";

export const debug = (log) => {
  if (process.env.DEBUG) console.log(log);
};

export const trimlog = (log) => console.log(mtrim(`${log}`));
