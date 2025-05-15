import enqueue from "../lib/queue/enqueue.js";
import logger from "../lib/logger.js";

export default async ({ data }) => {
  logger.info(
    `refreshBalance: ${data.collectionName}/${
      data.descriptorName || data.extendedKeyName || "root"
    }/${data.address}, testResponse ${data.testResponse}`
  );
  enqueue(data);
  return { success: true };
};
