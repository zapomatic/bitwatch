// scripts/generate-test-data.js

import { BIP32Factory } from "bip32";
import * as ecc from "tiny-secp256k1";
import * as bitcoin from "bitcoinjs-lib";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import logger from "../server/logger.js";
import { descriptorExtractPaths } from "../server/descriptorExtractPaths.js";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bip32 = BIP32Factory(ecc);

// --- NETWORK SETUP ---------------------------------------------------------

const networks = {
  xpub: {
    ...bitcoin.networks.bitcoin,
    bip32: { public: 0x0488b21e, private: 0x0488ade4 },
  },
  ypub: {
    ...bitcoin.networks.bitcoin,
    bip32: { public: 0x049d7cb2, private: 0x049d7878 },
  },
  zpub: {
    ...bitcoin.networks.bitcoin,
    bip32: { public: 0x04b24746, private: 0x04b2430c },
  },
};

const getKeyNetwork = (key) => {
  const lk = key.toLowerCase();
  if (lk.startsWith("ypub")) return networks.ypub;
  if (lk.startsWith("zpub")) return networks.zpub;
  return networks.xpub;
};
// --- DERIVE ADDRESSES FROM ANY SUPPORTED DESCRIPTOR -----------------------

function parseDescriptorType(descriptor) {
  // Recursively unwrap wrappers
  // let type = null;
  let inner = descriptor;
  let wrappers = [];
  while (true) {
    const m = inner.match(/^(\w+)\((.*)\)$/);
    if (!m) break;
    wrappers.push(m[1]);
    inner = m[2];
    // If we hit multi or sortedmulti, stop unwrapping
    if (m[1] === "multi" || m[1] === "sortedmulti") break;
  }
  return { wrappers, inner };
}

