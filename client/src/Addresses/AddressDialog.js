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
import { defaultAddressForm } from "./defaults";

const AddressDialog = ({ open, onClose, address, onSave }) => {
  const [formData, setFormData] = useState(defaultAddressForm);

  useEffect(() => {
    setFormData({ ...defaultAddressForm, ...(address || {}) });
  }, [address, open]);

  const handleSave = () => {
    if (!formData.name || !formData.address) {
      return;
    }
    onSave(formData);
    onClose();
  };

  const renderMonitorSelect = (label, value, onChange) => (
    <FormControl fullWidth sx={{ mt: 1 }}>
      <InputLabel sx={{ background: "var(--theme-surface)", px: 1 }}>
        {label}
      </InputLabel>
      <Select
        value={value}
        onChange={onChange}
        aria-label={label}
        sx={{
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "rgba(77, 244, 255, 0.3)",
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "var(--theme-secondary)",
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "var(--theme-primary)",
          },
        }}
      >
        <MenuItem value="alert">
          <Box className="crystal-flex crystal-flex-start crystal-gap-1">
            <NotificationsActiveIcon
              className="crystal-text-warning"
              sx={{ fontSize: "1rem" }}
            />
            <Typography>Alert</Typography>
          </Box>
        </MenuItem>
        <MenuItem value="auto-accept">
          <Box className="crystal-flex crystal-flex-start crystal-gap-1">
            <CheckCircleIcon
              className="crystal-text-success"
              sx={{ fontSize: "1rem" }}
            />
            <Typography>Auto Accept</Typography>
          </Box>
        </MenuItem>
      </Select>
    </FormControl>
  );

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{address ? "Edit Address" : "Add Address"}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="Name"
          fullWidth
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          helperText="A friendly name for this address"
        />
        <TextField
          margin="dense"
          label="Address"
          fullWidth
          value={formData.address}
          onChange={(e) =>
            setFormData({ ...formData, address: e.target.value })
          }
          helperText="The Bitcoin address to watch"
        />
        <Typography variant="subtitle1" sx={{ mt: 0, mb: 1 }}>
          Expected Balances
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <TextField
              margin="dense"
              label="Chain In"
              type="number"
              fullWidth
              value={formData.expect.chain_in}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  expect: {
                    ...formData.expect,
                    chain_in: parseInt(e.target.value) || 0,
                  },
                })
              }
              helperText="Expected on-chain incoming balance"
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              margin="dense"
              label="Chain Out"
              type="number"
              fullWidth
              value={formData.expect.chain_out}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  expect: {
                    ...formData.expect,
                    chain_out: parseInt(e.target.value) || 0,
                  },
                })
              }
              helperText="Expected on-chain outgoing balance"
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              margin="dense"
              label="Mempool In"
              type="number"
              fullWidth
              value={formData.expect.mempool_in}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  expect: {
                    ...formData.expect,
                    mempool_in: parseInt(e.target.value) || 0,
                  },
                })
              }
              helperText="Expected mempool incoming balance"
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              margin="dense"
              label="Mempool Out"
              type="number"
              fullWidth
              value={formData.expect.mempool_out}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  expect: {
                    ...formData.expect,
                    mempool_out: parseInt(e.target.value) || 0,
                  },
                })
              }
              helperText="Expected mempool outgoing balance"
            />
          </Grid>
        </Grid>
        <Typography variant="subtitle1" sx={{ mt: 0, mb: 1 }}>
          Monitoring Settings
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={6}>
            {renderMonitorSelect("Chain In", formData.monitor.chain_in, (e) =>
              setFormData({
                ...formData,
                monitor: {
                  ...formData.monitor,
                  chain_in: e.target.value,
                },
              })
            )}
          </Grid>
          <Grid item xs={6}>
            {renderMonitorSelect("Chain Out", formData.monitor.chain_out, (e) =>
              setFormData({
                ...formData,
                monitor: {
                  ...formData.monitor,
                  chain_out: e.target.value,
                },
              })
            )}
          </Grid>
          <Grid item xs={6}>
            {renderMonitorSelect(
              "Mempool In",
              formData.monitor.mempool_in,
              (e) =>
                setFormData({
                  ...formData,
                  monitor: {
                    ...formData.monitor,
                    mempool_in: e.target.value,
                  },
                })
            )}
          </Grid>
          <Grid item xs={6}>
            {renderMonitorSelect(
              "Mempool Out",
              formData.monitor.mempool_out,
              (e) =>
                setFormData({
                  ...formData,
                  monitor: {
                    ...formData.monitor,
                    mempool_out: e.target.value,
                  },
                })
            )}
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" color="primary">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddressDialog;
