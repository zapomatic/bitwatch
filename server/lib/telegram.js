import memory from "./memory.js";
import logger from "./logger.js";
import TelegramBot from "node-telegram-bot-api";

let bot = null;
// Keep track of alerts we've already sent
const sentAlerts = new Map();

const init = async (sendTestMessage = false) => {
  // Clear existing bot instance if it exists
  if (bot) {
    logger.info("Clearing existing bot instance");
    bot.stopPolling();
    bot = null;
  }

  if (!memory.db.telegram?.token || !memory.db.telegram?.chatId) {
    logger.warning("Telegram not configured - missing token or chat ID");
    return { success: false, error: "Missing token or chat ID" };
  }

  // Log environment and bot state
  logger.info(
    `Environment: ${
      process.env.NODE_ENV
    }, Bot exists: ${!!bot}, Token exists: ${!!memory.db.telegram.token}`
  );

  // In test mode, create a simple bot that just logs messages
  if (process.env.NODE_ENV === "test") {
    logger.info("Test mode: creating test bot instance");
    bot = {
      stopPolling: () => logger.info("Test bot: stopPolling called"),
      startPolling: () => logger.info("Test bot: startPolling called"),
      onText: (_pattern, _callback) =>
        logger.info("Test bot: onText handler registered"),
      on: (_event, _callback) =>
        logger.info(`Test bot: ${_event} handler registered`),
      sendMessage: (_chatId, _message, _options) => {
        // logger.info(`Test bot: sendMessage called`);
        return Promise.resolve(true);
      },
    };
    return { success: true };
  }

  // Create bot with error handling
  const createBot = async () => {
    try {
      logger.info("Creating new Telegram bot instance");
      const newBot = new TelegramBot(memory.db.telegram.token, {
        polling: false, // Don't start polling yet
      });

      // Test the token by making a simple API call
      return newBot
        .getMe()
        .then(() => {
          logger.info("Bot token validated successfully");
          // If getMe succeeds, start polling
          newBot.startPolling();
          return newBot;
        })
        .catch((error) => {
          logger.error(`Failed to validate Telegram token: ${error.message}`);
          return null;
        });
    } catch (error) {
      logger.error(`Failed to create Telegram bot: ${error.message}`);
      return null;
    }
  };

  bot = await createBot();
  if (!bot) return { success: false, error: "Invalid Telegram token" };

  // Handle /start command
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const message = `👋 Welcome to Bitwatch!

Your chat ID is: <code>${chatId}</code>

To receive notifications:
1. Copy this chat ID
2. Paste it in the Bitwatch Telegram configuration
3. Click Save to test the connection

Current status: ${
      chatId === memory.db.telegram.chatId
        ? "✅ Configured"
        : "❌ Not configured"
    }`;

    const result = await bot.sendMessage(chatId, message, {
      parse_mode: "HTML",
    });
    if (!result) {
      logger.error("Failed to send welcome message");
    }
  });

  // Handle all other messages
  bot.on("message", async (msg) => {
    if (msg.text === "/start") return; // Already handled
    const chatId = msg.chat.id;
    if (chatId !== memory.db.telegram.chatId) {
      const result = await bot.sendMessage(
        chatId,
        "❌ This chat is not configured to receive notifications.\nUse /start to get your chat ID and configure it in Bitwatch.",
        { parse_mode: "HTML" }
      );
      if (!result) {
        logger.error("Failed to send configuration message");
      }
    }
  });

  // Handle polling errors
  bot.on("polling_error", (error) => {
    logger.error(`[polling_error] ${JSON.stringify(error)}`);
    if (bot) {
      bot.stopPolling();
      bot = null;
    }
    return {
      success: false,
      error: "Telegram polling error: " + error.message,
    };
  });

  // Only send test message when saving configuration
  if (sendTestMessage) {
    return sendMessage(
      "✅ Bitwatch Telegram notifications configured successfully!\n\nYou will receive notifications here when address balances change."
    ).then((success) => {
      if (success) {
        logger.success("Telegram bot initialized and test message sent");
        return { success: true };
      } else {
        logger.error("Failed to send test message");
        if (bot) {
          bot.stopPolling();
          bot = null;
        }
        return { success: false, error: "Failed to send test message" };
      }
    });
  } else {
    logger.success("Telegram bot initialized");
    return { success: true };
  }
};

