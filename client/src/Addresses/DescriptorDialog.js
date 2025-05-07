import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Alert,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { DEFAULT_DESCRIPTOR_FORM } from "../config";

const DescriptorDialog = ({
  open,
  onClose,
  onSave,
  collection,
  descriptor,
}) => {
  const [formData, setFormData] = useState(DEFAULT_DESCRIPTOR_FORM);
  const [error, setError] = useState("");

  useEffect(() => {
    if (descriptor) {
      setFormData({
        name: descriptor.name,
        descriptor: descriptor.descriptor,
        gapLimit: descriptor.gapLimit,
        initialAddresses: descriptor.initialAddresses,
        skip: descriptor.skip,
        monitor: descriptor.monitor || DEFAULT_DESCRIPTOR_FORM.monitor,
      });
    } else {
      setFormData(DEFAULT_DESCRIPTOR_FORM);
    }
  }, [descriptor]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]:
        field === "name" || field === "descriptor" ? value : Number(value),
    }));
    setError("");
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

  const handleSubmit = async () => {
    const result = await onSave(collection, formData);
    if (result?.error) {
      setError(result.error.toString());
      return;
    }
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="descriptor-dialog-title"
      data-testid="descriptor-dialog"
    >
      <DialogTitle id="descriptor-dialog-title">
        {descriptor ? "Edit Descriptor" : "Add Descriptor"}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Name"
            name="name"
            value={formData.name}
            onChange={(e) => handleChange("name", e.target.value)}
            helperText="A friendly name for this descriptor"
            fullWidth
            inputProps={{
              "data-testid": "descriptor-name-input",
              "aria-label": "Descriptor name",
            }}
          />
          <TextField
            label="Descriptor"
            name="descriptor"
            value={formData.descriptor}
            onChange={(e) => handleChange("descriptor", e.target.value)}
            helperText="The output descriptor (e.g., wpkh([fingerprint/derivation]xpub/0/*))"
            fullWidth
            inputProps={{
              "data-testid": "descriptor-input",
              "aria-label": "Output descriptor",
            }}
          />
          <TextField
            label="Gap Limit"
            name="gapLimit"
            value={formData.gapLimit}
            onChange={(e) => handleChange("gapLimit", e.target.value)}
            type="number"
            helperText="Number of unused addresses before stopping derivation"
            fullWidth
            inputProps={{
              "data-testid": "descriptor-gap-input",
              "aria-label": "Gap limit",
            }}
          />
          <TextField
            label="Initial Addresses"
            name="initialAddresses"
            value={formData.initialAddresses}
            onChange={(e) => handleChange("initialAddresses", e.target.value)}
            type="number"
            helperText="Number of addresses to derive initially"
            fullWidth
            inputProps={{
              "data-testid": "descriptor-initial-input",
              "aria-label": "Initial addresses",
            }}
          />
          <TextField
            label="Skip"
            name="skip"
            value={formData.skip}
            onChange={(e) => handleChange("skip", e.target.value)}
            type="number"
            helperText="Number of addresses to skip before starting derivation"
            fullWidth
            inputProps={{
              "data-testid": "descriptor-skip-input",
              "aria-label": "Skip addresses",
            }}
          />
          <Typography variant="subtitle1">
            Default Monitoring Settings
          </Typography>
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
          data-testid="descriptor-cancel-button"
          aria-label="Cancel descriptor dialog"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          data-testid="descriptor-submit-button"
          aria-label={descriptor ? "Save descriptor" : "Add descriptor"}
        >
          {descriptor ? "Save" : "Add"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DescriptorDialog;
