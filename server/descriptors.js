import { BIP32Factory } from "bip32";
import * as ecc from "tiny-secp256k1";
import * as bitcoin from "bitcoinjs-lib";
import bs58check from "bs58check";

import logger from "./logger.js";

const bip32 = BIP32Factory(ecc);

// Define networks according to SLIP-132
const NETWORK_TYPES = {
  xpub: {
    ...bitcoin.networks.bitcoin,
    bip32: {
      public: 0x0488b21e,
      private: 0x0488ade4,
    },
  },
  ypub: {
    ...bitcoin.networks.bitcoin,
    bip32: {
      public: 0x049d7cb2,
      private: 0x049d7878,
    },
  },
  Ypub: {
    ...bitcoin.networks.bitcoin,
    bip32: {
      public: 0x0295b43f,
      private: 0x0295b005,
    },
  },
  zpub: {
    ...bitcoin.networks.bitcoin,
    bip32: {
      public: 0x04b24746,
      private: 0x04b2430c,
    },
  },
  Zpub: {
    ...bitcoin.networks.bitcoin,
    bip32: {
      public: 0x02aa7ed3,
      private: 0x02aa7a99,
    },
  },
};

// Convert between extended public key formats
const convertExtendedKey = (key) => {
  // Extract just the key part (before any derivation path)
  const keyPart = key.split("/")[0];

  try {
    // Decode the base58check data
    const data = bs58check.decode(keyPart);
    // Remove the first 4 bytes (version)
    const payload = data.slice(4);
    // Create new data with xpub version
    const newData = Buffer.concat([
      Buffer.from([0x04, 0x88, 0xb2, 0x1e]), // xpub version bytes
      payload,
    ]);
    // Encode back to base58check
    const xpub = bs58check.encode(newData);
    logger.debug(`Converted ${keyPart} to ${xpub}`);

    // Reattach the derivation path if it exists
    const path = key.slice(keyPart.length);
    return xpub + path;
  } catch (err) {
    logger.error(`Error converting key ${keyPart}: ${err.message}`);
    return null;
  }
};

// Helper to validate and get network for a key
export const getKeyNetwork = (__key) => {
  // Always use xpub network version for parsing
  return NETWORK_TYPES.xpub;
};

const cleanPath = (path) => {
  logger.debug(`Cleaning path: ${path}`);
  if (!path) {
    logger.debug("Empty path, returning empty string");
    return "";
  }
  // Remove leading/trailing slashes and empty parts
  const cleaned = path
    .split("/")
    .filter((p) => p !== "")
    .join("/");
  logger.debug(`Cleaned path result: ${cleaned}`);
  return cleaned;
};

