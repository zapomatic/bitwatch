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
} from "@mui/material";
import {
  DEFAULT_GAP_LIMIT,
  DEFAULT_INITIAL_ADDRESSES,
  DEFAULT_SKIP_ADDRESSES,
} from "../config";

const DescriptorDialog = ({
  open,
  onClose,
  onSave,
  collection,
  descriptor,
}) => {
  const [formData, setFormData] = useState({
    name: "",
    descriptor: "",
    gapLimit: DEFAULT_GAP_LIMIT,
    initialAddresses: DEFAULT_INITIAL_ADDRESSES,
    skip: DEFAULT_SKIP_ADDRESSES,
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (descriptor) {
      setFormData({
        name: descriptor.name,
        descriptor: descriptor.descriptor,
        gapLimit: descriptor.gapLimit,
        initialAddresses: descriptor.initialAddresses,
        skip: descriptor.skip,
      });
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
