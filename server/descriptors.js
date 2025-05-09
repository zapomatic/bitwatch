import { BIP32Factory } from "bip32";
import * as ecc from "tiny-secp256k1";
import * as bitcoin from "bitcoinjs-lib";
import logger from "./logger.js";
import { convertExtendedKey, getKeyNetwork } from "./extendedKeyUtils.js";

const bip32 = BIP32Factory(ecc);

// Parse a key from a descriptor
export const parseKey = (key) => {
  // First try to match fingerprint format
  const fingerprintMatch = key.match(/^\[([0-9a-f]{8})\/.*\]([^/]+)(\/.*)?$/i);
  if (fingerprintMatch) {
    const [, fingerprint, keyPart, path = ""] = fingerprintMatch;
    logger.debug(`Matched fingerprint format: ${fingerprint}${path}`);
    return {
      success: true,
      fingerprint,
      key: keyPart,
      path,
    };
  }

  // Then try simple format
  const simpleMatch = key.match(/^([^/]+)(\/.*)?$/);
  if (simpleMatch) {
    const [, keyPart, path = ""] = simpleMatch;
    logger.debug(`Matched simple format: ${keyPart}${path}`);

    // Validate extended key format
    if (!keyPart.match(/^[xyz]pub/i)) {
      logger.error(`Invalid key format: ${keyPart}`);
      return {
        success: false,
        error: "Invalid key format",
      };
    }

    return {
      success: true,
      key: keyPart,
      path,
    };
  }

  logger.error(`No valid key format found in: ${key}`);
  return {
    success: false,
    error: "Invalid key format",
  };
};

// Parse a multisig descriptor
export const parseMultiSigDescriptor = (descriptor) => {
  // Remove whitespace and split into parts
  const parts = descriptor.replace(/\s+/g, "").split(",");
  if (parts.length < 3) {
    logger.error("Invalid descriptor format: too few parts");
    return {
      success: false,
      error: "Invalid descriptor format",
    };
  }

  // Parse threshold and total
  const thresholdMatch = parts[0].match(/^multi\((\d+)$/);
  if (!thresholdMatch) {
    logger.error("Invalid descriptor format: missing threshold");
    return {
      success: false,
      error: "Invalid descriptor format",
    };
  }

  const threshold = parseInt(thresholdMatch[1]);
  const total = parts.length - 2; // Subtract threshold and closing parenthesis

  if (threshold > total) {
    logger.error("Invalid descriptor: threshold exceeds total keys");
    return {
      success: false,
      error: "Invalid threshold",
    };
  }

  // Parse keys
  const keys = [];
  for (let i = 1; i < parts.length - 1; i++) {
    const keyResult = parseKey(parts[i]);
    if (!keyResult.success) {
      logger.error(`Invalid key at position ${i}: ${keyResult.error}`);
      return {
        success: false,
        error: keyResult.error,
      };
    }
    keys.push(keyResult);
  }

  // Convert all keys to xpub format
  const convertedKeys = keys.map((key) => {
    const convertedKey = convertExtendedKey(key.key);
    if (!convertedKey) {
      logger.error(`Failed to convert key: ${key.key}`);
      return null;
    }
    return {
      ...key,
      key: convertedKey,
    };
  });

  if (convertedKeys.some((key) => key === null)) {
    return {
      success: false,
      error: "Failed to convert one or more keys",
    };
  }

  return {
    success: true,
    threshold,
    total,
    keys: convertedKeys,
  };
};

// Parse a single-key descriptor
export const parseSingleKeyDescriptor = (descriptor) => {
  // Remove whitespace
  const cleanDesc = descriptor.replace(/\s+/g, "");

  // Match pkh(), wpkh(), or sh(wpkh()) format with proper nesting
  const match = cleanDesc.match(/^(?:pkh|wpkh|sh\(wpkh)\(([^)]+)\)(\))?$/);
  if (!match) {
    logger.error("Invalid single-key descriptor format");
    return {
      success: false,
      error: "Invalid descriptor format",
    };
  }

  const [, key] = match;
  const type = cleanDesc.startsWith("sh(wpkh")
    ? "sh_wpkh"
    : cleanDesc.startsWith("wpkh")
    ? "wpkh"
    : "pkh";

  const keyResult = parseKey(key);
  if (!keyResult.success) {
    logger.error(`Invalid key: ${keyResult.error}`);
    return {
      success: false,
      error: keyResult.error,
    };
  }

  // Convert key to xpub format
  const convertedKey = convertExtendedKey(keyResult.key);
  if (!convertedKey) {
    logger.error(`Failed to convert key: ${keyResult.key}`);
    return {
      success: false,
      error: "Failed to convert key",
    };
  }

  return {
    success: true,
    type,
    key: {
      ...keyResult,
      key: convertedKey,
    },
  };
};

