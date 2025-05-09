import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
} from "@mui/material";
import MonitorSettings from "../components/MonitorSettings";
import { DEFAULT_ADDRESS_FORM, COLLAPSE_ANIMATION_DURATION } from "../config";

const AddressDialog = ({ open, onClose, address, onSave }) => {
  const [formData, setFormData] = useState(DEFAULT_ADDRESS_FORM);

  useEffect(() => {
    setFormData({
      ...DEFAULT_ADDRESS_FORM,
      monitor: { ...DEFAULT_ADDRESS_FORM.monitor },
      ...(address || {}),
    });
  }, [address, open]);

  const handleSave = () => {
    if (!formData.name || !formData.address) {
      return;
    }
    // Ensure monitor settings are included using current system defaults
    const dataToSave = {
      ...formData,
      monitor: formData.monitor || { ...DEFAULT_ADDRESS_FORM.monitor },
    };
    onSave(dataToSave);
    onClose();
  };

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      TransitionProps={{
        timeout: COLLAPSE_ANIMATION_DURATION,
      }}
      data-testid="address-dialog"
    >
      <DialogTitle>{address ? "Edit Address" : "Add Address"}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2 }}>
          <TextField
            autoFocus
            label="Name"
            value={formData.name}
            onChange={(e) => handleFormChange("name", e.target.value)}
            helperText="A friendly name for this address"
            fullWidth
            inputProps={{
              "data-testid": "address-name-input",
              "aria-label": "Address name",
            }}
          />
          <TextField
            label="Address"
            value={formData.address}
            onChange={(e) => handleFormChange("address", e.target.value)}
            helperText="The single address to watch (bc1..., 1..., 3..., etc.)"
            fullWidth
            inputProps={{
              "data-testid": "address-input",
              "aria-label": "Bitcoin address",
            }}
          />
          <MonitorSettings
            value={formData.monitor || {}}
            onChange={(newMonitor) =>
              setFormData({
                ...formData,
                monitor: newMonitor,
              })
            }
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={onClose}
          aria-label="Cancel address dialog"
          data-testid="address-dialog-cancel"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          aria-label="Save address"
          data-testid="address-dialog-save"
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddressDialog;
