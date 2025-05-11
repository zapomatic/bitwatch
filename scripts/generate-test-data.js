// scripts/generate-test-data.js

import { BIP32Factory } from "bip32";
import * as ecc from "tiny-secp256k1";
import * as bitcoin from "bitcoinjs-lib";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import bs58 from "bs58";

import logger from "../server/logger.js";
import { descriptorExtractPaths } from "../server/descriptorExtractPaths.js";

bitcoin.initEccLib(ecc);

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
  Ypub: {
    ...bitcoin.networks.bitcoin,
    bip32: { public: 0x0295b43f, private: 0x0295b005 },
  },
  zpub: {
    ...bitcoin.networks.bitcoin,
    bip32: { public: 0x04b24746, private: 0x04b2430c },
  },
  Zpub: {
    ...bitcoin.networks.bitcoin,
    bip32: { public: 0x02aa7ed3, private: 0x02aa7a99 },
  },
  vpub: {
    ...bitcoin.networks.bitcoin,
    bip32: { public: 0x045f1cf6, private: 0x045f18bc },
  },
};

// Improved getKeyNetwork: version-bytes first, then prefix
const getKeyNetwork = (key) => {
  // 1) Try to detect by version bytes
  const decoded = bs58.decode(key);
  if (decoded.length >= 4) {
    const version =
      (decoded[0] << 24) | (decoded[1] << 16) | (decoded[2] << 8) | decoded[3];
    for (const net of Object.values(networks)) {
      if (net.bip32.public === version) return net;
    }
  }

  // 2) Fallback to explicit prefix checks
  if (key.startsWith("Ypub")) return networks.Ypub;
  if (key.startsWith("Zpub")) return networks.Zpub;
  const lk = key.toLowerCase();
  if (lk.startsWith("ypub")) return networks.ypub;
  if (lk.startsWith("zpub")) return networks.zpub;
  if (lk.startsWith("vpub")) return networks.vpub;
  if (lk.startsWith("xpub")) return networks.xpub;

  // Default
  return networks.xpub;
};

// --- DERIVE ADDRESSES FROM ANY SUPPORTED DESCRIPTOR -----------------------

function parseDescriptorType(descriptor) {
  let inner = descriptor;
  const wrappers = [];
  while (true) {
    const m = inner.match(/^([a-zA-Z]+)\((.*)\)$/);
    if (!m) break;
    wrappers.push(m[1]);
    inner = m[2];
    if (m[1] === "multi" || m[1] === "sortedmulti") break;
  }
  return { wrappers, inner };
}

