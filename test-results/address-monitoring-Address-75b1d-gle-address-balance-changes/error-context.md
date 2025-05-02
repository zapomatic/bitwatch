# Test info

- Name: Address Monitoring >> monitors single address balance changes
- Location: /Users/adameivy/github.com/zapomatic/bitwatch/tests/e2e/address-monitoring.spec.js:11:3

# Error details

```
Error: page.waitForSelector: Target page, context or browser has been closed
Call log:
  - waiting for locator('text=bc1qpux3z758ulsxg69eptaakukraanqwtdxe5yy4c') to be visible

    at /Users/adameivy/github.com/zapomatic/bitwatch/tests/e2e/address-monitoring.spec.js:47:16
```

# Test source

```ts
   1 | import { test, expect } from './test-environment.js';
   2 | import testData from '../../test-data/keys.json' with { type: 'json' };
   3 |
   4 | test.describe('Address Monitoring', () => {
   5 |   test.beforeEach(async ({ page }) => {
   6 |     // Navigate to the app and wait for it to load
   7 |     await page.goto('/');
   8 |     await page.waitForLoadState('networkidle');
   9 |   });
   10 |
   11 |   test('monitors single address balance changes', async ({ page, mockServices }) => {
   12 |     // Setup test data
   13 |     const testAddress = testData.addresses.zpub1.addresses[0];
   14 |     
   15 |     // Set up initial balance
   16 |     mockServices.mempool.setAddressBalance(testAddress.address, {
   17 |       chain_in: 0,
   18 |       chain_out: 0,
   19 |       mempool_in: 0,
   20 |       mempool_out: 0
   21 |     });
   22 |     
   23 |     // Update client mock balances
   24 |     await page.evaluate(balances => {
   25 |       window.__setMockBalances(balances);
   26 |     }, mockServices.mempool.getBalances());
   27 |     
   28 |     // Add collection by clicking button and entering name in the table
   29 |     await page.getByRole('button', { name: 'Add Collection' }).click();
   30 |     await page.getByRole('textbox').fill('Test Collection');
   31 |     await page.getByRole('button', { name: /^Add$/ }).click();
   32 |     
   33 |     // Expand the collection
   34 |     await page.getByRole('row').filter({ hasText: 'Test Collection' })
   35 |       .getByRole('button')
   36 |       .first()
   37 |       .click();
   38 |     
   39 |     // Add address to collection
   40 |     await page.getByTestId('Test Collection-add-address').click();
   41 |     await page.getByRole('textbox', { name: 'Name' }).fill('Test Address');
   42 |     await page.getByRole('textbox', { name: 'Address' }).fill(testAddress.address);
   43 |     await page.getByRole('button', { name: 'Save' }).click();
   44 |
   45 |     // Wait for dialog to close and state to update
   46 |     await page.waitForSelector('text=Test Address');
>  47 |     await page.waitForSelector(`text=${testAddress.address}`);
      |                ^ Error: page.waitForSelector: Target page, context or browser has been closed
   48 |
   49 |     // Simulate balance change
   50 |     mockServices.mempool.setAddressBalance(testAddress.address, {
   51 |       chain_in: 100000,
   52 |       chain_out: 0,
   53 |       mempool_in: 50000,
   54 |       mempool_out: 0
   55 |     });
   56 |
   57 |     // Update client mock balances
   58 |     await page.evaluate(balances => {
   59 |       window.__setMockBalances(balances);
   60 |     }, mockServices.mempool.getBalances());
   61 |
   62 |     // Emit state update
   63 |     mockServices.websocket.emit('updateState', {
   64 |       collections: {
   65 |         'Test Collection': {
   66 |           name: 'Test Collection',
   67 |           addresses: [{
   68 |             name: 'Test Address',
   69 |             address: testAddress.address,
   70 |             actual: {
   71 |               chain_in: 100000,
   72 |               chain_out: 0,
   73 |               mempool_in: 50000,
   74 |               mempool_out: 0
   75 |             }
   76 |           }]
   77 |         }
   78 |       }
   79 |     });
   80 |
   81 |     // Wait for balance update
   82 |     await page.waitForSelector('text=100,000');
   83 |     await page.waitForSelector('text=50,000');
   84 |   });
   85 |
   86 |   test('monitors extended public key addresses', async ({ page, mockServices }) => {
   87 |     const testKey = testData.addresses.zpub1;
   88 |
   89 |     // Set up initial balances
   90 |     for (const addr of testKey.addresses) {
   91 |       mockServices.mempool.setAddressBalance(addr.address, {
   92 |         chain_in: 0,
   93 |         chain_out: 0,
   94 |         mempool_in: 0,
   95 |         mempool_out: 0
   96 |       });
   97 |     }
   98 |
   99 |     // Update client mock balances
  100 |     await page.evaluate(balances => {
  101 |       window.__setMockBalances(balances);
  102 |     }, mockServices.mempool.getBalances());
  103 |
  104 |     // Add collection by clicking button and entering name in the table
  105 |     await page.getByRole('button', { name: 'Add Collection' }).click();
  106 |     await page.getByRole('textbox').fill('Test Collection');
  107 |     await page.getByRole('button', { name: /^Add$/ }).click();
  108 |
  109 |     // Expand the collection
  110 |     await page.getByRole('row').filter({ hasText: 'Test Collection' })
  111 |       .getByRole('button')
  112 |       .first()
  113 |       .click();
  114 |
  115 |     // Add extended key
  116 |     await page.getByTestId('Test Collection-add-extended-key').click();
  117 |     await page.getByRole('textbox', { name: 'Name' }).fill('Test Key');
  118 |     await page.getByRole('textbox', { name: 'Extended Key' }).fill(testKey.key);
  119 |     await page.getByRole('button', { name: 'Add' }).click();
  120 |
  121 |     // Wait for addresses to be derived and displayed
  122 |     await page.waitForSelector(`text=${testKey.addresses[0].address}`);
  123 |
  124 |     // Verify addresses are displayed
  125 |     for (const addr of testKey.addresses) {
  126 |       await expect(page.getByText(addr.address)).toBeVisible();
  127 |     }
  128 |
  129 |     // Simulate balance changes
  130 |     for (const addr of testKey.addresses) {
  131 |       mockServices.mempool.setAddressBalance(addr.address, {
  132 |         chain_in: 100000,
  133 |         chain_out: 0,
  134 |         mempool_in: 50000,
  135 |         mempool_out: 0
  136 |       });
  137 |     }
  138 |
  139 |     // Update client mock balances
  140 |     await page.evaluate(balances => {
  141 |       window.__setMockBalances(balances);
  142 |     }, mockServices.mempool.getBalances());
  143 |
  144 |     // Emit state update
  145 |     mockServices.websocket.emit('updateState', {
  146 |       collections: {
  147 |         'Test Collection': {
```