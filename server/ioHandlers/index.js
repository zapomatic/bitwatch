import { client } from "./client.js";
import { refreshBalance } from "./refreshBalance.js";
import { getConfig, saveConfig } from "./config.js";
import { getIntegrations, saveIntegrations } from "./integrations.js";
import { add } from "./add.js";
import { saveExpected } from "./saveExpected.js";
import { addDescriptor, editDescriptor } from "./descriptors.js";
import { addExtendedKey } from "./extendedKeys.js";
import { deleteHandler } from "./delete.js";
import { updateAddress } from "./updateAddress.js";

// Export an object with event names as keys mapping to their handlers
export default {
  // Client connection
  client,

  // Balance management
  refreshBalance,

  // Configuration
  getConfig,
  saveConfig,

  // Integrations
  getIntegrations,
  saveIntegrations,

  // Collection and address management
  add,
  saveExpected,

  // Descriptor management
  addDescriptor,
  editDescriptor,

  // Extended key management
  addExtendedKey,

  // Deletion
  delete: deleteHandler,

  // Address updates
  updateAddress,
};
