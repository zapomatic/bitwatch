import memory from "../memory.js";

export default async () => {
  return { telegram: memory.db.telegram || {} };
};
