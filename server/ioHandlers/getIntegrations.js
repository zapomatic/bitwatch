import memory from "../memory.js";

export const getIntegrations = async () => {
  return { telegram: memory.db.telegram || {} };
};
