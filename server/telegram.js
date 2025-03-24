import TelegramBot from "node-telegram-bot-api";
import memory from "./memory.js";
import logger from "./logger.js";

let bot = null;

const init = (sendTestMessage = false) => {
  // Clear existing bot instance if it exists
  if (bot) {
    bot = null;
  }

  if (!memory.db.telegram?.token || !memory.db.telegram?.chatId) {
    logger.warning("Telegram not configured - missing token or chat ID");
    return;
  }

  try {
    bot = new TelegramBot(memory.db.telegram.token, { polling: true });

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

      await bot.sendMessage(chatId, message, { parse_mode: "HTML" });
    });

    // Handle all other messages
    bot.on("message", async (msg) => {
      if (msg.text === "/start") return; // Already handled
      const chatId = msg.chat.id;
      if (chatId !== memory.db.telegram.chatId) {
        await bot.sendMessage(
          chatId,
          "❌ This chat is not configured to receive notifications.\nUse /start to get your chat ID and configure it in Bitwatch.",
          { parse_mode: "HTML" }
        );
      }
    });

    // Only send test message when saving configuration
    if (sendTestMessage) {
      sendMessage(
        "✅ Bitwatch Telegram notifications configured successfully!\n\nYou will receive notifications here when address balances change."
      )
        .then(() => {
          logger.success("Telegram bot initialized and test message sent");
        })
        .catch((error) => {
          logger.error("Failed to send test message: " + error.message);
          bot = null; // Reset bot if test message fails
        });
    } else {
      logger.success("Telegram bot initialized");
    }
  } catch (error) {
    logger.error("Failed to initialize Telegram bot: " + error.message);
    bot = null;
  }
};

const sendMessage = async (message) => {
  if (!bot || !memory.db.telegram?.chatId) return;

  try {
    await bot.sendMessage(memory.db.telegram.chatId, message, {
      parse_mode: "HTML",
    });
  } catch (error) {
    logger.error("Failed to send Telegram message: " + error.message);
  }
};

const notifyBalanceChange = async (address, changes, collection, name) => {
  if (!bot || !memory.db.telegram?.chatId) return;

  const changeMessages = [];
  if (changes.chain_in) changeMessages.push(`Chain In: ${changes.chain_in}`);
  if (changes.chain_out) changeMessages.push(`Chain Out: ${changes.chain_out}`);
  if (changes.mempool_in)
    changeMessages.push(`Mempool In: ${changes.mempool_in}`);
  if (changes.mempool_out)
    changeMessages.push(`Mempool Out: ${changes.mempool_out}`);

  if (changeMessages.length === 0) return;

  const message = `
🔔 <b>Balance Change Detected</b>
${collection}/${name} (<code>${address}</code>)
${changeMessages.join("\n")}
`;

  await sendMessage(message);
};

export default {
  init,
  sendMessage,
  notifyBalanceChange,
};
