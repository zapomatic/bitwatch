import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import AddressDialog from "../AddressDialog";
import { defaultAddressForm } from "../defaults";
import { jest } from "@jest/globals";
import testData from "../../../../test-data/keys.json" with { type: "json" };

describe("AddressDialog", () => {
  const mockOnClose = jest.fn();
  const mockOnSave = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders with default form", () => {
    render(
      <AddressDialog open={true} onClose={mockOnClose} onSave={mockOnSave} />
    );

    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Address")).toBeInTheDocument();
    expect(screen.getByText("Expected Balances")).toBeInTheDocument();
    expect(screen.getByText("Monitoring Settings")).toBeInTheDocument();
  });

  test("validates required fields", () => {
    render(
      <AddressDialog open={true} onClose={mockOnClose} onSave={mockOnSave} />
    );

    fireEvent.click(screen.getByText("Save"));
    expect(mockOnSave).not.toHaveBeenCalled();
  });

  test("saves valid form data", () => {
    render(
      <AddressDialog open={true} onClose={mockOnClose} onSave={mockOnSave} />
    );

    const formData = {
      name: "Test Address",
      address: testData.addresses.xpub1.addresses[0].address,
      expect: {
        chain_in: "1",
        chain_out: "2",
        mempool_in: "3",
        mempool_out: "4",
      },
      monitor: {
        chain_in: "alert",
        chain_out: "auto-accept",
        mempool_in: "alert",
        mempool_out: "auto-accept",
      },
    };

    // Fill in basic info
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: formData.name },
    });
    fireEvent.change(screen.getByLabelText("Address"), {
      target: { value: formData.address },
    });

    // Fill in expected balances
    fireEvent.change(
      screen.getByLabelText("Chain In", { selector: "input[type='number']" }),
      {
        target: { value: formData.expect.chain_in },
      }
    );
    fireEvent.change(
      screen.getByLabelText("Chain Out", { selector: "input[type='number']" }),
      {
        target: { value: formData.expect.chain_out },
      }
    );
    fireEvent.change(
      screen.getByLabelText("Mempool In", { selector: "input[type='number']" }),
      {
        target: { value: formData.expect.mempool_in },
      }
    );
    fireEvent.change(
      screen.getByLabelText("Mempool Out", {
        selector: "input[type='number']",
      }),
      {
        target: { value: formData.expect.mempool_out },
      }
    );

    // Set monitoring settings
    const monitoringSelects = screen.getAllByRole("combobox");

    // Chain In
    fireEvent.mouseDown(monitoringSelects[0]);
    const chainInOptions = screen.getByRole("listbox");
    fireEvent.click(within(chainInOptions).getByText("Alert"));

    // Chain Out
    fireEvent.mouseDown(monitoringSelects[1]);
    const chainOutOptions = screen.getByRole("listbox");
    fireEvent.click(within(chainOutOptions).getByText("Auto Accept"));

    // Mempool In
    fireEvent.mouseDown(monitoringSelects[2]);
    const mempoolInOptions = screen.getByRole("listbox");
    fireEvent.click(within(mempoolInOptions).getByText("Alert"));

    // Mempool Out
    fireEvent.mouseDown(monitoringSelects[3]);
    const mempoolOutOptions = screen.getByRole("listbox");
    fireEvent.click(within(mempoolOutOptions).getByText("Auto Accept"));

    fireEvent.click(screen.getByText("Save"));

    expect(mockOnSave).toHaveBeenCalledWith({
      ...defaultAddressForm,
      name: formData.name,
      address: formData.address,
      expect: {
        chain_in: parseInt(formData.expect.chain_in),
        chain_out: parseInt(formData.expect.chain_out),
        mempool_in: parseInt(formData.expect.mempool_in),
        mempool_out: parseInt(formData.expect.mempool_out),
      },
      monitor: {
        chain_in: "alert",
        chain_out: "auto-accept",
        mempool_in: "alert",
        mempool_out: "auto-accept",
      },
    });
    expect(mockOnClose).toHaveBeenCalled();
  });

  test("handles editing existing address", () => {
    const existingAddress = {
      name: "Existing Address",
      address: testData.addresses.xpub1.addresses[0].address,
      expect: {
        chain_in: 1,
        chain_out: 2,
        mempool_in: 3,
        mempool_out: 4,
      },
      monitor: {
        chain_in: "alert",
        chain_out: "auto-accept",
        mempool_in: "alert",
        mempool_out: "auto-accept",
      },
    };

    render(
      <AddressDialog
        open={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        address={existingAddress}
      />
    );

    expect(screen.getByLabelText("Name")).toHaveValue(existingAddress.name);
    expect(screen.getByLabelText("Address")).toHaveValue(
      existingAddress.address
    );
    expect(
      screen.getByLabelText("Chain In", { selector: "input[type='number']" })
    ).toHaveValue(existingAddress.expect.chain_in);
    expect(
      screen.getByLabelText("Chain Out", { selector: "input[type='number']" })
    ).toHaveValue(existingAddress.expect.chain_out);
    expect(
      screen.getByLabelText("Mempool In", { selector: "input[type='number']" })
    ).toHaveValue(existingAddress.expect.mempool_in);
    expect(
      screen.getByLabelText("Mempool Out", { selector: "input[type='number']" })
    ).toHaveValue(existingAddress.expect.mempool_out);

    fireEvent.click(screen.getByText("Save"));
    expect(mockOnSave).toHaveBeenCalledWith(existingAddress);
  });
});
