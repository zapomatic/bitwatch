// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  websocket: jest.fn(),
  processing: jest.fn(),
  scan: jest.fn(),
  success: jest.fn(),
  warning: jest.fn(),
  network: jest.fn(),
  data: jest.fn(),
  wsState: jest.fn(),
  mempool: jest.fn(),
  block: jest.fn(),
  transaction: jest.fn(),
  system: jest.fn(),
  telegram: jest.fn(),
};

jest.mock("../logger.js", () => ({
  __esModule: true,
  default: mockLogger,
}));

const {
  parseDescriptor,
  validateDescriptor,
  deriveAddresses,
} = require("../descriptors.js");
const { readFileSync } = require("fs");
const { join } = require("path");

const testData = JSON.parse(
  readFileSync(join(__dirname, "../../test-data/keys.json"), "utf-8")
);

describe("Descriptor Parsing", () => {
  test("should parse valid multi-sig descriptor", () => {
    const result = parseDescriptor(testData.descriptors.multiSig);

    expect(result.success).toBe(true);
    expect(result.data.type).toBe("multi-sig");
    expect(result.data.scriptType).toBe("wsh");
    expect(result.data.requiredSignatures).toBe(2);
    expect(result.data.totalSignatures).toBe(2);
    expect(result.data.keys).toHaveLength(2);
  });

  test("should parse valid sorted multi-sig descriptor", () => {
    const result = parseDescriptor(testData.descriptors.sortedMultiSig);

    expect(result.success).toBe(true);
    expect(result.data.type).toBe("multi-sig");
    expect(result.data.scriptType).toBe("wsh");
    expect(result.data.requiredSignatures).toBe(2);
    expect(result.data.totalSignatures).toBe(2);
  });

  test("should validate descriptor format", () => {
    const result = validateDescriptor(testData.descriptors.multiSig);

    expect(result.valid).toBe(true);
    expect(result.type).toBe("multi-sig");
    expect(result.scriptType).toBe("wsh");
    expect(result.requiredSignatures).toBe(2);
    expect(result.totalSignatures).toBe(2);
  });
});

describe("Address Derivation", () => {
  test("should derive addresses from multi-sig descriptor", async () => {
    const result = await deriveAddresses(testData.descriptors.multiSig, 0, 2);

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
    expect(result.data[0].address).toBeDefined();
    expect(result.data[0].index).toBe(0);
    expect(result.data[1].address).toBeDefined();
    expect(result.data[1].index).toBe(1);
  });

  test("should handle different key types (xpub, ypub, zpub)", async () => {
    const result = await deriveAddresses(
      testData.descriptors.mixedKeyTypes,
      0,
      1
    );

    expect(result.success).toBe(true);
    expect(result.data[0].address).toBeDefined();
  });

  test("should handle skip parameter", async () => {
    const result = await deriveAddresses(
      testData.descriptors.multiSig,
      0,
      2,
      5
    );

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
    expect(result.data[0].index).toBe(5);
    expect(result.data[1].index).toBe(6);
  });

  test("derived addresses should match expected addresses", async () => {
    // Test single key address derivation
    const xpub1Addresses = testData.addresses.xpub1.addresses;
    const ypub1Addresses = testData.addresses.ypub1.addresses;
    const zpub1Addresses = testData.addresses.zpub1.addresses;

    // Test xpub addresses (P2PKH)
    const xpubResult = await deriveAddresses(
      testData.descriptors.xpubSingle,
      0,
      5
    );
    expect(xpubResult.success).toBe(true);
    xpubResult.data.forEach((addr, i) => {
      expect(addr.address).toBe(xpub1Addresses[i].address);
    });

    // Test ypub addresses (P2SH-P2WPKH)
    const ypubResult = await deriveAddresses(
      testData.descriptors.ypubSingle,
      0,
      5
    );
    expect(ypubResult.success).toBe(true);
    ypubResult.data.forEach((addr, i) => {
      expect(addr.address).toBe(ypub1Addresses[i].address);
    });

    // Test zpub addresses (P2WPKH)
    const zpubResult = await deriveAddresses(
      testData.descriptors.zpubSingle,
      0,
      5
    );
    expect(zpubResult.success).toBe(true);
    zpubResult.data.forEach((addr, i) => {
      expect(addr.address).toBe(zpub1Addresses[i].address);
    });
  });
});
