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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
} from "@mui/material";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { DEFAULT_ADDRESS_FORM, COLLAPSE_ANIMATION_DURATION } from "../config";

const AddressDialog = ({ open, onClose, address, onSave }) => {
  const [formData, setFormData] = useState(DEFAULT_ADDRESS_FORM);

  useEffect(() => {
    setFormData({ ...DEFAULT_ADDRESS_FORM, ...(address || {}) });
  }, [address, open]);

  const handleSave = () => {
    if (!formData.name || !formData.address) {
      return;
    }
    onSave(formData);
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

  const handleMonitorChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      monitor: {
        ...prev.monitor,
        [field]: value,
      },
    }));
  };

  const renderMonitorSelect = (label, value, onChange) => (
    <FormControl fullWidth>
      <InputLabel>{label}</InputLabel>
      <Select
        value={value}
        onChange={onChange}
        label={label}
        data-testid={`address-monitor-${label.toLowerCase().replace(" ", "-")}`}
        sx={{
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "var(--theme-secondary)",
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "var(--theme-primary)",
          },
        }}
      >
        <MenuItem value="alert">
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <NotificationsActiveIcon
              color="warning"
              sx={{ fontSize: "1rem" }}
            />
            <Typography>Alert</Typography>
          </Box>
        </MenuItem>
        <MenuItem value="auto-accept">
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CheckCircleIcon color="success" sx={{ fontSize: "1rem" }} />
            <Typography>Auto Accept</Typography>
          </Box>
        </MenuItem>
      </Select>
    </FormControl>
  );

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
          <Typography variant="subtitle1">Monitoring Settings</Typography>
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
              {renderMonitorSelect("Chain In", formData.monitor.chain_in, (e) =>
                handleMonitorChange("chain_in", e.target.value)
              )}
            </Grid>
            <Grid item>
              {renderMonitorSelect(
                "Chain Out",
                formData.monitor.chain_out,
                (e) => handleMonitorChange("chain_out", e.target.value)
              )}
            </Grid>
            <Grid item>
              {renderMonitorSelect(
                "Mempool In",
                formData.monitor.mempool_in,
                (e) => handleMonitorChange("mempool_in", e.target.value)
              )}
            </Grid>
            <Grid item>
              {renderMonitorSelect(
                "Mempool Out",
                formData.monitor.mempool_out,
                (e) => handleMonitorChange("mempool_out", e.target.value)
              )}
            </Grid>
          </Grid>
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
