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
    ...bitcoin.networks.bitcoin, // Standard bitcoin network
    bip32: {
      public: 0x0488b21e, // xpub
      private: 0x0488ade4, // xprv
    },
  },
  ypub: {
    ...bitcoin.networks.bitcoin, // Base on bitcoin network, but override bip32 versions
    bip32: {
      public: 0x049d7cb2, // ypub
      private: 0x049d7878, // yprv
    },
  },
  zpub: {
    ...bitcoin.networks.bitcoin, // Base on bitcoin network, but override bip32 versions
    bip32: {
      public: 0x04b24746, // zpub
      private: 0x04b2430c, // zprv
    },
  },
};

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

  // Create root nodes for each key type and purpose, specifying the network
  const roots = {
    // Extended keys
    xpub: bip32.fromSeed(seeds.xpub, NETWORKS.xpub), // Specify xpub network
    ypub: bip32.fromSeed(seeds.ypub, NETWORKS.ypub), // Specify ypub network
    zpub: bip32.fromSeed(seeds.zpub, NETWORKS.zpub), // Specify zpub network
    // Descriptors
    desc_xpub: bip32.fromSeed(seeds.desc_xpub, NETWORKS.xpub),
    desc_xpub2: bip32.fromSeed(seeds.desc_xpub2, NETWORKS.xpub),
    desc_ypub: bip32.fromSeed(seeds.desc_ypub, NETWORKS.ypub),
    desc_zpub: bip32.fromSeed(seeds.desc_zpub, NETWORKS.zpub),
  };

  // Define derivation paths for each key type
  const derivationPaths = {
    xpub: {
      receive: "m/44/0/0", // Legacy receive
      change: "m/44/0/1", // Legacy change
      test: "m/44/0/2", // Test path
    },
    ypub: {
      receive: "m/49/0/0", // P2SH-P2WPKH receive
      change: "m/49/0/1", // P2SH-P2WPKH change
      test: "m/49/0/2", // Test path
    },
    zpub: {
      receive: "m/84/0/0", // Native SegWit receive
      change: "m/84/0/1", // Native SegWit change
      test: "m/84/0/2", // Test path
    },
  };

  // Derive test keys for extended keys
  // Call .toBase58() without arguments to use the node's inherent network
  const xpub1 = roots.xpub
    .derivePath(derivationPaths.xpub.receive)
    .neutered()
    .toBase58();
  console.log("Generated xpub1:", xpub1);

  const xpub2 = roots.xpub
    .derivePath(derivationPaths.xpub.change)
    .neutered()
    .toBase58();
  console.log("Generated xpub2:", xpub2);

  // Generate ypub with correct format
  const ypub1 = roots.ypub
    .derivePath(derivationPaths.ypub.receive)
    .neutered()
    .toBase58();
  console.log("Generated ypub1:", ypub1);

  // Generate zpub with correct format
  const zpub1 = roots.zpub
    .derivePath(derivationPaths.zpub.receive)
    .neutered()
    .toBase58();
  console.log("Generated zpub1:", zpub1);

  // Derive test keys for descriptors
  const desc_xpub = roots.desc_xpub
    .derivePath(derivationPaths.xpub.receive)
    .neutered()
    .toBase58();
  console.log("Generated desc_xpub:", desc_xpub);

  const desc_xpub2 = roots.desc_xpub2
    .derivePath(derivationPaths.xpub.receive)
    .neutered()
    .toBase58();
  console.log("Generated desc_xpub2:", desc_xpub2);

  const desc_ypub = roots.desc_ypub
    .derivePath(derivationPaths.ypub.receive)
    .neutered()
    .toBase58();
  console.log("Generated desc_ypub:", desc_ypub);

  const desc_zpub = roots.desc_zpub
    .derivePath(derivationPaths.zpub.receive)
    .neutered()
    .toBase58();
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
    // Derivation paths
    derivationPaths,
  };
};

