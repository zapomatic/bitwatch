import { client } from "./client.js";
import { refreshBalance } from "./refreshBalance.js";
import { saveConfig } from "./saveConfig.js";
import { getConfig } from "./getConfig.js";
import { saveIntegrations } from "./saveIntegrations.js";
import { getIntegrations } from "./getIntegrations.js";
import { addAddress } from "./addAddress.js";
import { addCollection } from "./addCollection.js";
import { saveExpected } from "./saveExpected.js";
import { addDescriptor } from "./addDescriptor.js";
import { editDescriptor } from "./editDescriptor.js";
import { addExtendedKey } from "./addExtendedKey.js";
import { deleteHandler } from "./delete.js";
import { updateAddress } from "./updateAddress.js";
import { requestState } from "./requestState.js";
import { importCollections } from "./importCollections.js";

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
  addAddress,
  addCollection,
  saveExpected,
  importCollections,

  // Descriptor management
  addDescriptor,
  editDescriptor,

  // Extended key management
  addExtendedKey,

  // Deletion
  delete: deleteHandler,

  // Address updates
  updateAddress,

  // State management
  requestState,
};
