import { expect } from "@playwright/test";
import findAndClick from "../lib/findAndClick.js";

const addCollection = async (page, name) => {
  await findAndClick(page, '[aria-label="New Collection"]');
  const input = page.locator('.crystal-input[aria-label="Collection Name"]');
  await expect(input).toBeVisible();
  await input.fill(name);
  await input.press("Enter");
  await expect(page.getByText(name)).toBeVisible();
  console.log(`Created collection: ${name}`);
};

const getCollectionNames = async (page) => {
  // Get all collection name elements in order, excluding table headers
  const elements = await page
    .locator('tr.collection-row [data-testid$="-name"]')
    .all();
  const names = await Promise.all(elements.map((el) => el.textContent()));
  console.log("Current collection order:", names);
  return names;
};

export default async (page) => {
  // Navigate to addresses page
  await findAndClick(page, '[data-testid="watch-list-button"]');
  console.log("Navigated to addresses page");

  // Add first collection
  await addCollection(page, "Donations Collection");
  console.log("Verified first collection was added");

  // Add two more collections
  await addCollection(page, "Test 42");
  await addCollection(page, "Test 2");
  console.log("Added additional test collections");

  // Verify all collections are visible
  await expect(page.getByTestId("Donations Collection-name")).toBeVisible();
  await expect(page.getByTestId("Test 42-name")).toBeVisible();
  await expect(page.getByTestId("Test 2-name")).toBeVisible();

  // Test sorting by name ascending (need to click twice since it starts descending)
  await findAndClick(page, '[data-testid="sort-by-name"]');
  console.log("Clicked sort by name first time (descending)");

  // Verify descending sort order first
  const namesDesc = await getCollectionNames(page);
  expect(namesDesc).toEqual(["Test 42", "Test 2", "Donations Collection"]);
  console.log("Verified descending sort order");

  // Click again for ascending
  await findAndClick(page, '[data-testid="sort-by-name"]');
  console.log("Clicked sort by name second time (ascending)");

  // Verify ascending sort order
  const namesAsc = await getCollectionNames(page);
  expect(namesAsc).toEqual(["Donations Collection", "Test 2", "Test 42"]);
  console.log("Verified ascending sort order");

  // Test sorting by name back to descending
  await findAndClick(page, '[data-testid="sort-by-name"]');
  console.log("Clicked sort by name third time (back to descending)");

  // Verify back to descending sort order
  const namesDescAgain = await getCollectionNames(page);
  expect(namesDescAgain).toEqual(["Test 42", "Test 2", "Donations Collection"]);
  console.log("Verified back to descending sort order");

  // Delete Test 42 collection
  await findAndClick(page, '[data-testid="Test 42-delete"]');
  await expect(
    page.locator('[data-testid="delete-confirmation-dialog"]')
  ).toBeVisible();
  await findAndClick(page, '[data-testid="delete-confirmation-confirm"]', {
    allowOverlay: true,
  });
  await expect(page.getByTestId("Test 42-name")).not.toBeVisible();
  console.log("Deleted Test 42 collection");

  // Delete Test 2 collection
  await findAndClick(page, '[data-testid="Test 2-delete"]');
  await expect(
    page.locator('[data-testid="delete-confirmation-dialog"]')
  ).toBeVisible();
  await findAndClick(page, '[data-testid="delete-confirmation-confirm"]', {
    allowOverlay: true,
  });
  await expect(page.getByTestId("Test 2-name")).not.toBeVisible();
  console.log("Deleted Test 2 collection");

  // Verify only Donations Collection remains
  await expect(page.getByTestId("Test 42-name")).not.toBeVisible();
  await expect(page.getByTestId("Test 2-name")).not.toBeVisible();
  await expect(page.getByTestId("Donations Collection-name")).toBeVisible();
  console.log("Verified only Donations Collection remains");

  // Edit the remaining collection name using the save button first
  await findAndClick(page, '[data-testid="Donations Collection-edit"]');
  console.log("Clicked edit collection button");

  // Wait for the edit input to be visible and fill in new name
  const editInput = page.getByTestId("Donations Collection-edit-input");
  await expect(editInput).toBeVisible({ timeout: 10000 });
  await editInput.fill("Donations Clicked");
  console.log("Filled in new collection name: Donations Clicked");

  // Click the save button and wait for the notification
  await findAndClick(page, '[data-testid="Donations Collection-save"]');
  console.log("Clicked save button");

  // Wait for success notification
  let notification = page.getByTestId("notification");
  await expect(notification).toBeVisible();
  await expect(notification).toHaveClass(/MuiAlert-standardSuccess/);
  console.log("Verified success notification");

  // Wait for the name to update
  await expect(page.getByTestId("Donations Collection-name")).not.toBeVisible();
  await expect(page.getByTestId("Donations Clicked-name")).toBeVisible();
  console.log("Verified collection was renamed to: Donations Clicked");

  // Now edit again and use Enter key
  await findAndClick(page, '[data-testid="Donations Clicked-edit"]');
  console.log("Clicked edit collection button again");

  // Wait for the edit input and fill in final name
  const finalEditInput = page.getByTestId("Donations Clicked-edit-input");
  await expect(finalEditInput).toBeVisible({ timeout: 10000 });
  await finalEditInput.fill("Donations");
  await finalEditInput.press("Enter");
  console.log("Filled in new collection name: Donations and pressed Enter");

  // Wait for success notification
  notification = page.getByTestId("notification");
  await expect(notification).toBeVisible();
  await expect(notification).toHaveClass(/MuiAlert-standardSuccess/);
  console.log("Verified success notification");

  // Wait for the name to update to final name
  await expect(page.getByTestId("Donations Clicked-name")).not.toBeVisible();
  await expect(page.getByTestId("Donations-name")).toBeVisible();
  console.log("Verified collection was renamed to: Donations");
};