// Generate test addresses from keys
const generateAddressesForKey = (
  key,
  keyType,
  network,
  skip = 0,
  derivationPath = "m/0"
) => {
  // First decode using the correct network for the key type
  // This should now work as the key string will have the correct version bytes
  let node;
  try {
    node = bip32.fromBase58(key, NETWORKS[keyType]);
  } catch (error) {
    console.error(
      `Failed to decode key: ${key} with keyType ${keyType}`,
      error
    );
    return { addresses: [], key };
  }

  if (!node) {
    console.error(`Failed to decode key: ${key} with keyType ${keyType}`);
    return { addresses: [], key };
  }

  const addresses = [];
  // Generate first 6 addresses for each key, taking skip into account
  for (let i = 0; i < 6; i++) {
    const actualIndex = i + skip;

    // Parse derivation path and get the base node
    const pathParts = derivationPath.split("/").slice(1); // Remove 'm'
    let baseNode = node;
    for (const part of pathParts) {
      const index = parseInt(part);
      if (isNaN(index)) {
        console.error("Invalid derivation path index");
        return { addresses: [], key };
      }
      baseNode = baseNode.derive(index);
    }

    // Derive the final address index
    const child = baseNode.derive(actualIndex);
    let address;

    if (keyType === "xpub") {
      // P2PKH (legacy)
      const { address: p2pkh } = bitcoin.payments.p2pkh({
        pubkey: child.publicKey,
        network: bitcoin.networks.bitcoin, // Use bitcoin.networks.bitcoin for address generation
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

    if (address) {
      addresses.push({
        index: actualIndex,
        address,
      });
    }
  }

  return { addresses, key };
};

const generateTestAddresses = (keys) => {
  const result = {
    extendedKeys: {},
    descriptors: {},
  };

  // Process extended keys
  for (const [name, keyData] of Object.entries(keys)) {
    if (name.startsWith("desc_")) continue; // Skip descriptor keys for now
    if (name === "derivationPaths") continue; // Skip the derivationPaths object

    // Determine key type from the key name
    let keyType;
    if (name.startsWith("ypub")) {
      keyType = "ypub";
    } else if (name.startsWith("zpub")) {
      keyType = "zpub";
    } else {
      keyType = "xpub"; // Default or if name is xpub1, xpub2
    }

    // Set skip values to match our test configuration
    const skip = name === "xpub1" ? 2 : 0;

    // Make sure we're passing the key string, not the key object
    const keyString = typeof keyData === "string" ? keyData : keyData.key;
    if (!keyString) {
      console.error(`No key found for ${name}`);
      continue;
    }

    // Get the appropriate derivation path based on the key name
    let derivationPath;
    if (name === "xpub1" || name === "ypub1" || name === "zpub1") {
      derivationPath = keys.derivationPaths[keyType].receive;
    } else if (name === "xpub2") {
      derivationPath = keys.derivationPaths.xpub.change;
    }

    const { addresses } = generateAddressesForKey(
      keyString,
      keyType,
      NETWORKS[keyType],
      skip,
      derivationPath
    );

    result.extendedKeys[name] = {
      key: keyString,
      type: keyType,
      addresses,
      derivationPath,
    };
  }

  // Process descriptors
  const descriptors = generateTestDescriptors(keys);
  for (const [name, descriptor] of Object.entries(descriptors)) {
    // Extract the xpub/ypub/zpub key from the descriptor
    const keyMatch = descriptor.match(/([xyz]pub[A-Za-z0-9]+)/);
    if (!keyMatch) {
      console.error(`Could not extract key from descriptor: ${descriptor}`);
      continue;
    }

    const keyString = keyMatch[1];
    const keyType = keyString.startsWith("ypub")
      ? "ypub"
      : keyString.startsWith("zpub")
      ? "zpub"
      : "xpub";

    // Set skip values to match our test configuration
    const skip = 0;

    const { addresses } = generateAddressesForKey(
      keyString,
      keyType,
      NETWORKS[keyType],
      skip
    );

    // Get the appropriate derivation path based on the descriptor type
    let derivationPath;
    if (name.includes("Single")) {
      derivationPath = keys.derivationPaths[keyType].receive;
    } else if (name.includes("Multi")) {
      // For multi-sig, we use a combination of receive and change paths
      derivationPath = `${keys.derivationPaths[keyType].receive},${keys.derivationPaths[keyType].change}`;
    } else if (name === "mixedKeyTypes") {
      // For mixed key types, we need both ypub and zpub paths
      derivationPath = `${keys.derivationPaths.ypub.receive},${keys.derivationPaths.zpub.receive}`;
    }

    result.descriptors[name] = {
      key: descriptor,
      type: keyType,
      addresses,
      derivationPath,
    };
  }

  return result;
};

// Generate test descriptors
const generateTestDescriptors = (keys) => {
  // keys.desc_xpub, keys.desc_ypub, keys.desc_zpub are now correctly formatted extended public keys
  return {
    // Multi-sig descriptors
    // Assuming derivation path for multi-sig participants is <xpub>/<chain>/*
    // where <chain> is 0 for external, 1 for internal, and * is the address index.
    multiSig: `wsh(multi(2,${keys.desc_xpub}/0/*,${keys.desc_xpub}/1/*))`, // Example: 2 keys, one from chain 0, one from chain 1
    sortedMultiSig: `wsh(sortedmulti(2,${keys.desc_xpub2}/0/*,${keys.desc_xpub}/0/*))`, // Using two different xpubs for sorted multi-sig
    mixedKeyTypes: `wsh(multi(2,${keys.desc_ypub}/0/*,${keys.desc_zpub}/0/*))`, // Mixed ypub and zpub in a multi-sig

    // Single key descriptors
    // Path /0/* means external chain, any address index.
    xpubSingle: `pkh(${keys.desc_xpub}/0/*)`, // P2PKH
    ypubSingle: `sh(wpkh(${keys.desc_ypub}/0/*))`, // P2SH-P2WPKH
    zpubSingle: `wpkh(${keys.desc_zpub}/0/*)`, // P2WPKH
  };
};

const main = async () => {
  console.log("Starting test data generation...");
  const testKeys = generateTestKeys();
  console.log("\nGenerated Test Keys:", JSON.stringify(testKeys, null, 2));

  console.log("\nGenerating Test Addresses...");
  const testAddresses = generateTestAddresses(testKeys);
  testAddresses.plain = {
    zapomatic: "bc1q67csgqm9muhynyd864tj2p48g8gachyg2nwara",
  };

  // Save to file
  const outputPath = path.join(__dirname, "../test-data/keys.json");
  try {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(testAddresses, null, 2));
    console.log("\nTest data generated and saved to:", outputPath);
    console.log(
      "Generated data structure:",
      JSON.stringify(
        testAddresses,
        (key, value) => {
          // Basic summary to avoid overly long output in console for verification
          if (key === "addresses" && Array.isArray(value))
            return `[${value.length} addresses]`;
          return value;
        },
        2
      )
    );
  } catch (error) {
    console.error("Error during file operations or main execution:", error);
  }
};

main().catch((error) => {
  console.error("Unhandled error in main:", error);
});
