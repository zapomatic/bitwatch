import * as bitcoin from "bitcoinjs-lib";
import { BIP32Factory } from "bip32";
import * as ecc from "tiny-secp256k1";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

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

// Convert xpub to ypub/zpub using bip32
// const convertXPubToType = (xpub, targetType) => {
//   // First decode as xpub
//   const node = bip32.fromBase58(xpub, NETWORKS.xpub);
//   if (!node) return null;

//   // Convert to target type by using the target network
//   return node.toBase58(NETWORKS[targetType]);
// };

// Generate test keys
const generateTestKeys = () => {
  // Generate different seeds for each key type and purpose
  const seeds = {
    // Extended keys
    xpub: Buffer.from(
      "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
      "hex"
    ),
    ypub: Buffer.from(
      "1112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f30",
      "hex"
    ),
    zpub: Buffer.from(
      "22232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f4041",
      "hex"
    ),
    // Descriptors
    desc_xpub: Buffer.from(
      "333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f5051",
      "hex"
    ),
    desc_xpub2: Buffer.from(
      "666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f8081828384",
      "hex"
    ),
    desc_ypub: Buffer.from(
      "4445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f606162",
      "hex"
    ),
    desc_zpub: Buffer.from(
      "55565758595a5b5c5d5e5f606162636465666768696a6b6c6d6e6f70717273",
      "hex"
    ),
  };

  // Create root nodes for each key type and purpose
  const roots = {
    // Extended keys
    xpub: bip32.fromSeed(seeds.xpub),
    ypub: bip32.fromSeed(seeds.ypub),
    zpub: bip32.fromSeed(seeds.zpub),
    // Descriptors
    desc_xpub: bip32.fromSeed(seeds.desc_xpub),
    desc_xpub2: bip32.fromSeed(seeds.desc_xpub2),
    desc_ypub: bip32.fromSeed(seeds.desc_ypub),
    desc_zpub: bip32.fromSeed(seeds.desc_zpub),
  };

  // Derive test keys for extended keys
  const xpub1 = roots.xpub
    .derivePath("m/44'/0'/0'")
    .neutered()
    .toBase58(NETWORKS.xpub);
  console.log("Generated xpub1:", xpub1);

  const xpub2 = roots.xpub
    .derivePath("m/44'/0'/1'")
    .neutered()
    .toBase58(NETWORKS.xpub);
  console.log("Generated xpub2:", xpub2);

  const ypub1 = roots.ypub
    .derivePath("m/49'/0'/0'")
    .neutered()
    .toBase58(NETWORKS.ypub);
  console.log("Generated ypub1:", ypub1);

  const zpub1 = roots.zpub
    .derivePath("m/84'/0'/0'")
    .neutered()
    .toBase58(NETWORKS.zpub);
  console.log("Generated zpub1:", zpub1);

  // Derive test keys for descriptors
  const desc_xpub = roots.desc_xpub
    .derivePath("m/44'/0'/0'")
    .neutered()
    .toBase58(NETWORKS.xpub);
  console.log("Generated desc_xpub:", desc_xpub);

  const desc_xpub2 = roots.desc_xpub2
    .derivePath("m/44'/0'/0'")
    .neutered()
    .toBase58(NETWORKS.xpub);
  console.log("Generated desc_xpub2:", desc_xpub2);

  const desc_ypub = roots.desc_ypub
    .derivePath("m/49'/0'/0'")
    .neutered()
    .toBase58(NETWORKS.ypub);
  console.log("Generated desc_ypub:", desc_ypub);

  const desc_zpub = roots.desc_zpub
    .derivePath("m/84'/0'/0'")
    .neutered()
    .toBase58(NETWORKS.zpub);
  console.log("Generated desc_zpub:", desc_zpub);

  return {
    // Extended keys
    xpub1,
    xpub2,
    ypub1,
    zpub1,
    // Descriptor keys
    desc_xpub,
    desc_xpub2,
    desc_ypub,
    desc_zpub,
  };
};

