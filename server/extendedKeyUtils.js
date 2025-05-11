import * as bitcoin from "bitcoinjs-lib";
import bs58check from "bs58check";

// Define networks according to SLIP-132
export const NETWORK_TYPES = {
  xpub: {
    ...bitcoin.networks.bitcoin,
    bip32: {
      public: 0x0488b21e,
      private: 0x0488ade4,
    },
  },
  ypub: {
    ...bitcoin.networks.bitcoin,
    bip32: {
      public: 0x049d7cb2,
      private: 0x049d7878,
    },
  },
  Ypub: {
    ...bitcoin.networks.bitcoin,
    bip32: {
      public: 0x0295b43f,
      private: 0x0295b005,
    },
  },
  zpub: {
    ...bitcoin.networks.bitcoin,
    bip32: {
      public: 0x04b24746,
      private: 0x04b2430c,
    },
  },
  Zpub: {
    ...bitcoin.networks.bitcoin,
    bip32: {
      public: 0x02aa7ed3,
      private: 0x02aa7a99,
    },
  },
};

// Convert between extended public key formats
export const convertExtendedKey = (key) => {
  // Extract just the key part (before any derivation path)
  const keyPart = key.split("/")[0];

  try {
    // Decode the base58check data
    const data = bs58check.decode(keyPart);
    // Remove the first 4 bytes (version)
    const payload = data.slice(4);
    // Create new data with xpub version
    const newData = Buffer.concat([
      Buffer.from([0x04, 0x88, 0xb2, 0x1e]), // xpub version bytes
      payload,
    ]);
    // Encode back to base58check
    const xpub = bs58check.encode(newData);

    // Reattach the derivation path if it exists
    const path = key.slice(keyPart.length);
    return xpub + path;
  } catch (err) {
    console.error("Error converting extended key:", err);
    return null;
  }
};

// Get network for a key
export const getKeyNetwork = (key) => {
  // 1) Try to detect by version bytes first
  try {
    const data = bs58check.decode(key);
    if (data.length >= 4) {
      const version =
        (data[0] << 24) | (data[1] << 16) | (data[2] << 8) | data[3];
      for (const [__type, net] of Object.entries(NETWORK_TYPES)) {
        if (net.bip32.public === version) return net;
      }
    }
  } catch (e) {
    console.error("Error getting key network:", e);
    return null;
  }

  // 2) Fallback to explicit prefix checks
  if (key.startsWith("Ypub")) return NETWORK_TYPES.Ypub;
  if (key.startsWith("Zpub")) return NETWORK_TYPES.Zpub;
  const lk = key.toLowerCase();
  if (lk.startsWith("ypub")) return NETWORK_TYPES.ypub;
  if (lk.startsWith("zpub")) return NETWORK_TYPES.zpub;
  if (lk.startsWith("xpub")) return NETWORK_TYPES.xpub;

  return null;
};

// Get address type for a key
export const getAddressType = (key) => {
  if (key.startsWith("Ypub")) return "p2sh-p2wsh";
  if (key.startsWith("Zpub")) return "p2wsh";
  const lk = key.toLowerCase();
  if (lk.startsWith("zpub")) return "p2wpkh";
  if (lk.startsWith("ypub")) return "p2sh-p2wpkh";
  return "p2pkh";
};
