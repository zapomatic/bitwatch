import pjson from "../../package.json" with { type: "json" };
import memory from "../memory.js";
import logger from "../logger.js";

export const client = async (data) => {
  logger.info(`Client connected (ID: ${data.socketID})`);
  
  // Determine initial API state based on address data
  const hasActualData = Object.values(memory.db.collections).some(col => 
    col.addresses.some(addr => addr.actual !== null)
  );
  const hasErrors = Object.values(memory.db.collections).some(col => 
    col.addresses.some(addr => addr.error)
  );
  const hasLoading = Object.values(memory.db.collections).some(col => 
    col.addresses.some(addr => addr.actual === null && !addr.error)
  );

  let apiState = "?";
  if (hasErrors) {
    apiState = "ERROR";
  } else if (hasLoading) {
    apiState = "CHECKING";
  } else if (hasActualData) {
    apiState = "GOOD";
  }

  // Update memory state
  memory.state.apiState = apiState;

  return {
    version: pjson.version,
    collections: memory.db.collections,
    websocketState: memory.state.websocketState,
    apiState: memory.state.apiState,
    interval: memory.db.interval
  };
}; 