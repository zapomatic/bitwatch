import { expect } from "@playwright/test";
import testData from "../../../test-data/keys.json" with { type: "json" };
import verifyBalance from "../lib/verifyBalance.js";

const MOCK_API = "http://localhost:3006";

const waitForTrackedAddress = async (address) => {
  await expect
    .poll(
      async () => {
        const response = await globalThis.fetch(
          `${MOCK_API}/test/tracked-addresses`
        );
        const { addresses } = await response.json();
        return addresses;
      },
      { timeout: 10000 }
    )
    .toContain(address);
};

const simulateTransaction = async (tx) => {
  const response = await globalThis.fetch(`${MOCK_API}/test/simulate-transaction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tx }),
  });

  expect(response.ok).toBe(true);
  const result = await response.json();
  expect(result.delivered).toBeGreaterThan(0);
};

export default async (page) => {
  const address = testData.plain.zapomatic;

  console.log("Testing mempool websocket activity...");
  await waitForTrackedAddress(address);

  await simulateTransaction({
    txid: "websocket-e2e-transaction",
    vin: [
      {
        prevout: {
          scriptpubkey_address: address,
          value: 1000,
        },
      },
    ],
    vout: [
      {
        scriptpubkey_address: address,
        value: 2500,
      },
    ],
  });

  await verifyBalance(page, address, {
    chain_in: "0.00010000 ₿",
    chain_out: "0.00001000 ₿",
    mempool_in: "0.00002500 ₿",
    mempool_out: "0.00001000 ₿",
  });

  await expect(page.getByTestId(`${address}-mempool-out-diff`)).toBeVisible();
  await expect(page.getByTestId(`${address}-accept-button`)).toBeVisible();
  console.log("Mempool websocket activity verified");
};
