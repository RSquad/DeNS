const convert = (from, to) => (str) => Buffer.from(str, from).toString(to);

export const utf8ToHex = convert("utf8", "hex");

export const genRandonHex = (size) =>
  [...Array(size)]
    .map(() => Math.floor(Math.random() * 16).toString(16))
    .join("");
