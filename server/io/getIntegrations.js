import memory from "../lib/memory.js";

export default async () => {
  return { telegram: memory.db.telegram || {} };
};