function deriveAddresses(descriptor, start = 0, count = 6, skip = 0) {
  const { wrappers, inner } = parseDescriptorType(descriptor);
  const isMulti =
    wrappers.includes("multi") || wrappers.includes("sortedmulti");
  const isSorted = wrappers.includes("sortedmulti");

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

  const baseIndex = start + skip;
  const out = [];

  for (let i = 0; i < count; i++) {
    const idx = baseIndex + i;
    const pubs = keys
      .map((key) => {
        // Extract just the key part from the descriptor format
        const keyMatch = key.match(
          /^(\[.*\])?([A-Za-z0-9]+[1-9A-HJ-NP-Za-km-z]+)(\/.*)?$/
        );
        if (!keyMatch) return null;

        const xpub = keyMatch[2];
        const path = keyMatch[3] ? keyMatch[3].slice(1) : "";
        const net = getKeyNetwork(xpub);

        let node;
        try {
          node = bip32.fromBase58(xpub, net);
        } catch (e) {
          console.log("bip32.fromBase58 failed for key:", xpub, e);
          return null;
        }

        if (path) {
          for (const seg of path.split("/")) {
            node = seg === "*" ? node.derive(idx) : node.derive(Number(seg));
          }
        } else {
          node = node.derive(idx);
        }

        return node.publicKey;
      })
      .filter(Boolean);

    let payment;
    if (isMulti) {
      const usePubs = isSorted ? [...pubs].sort(Buffer.compare) : pubs;
      const ms = bitcoin.payments.p2ms({ m: threshold, pubkeys: usePubs });
      if (wrappers[0] === "wsh") {
        payment = bitcoin.payments.p2wsh({ redeem: ms });
      } else if (wrappers[0] === "sh") {
        payment = bitcoin.payments.p2sh({ redeem: ms });
      }
    } else if (wrappers[0] === "pkh") {
      payment = bitcoin.payments.p2pkh({ pubkey: pubs[0] });
    } else if (wrappers[0] === "wpkh") {
      payment = bitcoin.payments.p2wpkh({ pubkey: pubs[0] });
    } else if (wrappers[0] === "sh" && wrappers[1] === "wpkh") {
      const p2wpkh = bitcoin.payments.p2wpkh({ pubkey: pubs[0] });
      payment = bitcoin.payments.p2sh({ redeem: p2wpkh });
    } else if (wrappers[0] === "wsh" && wrappers.length === 1) {
      // bare wsh(single-key) → wrap P2WPKH in P2WSH
      const p2wpkh = bitcoin.payments.p2wpkh({ pubkey: pubs[0] });
      payment = bitcoin.payments.p2wsh({ redeem: p2wpkh });
    } else if (wrappers[0] === "sh" && wrappers[1] === "wsh") {
      // nested sh(wsh(single-key))
      const p2wpkh = bitcoin.payments.p2wpkh({ pubkey: pubs[0] });
      const p2wsh = bitcoin.payments.p2wsh({ redeem: p2wpkh });
      payment = bitcoin.payments.p2sh({ redeem: p2wsh });
    } else if (wrappers[0] === "tr") {
      // Taproot (BIP86) expects x-only pubkey (32 bytes)
      payment = bitcoin.payments.p2tr({ pubkey: pubs[0].subarray(1, 33) });
    } else {
      throw new Error("Unsupported descriptor type: " + descriptor);
    }

    if (payment.address) out.push({ index: idx, address: payment.address });
    else logger.error(`Failed to derive address at index ${idx}`);
  }

  return out;
}

// --- YOUR EXISTING EXTENDED KEY GENERATION -------------------------------
// [unchanged]

// --- BUILD TEST-DATA ------------------------------------------------------
// [unchanged]

