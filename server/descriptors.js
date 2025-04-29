import { BIP32Factory } from "bip32";
import * as ecc from "tiny-secp256k1";
import * as bitcoin from "bitcoinjs-lib";
import logger from "./logger.js";

const bip32 = BIP32Factory(ecc);

// Create networks for different key types
const networks = {
  xpub: {
    ...bitcoin.networks.bitcoin,
    bip32: {
      public: 0x0488b21e, // xpub
      private: 0x0488ade4, // xprv
    },
  },
  ypub: {
    ...bitcoin.networks.bitcoin,
    bip32: {
      public: 0x049d7cb2, // ypub
      private: 0x049d7878, // yprv
    },
  },
  zpub: {
    ...bitcoin.networks.bitcoin,
    bip32: {
      public: 0x04b24746, // zpub
      private: 0x04b2430c, // zprv
    },
  },
};

// Helper to validate and get network for a key
const getKeyNetwork = (key) => {
  const keyLower = key.toLowerCase();
  if (keyLower.startsWith("ypub")) {
    return networks.ypub;
  } else if (keyLower.startsWith("zpub")) {
    return networks.zpub;
  }
  return networks.xpub;
};

const cleanPath = (path) => {
  if (!path) return "";
  // Remove leading/trailing slashes and empty parts
  return path
    .split("/")
    .filter((p) => p !== "")
    .join("/");
};

