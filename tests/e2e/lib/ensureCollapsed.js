import findAndClick from "./findAndClick";
export default async (page, parentKey) => {
  const expandButton = page.getByTestId(`${parentKey}-expand-button`);
  const expandedState = await expandButton.getAttribute("aria-expanded");

  if (expandedState === "true") {
    await findAndClick(page, `${parentKey}-expand-button`);
  }
};
