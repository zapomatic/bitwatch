import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  FormControlLabel,
  Switch,
  Typography,
} from "@mui/material";
import MonitorSettings from "../components/MonitorSettings";
import { DEFAULT_ADDRESS_FORM } from "../config";

const AddressDialog = ({ open, onClose, address, onSave }) => {
  const [formData, setFormData] = useState({
    ...DEFAULT_ADDRESS_FORM,
    trackWebsocket: false,
  });

  useEffect(() => {
    if (address) {
      console.log("Setting form data from address:", address);
      setFormData({
        ...DEFAULT_ADDRESS_FORM,
        ...address,
        trackWebsocket: Boolean(address.trackWebsocket),
        monitor: {
          ...DEFAULT_ADDRESS_FORM.monitor,
          ...(address.monitor || {}),
        },
      });
    } else {
      setFormData({
        ...DEFAULT_ADDRESS_FORM,
        trackWebsocket: false,
        monitor: { ...DEFAULT_ADDRESS_FORM.monitor },
      });
    }
  }, [address, open]);

  const handleSave = () => {
    if (!formData.name || !formData.address) {
      return;
    }
    console.log("Saving form data:", formData);
    onSave({
      ...formData,
      address: formData.address, // Ensure address is passed as unique identifier
      trackWebsocket: formData.trackWebsocket, // Ensure trackWebsocket is explicitly included
    });
    onClose();
  };

  const handleFormChange = (field, value) => {
    console.log(`Changing ${field} to:`, value);
    setFormData((prev) => {
      const newData = {
        ...prev,
        [field]: value,
      };
      console.log("New form data:", newData);
      return newData;
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      TransitionProps={{
        timeout: 300,
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
          <FormControlLabel
            control={
              <Switch
                checked={Boolean(formData.trackWebsocket)}
                onChange={(e) => {
                  console.log("Switch changed to:", e.target.checked);
                  handleFormChange("trackWebsocket", e.target.checked);
                }}
                data-testid="track-websocket-switch"
              />
            }
            label={
              <Box>
                <Typography variant="body2">Track with WebSocket</Typography>
                <Typography variant="caption" color="text.secondary">
                  Enable real-time balance updates via mempool.space WebSocket
                </Typography>
              </Box>
            }
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