// Parse a multi-sig descriptor like "wsh(multi(k,key1,key2,...))" or single key descriptor like "pkh(key)", "sh(wpkh(key))", or "wpkh(key)"
const parseMultiSigDescriptor = (descriptor) => {
  if (!descriptor) {
    return { success: false, error: "Descriptor is undefined" };
  }

  logger.debug(`Parsing descriptor: ${descriptor}`);

  // Single key descriptor patterns
  const pkhRegex = /^pkh\(([^)]+)\)$/;
  const shWpkhRegex = /^sh\(wpkh\(([^)]+)\)\)$/;
  const wpkhRegex = /^wpkh\(([^)]+)\)$/;

  // Multi-sig descriptor patterns
  const wshmultiRegex = /^wsh\(multi\((\d+),([^)]+)\)\)$/;
  const sortedmultiRegex = /^wsh\(sortedmulti\((\d+),([^)]+)\)\)$/;

  // Try to match single key patterns first
  let singleKeyMatch =
    descriptor.match(pkhRegex) ||
    descriptor.match(shWpkhRegex) ||
    descriptor.match(wpkhRegex);

  if (singleKeyMatch) {
    const key = singleKeyMatch[1];
    logger.debug(`Found single key descriptor with key: ${key}`);

    const parsedKey = parseKey(key);
    if (!parsedKey.success) {
      return { success: false, error: parsedKey.error };
    }

    let type;
    if (descriptor.match(pkhRegex)) {
      type = "pkh";
    } else if (descriptor.match(shWpkhRegex)) {
      type = "sh_wpkh";
    } else if (descriptor.match(wpkhRegex)) {
      type = "wpkh";
    }

    return {
      success: true,
      data: {
        type,
        keys: [parsedKey],
        threshold: 1,
      },
    };
  }

  // Try to match multi-sig patterns
  let multiMatch =
    descriptor.match(wshmultiRegex) || descriptor.match(sortedmultiRegex);
  if (multiMatch) {
    const threshold = parseInt(multiMatch[1]);
    const keys = multiMatch[2].split(",").map((k) => k.trim());
    logger.debug(
      `Found multi-sig descriptor with threshold ${threshold} and keys: ${keys.join(
        ", "
      )}`
    );

    // Convert all keys to xpub format first
    const convertedKeys = keys.map((key) => {
      const converted = convertExtendedKey(key);
      if (!converted) {
        logger.error(`Failed to convert key: ${key}`);
        return null;
      }
      return converted;
    });

    if (convertedKeys.some((k) => k === null)) {
      return { success: false, error: "Failed to convert one or more keys" };
    }

    const parsedKeys = convertedKeys.map((key) => parseKey(key));
    const failedKey = parsedKeys.find((k) => !k.success);
    if (failedKey) {
      return { success: false, error: failedKey.error };
    }

    return {
      success: true,
      data: {
        type: descriptor.match(wshmultiRegex) ? "wsh_multi" : "wsh_sortedmulti",
        keys: parsedKeys,
        threshold,
      },
    };
  }

  logger.error(`Unsupported descriptor format: ${descriptor}`);
  return { success: false, error: "Unsupported descriptor format" };
};

