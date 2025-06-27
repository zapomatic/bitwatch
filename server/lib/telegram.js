import memory from "./memory.js";
import logger from "./logger.js";
import TelegramBot from "node-telegram-bot-api";

let bot = null;
let isConnected = false;
let reconnectionTimeout = null;
let healthCheckInterval = null;
let reconnectionAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_BACKOFF = 5000;

// Keep track of alerts we've already sent
const sentAlerts = new Map();

const cleanup = async () => {
  if (bot) {
    logger.info("Cleaning up Telegram bot instance");
    if (bot.isPolling()) {
      await bot.stopPolling();
    }
    bot = null;
  }
  if (reconnectionTimeout) clearTimeout(reconnectionTimeout);
  if (healthCheckInterval) clearInterval(healthCheckInterval);
  isConnected = false;
  reconnectionAttempts = 0;
  sentAlerts.clear();
  return true;
};

const reconnect = () => {
  if (reconnectionAttempts >= MAX_RECONNECT_ATTEMPTS) {
    logger.error("Max reconnection attempts reached. Giving up.");
    return;
  }
  reconnectionAttempts++;
  const delay = RECONNECT_BACKOFF * reconnectionAttempts;
  logger.info(`Attempting to reconnect in ${delay / 1000}s...`);
  if (reconnectionTimeout) clearTimeout(reconnectionTimeout);
  reconnectionTimeout = setTimeout(() => init(false), delay);
};

const healthCheck = async () => {
  if (!bot || !isConnected) {
    logger.warning("Health check failed: bot not connected. Attempting to reconnect.");
    reconnect();
    return;
  }

  try {
    await bot.getMe();
    // logger.info("Health check passed.");
  } catch (error) {
    logger.error(`Health check failed: ${error.message}`);
    isConnected = false;
    reconnect();
  }
};

const init = async (sendTestMessage = false) => {
  await cleanup();

  if (!memory.db.telegram?.token || !memory.db.telegram?.chatId) {
    logger.warning("Telegram not configured - missing token or chat ID");
    return { success: false, error: "Missing token or chat ID" };
  }

  logger.info(
    `Environment: ${
      process.env.NODE_ENV
    }, Bot exists: ${!!bot}, Token exists: ${!!memory.db.telegram.token}`
  );

  if (process.env.NODE_ENV === "test") {
    logger.info("Test mode: creating test bot instance");
    bot = {
      stopPolling: () => logger.info("Test bot: stopPolling called"),
      isPolling: () => true,
      startPolling: () => logger.info("Test bot: startPolling called"),
      onText: (_pattern, _callback) =>
        logger.info("Test bot: onText handler registered"),
      on: (_event, _callback) =>
        logger.info(`Test bot: ${_event} handler registered`),
      sendMessage: (_chatId, _message, _options) => Promise.resolve(true),
      getMe: () => Promise.resolve(true),
    };
    isConnected = true;
    reconnectionAttempts = 0;
    if (healthCheckInterval) clearInterval(healthCheckInterval);
    healthCheckInterval = setInterval(healthCheck, 30000);
    return { success: true };
  }

  const createBot = async () => {
    try {
      logger.info("Creating new Telegram bot instance");
      const newBot = new TelegramBot(memory.db.telegram.token, {
        polling: false,
      });

      await newBot.getMe();
      logger.info("Bot token validated successfully");
      await newBot.startPolling();
      isConnected = true;
      reconnectionAttempts = 0;
      if (healthCheckInterval) clearInterval(healthCheckInterval);
      healthCheckInterval = setInterval(healthCheck, 30000);
      return newBot;
    } catch (error) {
      logger.error(`Failed to create/validate Telegram bot: ${error.message}`);
      isConnected = false;
      return null;
    }
  };

  bot = await createBot();
  if (!bot) {
    reconnect();
    return { success: false, error: "Invalid Telegram token" };
  }

  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const message = `👋 Welcome to Bitwatch!\n\nYour chat ID is: <code>${chatId}</code>\n\nTo receive notifications:\n1. Copy this chat ID\n2. Paste it in the Bitwatch Telegram configuration\n3. Click Save to test the connection\n\nCurrent status: ${
      chatId === memory.db.telegram.chatId
        ? "✅ Configured"
        : "❌ Not configured"
    }`;
    await bot.sendMessage(chatId, message, { parse_mode: "HTML" });
  });

  bot.on("message", async (msg) => {
    if (msg.text.startsWith("/start")) return;
    const chatId = msg.chat.id;
    if (chatId !== memory.db.telegram.chatId) {
      await bot.sendMessage(
        chatId,
        "❌ This chat is not configured to receive notifications.\nUse /start to get your chat ID and configure it in Bitwatch.",
        { parse_mode: "HTML" }
      );
    }
  });

  bot.on("polling_error", (error) => {
    logger.error(`[polling_error] ${error.code} - ${error.message}`);
    isConnected = false;
    reconnect();
  });

  if (sendTestMessage) {
    const success = await sendMessage(
      "✅ Bitwatch Telegram notifications configured successfully!\n\nYou will receive notifications here when address balances change."
    );
    if (success) {
      logger.success("Telegram bot initialized and test message sent");
      return { success: true };
    } else {
      logger.error("Failed to send test message");
      await cleanup();
      return { success: false, error: "Failed to send test message" };
    }
  } else {
    logger.success("Telegram bot initialized");
    return { success: true };
  }
};

