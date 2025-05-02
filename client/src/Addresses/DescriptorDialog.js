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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleSubmit = async () => {
    try {
      await onSave(collection, formData);
      onClose();
    } catch (err) {
      setError(err.toString());
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>
        {descriptor ? "Edit Descriptor" : "Add Descriptor"}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            helperText="A friendly name for this descriptor"
            fullWidth
          />
          <TextField
            label="Descriptor"
            name="descriptor"
            value={formData.descriptor}
            onChange={handleChange}
            helperText="The output descriptor (e.g., wpkh([fingerprint/derivation]xpub/0/*))"
            fullWidth
          />
          <TextField
            label="Gap Limit"
            name="gapLimit"
            value={formData.gapLimit}
            onChange={handleChange}
            type="number"
            helperText="Number of unused addresses before stopping derivation"
            fullWidth
          />
          <TextField
            label="Initial Addresses"
            name="initialAddresses"
            value={formData.initialAddresses}
            onChange={handleChange}
            type="number"
            helperText="Number of addresses to derive initially"
            fullWidth
          />
          <TextField
            label="Skip"
            name="skip"
            value={formData.skip}
            onChange={handleChange}
            type="number"
            helperText="Number of addresses to skip before starting derivation"
            fullWidth
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained">
          {descriptor ? "Save" : "Add"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DescriptorDialog;
