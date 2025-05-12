import memory from "../memory.js";
import logger from "../logger.js";
import telegram from "../telegram.js";

export const saveIntegrations = async ({ data }) => {
  // Allow empty telegram config
  if (!data?.telegram) {
    data.telegram = {};
  }

  logger.processing(`Saving integrations configuration`);

  // If we're clearing telegram config, clean up the bot first
  if (!data.telegram.token || !data.telegram.chatId) {
    logger.info("Clearing Telegram configuration");
    await telegram.cleanup();
  }

  memory.db.telegram = data.telegram;

  const saveResult = memory.saveDb();
  if (!saveResult) {
    logger.error("Failed to save integrations");
    return { error: "Failed to save integrations" };
  }

  // Only initialize telegram if we have both token and chatId
  if (data.telegram.token && data.telegram.chatId) {
    logger.info("Initializing Telegram with test message");
    const result = await telegram.init(true);
    logger.info("Telegram initialization result:", result);

    if (!result.success) {
      logger.error(`Telegram initialization failed: ${result.error}`);
      return { error: `Telegram initialization failed: ${result.error}` };
    }
    logger.success("Telegram initialized successfully");
  } else {
    logger.info("Telegram configuration cleared");
  }

  return { success: true };
};