const sendMessage = async (message) => {
  if (!bot || !isConnected || !memory.db.telegram?.chatId) {
    logger.warning("sendMessage called but bot not ready.");
    return false;
  }

  try {
    const result = await bot.sendMessage(memory.db.telegram.chatId, message, {
      parse_mode: "HTML",
    });
    return !!result;
  } catch (error) {
    logger.error(`Failed to send Telegram message: ${error.message}`);
    if (error.code === 'ETELEGRAM' && error.response && error.response.body) {
      logger.error(`Telegram API error: ${error.response.body.description}`);
    }
    isConnected = false;
    reconnect();
    return false;
  }
};

const formatSats = (sats) => {
  if (!sats) return "0 sats";
  const numericSats = parseInt(sats.toString().replace(/[^0-9]/g, ""));
  if (isNaN(numericSats)) return "0 sats";
  return `${numericSats.toLocaleString()} sats`;
};

const getAlertKey = (collection, name, address, type, value) => {
  return `${collection}/${name}/${address}/${type}:${value}`;
};

const notifyBalanceChange = async (address, changes, collection, name) => {
  if (!bot || !isConnected || !memory.db.telegram?.chatId) {
    logger.warning(
      `Balance changed on ${collection}/${name} (${address}) but Telegram not configured - ${
        !bot ? "bot not initialized" : "not connected or missing chat ID"
      }`
    );
    return false;
  }

  const changeMessages = [];
  
  const processChange = (type, value) => {
    const key = getAlertKey(collection, name, address, type, value);
    if (!sentAlerts.has(key)) {
      let label = '';
      switch(type) {
        case 'chain_in': label = 'Chain In'; break;
        case 'chain_out': label = 'Chain Out'; break;
        case 'mempool_in': label = 'Mempool In'; break;
        case 'mempool_out': label = 'Mempool Out'; break;
      }
      changeMessages.push(`${label}: ${formatSats(value)}`);
      sentAlerts.set(key, true);
    }
  };

  if (typeof changes.chain_in === "number") processChange('chain_in', changes.chain_in);
  if (typeof changes.chain_out === "number") processChange('chain_out', changes.chain_out);
  if (typeof changes.mempool_in === "number") processChange('mempool_in', changes.mempool_in);
  if (typeof changes.mempool_out === "number") processChange('mempool_out', changes.mempool_out);

  if (changeMessages.length === 0) return true;

  const msg = changeMessages.join("\n");
  const message = `\n🔔 <b>Balance Change Detected</b>\n${collection}/${name} (<a href="https://mempool.space/address/${address}">${address}</a>)\n${msg}\n`;

  logger.telegram(
    `Telegram Alert Send: ${collection}/${name} (${address}), msg: ${msg}`
  );
  return await sendMessage(message);
};

export default {
  init,
  sendMessage,
  notifyBalanceChange,
  cleanup,
};