import { BIP32Factory } from "bip32";
import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "tiny-secp256k1";
import logger from "./logger.js";
import { parseMultiSigDescriptor, getKeyNetwork } from "./descriptors.js";

const bip32 = BIP32Factory(ecc);

export const deriveExtendedKeyAddresses = async (
  extendedKey,
  startIndex,
  count,
  derivationPath
) => {
  const addresses = [];

  // Extract key from extendedKey object if needed
  const keyString =
    typeof extendedKey === "object" ? extendedKey.key : extendedKey;
  const skipValue = typeof extendedKey === "object" ? extendedKey.skip || 0 : 0;

  logger.scan(
    `Deriving ${count} addresses starting from index ${startIndex} with skip ${skipValue}`
  );

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

  // Determine which network to use based on key prefix
  const keyLower = keyString.toLowerCase();
  let network;
  if (keyLower.startsWith("zpub")) {
    network = networks.zpub;
  } else if (keyLower.startsWith("ypub")) {
    network = networks.ypub;
  } else {
    network = networks.xpub;
  }

  // Decode the extended key
  let node;
  // fromBase58 will throw if invalid, we'll let it return undefined
  node = bip32.fromBase58(keyString, network);
  if (!node) {
    logger.error("Failed to decode extended key");
    return null;
  }

  // Parse derivation path and get the base node
  const pathParts = derivationPath.split("/").slice(1); // Remove 'm'
  let baseNode = node;
  for (const part of pathParts) {
    const isHardened = part.endsWith("'") || part.endsWith("h");
    if (isHardened) {
      logger.error("Cannot derive hardened keys from extended public keys");
      return null;
    }
    const index = parseInt(part.replace(/['h]/g, ""));
    if (isNaN(index)) {
      logger.error("Invalid derivation path index");
      return null;
    }
    baseNode = baseNode.derive(index);
    if (!baseNode) {
      logger.error("Failed to derive path");
      return null;
    }
  }

  // Calculate the actual start index including skip
  const actualStartIndex = startIndex + skipValue;

  // Derive addresses starting from the actual start index
  for (let i = 0; i < count; i++) {
    const derivationIndex = actualStartIndex + i;
    const child = baseNode.derive(derivationIndex);
    if (!child) {
      logger.error(`Failed to derive child at index ${derivationIndex}`);
      return null;
    }

    // Use appropriate address type based on key prefix
    let address;
    if (keyLower.startsWith("zpub")) {
      // Native segwit (P2WPKH)
      address = bitcoin.payments.p2wpkh({
        pubkey: child.publicKey,
        network,
      }).address;
    } else if (keyLower.startsWith("ypub")) {
      // P2SH-wrapped segwit (P2SH-P2WPKH)
      const p2wpkh = bitcoin.payments.p2wpkh({
        pubkey: child.publicKey,
        network,
      });
      address = bitcoin.payments.p2sh({ redeem: p2wpkh, network }).address;
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
      name: `Address ${derivationIndex}`,
      address,
      index: derivationIndex,
    });
  }

  return addresses;
};
