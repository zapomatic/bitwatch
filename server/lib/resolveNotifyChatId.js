import memory from "./memory.js";

// Resolve the Telegram chat ID that should receive a notification for a given
// address, using the override cascade (most specific wins):
//
//   address.notify.chatId
//     ?? parentItem(extendedKey/descriptor).notify.chatId
//     ?? collection.notify.chatId
//     ?? global db.telegram.chatId
//
// An empty/missing chatId at any level falls through to the next, so a blank
// override simply means "use the inherited default".
const resolveNotifyChatId = ({ addr, parentItem, collectionName }) => {
  const collection = memory.db.collections?.[collectionName];
  return (
    addr?.notify?.chatId ||
    parentItem?.notify?.chatId ||
    collection?.notify?.chatId ||
    memory.db.telegram?.chatId ||
    null
  );
};

export default resolveNotifyChatId;