// Parse a multi-sig descriptor like "wsh(multi(k,key1,key2,...))"
const parseMultiSigDescriptor = (descriptor) => {
  logger.info(`Parsing descriptor: ${descriptor}`);

  const wshmultiRegex = /^wsh\(multi\((\d+),([^)]+)\)\)$/;
  const sortedmultiRegex = /^wsh\(sortedmulti\((\d+),([^)]+)\)\)$/;

  let match =
    descriptor.match(wshmultiRegex) || descriptor.match(sortedmultiRegex);
  if (!match) {
    logger.error(`Failed to match descriptor format: ${descriptor}`);
    return { success: false, error: "Invalid multi-sig descriptor format" };
  }

  const [, requiredSigs, keysStr] = match;
  logger.info(`Required signatures: ${requiredSigs}`);

  const keys = keysStr.split(",").map((k) => k.trim());
  logger.info(`Found ${keys.length} keys in descriptor`);

  // Parse each key and its derivation path
  const parsedKeys = keys.map((key, index) => {
    logger.info(`Parsing key ${index + 1}: ${key}`);

    // Try to match both formats:
    // 1. [fingerprint/path]xpub.../remaining
    // 2. xpub.../path
    const fingerprintFormat = key.match(
      /^\[([a-f0-9]{8}(?:\/[0-9]+[h']?)*)\]([A-Za-z][A-Za-z0-9]+)(.*)$/
    );
    const simpleFormat = key.match(/^([A-Za-z][A-Za-z0-9]+)(.*)$/);

    if (fingerprintFormat) {
      // Format with fingerprint
      const [, originPath, xpub, remainingPath] = fingerprintFormat;
      logger.info(`Fingerprint format - Origin path: ${originPath}`);
      logger.info(`Extended key: ${xpub.slice(0, 8)}...`);
      logger.info(`Remaining path: ${remainingPath}`);

      const [fingerprint, ...originComponents] = originPath.split("/");
      const fullPath = [...originComponents];
      if (remainingPath) {
        fullPath.push(cleanPath(remainingPath));
      }

      const finalPath = cleanPath(fullPath.join("/"));
      logger.info(`Final derivation path: ${finalPath}`);

      return {
        fingerprint,
        path: finalPath,
        xpub,
      };
    } else if (simpleFormat) {
      // Simple format without fingerprint
      const [, xpub, path] = simpleFormat;
      logger.info(`Simple format - Extended key: ${xpub.slice(0, 8)}...`, path);

      const cleanedPath = cleanPath(path);
      logger.info(`Final derivation path: ${cleanedPath}`);

      return {
        fingerprint: "", // No fingerprint in simple format
        path: cleanedPath,
        xpub,
      };
    } else {
      logger.error(`Failed to parse key format: ${key}`);
      return {
        success: false,
        error: `Invalid key format in descriptor: ${key}`,
      };
    }
  });

  // Check if any key parsing failed
  const failedKey = parsedKeys.find((key) => key.success === false);
  if (failedKey) {
    return failedKey;
  }

  logger.info(`Successfully parsed all ${parsedKeys.length} keys`);
  return {
    success: true,
    data: {
      type: "multi-sig",
      scriptType: "wsh",
      requiredSignatures: parseInt(requiredSigs),
      totalSignatures: keys.length,
      keys: parsedKeys,
    },
  };
};

export const deriveAddresses = async (
  descriptor,
  startIndex,
  count,
  skip = 0
) => {
  const addresses = [];
  const parsed = parseDescriptor(descriptor);
  if (!parsed.success) {
    logger.error(`Failed to parse descriptor: ${parsed.error}`);
    return { success: false, error: parsed.error };
  }

  // Calculate the actual start index including skip
  const actualStartIndex = startIndex + skip;
  logger.info(
    `Deriving addresses from index ${actualStartIndex} to ${
      actualStartIndex + count - 1
    }`
  );

  // For each index, derive public keys from all xpubs and create the multi-sig address
  for (let i = 0; i < count; i++) {
    const derivationIndex = actualStartIndex + i;

    // Derive public keys for each xpub at this index
    const pubkeyResults = await Promise.all(
      parsed.data.keys.map(async ({ path, xpub }, keyIndex) => {
        logger.info(`Deriving key ${keyIndex + 1} at index ${derivationIndex}`);
        logger.debug(`Using path: ${path}`);
        logger.debug(`Using xpub: ${xpub.slice(0, 8)}...`);

        const network = getKeyNetwork(xpub);
        const node = bip32.fromBase58(xpub, network);
        if (!node) {
          logger.error(`Failed to create BIP32 node for key ${keyIndex + 1}`);
          return {
            success: false,
            error: `Invalid xpub format for key ${keyIndex + 1}`,
          };
        }
        logger.debug(`Successfully created BIP32 node`);

        let derivedNode = node;
        const pathParts = path.split("/").filter((p) => p !== ""); // Remove empty parts

        for (const part of pathParts) {
          if (part === "*") {
            logger.debug(`Deriving index ${derivationIndex} for wildcard`);
            derivedNode = derivedNode.derive(derivationIndex);
          } else {
            const index = parseInt(part);
            if (isNaN(index)) {
              logger.error(`Invalid path part: ${part}`);
              return { success: false, error: `Invalid path part: ${part}` };
            }
            logger.debug(`Deriving fixed index ${index}`);
            derivedNode = derivedNode.derive(index);
          }
        }

        logger.debug(`Successfully derived public key ${keyIndex + 1}`);
        return { success: true, data: derivedNode.publicKey };
      })
    );

    // Check for any failed key derivations
    const failedKey = pubkeyResults.find((result) => !result.success);
    if (failedKey) {
      logger.error(`Failed to derive keys: ${failedKey.error}`);
      return { success: false, error: failedKey.error };
    }

    const pubkeys = pubkeyResults.map((result) => result.data);

    logger.debug(
      `Successfully derived all public keys for index ${derivationIndex}`
    );

    // Create P2WSH multi-sig address
    const p2ms = bitcoin.payments.p2ms({
      m: parsed.data.requiredSignatures,
      pubkeys: pubkeys.sort((a, b) => Buffer.compare(a, b)), // Sort pubkeys for sortedmulti
      network: bitcoin.networks.bitcoin,
    });

    const p2wsh = bitcoin.payments.p2wsh({
      redeem: p2ms,
      network: bitcoin.networks.bitcoin,
    });

    if (!p2wsh.address) {
      logger.error(`Failed to generate address for index ${derivationIndex}`);
      return {
        success: false,
        error: `Failed to generate address for index ${derivationIndex}`,
      };
    }

    logger.info(
      `Generated address for index ${derivationIndex}: ${p2wsh.address}`
    );

    addresses.push({
      name: `Address ${derivationIndex}`,
      address: p2wsh.address,
      index: derivationIndex,
    });
  }

  logger.info(`Successfully derived ${addresses.length} addresses`);
  return { success: true, data: addresses };
};

export const validateDescriptor = (descriptor) => {
  const parsed = parseDescriptor(descriptor);
  if (!parsed.success) {
    return {
      valid: false,
      error: parsed.error,
    };
  }
  return {
    valid: true,
    type: parsed.data.type,
    scriptType: parsed.data.scriptType,
    requiredSignatures: parsed.data.requiredSignatures,
    totalSignatures: parsed.data.totalSignatures,
  };
};

export const parseDescriptor = parseMultiSigDescriptor;
