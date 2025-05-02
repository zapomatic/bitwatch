import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ExtendedKeyDialog from "../ExtendedKeyDialog";
import { jest } from "@jest/globals";
import testData from "../../../../test-data/keys.json";
import {
  DEFAULT_GAP_LIMIT,
  DEFAULT_INITIAL_ADDRESSES,
  DEFAULT_SKIP_ADDRESSES,
} from "../../config";

// Use test keys from the shared test data
const TEST_KEYS = {
  xpub: testData.keys.xpub1,
  ypub: testData.keys.ypub1,
  zpub: testData.keys.zpub1,
};

describe("ExtendedKeyDialog", () => {
  const mockOnSave = jest.fn();
  const mockOnClose = jest.fn();
  const collection = "test";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders with default form", () => {
    render(
      <ExtendedKeyDialog
        open={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        collection={collection}
      />
    );

    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Extended Key")).toBeInTheDocument();
    expect(screen.getByLabelText("Derivation Path")).toBeInTheDocument();
    expect(screen.getByLabelText("Initial Addresses")).toBeInTheDocument();
    expect(screen.getByLabelText("Skip")).toBeInTheDocument();
    expect(screen.getByLabelText("Gap Limit")).toBeInTheDocument();
  });

  test("validates required fields", async () => {
    mockOnSave.mockRejectedValueOnce("Name and extended key are required");

    render(
      <ExtendedKeyDialog
        open={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        collection={collection}
      />
    );

    fireEvent.click(screen.getByText("Add"));
    await waitFor(() => {
      expect(
        screen.getByText("Name and extended key are required")
      ).toBeInTheDocument();
    });
  });

  test("validates extended key format", async () => {
    mockOnSave.mockRejectedValueOnce("Invalid extended key format");

    render(
      <ExtendedKeyDialog
        open={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        collection={collection}
      />
    );

    fireEvent.change(screen.getByLabelText("Extended Key"), {
      target: { value: "invalid-key" },
    });
    fireEvent.click(screen.getByText("Add"));
    await waitFor(() => {
      expect(
        screen.getByText("Invalid extended key format")
      ).toBeInTheDocument();
    });
  });

  test("validates derivation path format", async () => {
    mockOnSave.mockRejectedValueOnce("Invalid derivation path format");

    render(
      <ExtendedKeyDialog
        open={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        collection={collection}
      />
    );

    fireEvent.change(screen.getByLabelText("Derivation Path"), {
      target: { value: "invalid-path" },
    });
    fireEvent.click(screen.getByText("Add"));
    await waitFor(() => {
      expect(
        screen.getByText("Invalid derivation path format")
      ).toBeInTheDocument();
    });
  });

  test("validates hardened derivation not allowed", async () => {
    mockOnSave.mockRejectedValueOnce("Hardened derivation not allowed");

    render(
      <ExtendedKeyDialog
        open={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        collection={collection}
      />
    );

    fireEvent.change(screen.getByLabelText("Derivation Path"), {
      target: { value: "m/44'/0'/0'" },
    });
    fireEvent.click(screen.getByText("Add"));
    await waitFor(() => {
      expect(
        screen.getByText("Hardened derivation not allowed")
      ).toBeInTheDocument();
    });
  });

  test("saves valid form data", async () => {
    const formData = {
      name: "Test Key",
      key: TEST_KEYS.xpub,
      derivationPath: "m/44/0/0",
      gapLimit: DEFAULT_GAP_LIMIT,
      initialAddresses: DEFAULT_INITIAL_ADDRESSES,
      skip: DEFAULT_SKIP_ADDRESSES,
    };

    mockOnSave.mockResolvedValueOnce(undefined);

    render(
      <ExtendedKeyDialog
        open={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        collection={collection}
      />
    );

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: formData.name },
    });
    fireEvent.change(screen.getByLabelText("Extended Key"), {
      target: { value: formData.key },
    });
    fireEvent.change(screen.getByLabelText("Derivation Path"), {
      target: { value: formData.derivationPath },
    });
    fireEvent.change(screen.getByLabelText("Initial Addresses"), {
      target: { value: formData.initialAddresses },
    });
    fireEvent.change(screen.getByLabelText("Skip"), {
      target: { value: formData.skip },
    });
    fireEvent.change(screen.getByLabelText("Gap Limit"), {
      target: { value: formData.gapLimit },
    });

    fireEvent.click(screen.getByText("Add"));
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(collection, formData);
    });
    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
