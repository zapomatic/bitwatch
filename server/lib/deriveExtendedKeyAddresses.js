import { BIP32Factory } from "bip32";
import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "tiny-secp256k1";
import logger from "./logger.js";
import { getKeyNetwork, getAddressType } from "./extendedKeyUtils.js";

// Initialize ECC library for Taproot support
bitcoin.initEccLib(ecc);

const bip32 = BIP32Factory(ecc);

const MAX_DERIVATION_INDEX = 0x7fffffff;

const parseDerivationPath = (derivationPath) => {
  const path = (derivationPath || "m/0").trim();
  const segments = path.split("/");

  if (segments[0].toLowerCase() !== "m" || segments.some((segment) => !segment)) {
    return null;
  }

  const pathParts = segments.slice(1).map((segment) => {
    const match = segment.match(/^(\d+)(['h])?$/i);
    if (!match) return null;

    const index = Number(match[1]);
    if (!Number.isSafeInteger(index) || index > MAX_DERIVATION_INDEX) {
      return null;
    }

    return {
      index,
      hardened: Boolean(match[2]),
    };
  });

  return pathParts.some((part) => part === null) ? null : pathParts;
};

const deriveBaseNode = (node, pathParts) => {
  let pathToDerive = pathParts;

  // A public extended key cannot derive a hardened child. A full hardened
  // path is still useful as the origin path of an account-level xpub, though:
  // the key already represents that path, so only derive the suffix after the
  // key's encoded depth. This keeps hardened origin metadata usable without
  // pretending that an xpub can derive private-only branches.
  if (node.isNeutered() && pathParts.some(({ hardened }) => hardened)) {
    const keyDepth = Number(node.depth);
    const suffix = pathParts.slice(keyDepth);

    if (
      keyDepth === 0 ||
      pathParts.length < keyDepth ||
      suffix.some(({ hardened }) => hardened)
    ) {
      logger.error(
        "Cannot derive hardened path components from this extended public key; use an account-level xpub with its full origin path or a relative path such as m/0"
      );
      return null;
    }

    pathToDerive = suffix;
  }

  let baseNode = node;
  for (const { index, hardened } of pathToDerive) {
    baseNode = hardened
      ? baseNode.deriveHardened(index)
      : baseNode.derive(index);
    if (!baseNode) {
      logger.error("Failed to derive path");
      return null;
    }
  }

  return baseNode;
};

export const deriveExtendedKeyAddresses = ({
  key,
  skip = 0,
  startIndex = 0,
  count,
  derivationPath = "m/0",
}) => {
  const addresses = [];

  logger.scan(
    `Deriving ${count} addresses starting from index ${startIndex} with skip ${skip}, using path: ${derivationPath}`
  );

  // Get network for the key
  const network = getKeyNetwork(key);
  if (!network) {
    logger.error("Invalid key format");
    return null;
  }

  // Decode the extended key
  let node;
  // fromBase58 will throw if invalid, we'll let it return undefined
  node = bip32.fromBase58(key, network);
  if (!node) {
    logger.error("Failed to decode extended key");
    return null;
  }

  // Parse derivation path and get the base node
  const pathParts = parseDerivationPath(derivationPath);
  if (!pathParts) {
    logger.error("Invalid derivation path");
    return null;
  }
  const baseNode = deriveBaseNode(node, pathParts);
  if (!baseNode) return null;

  // Calculate the actual start index including skip
  const actualStartIndex = startIndex + skip;

  // Get address type for the key
  const addressType = getAddressType(key, derivationPath);

  // Derive addresses starting from the actual start index
  for (let i = 0; i < count; i++) {
    // For the initial set, use actualStartIndex, then continue sequentially
    const derivationIndex = i === 0 ? actualStartIndex : actualStartIndex + i;
    const child = baseNode.derive(derivationIndex);
    if (!child) {
      logger.error(`Failed to derive child at index ${derivationIndex}`);
      return null;
    }

    // Use appropriate address type based on key prefix
    let address;
    if (addressType === "p2wsh") {
      // Native segwit (P2WSH)
      const p2wpkh = bitcoin.payments.p2wpkh({
        pubkey: child.publicKey,
        network,
      });
      address = bitcoin.payments.p2wsh({ redeem: p2wpkh, network }).address;
    } else if (addressType === "p2sh-p2wsh") {
      // P2SH-wrapped segwit (P2SH-P2WSH)
      const p2wpkh = bitcoin.payments.p2wpkh({
        pubkey: child.publicKey,
        network,
      });
      const p2wsh = bitcoin.payments.p2wsh({ redeem: p2wpkh, network });
      address = bitcoin.payments.p2sh({ redeem: p2wsh, network }).address;
    } else if (addressType === "p2wpkh") {
      // Native segwit (P2WPKH)
      address = bitcoin.payments.p2wpkh({
        pubkey: child.publicKey,
        network,
      }).address;
    } else if (addressType === "p2sh-p2wpkh") {
      // P2SH-wrapped segwit (P2SH-P2WPKH)
      const p2wpkh = bitcoin.payments.p2wpkh({
        pubkey: child.publicKey,
        network,
      });
      address = bitcoin.payments.p2sh({ redeem: p2wpkh, network }).address;
    } else if (addressType === "p2tr") {
      // Taproot (BIP86)
      address = bitcoin.payments.p2tr({
        pubkey: child.publicKey.subarray(1, 33), // x-only pubkey
        network,
      }).address;
    } else {
      // Legacy (P2PKH)
      address = bitcoin.payments.p2pkh({
        pubkey: child.publicKey,
        network,
      }).address;
    }

    if (!address) {
      logger.error(`Failed to generate address at index ${derivationIndex}`);
      return null;
    }

    addresses.push({
      address,
      index: derivationIndex,
    });
  }

  return addresses;
};