// Parse any descriptor type
export const parseDescriptor = (descriptor) => {
  // First try single-key format since it's more common
  const singleResult = parseSingleKeyDescriptor(descriptor);
  if (singleResult.success) {
    return singleResult;
  }

  // Then try multisig format
  const multiResult = parseMultiSigDescriptor(descriptor);
  if (multiResult.success) {
    return {
      ...multiResult,
      type: "multi",
    };
  }

  return {
    success: false,
    error: "Invalid descriptor format",
  };
};

// Derive addresses from a descriptor
export const deriveAddresses = (descriptor, startIndex, count, skip = 0) => {
  const result = parseDescriptor(descriptor);
  if (!result.success) {
    logger.error(`Failed to parse descriptor: ${result.error}`);
    return [];
  }

  const addresses = [];
  for (let i = 0; i < count; i++) {
    const index = startIndex + skip + i;
    const address = deriveAddress(descriptor, index);
    if (!address) {
      logger.error(`Failed to derive address at index ${index}`);
      return [];
    }
    addresses.push(address);
  }

  return addresses;
};

// Derive a single address from a descriptor
export const deriveAddress = (descriptor, index) => {
  const result = parseDescriptor(descriptor);
  if (!result.success) {
    logger.error(`Failed to parse descriptor: ${result.error}`);
    return null;
  }

  // Get the network for the key
  const network = getKeyNetwork(
    result.type === "multi" ? result.keys[0].key : result.key.key
  );
  if (!network) {
    logger.error("Invalid key format");
    return null;
  }

  // Derive the address
  try {
    let address;
    if (result.type === "multi") {
      address = bitcoin.payments.p2ms({
        m: result.threshold,
        pubkeys: result.keys.map((key) => {
          const node = bip32.fromBase58(key.key, network);
          if (!node) {
            throw new Error("Failed to decode extended key");
          }
          // Handle derivation path if present
          let derivedNode = node;
          if (key.path) {
            const pathParts = key.path.split("/").slice(1); // Remove leading slash
            for (const part of pathParts) {
              if (part === "*") {
                derivedNode = derivedNode.derive(index);
              } else {
                const index = parseInt(part.replace(/['h]/g, ""));
                if (isNaN(index)) {
                  throw new Error(`Invalid path index: ${part}`);
                }
                derivedNode = derivedNode.derive(index);
              }
            }
          } else {
            derivedNode = derivedNode.derive(index);
          }
          return derivedNode.publicKey;
        }),
        network,
      }).address;
    } else {
      // Single key descriptor
      const node = bip32.fromBase58(result.key.key, network);
      if (!node) {
        throw new Error("Failed to decode extended key");
      }

      // Handle derivation path if present
      let derivedNode = node;
      if (result.key.path) {
        const pathParts = result.key.path.split("/").slice(1); // Remove leading slash
        for (const part of pathParts) {
          if (part === "*") {
            derivedNode = derivedNode.derive(index);
          } else {
            const index = parseInt(part.replace(/['h]/g, ""));
            if (isNaN(index)) {
              throw new Error(`Invalid path index: ${part}`);
            }
            derivedNode = derivedNode.derive(index);
          }
        }
      } else {
        derivedNode = derivedNode.derive(index);
      }

      if (result.type === "pkh") {
        address = bitcoin.payments.p2pkh({
          pubkey: derivedNode.publicKey,
          network,
        }).address;
      } else if (result.type === "wpkh") {
        address = bitcoin.payments.p2wpkh({
          pubkey: derivedNode.publicKey,
          network,
        }).address;
      } else if (result.type === "sh_wpkh") {
        const p2wpkh = bitcoin.payments.p2wpkh({
          pubkey: derivedNode.publicKey,
          network,
        });
        address = bitcoin.payments.p2sh({ redeem: p2wpkh, network }).address;
      }
    }

    if (!address) {
      logger.error("Failed to generate address");
      return null;
    }

    return {
      address,
      index,
    };
  } catch (err) {
    logger.error(`Error deriving address: ${err.message}`);
    return null;
  }
};

// Validate a descriptor
export const validateDescriptor = (descriptor) => {
  const result = parseDescriptor(descriptor);
  if (!result.success) {
    logger.error(`Invalid descriptor: ${result.error}`);
    return {
      success: false,
      error: result.error,
    };
  }
  return {
    success: true,
  };
};
