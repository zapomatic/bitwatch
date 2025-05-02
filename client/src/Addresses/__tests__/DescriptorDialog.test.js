import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DescriptorDialog from "../DescriptorDialog";
import { defaultDescriptorForm } from "../defaults";
import { jest } from "@jest/globals";
import testData from "../../../../test-data/keys.json";

// Use test keys and descriptors from the shared test data
const TEST_KEYS = {
  xpub1: testData.keys.xpub1,
  xpub2: testData.keys.xpub2,
};

describe("DescriptorDialog", () => {
  const mockOnSave = jest.fn();
  const mockOnClose = jest.fn();
  const collection = "test";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders with default form", () => {
    render(
      <DescriptorDialog
        open={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        collection={collection}
      />
    );

    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Descriptor")).toBeInTheDocument();
    expect(screen.getByLabelText("Initial Addresses")).toBeInTheDocument();
    expect(screen.getByLabelText("Skip")).toBeInTheDocument();
    expect(screen.getByLabelText("Gap Limit")).toBeInTheDocument();
  });

  test("validates required fields", async () => {
    mockOnSave.mockRejectedValueOnce("Name and descriptor are required");

    render(
      <DescriptorDialog
        open={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        collection={collection}
      />
    );

    fireEvent.click(screen.getByText("Add"));
    await waitFor(() => {
      expect(
        screen.getByText("Name and descriptor are required")
      ).toBeInTheDocument();
    });
  });

  test("saves valid form data", async () => {
    const formData = {
      name: "Test Descriptor",
      descriptor: testData.descriptors.xpubSingle,
      gapLimit: "20",
      initialAddresses: "10",
      skip: "0",
    };

    mockOnSave.mockResolvedValueOnce(undefined);

    render(
      <DescriptorDialog
        open={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        collection={collection}
      />
    );

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: formData.name },
    });
    fireEvent.change(screen.getByLabelText("Descriptor"), {
      target: { value: formData.descriptor },
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

  test("handles editing existing descriptor", async () => {
    const existingDescriptor = {
      name: "Existing Descriptor",
      descriptor: testData.descriptors.xpubSingle,
      gapLimit: "20",
      initialAddresses: "10",
      skip: "0",
    };

    render(
      <DescriptorDialog
        open={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        collection={collection}
        descriptor={existingDescriptor}
      />
    );

    // Convert string values to numbers for comparison since the input fields are type="number"
    expect(screen.getByLabelText("Name")).toHaveValue(existingDescriptor.name);
    expect(screen.getByLabelText("Descriptor")).toHaveValue(
      existingDescriptor.descriptor
    );
    expect(screen.getByLabelText("Initial Addresses")).toHaveValue(
      Number(existingDescriptor.initialAddresses)
    );
    expect(screen.getByLabelText("Skip")).toHaveValue(
      Number(existingDescriptor.skip)
    );
    expect(screen.getByLabelText("Gap Limit")).toHaveValue(
      Number(existingDescriptor.gapLimit)
    );
  });
});
