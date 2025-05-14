import pjson from "../../package.json" with { type: "json" };
import memory from "../lib/memory.js";
import queue from "../lib/queue/index.js";

export default async () => {

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
    queue,
    monitor: memory.db.monitor
  };
}; 