const sendMessage = async (message) => {
  if (!bot || !memory.db.telegram?.chatId) return false;

  const result = await bot.sendMessage(memory.db.telegram.chatId, message, {
    parse_mode: "HTML",
  });

  if (!result) {
    logger.error("Failed to send Telegram message");
    return false;
  }

  return true;
};

const formatSats = (sats) => {
  if (!sats) return "0 sats";
  // Remove any non-numeric characters and convert to number
  const numericSats = parseInt(sats.toString().replace(/[^0-9]/g, ""));
  if (isNaN(numericSats)) return "0 sats";
  // Format with commas for thousands
  return `${numericSats.toLocaleString()} sats`;
};

const getAlertKey = (collection, name, address, type, value) => {
  return `${collection}/${name}/${address}/${type}:${value}`;
};

const notifyBalanceChange = async (address, changes, collection, name) => {
  if (!bot || !memory.db.telegram?.chatId) {
    logger.warning(
      `Balance changed on ${collection}/${name} (${address}) but Telegram not configured - ${
        !bot ? "bot not initialized" : "missing token or chat ID"
      }`
    );
    return false;
  }

  const changeMessages = [];
  const newChanges = {};

  // Check each change type and only alert if we haven't sent this exact alert before
  if (typeof changes.chain_in === "number") {
    const key = getAlertKey(
      collection,
      name,
      address,
      "chain_in",
      changes.chain_in
    );
    if (!sentAlerts.has(key)) {
      changeMessages.push(`Chain In: ${formatSats(changes.chain_in)}`);
      newChanges.chain_in = changes.chain_in;
      sentAlerts.set(key, true);
    }
  }
  if (typeof changes.chain_out === "number") {
    const key = getAlertKey(
      collection,
      name,
      address,
      "chain_out",
      changes.chain_out
    );
    if (!sentAlerts.has(key)) {
      changeMessages.push(`Chain Out: ${formatSats(changes.chain_out)}`);
      newChanges.chain_out = changes.chain_out;
      sentAlerts.set(key, true);
    }
  }
  if (typeof changes.mempool_in === "number") {
    const key = getAlertKey(
      collection,
      name,
      address,
      "mempool_in",
      changes.mempool_in
    );
    if (!sentAlerts.has(key)) {
      changeMessages.push(`Mempool In: ${formatSats(changes.mempool_in)}`);
      newChanges.mempool_in = changes.mempool_in;
      sentAlerts.set(key, true);
    }
  }
  if (typeof changes.mempool_out === "number") {
    const key = getAlertKey(
      collection,
      name,
      address,
      "mempool_out",
      changes.mempool_out
    );
    if (!sentAlerts.has(key)) {
      changeMessages.push(`Mempool Out: ${formatSats(changes.mempool_out)}`);
      newChanges.chain_out = changes.mempool_out;
      sentAlerts.set(key, true);
    }
  }

  if (changeMessages.length === 0) return true;

  const msg = changeMessages.join("\n");

  const message = `
🔔 <b>Balance Change Detected</b>
${collection}/${name} (<a href="https://mempool.space/address/${address}">${address}</a>)
${msg}
`;

  logger.telegram(
    `Telegram Alert Send: ${collection}/${name} (${address}), msg: ${msg}`
  );
  return await sendMessage(message);
};

const cleanup = async () => {
  if (bot) {
    logger.info("Cleaning up Telegram bot instance");
    bot.stopPolling();
    bot = null;
  }
  // Clear the sent alerts map
  sentAlerts.clear();
  return true;
};

export default {
  init,
  sendMessage,
  notifyBalanceChange,
  cleanup,
};
