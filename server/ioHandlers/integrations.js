import memory from "../memory.js";
import logger from "../logger.js";
import telegram from "../telegram.js";

export const getIntegrations = async () => {
  return { telegram: memory.db.telegram || {} };
};

export const saveIntegrations = async (data) => {
  if (!data?.telegram) {
    logger.error("Missing telegram configuration");
    return { error: "Missing telegram configuration" };
  }

  logger.processing(`Saving integrations configuration`);
  memory.db.telegram = data.telegram;

  const saveResult = memory.saveDb();
  if (!saveResult) {
    logger.error("Failed to save integrations");
    return { error: "Failed to save integrations" };
  }

  // Initialize telegram and wait for test message
  logger.info("Initializing Telegram with test message");
  const result = await telegram.init(true);
  logger.info("Telegram initialization result:", result);

  if (!result.success) {
    logger.error(`Telegram initialization failed: ${result.error}`);
    return { error: `Telegram initialization failed: ${result.error}` };
  }

  logger.success("Telegram initialized successfully");
  return { success: true };
};
