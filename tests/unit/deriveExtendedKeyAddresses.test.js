import assert from "node:assert/strict";
import { test } from "node:test";
import { BIP32Factory } from "bip32";
import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "tiny-secp256k1";
import { deriveExtendedKeyAddresses } from "../../server/lib/deriveExtendedKeyAddresses.js";

bitcoin.initEccLib(ecc);

const bip32 = BIP32Factory(ecc);
const network = {
  ...bitcoin.networks.bitcoin,
  bip32: {
    public: 0x0488b21e,
    private: 0x0488ade4,
  },
};
const seed = Buffer.from(
  "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
  "hex"
);

const root = bip32.fromSeed(seed, network);
const accountXpub = root.derivePath("m/84'/0'/0'").neutered().toBase58();

const nativeSegwitAddress = (node) =>
  bitcoin.payments.p2wpkh({ pubkey: node.publicKey, network }).address;

test("derives native SegWit addresses from an account xpub with a hardened origin", () => {
  const addresses = deriveExtendedKeyAddresses({
    key: accountXpub,
    derivationPath: "m/84'/0'/0'",
    count: 2,
  });

  assert.deepEqual(addresses, [
    {
      address: nativeSegwitAddress(root.derivePath("m/84'/0'/0'/0")),
      index: 0,
    },
    {
      address: nativeSegwitAddress(root.derivePath("m/84'/0'/0'/1")),
      index: 1,
    },
  ]);
});

test("derives the requested external branch after a hardened account origin", () => {
  const addresses = deriveExtendedKeyAddresses({
    key: accountXpub,
    derivationPath: "m/84'/0'/0'/0",
    count: 1,
  });

  assert.deepEqual(addresses, [
    {
      address: nativeSegwitAddress(root.derivePath("m/84'/0'/0'/0/0")),
      index: 0,
    },
  ]);
});

test("rejects hardened derivation that an xpub cannot perform", () => {
  const rootXpub = root.neutered().toBase58();

  assert.equal(
    deriveExtendedKeyAddresses({
      key: rootXpub,
      derivationPath: "m/84'/0'/0'",
      count: 1,
    }),
    null
  );

  assert.equal(
    deriveExtendedKeyAddresses({
      key: accountXpub,
      derivationPath: "m/84'/0'/0'/0'",
      count: 1,
    }),
    null
  );
});
