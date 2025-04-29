import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
} from "@mui/material";
import { defaultDescriptorForm } from "./defaults";

const DescriptorDialog = ({ open, onClose, onSave, descriptor }) => {
  const [formData, setFormData] = useState(defaultDescriptorForm);
  const [error, setError] = useState("");
  const [validation, setValidation] = useState(null);

  useEffect(() => {
    setFormData({ ...defaultDescriptorForm, ...(descriptor || {}) });
    setValidation(null);
  }, [descriptor, open]);

  const handleDescriptorChange = (e) => {
    const value = e.target.value;
    setFormData({ ...formData, descriptor: value });
    setError("");
    setValidation(null);
  };

  const handleSave = () => {
    if (!formData.name || !formData.descriptor) {
      setError("Name and descriptor are required");
      return;
    }

    // If we're editing, include the original descriptor data but let form data override it
    const dataToSave = descriptor
      ? { ...formData, ...descriptor, ...formData }
      : formData;
    onSave(dataToSave);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {descriptor ? "Edit Output Descriptor" : "Add Output Descriptor"}
      </DialogTitle>
      <DialogContent>
        <TextField
          margin="dense"
          label="Name"
          fullWidth
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
        <TextField
          margin="dense"
          label="Output Descriptor"
          fullWidth
          multiline
          rows={4}
          value={formData.descriptor}
          onChange={handleDescriptorChange}
          helperText="Example: wsh(sortedmulti(2,[xpub1/0/*]tpub1,[xpub2/0/*]tpub2))"
        />
        <TextField
          margin="dense"
          label="Initial Addresses to Fetch"
          type="number"
          fullWidth
          value={formData.initialAddresses}
          onChange={(e) =>
            setFormData({
              ...formData,
              initialAddresses: parseInt(e.target.value) || 10,
            })
          }
          helperText="Number of addresses to fetch initially"
        />
        <TextField
          margin="dense"
          label="Gap Limit"
          type="number"
          fullWidth
          value={formData.gapLimit}
          onChange={(e) =>
            setFormData({
              ...formData,
              gapLimit: parseInt(e.target.value) || 20,
            })
          }
          helperText="Number of consecutive unused addresses to maintain"
        />
        <TextField
          margin="dense"
          label="Skip Addresses"
          type="number"
          fullWidth
          value={formData.skip}
          onChange={(e) =>
            setFormData({ ...formData, skip: parseInt(e.target.value) || 0 })
          }
          helperText="Number of addresses to skip before starting scan"
        />
        {error && (
          <Typography color="error" sx={{ mt: 2 }}>
            {error}
          </Typography>
        )}
        {validation && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2">Descriptor Info:</Typography>
            <Typography>Type: {validation.type}</Typography>
            <Typography>Script Type: {validation.scriptType}</Typography>
            <Typography>
              Signatures: {validation.requiredSignatures} of{" "}
              {validation.totalSignatures}
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" color="primary">
          {descriptor ? "Save" : "Add"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DescriptorDialog;
