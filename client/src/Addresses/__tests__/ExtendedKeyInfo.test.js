import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { jest } from "@jest/globals";
import testData from "../../../../test-data/keys.json" with { type: "json" };
import ExtendedKeyInfo from "../ExtendedKeyInfo";

describe("ExtendedKeyInfo", () => {
  const mockOnDelete = jest.fn();
  const mockOnEdit = jest.fn();
  const extendedKey = {
    name: "Test Key",
    key: testData.keys.xpub1,
    derivationPath: "m/0",
    gapLimit: 20,
    skipAddresses: 0,
    initialAddresses: 10,
    collection: "test",
    addresses: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("deleting extended key doesn't trigger collection deletion", () => {
    render(
      <ExtendedKeyInfo
        extendedKey={extendedKey}
        onDelete={mockOnDelete}
        onEdit={mockOnEdit}
      />
    );

    const deleteButton = screen.getByTestId("delete-button");
    fireEvent.click(deleteButton);

    expect(mockOnDelete).toHaveBeenCalledWith({ extendedKey });
  });

  test("expanding and collapsing works correctly", () => {
    render(
      <ExtendedKeyInfo
        extendedKey={extendedKey}
        onDelete={mockOnDelete}
        onEdit={mockOnEdit}
      />
    );

    // Initially should show expand more icon
    const expandButton = screen.getByTestId("expand-button");
    expect(expandButton).toBeInTheDocument();

    // Click to expand
    fireEvent.click(expandButton);

    // Should show expand less icon
    const collapseButton = screen.getByTestId("collapse-button");
    expect(collapseButton).toBeInTheDocument();
  });
});
