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
  console.log("[DEBUG] parseMultiSigDescriptor input:", descriptor);
  // Remove whitespace and split into parts
  const parts = descriptor.replace(/\s+/g, "").split(",");
  console.log("[DEBUG] multisig parts:", parts);
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

  // Match pkh(), wpkh(), wsh(), sh(wpkh()), or sh(wsh()) format with proper nesting
  const match = cleanDesc.match(
    /^(?:pkh|wpkh|wsh|sh\(wpkh|sh\(wsh)\(([^)]+)\)(\))?$/
  );
  if (!match) {
    logger.error("Invalid single-key descriptor format");
    return {
      success: false,
      error: "Invalid descriptor format",
    };
  }

  const [, key] = match;
  const type = cleanDesc.startsWith("sh(wsh")
    ? "sh_wsh"
    : cleanDesc.startsWith("wsh")
    ? "wsh"
    : cleanDesc.startsWith("sh(wpkh")
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
  console.log("[DEBUG] parseDescriptor input:", descriptor);

  // Unwrap wsh(...), sh(...), etc. and recursively parse the inner content
  const outerMatch = descriptor.match(/^(wsh|sh|sh\(wpkh)\((.+)\)$/);
  if (outerMatch) {
    const inner = outerMatch[2];
    console.log(
      "[DEBUG] Unwrapped outer function:",
      outerMatch[1],
      "->",
      inner
    );
    return parseDescriptor(inner);
  }

  // First try single-key format since it's more common
  const singleResult = parseSingleKeyDescriptor(descriptor);
  if (singleResult.success) {
    return singleResult;
  }

  // Remove the call to parseMultiSigDescriptor and just return failure for non-single-key
  return {
    success: false,
    error: "Invalid descriptor format",
  };
};

// Derive addresses from a descriptor
export const deriveAddresses = (descriptor, startIndex, count, skip = 0) => {
  const addresses = [];
  for (let i = 0; i < count; i++) {
    const index = startIndex + skip + i;
    const address = deriveAddress(descriptor, index);
    if (!address) {
      logger.error(`Failed to derive address at index ${index}`);
      return {
        success: false,
        error: `Failed to derive address at index ${index}`,
      };
    }
    addresses.push(address);
  }
  return {
    success: true,
    data: addresses,
  };
};

// Recursively parse and unwrap descriptor wrappers
function parseDescriptorType(descriptor) {
  let inner = descriptor;
  let wrappers = [];
  while (true) {
    const m = inner.match(/^(\w+)\((.*)\)$/);
    if (!m) break;
    wrappers.push(m[1]);
    inner = m[2];
    if (m[1] === "multi" || m[1] === "sortedmulti") break;
  }
  return { wrappers, inner };
}

// Derive a single address from a descriptor
export const deriveAddress = (descriptor, index) => {
  const { wrappers, inner } = parseDescriptorType(descriptor);
  let isMulti = wrappers.includes("multi") || wrappers.includes("sortedmulti");
  let isSorted = wrappers.includes("sortedmulti");
  let threshold = 1;
  let keys = [];
  if (isMulti) {
    const multiMatch = inner.match(/^(\d+),(.+)$/);
    if (!multiMatch) throw new Error("Invalid multi descriptor");
    threshold = parseInt(multiMatch[1], 10);
    keys = multiMatch[2].split(",").map((k) => k.trim());
  } else {
    keys = [inner];
  }

  // Derive all public keys
  const pubs = keys.map((key) => {
    const keyMatch = key.match(/^(\[.*\])?([A-Za-z0-9]+)(\/.*)?$/);
    const xpub = keyMatch ? keyMatch[2] : key;
    const path = keyMatch && keyMatch[3] ? keyMatch[3].replace(/^\//, "") : "";
    let node = bip32.fromBase58(xpub, getKeyNetwork(xpub));
    if (path) {
      for (const seg of path.split("/")) {
        node =
          seg === "*" ? node.derive(index) : node.derive(parseInt(seg, 10));
      }
    } else {
      node = node.derive(index);
    }
    return node.publicKey;
  });

  // Build the right payment
  let payment;
  if (isMulti) {
    const usePubs = isSorted ? [...pubs].sort(Buffer.compare) : pubs;
    const ms = bitcoin.payments.p2ms({ m: threshold, pubkeys: usePubs });
    if (wrappers[0] === "wsh") {
      payment = bitcoin.payments.p2wsh({ redeem: ms });
    } else if (wrappers[0] === "sh") {
      payment = bitcoin.payments.p2sh({ redeem: ms });
    } else {
      throw new Error("Unsupported multisig wrapper");
    }
  } else if (wrappers[0] === "pkh") {
    payment = bitcoin.payments.p2pkh({ pubkey: pubs[0] });
  } else if (wrappers[0] === "wpkh") {
    payment = bitcoin.payments.p2wpkh({ pubkey: pubs[0] });
  } else if (wrappers[0] === "sh" && wrappers[1] === "wpkh") {
    const p2wpkh = bitcoin.payments.p2wpkh({ pubkey: pubs[0] });
    payment = bitcoin.payments.p2sh({ redeem: p2wpkh });
  } else if (wrappers[0] === "sh" && wrappers[1] === "wsh") {
    // sh(wsh(...))
    const p2wpkh = bitcoin.payments.p2wpkh({ pubkey: pubs[0] });
    const p2wsh = bitcoin.payments.p2wsh({ redeem: p2wpkh });
    payment = bitcoin.payments.p2sh({ redeem: p2wsh });
  } else if (wrappers[0] === "wsh" && wrappers.length === 1) {
    // wsh(single-key) → wrap P2WPKH in P2WSH
    const p2wpkh = bitcoin.payments.p2wpkh({ pubkey: pubs[0] });
    payment = bitcoin.payments.p2wsh({ redeem: p2wpkh });
  } else {
    throw new Error("Unsupported descriptor type: " + descriptor);
  }

  if (!payment?.address) {
    logger.error("Failed to generate address");
    return null;
  }

  return {
    address: payment.address,
    index,
  };
};
