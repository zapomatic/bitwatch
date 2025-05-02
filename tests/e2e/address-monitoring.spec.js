import { test, expect } from './test-environment.js';
import testData from '../../test-data/keys.json' with { type: 'json' };

test.describe('Address Monitoring', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app and wait for it to load
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('monitors single address balance changes', async ({ page, mockServices }) => {
    // Setup test data
    const testAddress = testData.addresses.zpub1.addresses[0];
    
    // Set up initial balance
    mockServices.mempool.setAddressBalance(testAddress.address, {
      chain_in: 0,
      chain_out: 0,
      mempool_in: 0,
      mempool_out: 0
    });
    
    // Update client mock balances
    await page.evaluate(balances => {
      window.__setMockBalances(balances);
    }, mockServices.mempool.getBalances());
    
    // Add collection by clicking button and entering name in the table
    await page.getByRole('button', { name: 'Add Collection' }).click();
    await page.getByRole('textbox').fill('Test Collection');
    await page.getByRole('button', { name: /^Add$/ }).click();
    
    // Expand the collection
    await page.getByRole('row').filter({ hasText: 'Test Collection' })
      .getByRole('button')
      .first()
      .click();
    
    // Add address to collection
    await page.getByTestId('Test Collection-add-address').click();
    await page.getByRole('textbox', { name: 'Name' }).fill('Test Address');
    await page.getByRole('textbox', { name: 'Address' }).fill(testAddress.address);
    await page.getByRole('button', { name: 'Save' }).click();

    // Wait for dialog to close and state to update
    await page.waitForSelector('text=Test Address');
    await page.waitForSelector(`text=${testAddress.address}`);

    // Simulate balance change
    mockServices.mempool.setAddressBalance(testAddress.address, {
      chain_in: 100000,
      chain_out: 0,
      mempool_in: 50000,
      mempool_out: 0
    });

    // Update client mock balances
    await page.evaluate(balances => {
      window.__setMockBalances(balances);
    }, mockServices.mempool.getBalances());

    // Emit state update
    mockServices.websocket.emit('updateState', {
      collections: {
        'Test Collection': {
          name: 'Test Collection',
          addresses: [{
            name: 'Test Address',
            address: testAddress.address,
            actual: {
              chain_in: 100000,
              chain_out: 0,
              mempool_in: 50000,
              mempool_out: 0
            }
          }]
        }
      }
    });

    // Wait for balance update
    await page.waitForSelector('text=100,000');
    await page.waitForSelector('text=50,000');
  });

  test('monitors extended public key addresses', async ({ page, mockServices }) => {
    const testKey = testData.addresses.zpub1;

    // Set up initial balances
    for (const addr of testKey.addresses) {
      mockServices.mempool.setAddressBalance(addr.address, {
        chain_in: 0,
        chain_out: 0,
        mempool_in: 0,
        mempool_out: 0
      });
    }

    // Update client mock balances
    await page.evaluate(balances => {
      window.__setMockBalances(balances);
    }, mockServices.mempool.getBalances());

    // Add collection by clicking button and entering name in the table
    await page.getByRole('button', { name: 'Add Collection' }).click();
    await page.getByRole('textbox').fill('Test Collection');
    await page.getByRole('button', { name: /^Add$/ }).click();

    // Expand the collection
    await page.getByRole('row').filter({ hasText: 'Test Collection' })
      .getByRole('button')
      .first()
      .click();

    // Add extended key
    await page.getByTestId('Test Collection-add-extended-key').click();
    await page.getByRole('textbox', { name: 'Name' }).fill('Test Key');
    await page.getByRole('textbox', { name: 'Extended Key' }).fill(testKey.key);
    await page.getByRole('button', { name: 'Add' }).click();

    // Wait for addresses to be derived and displayed
    await page.waitForSelector(`text=${testKey.addresses[0].address}`);

    // Verify addresses are displayed
    for (const addr of testKey.addresses) {
      await expect(page.getByText(addr.address)).toBeVisible();
    }

    // Simulate balance changes
    for (const addr of testKey.addresses) {
      mockServices.mempool.setAddressBalance(addr.address, {
        chain_in: 100000,
        chain_out: 0,
        mempool_in: 50000,
        mempool_out: 0
      });
    }

    // Update client mock balances
    await page.evaluate(balances => {
      window.__setMockBalances(balances);
    }, mockServices.mempool.getBalances());

    // Emit state update
    mockServices.websocket.emit('updateState', {
      collections: {
        'Test Collection': {
          name: 'Test Collection',
          addresses: testKey.addresses.map(addr => ({
            name: addr.address,
            address: addr.address,
            actual: {
              chain_in: 100000,
              chain_out: 0,
              mempool_in: 50000,
              mempool_out: 0
            }
          }))
        }
      }
    });

    // Wait for balance updates
    await page.waitForSelector('text=100,000');
    const balances = page.getByText('100,000');
    await expect(balances).toHaveCount(testKey.addresses.length);
  });

  test('monitors descriptor wallet addresses', async ({ page, mockServices }) => {
    const testDescriptor = testData.descriptors.multiSig;

    // Add collection by clicking button and entering name in the table
    await page.getByRole('button', { name: 'Add Collection' }).click();
    await page.getByRole('textbox').fill('Test Collection');
    await page.getByRole('button', { name: /^Add$/ }).click();

    // Expand the collection
    await page.getByRole('row').filter({ hasText: 'Test Collection' })
      .getByRole('button')
      .first()
      .click();

    // Add descriptor
    await page.getByTestId('Test Collection-add-descriptor').click();
    await page.getByRole('textbox', { name: 'Name' }).fill('Test Descriptor');
    await page.getByRole('textbox', { name: 'Descriptor' }).fill(testDescriptor);
    await page.getByRole('button', { name: 'Add' }).click();

    // Wait for addresses to be derived and displayed
    await page.waitForSelector('text=bc1');

    // Get derived addresses
    const addresses = await page.locator('text=bc1').allTextContents();

    // Set up initial balances
    for (const addr of addresses) {
      mockServices.mempool.setAddressBalance(addr, {
        chain_in: 0,
        chain_out: 0,
        mempool_in: 0,
        mempool_out: 0
      });
    }

    // Update client mock balances
    await page.evaluate(balances => {
      window.__setMockBalances(balances);
    }, mockServices.mempool.getBalances());

    // Simulate balance changes
    for (const addr of addresses) {
      mockServices.mempool.setAddressBalance(addr, {
        chain_in: 100000,
        chain_out: 0,
        mempool_in: 50000,
        mempool_out: 0
      });
    }

    // Update client mock balances
    await page.evaluate(balances => {
      window.__setMockBalances(balances);
    }, mockServices.mempool.getBalances());

    // Emit state update
    mockServices.websocket.emit('updateState', {
      collections: {
        'Test Collection': {
          name: 'Test Collection',
          addresses: addresses.map(addr => ({
            name: addr,
            address: addr,
            actual: {
              chain_in: 100000,
              chain_out: 0,
              mempool_in: 50000,
              mempool_out: 0
            }
          }))
        }
      }
    });

    // Wait for balance updates
    await page.waitForSelector('text=100,000');
    const balances = page.getByText('100,000');
    await expect(balances).toHaveCount(addresses.length);
  });
});