// Helper function to parse a key and its derivation path
const parseKey = (key) => {
  logger.debug(`Parsing key: ${key}`);
  // Try to match both formats:
  // 1. [fingerprint/path]xpub.../remaining
  // 2. xpub.../path
  const fingerprintFormat = key.match(
    /^\[([a-f0-9]{8}(?:\/[0-9]+[h']?)*)\]([A-Za-z][A-Za-z0-9]+)(.*)$/
  );
  const simpleFormat = key.match(/^([A-Za-z][A-Za-z0-9]+)(\/[^)]*)?$/);

  if (fingerprintFormat) {
    // Format with fingerprint
    const [, originPath, xpub, remainingPath] = fingerprintFormat;
    logger.debug(
      `Found fingerprint format: originPath=${originPath}, xpub=${xpub}, remainingPath=${remainingPath}`
    );
    const [fingerprint, ...originComponents] = originPath.split("/");
    const fullPath = [...originComponents];
    if (remainingPath) {
      fullPath.push(cleanPath(remainingPath));
    }

    const finalPath = cleanPath(fullPath.join("/"));
    logger.debug(`Final path: ${finalPath}`);

    // Convert the key to xpub format if needed
    const convertedKey = convertExtendedKey(xpub);
    if (!convertedKey) {
      return {
        success: false,
        error: "Invalid extended key format",
      };
    }

    return {
      success: true,
      fingerprint,
      path: finalPath,
      xpub: convertedKey,
    };
  } else if (simpleFormat) {
    // Simple format without fingerprint
    const [, xpub, path = ""] = simpleFormat;
    logger.debug(`Found simple format: xpub=${xpub}, path=${path}`);

    // Convert the key to xpub format if needed
    const convertedKey = convertExtendedKey(xpub);
    if (!convertedKey) {
      return {
        success: false,
        error: "Invalid extended key format",
      };
    }

    // Remove leading slash if present and clean the path
    const cleanedPath = cleanPath(path.replace(/^\//, ""));
    logger.debug(`Cleaned path: ${cleanedPath}`);

    return {
      success: true,
      fingerprint: null,
      path: cleanedPath,
      xpub: convertedKey,
    };
  }

  logger.error(`Invalid key format: ${key}`);
  return {
    success: false,
    error: "Invalid key format",
  };
};

export const deriveAddresses = (
  descriptor,
  startIndex = 0,
  count = 5,
  skip = 0
) => {
  logger.debug(`Deriving addresses for descriptor: ${descriptor}`);
  logger.debug(
    `Parameters: startIndex=${startIndex}, count=${count}, skip=${skip}`
  );

  const addresses = [];
  const parsed = parseMultiSigDescriptor(descriptor);
  if (!parsed.success) {
    logger.error(`Failed to parse descriptor: ${parsed.error}`);
    return [];
  }

  logger.debug(`Parsed descriptor data: ${JSON.stringify(parsed.data)}`);

  // Calculate the actual start index including skip
  const actualStartIndex = startIndex + skip;
  logger.debug(`Actual start index: ${actualStartIndex}`);

  // For each index, derive public keys from all xpubs and create the address
  for (let i = 0; i < count; i++) {
    const derivationIndex = actualStartIndex + i;
    logger.debug(`Deriving address for index ${derivationIndex}`);

    let publicKeys = [];
    let currentKey = null;

    // Process each key in the descriptor
    for (const key of parsed.data.keys) {
      logger.debug(`Processing key: ${key.xpub}`);
      try {
        const network = getKeyNetwork(key.xpub);
        if (!network) {
          logger.error(`Invalid network for key: ${key.xpub}`);
          return [];
        }
        currentKey = bip32.fromBase58(key.xpub, network);

        // If there's a path, derive each component
        if (key.path) {
          const pathParts = key.path.split("/").filter((p) => p !== "");
          logger.debug(`Path parts: ${JSON.stringify(pathParts)}`);

          for (const part of pathParts) {
            if (part === "*") {
              // For wildcard, derive the current index
              logger.debug(`Deriving wildcard index ${derivationIndex}`);
              currentKey = currentKey.derive(derivationIndex);
            } else {
              // For regular path components, derive the specified index
              const index = parseInt(part);
              if (isNaN(index)) {
                logger.error(`Invalid path component: ${part}`);
                continue;
              }
              currentKey = currentKey.derive(index);
            }
          }
        }

        publicKeys.push(currentKey.publicKey);
      } catch (err) {
        logger.error(`Error processing key ${key.xpub}: ${err.message}`);
        return [];
      }
    }

    // Create the address based on the descriptor type
    let address;
    try {
      if (parsed.data.type === "pkh") {
        address = bitcoin.payments.p2pkh({ pubkey: publicKeys[0] }).address;
      } else if (parsed.data.type === "sh_wpkh") {
        address = bitcoin.payments.p2sh({
          redeem: bitcoin.payments.p2wpkh({ pubkey: publicKeys[0] }),
        }).address;
      } else if (parsed.data.type === "wpkh") {
        address = bitcoin.payments.p2wpkh({ pubkey: publicKeys[0] }).address;
      } else if (
        parsed.data.type === "wsh_multi" ||
        parsed.data.type === "wsh_sortedmulti"
      ) {
        const sortedKeys =
          parsed.data.type === "wsh_sortedmulti"
            ? publicKeys.sort((a, b) => a.compare(b))
            : publicKeys;
        address = bitcoin.payments.p2wsh({
          redeem: bitcoin.payments.p2ms({
            m: parsed.data.threshold,
            pubkeys: sortedKeys,
          }),
        }).address;
      }
    } catch (err) {
      logger.error(`Error creating address: ${err.message}`);
      continue;
    }

    if (!address) {
      logger.error(`Failed to generate address for index ${derivationIndex}`);
      continue;
    }

    logger.debug(`Generated address: ${address} for index ${derivationIndex}`);
    addresses.push({
      index: derivationIndex,
      address,
      name: `${descriptor.name || "Address"} ${derivationIndex}`,
    });
  }

  return addresses;
};

export const validateDescriptor = (descriptor) => {
  const parsed = parseMultiSigDescriptor(descriptor);
  if (!parsed.success) {
    return { success: false, error: parsed.error };
  }
  return { success: true };
};