function generateTestKeys() {
  // seeds
  const seeds = {
    xpub: Buffer.from(
      "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
      "hex"
    ),
    ypub: Buffer.from(
      "1112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f30",
      "hex"
    ),
    Ypub: Buffer.from(
      "7778797a7b7c7d7e7f808182838485868788898a8b8c8d8e8f90919293949596",
      "hex"
    ),
    zpub: Buffer.from(
      "22232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f4041",
      "hex"
    ),
    Zpub: Buffer.from(
      "88898a8b8c8d8e8f909192939495969798999a9b9c9d9e9fa0a1a2a3a4a5a6a7",
      "hex"
    ),
    vpub: Buffer.from(
      "333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f5051",
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
    desc_Ypub: Buffer.from(
      "999a9b9c9d9e9fa0a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7",
      "hex"
    ),
    desc_zpub: Buffer.from(
      "55565758595a5b5c5d5e5f606162636465666768696a6b6c6d6e6f70717273",
      "hex"
    ),
    desc_Zpub: Buffer.from(
      "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899",
      "hex"
    ),
    desc_vpub: Buffer.from(
      "bbccddeeff00112233445566778899aabbccddeeff00112233445566778899aa",
      "hex"
    ),
  };

  // roots
  const roots = {
    xpub: bip32.fromSeed(seeds.xpub, networks.xpub),
    ypub: bip32.fromSeed(seeds.ypub, networks.ypub),
    Ypub: bip32.fromSeed(seeds.Ypub, networks.Ypub),
    zpub: bip32.fromSeed(seeds.zpub, networks.zpub),
    Zpub: bip32.fromSeed(seeds.Zpub, networks.Zpub),
    vpub: bip32.fromSeed(seeds.vpub, networks.vpub),
    desc_xpub: bip32.fromSeed(seeds.desc_xpub, networks.xpub),
    desc_xpub2: bip32.fromSeed(seeds.desc_xpub2, networks.xpub),
    desc_ypub: bip32.fromSeed(seeds.desc_ypub, networks.ypub),
    desc_Ypub: bip32.fromSeed(seeds.desc_Ypub, networks.Ypub),
    desc_zpub: bip32.fromSeed(seeds.desc_zpub, networks.zpub),
    desc_Zpub: bip32.fromSeed(seeds.desc_Zpub, networks.Zpub),
    desc_vpub: bip32.fromSeed(seeds.desc_vpub, networks.vpub),
  };

  // derivation paths
  const derivationPaths = {
    xpub: { receive: "m/44/0/0", change: "m/44/0/1", test: "m/44/0/2" },
    ypub: { receive: "m/49/0/0", change: "m/49/0/1", test: "m/49/0/2" },
    Ypub: { receive: "m/49/0/0", change: "m/49/0/1", test: "m/49/0/2" },
    zpub: { receive: "m/84/0/0", change: "m/84/0/1", test: "m/84/0/2" },
    Zpub: { receive: "m/84/0/0", change: "m/84/0/1", test: "m/84/0/2" },
    vpub: { receive: "m/86/0/0", change: "m/86/0/1", test: "m/86/0/2" },
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
  const Ypub1 = roots.Ypub.derivePath(derivationPaths.Ypub.receive)
    .neutered()
    .toBase58();
  const zpub1 = roots.zpub
    .derivePath(derivationPaths.zpub.receive)
    .neutered()
    .toBase58();
  const Zpub1 = roots.Zpub.derivePath(derivationPaths.Zpub.receive)
    .neutered()
    .toBase58();
  const vpub1 = roots.vpub
    .derivePath(derivationPaths.vpub.receive)
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
  const desc_Y = roots.desc_Ypub
    .derivePath(derivationPaths.Ypub.receive)
    .neutered()
    .toBase58();
  const desc_z = roots.desc_zpub
    .derivePath(derivationPaths.zpub.receive)
    .neutered()
    .toBase58();
  const desc_Z = roots.desc_Zpub
    .derivePath(derivationPaths.Zpub.receive)
    .neutered()
    .toBase58();
  const desc_v = roots.desc_vpub
    .derivePath(derivationPaths.vpub.receive)
    .neutered()
    .toBase58();

  return {
    xpub1,
    ypub1,
    Ypub1,
    zpub1,
    Zpub1,
    vpub1,
    desc_xpub: desc_x,
    desc_xpub2: desc_x2,
    desc_ypub: desc_y,
    desc_Ypub: desc_Y,
    desc_zpub: desc_z,
    desc_Zpub: desc_Z,
    desc_vpub: desc_v,
    derivationPaths,
  };
}

function generateTestDescriptors(keys) {
  const M = keys;
  const descs = {
    xpubSingle: `pkh(${M.desc_xpub}/0/*)`,
    ypubSingle: `sh(wpkh(${M.desc_ypub}/0/*))`,
    YpubSingle: `sh(wsh(${M.desc_Ypub}/0/*))`,
    zpubSingle: `wpkh(${M.desc_zpub}/0/*)`,
    ZpubSingle: `wsh(${M.desc_Zpub}/0/*)`,
    vpubSingle: `tr(${M.desc_vpub}/0/*)`,
    multiSig: `wsh(multi(2,${M.desc_xpub}/0/*,${M.desc_xpub}/1/*))`,
    sortedMulti: `wsh(sortedmulti(2,${M.desc_xpub2}/0/*,${M.desc_xpub}/0/*))`,
    mixedKeys: `wsh(multi(2,${M.desc_ypub}/0/*,${M.desc_zpub}/0/*))`,
    mixedKeysY: `sh(wsh(multi(2,${M.desc_Ypub}/0/*,${M.desc_Zpub}/0/*)))`,
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

    const keyType = name.startsWith("Ypub")
      ? "Ypub"
      : name.startsWith("Zpub")
      ? "Zpub"
      : name.startsWith("ypub")
      ? "ypub"
      : name.startsWith("zpub")
      ? "zpub"
      : "xpub";

    const derivationPath = keys.derivationPaths[keyType].receive;

    // Only use neutered (public) keys for descriptors
    const base = derivationPath.split("/").slice(1).join("/");
    const fauxDesc =
      keyType === "xpub"
        ? `pkh(${val}/${base}/*)`
        : keyType === "ypub"
        ? `sh(wpkh(${val}/${base}/*))`
        : keyType === "Ypub"
        ? `sh(wsh(${val}/${base}/*))`
        : keyType === "Zpub"
        ? `wsh(${val}/${base}/*)`
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
    console.error("Fatal error in data generation:", e);
    console.error(e.stack);
    process.exit(1);
  }
})();
