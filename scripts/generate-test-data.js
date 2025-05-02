import * as bitcoin from "bitcoinjs-lib";
import { BIP32Factory } from "bip32";
import * as ecc from "tiny-secp256k1";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import bs58check from "bs58check";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bip32 = BIP32Factory(ecc);

// Version bytes for different key types
const NETWORKS = {
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

// Convert xpub to ypub/zpub
const convertXPubToType = (xpub, targetType) => {
  // First decode as xpub
  const decoded = bs58check.decode(xpub);

  // Create a new buffer from the decoded data
  const buffer = Buffer.from(decoded);

  // Replace version bytes
  buffer.writeUInt32BE(NETWORKS[targetType].bip32.public, 0);

  // Encode back to base58
  return bs58check.encode(buffer);
};

// Generate test keys
const generateTestKeys = () => {
  // generate a seed using the bip-32 test vector
  const seed = Buffer.from("000102030405060708090a0b0c0d0e0f", "hex");

  // Create root node
  const root = bip32.fromSeed(seed);

  // Derive test keys
  const xpub1 = root.derivePath("m/44'/0'/0'").neutered().toBase58();
  const xpub2 = root.derivePath("m/44'/0'/1'").neutered().toBase58();
  const ypub1 = convertXPubToType(
    root.derivePath("m/49'/0'/0'").neutered().toBase58(),
    "ypub"
  );
  const zpub1 = convertXPubToType(
    root.derivePath("m/84'/0'/0'").neutered().toBase58(),
    "zpub"
  );

  return {
    xpub1,
    xpub2,
    ypub1,
    zpub1,
  };
};

// Generate test addresses from keys
const generateTestAddresses = (keys) => {
  const addresses = {};

  // Generate addresses for each key type
  Object.entries(keys).forEach(([keyName, key]) => {
    const keyType = keyName.substring(0, keyName.length - 1); // Remove the number to get type
    const network = NETWORKS[keyType];
    const node = bip32.fromBase58(key, network);
    addresses[keyName] = {
      key,
      addresses: [],
    };

    // Generate first 5 addresses for each key
    for (let i = 0; i < 5; i++) {
      const child = node.derive(0).derive(i);
      let address;

      if (keyType === "xpub") {
        // P2PKH (legacy)
        const { address: p2pkh } = bitcoin.payments.p2pkh({
          pubkey: child.publicKey,
          network: bitcoin.networks.bitcoin,
        });
        address = p2pkh;
      } else if (keyType === "ypub") {
        // P2SH-P2WPKH (nested SegWit)
        const { address: p2sh } = bitcoin.payments.p2sh({
          redeem: bitcoin.payments.p2wpkh({
            pubkey: child.publicKey,
            network: bitcoin.networks.bitcoin,
          }),
          network: bitcoin.networks.bitcoin,
        });
        address = p2sh;
      } else if (keyType === "zpub") {
        // P2WPKH (native SegWit)
        const { address: p2wpkh } = bitcoin.payments.p2wpkh({
          pubkey: child.publicKey,
          network: bitcoin.networks.bitcoin,
        });
        address = p2wpkh;
      }

      addresses[keyName].addresses.push({
        index: i,
        address,
      });
    }
  });

  return addresses;
};

// Generate test descriptors
const generateTestDescriptors = (keys) => {
  return {
    // Multi-sig descriptors
    multiSig: `wsh(multi(2,${keys.xpub1}/0/*,${keys.xpub2}/0/*))`,
    sortedMultiSig: `wsh(sortedmulti(2,${keys.xpub1}/0/*,${keys.xpub2}/0/*))`,
    mixedKeyTypes: `wsh(multi(2,${keys.ypub1}/0/*,${keys.zpub1}/0/*))`,

    // Single key descriptors
    xpubSingle: `pkh(${keys.xpub1}/0/*)`, // P2PKH
    ypubSingle: `sh(wpkh(${keys.ypub1}/0/*))`, // P2SH-P2WPKH
    zpubSingle: `wpkh(${keys.zpub1}/0/*)`, // P2WPKH
  };
};

const main = async () => {
  const testKeys = generateTestKeys();
  const testAddresses = generateTestAddresses(testKeys);
  const testDescriptors = generateTestDescriptors(testKeys);

  const testData = {
    keys: testKeys,
    addresses: testAddresses,
    descriptors: testDescriptors,
  };

  // Save to file
  const outputPath = path.join(__dirname, "../test-data/keys.json");
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(testData, null, 2));
  console.log("Test data generated and saved to:", outputPath);
};

main().catch(console.error);
