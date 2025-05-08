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
  Grid,
} from "@mui/material";
import MonitorSettings from "../components/MonitorSettings";
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
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle id="descriptor-dialog-title">
        {descriptor ? "Edit Descriptor" : "Add Descriptor"}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Grid container spacing={2} sx={{ width: "100%" }}>
            <Grid item xs={12} sx={{ width: "100%" }}>
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
            </Grid>
            <Grid item xs={12} sx={{ width: "100%" }}>
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
            </Grid>
          </Grid>
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
              mt: 2,
            }}
          >
            <Grid item>
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
            </Grid>
            <Grid item>
              <TextField
                label="Initial Addresses"
                name="initialAddresses"
                value={formData.initialAddresses}
                onChange={(e) =>
                  handleChange("initialAddresses", e.target.value)
                }
                type="number"
                helperText="Number of addresses to derive initially"
                fullWidth
                inputProps={{
                  "data-testid": "descriptor-initial-input",
                  "aria-label": "Initial addresses",
                }}
              />
            </Grid>
            <Grid item>
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
            title="Default Monitoring Settings"
          />
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
