import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Grid,
  Box,
} from "@mui/material";
import MonitorSettings from "../components/MonitorSettings";
import {
  DEFAULT_ADDRESS_FORM,
  COLLAPSE_ANIMATION_DURATION,
  SYSTEM_MONITOR_SETTINGS,
} from "../config";

const AddressDialog = ({ open, onClose, address, onSave }) => {
  const [formData, setFormData] = useState(DEFAULT_ADDRESS_FORM);

  useEffect(() => {
    setFormData({ ...DEFAULT_ADDRESS_FORM, ...(address || {}) });
  }, [address, open]);

  const handleSave = () => {
    if (!formData.name || !formData.address) {
      return;
    }
    // Ensure monitor settings are included using system defaults
    const dataToSave = {
      ...formData,
      monitor: formData.monitor || SYSTEM_MONITOR_SETTINGS,
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

  const handleExpectChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      expect: {
        ...prev.expect,
        [field]: parseInt(value) || 0,
      },
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
          <Typography variant="subtitle1">Expected Balances</Typography>
          <Grid
            container
            spacing={2}
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                md: "repeat(2, 1fr)",
              },
              gap: 2,
            }}
          >
            <Grid item>
              <TextField
                label="Chain In"
                type="number"
                value={formData.expect.chain_in}
                onChange={(e) => handleExpectChange("chain_in", e.target.value)}
                fullWidth
                inputProps={{
                  "data-testid": "address-chain-in-input",
                  "aria-label": "Expected chain incoming balance",
                }}
              />
            </Grid>
            <Grid item>
              <TextField
                label="Chain Out"
                type="number"
                value={formData.expect.chain_out}
                onChange={(e) =>
                  handleExpectChange("chain_out", e.target.value)
                }
                fullWidth
                inputProps={{
                  "data-testid": "address-chain-out-input",
                  "aria-label": "Expected chain outgoing balance",
                }}
              />
            </Grid>
            <Grid item>
              <TextField
                label="Mempool In"
                type="number"
                value={formData.expect.mempool_in}
                onChange={(e) =>
                  handleExpectChange("mempool_in", e.target.value)
                }
                fullWidth
                inputProps={{
                  "data-testid": "address-mempool-in-input",
                  "aria-label": "Expected mempool incoming balance",
                }}
              />
            </Grid>
            <Grid item>
              <TextField
                label="Mempool Out"
                type="number"
                value={formData.expect.mempool_out}
                onChange={(e) =>
                  handleExpectChange("mempool_out", e.target.value)
                }
                fullWidth
                inputProps={{
                  "data-testid": "address-mempool-out-input",
                  "aria-label": "Expected mempool outgoing balance",
                }}
              />
            </Grid>
          </Grid>
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
