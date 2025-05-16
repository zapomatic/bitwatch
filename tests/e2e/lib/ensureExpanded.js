import findAndClick from "./findAndClick";
export default async (page, parentKey) => {
  const expandButton = page.getByTestId(`${parentKey}-expand-button`);
  const expandedState = await expandButton.getAttribute("aria-expanded");

  // Only expand if explicitly collapsed (aria-expanded="false")
  // If it's null or "true", we want to leave it as is
  if (expandedState === "false") {
    await findAndClick(page, `${parentKey}-expand-button`);
  }
};
