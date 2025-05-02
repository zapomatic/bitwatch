import { BIP32Factory } from "bip32";
import * as ecc from "tiny-secp256k1";
import * as bitcoin from "bitcoinjs-lib";

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

// Parse a multi-sig descriptor like "wsh(multi(k,key1,key2,...))" or single key descriptor like "pkh(key)", "sh(wpkh(key))", or "wpkh(key)"
const parseMultiSigDescriptor = (descriptor) => {
  if (!descriptor) {
    return { success: false, error: "Descriptor is undefined" };
  }

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
    const [, keyStr] = singleKeyMatch;

    // Parse the key and its derivation path
    const parsedKey = parseKey(keyStr);
    if (!parsedKey.success) {
      return parsedKey;
    }

    let scriptType = "pkh";
    if (descriptor.startsWith("sh(wpkh")) {
      scriptType = "sh-wpkh";
    } else if (descriptor.startsWith("wpkh")) {
      scriptType = "wpkh";
    }

    return {
      success: true,
      data: {
        type: "single-key",
        scriptType,
        keys: [parsedKey],
      },
    };
  }

  // If not a single key descriptor, try multi-sig patterns
  let match =
    descriptor.match(wshmultiRegex) || descriptor.match(sortedmultiRegex);
  if (!match) {
    return { success: false, error: "Invalid descriptor format" };
  }

  const [, requiredSigs, keysStr] = match;
  const keys = keysStr.split(",").map((k) => k.trim());

  // Parse each key and its derivation path
  const parsedKeys = keys.map((key, index) => parseKey(key, index));

  // Check if any key parsing failed
  const failedKey = parsedKeys.find((key) => !key.success);
  if (failedKey) {
    return failedKey;
  }

  return {
    success: true,
    data: {
      type: "multi-sig",
      scriptType: "wsh",
      requiredSignatures: parseInt(requiredSigs),
      totalSignatures: keys.length,
      keys: parsedKeys.map((key) => ({
        fingerprint: key.fingerprint,
        path: key.path,
        xpub: key.xpub,
      })),
    },
  };
};

// Helper function to parse a key and its derivation path
const parseKey = (key) => {
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
    const [fingerprint, ...originComponents] = originPath.split("/");
    const fullPath = [...originComponents];
    if (remainingPath) {
      fullPath.push(cleanPath(remainingPath));
    }

    const finalPath = cleanPath(fullPath.join("/"));

    return {
      success: true,
      fingerprint,
      path: finalPath,
      xpub,
    };
  } else if (simpleFormat) {
    // Simple format without fingerprint
    const [, xpub, path] = simpleFormat;
    const cleanedPath = cleanPath(path);

    return {
      success: true,
      fingerprint: "", // No fingerprint in simple format
      path: cleanedPath,
      xpub,
    };
  } else {
    return {
      success: false,
      error: `Invalid key format in descriptor: ${key}`,
    };
  }
};

export const deriveAddresses = async (
  descriptor,
  startIndex,
  count,
  skip = 0
) => {
  const addresses = [];
  const parsed = parseMultiSigDescriptor(descriptor);
  if (!parsed.success) {
    return { success: false, error: parsed.error };
  }

  // Calculate the actual start index including skip
  const actualStartIndex = startIndex + skip;

  // For each index, derive public keys from all xpubs and create the address
  for (let i = 0; i < count; i++) {
    const derivationIndex = actualStartIndex + i;

    // Derive public keys for each xpub at this index
    const pubkeyResults = await Promise.all(
      parsed.data.keys.map(async ({ path, xpub }) => {
        const network = getKeyNetwork(xpub);
        const node = bip32.fromBase58(xpub, network);
        if (!node) {
          return {
            success: false,
            error: `Invalid xpub format`,
          };
        }

        let derivedNode = node;
        const pathParts = path.split("/").filter((p) => p !== ""); // Remove empty parts

        // Derive each path component
        for (const part of pathParts) {
          if (part === "*") {
            derivedNode = derivedNode.derive(derivationIndex);
          } else {
            const index = parseInt(part);
            if (isNaN(index)) {
              return {
                success: false,
                error: `Invalid path component: ${part}`,
              };
            }
            derivedNode = derivedNode.derive(index);
          }
        }

        return {
          success: true,
          data: derivedNode.publicKey,
        };
      })
    );

    // Check if any key derivation failed
    const failedDerivation = pubkeyResults.find((result) => !result.success);
    if (failedDerivation) {
      return failedDerivation;
    }

    // Create the address based on script type
    const pubkeys = pubkeyResults.map((result) => result.data);
    let address;

    if (parsed.data.type === "multi-sig") {
      const p2wsh = bitcoin.payments.p2wsh({
        redeem: bitcoin.payments.p2ms({
          m: parsed.data.requiredSignatures,
          pubkeys,
        }),
      });
      address = p2wsh.address;
    } else {
      const payment = {
        pkh: () => bitcoin.payments.p2pkh({ pubkey: pubkeys[0] }),
        "sh-wpkh": () =>
          bitcoin.payments.p2sh({
            redeem: bitcoin.payments.p2wpkh({ pubkey: pubkeys[0] }),
          }),
        wpkh: () => bitcoin.payments.p2wpkh({ pubkey: pubkeys[0] }),
      }[parsed.data.scriptType];

      if (!payment) {
        return {
          success: false,
          error: `Unsupported script type: ${parsed.data.scriptType}`,
        };
      }

      address = payment().address;
    }

    if (!address) {
      return {
        success: false,
        error: `Failed to generate address for index ${derivationIndex}`,
      };
    }

    addresses.push({
      index: derivationIndex,
      address,
    });
  }

  return { success: true, data: addresses };
};

export const validateDescriptor = (descriptor) => {
  const parsed = parseMultiSigDescriptor(descriptor);
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
