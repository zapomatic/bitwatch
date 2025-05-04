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

const ExtendedKeyDialog = ({
  open,
  onClose,
  onSave,
  collection,
  extendedKey,
}) => {
  const [formData, setFormData] = useState({
    name: "",
    key: "",
    derivationPath: "m/0",
    gapLimit: DEFAULT_GAP_LIMIT,
    initialAddresses: DEFAULT_INITIAL_ADDRESSES,
    skip: DEFAULT_SKIP_ADDRESSES,
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (extendedKey) {
      setFormData({
        name: extendedKey.name,
        key: extendedKey.key,
        derivationPath: extendedKey.derivationPath,
        gapLimit: Number(extendedKey.gapLimit),
        initialAddresses: Number(extendedKey.initialAddresses),
        skip: Number(extendedKey.skip),
      });
    }
  }, [extendedKey]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: e.target.type === "number" ? Number(value) : value,
    }));
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
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="extended-key-dialog-title"
      data-testid="extended-key-dialog"
    >
      <DialogTitle id="extended-key-dialog-title">
        {extendedKey ? "Edit Extended Key" : "Add Extended Key"}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            helperText="A friendly name for this extended key"
            fullWidth
            inputProps={{
              "data-testid": "extended-key-name-input",
              "aria-label": "Extended key name",
            }}
          />
          <TextField
            label="Extended Key"
            name="key"
            value={formData.key}
            onChange={handleChange}
            helperText="The extended public key (xpub, ypub, zpub)"
            fullWidth
            inputProps={{
              "data-testid": "extended-key-key-input",
              "aria-label": "Extended public key",
            }}
          />
          <TextField
            label="Derivation Path"
            name="derivationPath"
            value={formData.derivationPath}
            onChange={handleChange}
            helperText="The derivation path (e.g., m/0)"
            fullWidth
            inputProps={{
              "data-testid": "extended-key-path-input",
              "aria-label": "Derivation path",
            }}
          />
          <TextField
            label="Gap Limit"
            name="gapLimit"
            value={formData.gapLimit}
            onChange={handleChange}
            type="number"
            helperText="Number of unused addresses before stopping derivation"
            fullWidth
            inputProps={{
              "data-testid": "extended-key-gap-input",
              "aria-label": "Gap limit",
            }}
          />
          <TextField
            label="Initial Addresses"
            name="initialAddresses"
            value={formData.initialAddresses}
            onChange={handleChange}
            type="number"
            helperText="Number of addresses to derive initially"
            fullWidth
            inputProps={{
              "data-testid": "extended-key-initial-input",
              "aria-label": "Initial addresses",
            }}
          />
          <TextField
            label="Skip"
            name="skip"
            value={formData.skip}
            onChange={handleChange}
            type="number"
            helperText="Number of addresses to skip before starting derivation"
            fullWidth
            inputProps={{
              "data-testid": "extended-key-skip-input",
              "aria-label": "Skip addresses",
            }}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={onClose}
          data-testid="extended-key-cancel-button"
          aria-label="Cancel extended key dialog"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          data-testid="extended-key-submit-button"
          aria-label={extendedKey ? "Save extended key" : "Add extended key"}
        >
          {extendedKey ? "Save" : "Add"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ExtendedKeyDialog;