function deriveAddresses(descriptor, start = 0, count = 6, skip = 0) {
  // Determine descriptor type and unwrap
  const { wrappers, inner } = parseDescriptorType(descriptor);
  // let type = wrappers[0];
  let isMulti = wrappers.includes("multi") || wrappers.includes("sortedmulti");
  let isSorted = wrappers.includes("sortedmulti");

  // For multi/sortedmulti, parse threshold and keys
  let threshold = 1;
  let keys = [];
  if (isMulti) {
    // multi(2,xpub/0/*,xpub/1/*) or sortedmulti(2,xpub/0/*,xpub/1/*)
    const multiMatch = inner.match(/^(\d+),(.+)$/);
    if (!multiMatch) throw new Error("Invalid multi descriptor");
    threshold = parseInt(multiMatch[1], 10);
    keys = multiMatch[2].split(",").map((k) => k.trim());
  } else {
    keys = [inner];
  }

  const baseIndex = start + skip;
  const out = [];

  for (let i = 0; i < count; i++) {
    const idx = baseIndex + i;
    // Derive all public keys
    const pubs = keys.map((key) => {
      // Remove any origin info
      const keyMatch = key.match(/^(\[.*\])?([A-Za-z0-9]+)(\/.*)?$/);
      const xpub = keyMatch ? keyMatch[2] : key;
      const path =
        keyMatch && keyMatch[3] ? keyMatch[3].replace(/^\//, "") : "";
      let node = bip32.fromBase58(xpub, getKeyNetwork(xpub));
      if (path) {
        for (const seg of path.split("/")) {
          node =
            seg === "*" ? node.derive(idx) : node.derive(parseInt(seg, 10));
        }
      } else {
        node = node.derive(idx);
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
      // sh(wpkh(...))
      const p2wpkh = bitcoin.payments.p2wpkh({ pubkey: pubs[0] });
      payment = bitcoin.payments.p2sh({ redeem: p2wpkh });
    } else {
      throw new Error("Unsupported descriptor type: " + descriptor);
    }

    if (payment?.address) out.push({ index: idx, address: payment.address });
    else logger.error(`Failed to derive address at index ${idx}`);
  }

  return out;
}

// --- YOUR EXISTING EXTENDED KEY GENERATION -------------------------------

function generateTestKeys() {
  // seeds (unchanged from your original)
  const seeds = {
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

  // roots
  const roots = {
    xpub: bip32.fromSeed(seeds.xpub, networks.xpub),
    ypub: bip32.fromSeed(seeds.ypub, networks.ypub),
    zpub: bip32.fromSeed(seeds.zpub, networks.zpub),
    desc_xpub: bip32.fromSeed(seeds.desc_xpub, networks.xpub),
    desc_xpub2: bip32.fromSeed(seeds.desc_xpub2, networks.xpub),
    desc_ypub: bip32.fromSeed(seeds.desc_ypub, networks.ypub),
    desc_zpub: bip32.fromSeed(seeds.desc_zpub, networks.zpub),
  };

  // derivation paths
  const derivationPaths = {
    xpub: { receive: "m/44/0/0", change: "m/44/0/1", test: "m/44/0/2" },
    ypub: { receive: "m/49/0/0", change: "m/49/0/1", test: "m/49/0/2" },
    zpub: { receive: "m/84/0/0", change: "m/84/0/1", test: "m/84/0/2" },
  };

  // neuter & toBase58
  const xpub1 = roots.xpub
    .derivePath(derivationPaths.xpub.receive)
    .neutered()
    .toBase58();
  const ypub1 = roots.ypub
    .derivePath(derivationPaths.ypub.receive)
    .neutered()
    .toBase58();
  const zpub1 = roots.zpub
    .derivePath(derivationPaths.zpub.receive)
    .neutered()
    .toBase58();
  const desc_x = roots.desc_xpub
    .derivePath(derivationPaths.xpub.receive)
    .neutered()
    .toBase58();
  const desc_x2 = roots.desc_xpub2
    .derivePath(derivationPaths.xpub.receive)
    .neutered()
    .toBase58();
  const desc_y = roots.desc_ypub
    .derivePath(derivationPaths.ypub.receive)
    .neutered()
    .toBase58();
  const desc_z = roots.desc_zpub
    .derivePath(derivationPaths.zpub.receive)
    .neutered()
    .toBase58();

  return {
    xpub1,
    ypub1,
    zpub1,
    desc_xpub: desc_x,
    desc_xpub2: desc_x2,
    desc_ypub: desc_y,
    desc_zpub: desc_z,
    derivationPaths,
  };
}

// --- BUILD TEST-DATA ------------------------------------------------------

function generateTestDescriptors(keys) {
  const M = keys;
  const descs = {
    xpubSingle: `pkh(${M.desc_xpub}/0/*)`,
    ypubSingle: `sh(wpkh(${M.desc_ypub}/0/*))`,
    zpubSingle: `wpkh(${M.desc_zpub}/0/*)`,
    multiSig: `wsh(multi(2,${M.desc_xpub}/0/*,${M.desc_xpub}/1/*))`,
    sortedMulti: `wsh(sortedmulti(2,${M.desc_xpub2}/0/*,${M.desc_xpub}/0/*))`,
    mixedKeys: `wsh(multi(2,${M.desc_ypub}/0/*,${M.desc_zpub}/0/*))`,
  };

  return Object.fromEntries(
    Object.entries(descs).map(([name, d]) => [
      name,
      {
        key: d,
        derivationPath: descriptorExtractPaths(d),
        addresses: deriveAddresses(d, 0, 6),
      },
    ])
  );
}

function generateTestData() {
  const keys = generateTestKeys();
  const out = { extendedKeys: {}, descriptors: {} };

  // extended
  for (const [name, val] of Object.entries(keys)) {
    if (name === "derivationPaths" || name.startsWith("desc_")) continue;

    const keyType = name.startsWith("ypub")
      ? "ypub"
      : name.startsWith("zpub")
      ? "zpub"
      : "xpub";

    const derivationPath = keys.derivationPaths[keyType].receive;

    // reuse deriveAddresses for single‑key descriptors by forming a faux descriptor:
    //  pkh(xpub/derivation/*)  or wpkh/sh(wpkh) as needed

    const base = derivationPath.split("/").slice(1).join("/");
    const fauxDesc =
      keyType === "xpub"
        ? `pkh(${val}/${base}/*)`
        : keyType === "ypub"
        ? `sh(wpkh(${val}/${base}/*))`
        : `wpkh(${val}/${base}/*)`;

    out.extendedKeys[name] = {
      key: val,
      type: keyType,
      derivationPath,
      addresses: deriveAddresses(fauxDesc, 0, 6),
    };
  }

  // descriptors
  out.descriptors = generateTestDescriptors(keys);
  return out;
}

// --- MAIN -----------------------------------------------------------------

(async () => {
  logger.info("Generating test data…");
  try {
    const data = generateTestData();
    data.plain = { zapomatic: "bc1q67csgqm9muhynyd864tj2p48g8gachyg2nwara" };
    const fp = path.join(__dirname, "../test-data/keys.json");
    await fs.mkdir(path.dirname(fp), { recursive: true });
    await fs.writeFile(fp, JSON.stringify(data, null, 2));
    logger.info(`✓ Test data written to ${fp}`);
  } catch (e) {
    // Dump the real error so you can see what's going on:
    console.error("Fatal error in data generation:", e);
    console.error(e.stack);
    process.exit(1);
  }
})();
