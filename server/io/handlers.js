import addAddress from "./addAddress.js";
import addCollection from "./addCollection.js";
import addDescriptor from "./addDescriptor.js";
import addExtendedKey from "./addExtendedKey.js";
import client from "./client.js";
import deleteHandler from "./delete.js";
import editAddress from "./editAddress.js";
import editCollection from "./editCollection.js";
import editDescriptor from "./editDescriptor.js";
import editExtendedKey from "./editExtendedKey.js";
import getConfig from "./getConfig.js";
import getIntegrations from "./getIntegrations.js";
import importCollections from "./importCollections.js";
import refreshBalance from "./refreshBalance.js";
import requestState from "./requestState.js";
import saveConfig from "./saveConfig.js";
import saveExpected from "./saveExpected.js";
import saveIntegrations from "./saveIntegrations.js";

// Export an object with event names as keys mapping to their handlers
export default {
  addAddress,
  addCollection,
  addDescriptor,
  addExtendedKey,
  client,
  delete: deleteHandler,
  editAddress,
  editCollection,
  editDescriptor,
  editExtendedKey,
  getConfig,
  getIntegrations,
  importCollections,
  refreshBalance,
  requestState,
  saveConfig,
  saveExpected,
  saveIntegrations,
};