// Generate test addresses from keys
const generateAddressesForKey = (key, keyType, network, skip = 0) => {
  const node = bip32.fromBase58(key, network);
  if (!node) {
    console.error(`Failed to decode key: ${key}`);
    return [];
  }

  const addresses = [];
  // Generate first 6 addresses for each key, taking skip into account
  for (let i = 0; i < 6; i++) {
    const actualIndex = i + skip;
    console.log(
      `Generating address at index ${actualIndex} (base index ${i} + skip ${skip})`
    );
    const child = node.derive(0).derive(actualIndex);
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

    if (!address) {
      console.error(`Failed to generate address at index ${actualIndex}`);
      continue;
    }

    addresses.push({
      index: actualIndex,
      address,
    });
  }

  return addresses;
};

const generateTestAddresses = (keys) => {
  const result = {
    plain: {
      zapomatic: "bc1q67csgqm9muhynyd864tj2p48g8gachyg2nwara",
    },
    extended: {},
    descriptors: {},
  };

  // Process extended keys
  Object.entries(keys).forEach(([keyName, key]) => {
    // Skip descriptor keys
    if (keyName.startsWith("desc_")) return;

    // Determine key type from the key prefix
    let keyType;
    const keyLower = key.toLowerCase();
    if (keyLower.startsWith("zpub")) {
      keyType = "zpub";
    } else if (keyLower.startsWith("ypub")) {
      keyType = "ypub";
    } else if (keyLower.startsWith("xpub")) {
      keyType = "xpub";
    } else {
      console.error(`Unknown key type for key: ${keyName}`);
      return;
    }

    // Set skip values to match our test configuration
    const skip = 0; // xpub1 has skip=2 in our test
    console.log(
      `Processing extended key ${keyName} of type ${keyType} with skip=${skip}`
    );
    const network = NETWORKS[keyType];

    result.extended[keyName] = {
      key,
      type: keyType,
      addresses: generateAddressesForKey(key, keyType, network, skip),
    };
  });

  // Process descriptors
  const descriptors = generateTestDescriptors(keys);
  Object.entries(descriptors).forEach(([name, descriptor]) => {
    console.log(`Processing descriptor ${name}`);

    // Parse the descriptor to get the key and path
    const keyMatch = descriptor.match(/[xyz]pub[A-Za-z0-9]+\/[^)]+/);
    if (!keyMatch) {
      console.error(`Could not parse key from descriptor: ${descriptor}`);
      return;
    }

    const [key, path] = keyMatch[0].split("/");
    const keyType = key.toLowerCase().startsWith("zpub")
      ? "zpub"
      : key.toLowerCase().startsWith("ypub")
      ? "ypub"
      : "xpub";

    // Set skip values to match our test configuration
    const skip = name === "xpubSingle" ? 1 : 0; // xpubSingle has skip=1 in our test
    console.log(`Using skip=${skip} for descriptor ${name}`);

    // Generate addresses using the proper derivation path
    const addresses = [];
    const node = bip32.fromBase58(key, NETWORKS[keyType]);
    if (!node) {
      console.error(`Failed to decode key: ${key}`);
      return;
    }

    // Derive the base node using the path from the descriptor
    let baseNode = node;
    const pathParts = path.split("/");
    for (const part of pathParts) {
      if (part === "*") continue; // Skip the wildcard, we'll handle it in the loop
      const index = parseInt(part);
      if (isNaN(index)) {
        console.error(`Invalid path component: ${part}`);
        return;
      }
      baseNode = baseNode.derive(index);
    }

    // Generate addresses using the proper derivation
    for (let i = 0; i < 6; i++) {
      const actualIndex = i + skip;
      const child = baseNode.derive(actualIndex);
      let address;

      if (descriptor.startsWith("pkh(")) {
        // P2PKH (legacy)
        address = bitcoin.payments.p2pkh({
          pubkey: child.publicKey,
          network: bitcoin.networks.bitcoin,
        }).address;
      } else if (descriptor.startsWith("sh(wpkh(")) {
        // P2SH-P2WPKH (nested SegWit)
        address = bitcoin.payments.p2sh({
          redeem: bitcoin.payments.p2wpkh({
            pubkey: child.publicKey,
            network: bitcoin.networks.bitcoin,
          }),
          network: bitcoin.networks.bitcoin,
        }).address;
      } else if (descriptor.startsWith("wpkh(")) {
        // P2WPKH (native SegWit)
        address = bitcoin.payments.p2wpkh({
          pubkey: child.publicKey,
          network: bitcoin.networks.bitcoin,
        }).address;
      } else if (
        descriptor.startsWith("wsh(multi(") ||
        descriptor.startsWith("wsh(sortedmulti(")
      ) {
        // For multi-sig, we need to derive all keys and create the script
        const keys = descriptor.match(/[xyz]pub[A-Za-z0-9]+\/[^,)]+/g);
        if (!keys) {
          console.error(
            `Could not parse keys from multi-sig descriptor: ${descriptor}`
          );
          return;
        }

        const threshold = parseInt(descriptor.match(/multi\((\d+),/)[1]);
        const pubkeys = [];

        for (const keyStr of keys) {
          const [key, path] = keyStr.split("/");
          const keyNode = bip32.fromBase58(key, NETWORKS[keyType]);
          if (!keyNode) {
            console.error(`Failed to decode key: ${key}`);
            return;
          }

          let keyBaseNode = keyNode;
          const keyPathParts = path.split("/");
          for (const part of keyPathParts) {
            if (part === "*") continue;
            const index = parseInt(part);
            if (isNaN(index)) {
              console.error(`Invalid path component: ${part}`);
              return;
            }
            keyBaseNode = keyBaseNode.derive(index);
          }
          pubkeys.push(keyBaseNode.derive(actualIndex).publicKey);
        }

        // Sort pubkeys if it's a sortedmulti
        const sortedPubkeys = descriptor.startsWith("wsh(sortedmulti(")
          ? pubkeys.sort((a, b) => a.compare(b))
          : pubkeys;

        address = bitcoin.payments.p2wsh({
          redeem: bitcoin.payments.p2ms({
            m: threshold,
            pubkeys: sortedPubkeys,
          }),
          network: bitcoin.networks.bitcoin,
        }).address;
      }

      if (!address) {
        console.error(`Failed to generate address at index ${actualIndex}`);
        continue;
      }

      addresses.push({
        index: actualIndex,
        address,
      });
    }

    result.descriptors[name] = {
      key: descriptor,
      type: keyType,
      addresses,
    };
  });

  return result;
};

// Generate test descriptors
const generateTestDescriptors = (keys) => {
  return {
    // Multi-sig descriptors
    multiSig: `wsh(multi(2,${keys.desc_xpub}/0/*,${keys.desc_xpub}/0/*))`,
    sortedMultiSig: `wsh(sortedmulti(2,${keys.desc_xpub2}/0/*,${keys.desc_xpub2}/0/*))`,
    mixedKeyTypes: `wsh(multi(2,${keys.desc_ypub}/0/*,${keys.desc_zpub}/0/*))`,

    // Single key descriptors
    xpubSingle: `pkh(${keys.desc_xpub}/0/*)`, // P2PKH
    ypubSingle: `sh(wpkh(${keys.desc_ypub}/0/*))`, // P2SH-P2WPKH
    zpubSingle: `wpkh(${keys.desc_zpub}/0/*)`, // P2WPKH
  };
};

const main = async () => {
  const testKeys = generateTestKeys();
  const testAddresses = generateTestAddresses(testKeys);

  // Save to file
  const outputPath = path.join(__dirname, "../test-data/keys.json");
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(testAddresses, null, 2));
  console.log("Test data generated and saved to:", outputPath);
};

main().catch(console.error);
