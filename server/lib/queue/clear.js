import memory from "../memory.js";
import logger from "../logger.js";
import emitState from "../emitState.js";
import queue from "./index.js";

export default () => {
  queue.items = [];
  logger.info("Balance queue cleared");
  emitState({
    collections: memory.db.collections,
    queue,
  });
};
