import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
} from "@mui/material";

const ExtendedKeyDialog = ({ open, onClose, onSave, extendedKey }) => {
  const [formData, setFormData] = useState({
    name: "",
    key: "",
    gapLimit: 2,
    initialAddresses: 10,
    derivationPath: "m/0",
    skip: 0,
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (extendedKey) {
      setFormData({
        name: extendedKey.name || "",
        key: extendedKey.key || "",
        gapLimit: extendedKey.gapLimit || 2,
        initialAddresses: extendedKey.initialAddresses || 10,
        derivationPath: extendedKey.derivationPath || "m/0",
        skip: extendedKey.skip || 0,
      });
    } else {
      setFormData({
        name: "",
        key: "",
        gapLimit: 2,
        initialAddresses: 10,
        derivationPath: "m/0",
        skip: 0,
      });
    }
  }, [extendedKey, open]);

  const handleSave = () => {
    if (!formData.name || !formData.key || !formData.derivationPath) {
      setError("Name, extended key, and derivation path are required");
      return;
    }

    if (!formData.key.match(/^[xyz]pub[a-zA-Z0-9]{107,108}$/)) {
      setError("Invalid extended key format");
      return;
    }

    if (!formData.derivationPath.match(/^m(\/\d+'?)*$/)) {
      setError("Invalid derivation path format");
      return;
    }

    if (formData.derivationPath.includes("'")) {
      setError("Cannot use hardened derivation with extended public keys");
      return;
    }

    // If we're editing, include the original extended key data
    const dataToSave = extendedKey ? { ...extendedKey, ...formData } : formData;
    onSave(dataToSave);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>
        {extendedKey ? "Edit Extended Key" : "Add Extended Key"}
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
          label="Extended Key"
          fullWidth
          value={formData.key}
          onChange={(e) => setFormData({ ...formData, key: e.target.value })}
          helperText="Format: xpub, ypub, or zpub"
        />
        <TextField
          margin="dense"
          label="Derivation Path"
          fullWidth
          value={formData.derivationPath}
          onChange={(e) =>
            setFormData({ ...formData, derivationPath: e.target.value })
          }
          helperText="Format: m/0 (native segwit), m/49/0/0 (BIP49), m/44/0/0 (BIP44), etc"
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
          label="Skip Addresses"
          type="number"
          fullWidth
          value={formData.skip}
          onChange={(e) =>
            setFormData({ ...formData, skip: parseInt(e.target.value) || 0 })
          }
          helperText="Number of addresses to skip before starting scan"
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
              gapLimit: parseInt(e.target.value) || 2,
            })
          }
          helperText="Number of consecutive empty addresses to maintain"
        />
        {error && <Typography color="error">{error}</Typography>}
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

export default ExtendedKeyDialog;
