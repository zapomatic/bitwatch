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
  Autocomplete,
  Typography,
} from "@mui/material";
import MonitorSettings from "../components/MonitorSettings";
import { DEFAULT_EXTENDED_KEY_FORM } from "../config";

const DERIVATION_PATH_OPTIONS = [
  // RELATIVE paths – for zpub/ypub/xpub already at m/84'/0'/0' or similar
  { path: "m/0", label: "Relative path: external (m/0/*)" },
  { path: "m/1", label: "Relative path: internal/change (m/1/*)" },

  // ABSOLUTE BIP paths – for xprv or root keys, or to document intent
  { path: "m/84/0/0", label: 'BIP84 P2WPKH (native SegWit "bc1q…" external)' },
  { path: "m/84/0/1", label: 'BIP84 P2WPKH (native SegWit "bc1q…" change)' },
  { path: "m/86/0/0", label: 'BIP86 P2TR (Taproot "bc1p…" external)' },
  { path: "m/86/0/1", label: 'BIP86 P2TR (Taproot "bc1p…" change)' },
  {
    path: "m/49/0/0",
    label: 'BIP49 P2SH‑P2WPKH (wrapped SegWit "3…" external)',
  },
  { path: "m/49/0/1", label: 'BIP49 P2SH‑P2WPKH (wrapped SegWit "3…" change)' },
  { path: "m/44/0/0", label: 'BIP44 P2PKH (legacy "1…" external)' },
  { path: "m/44/0/1", label: 'BIP44 P2PKH (legacy "1…" change)' },
];

const ExtendedKeyDialog = ({
  open,
  onClose,
  onSave,
  collection,
  extendedKey,
}) => {
  const [formData, setFormData] = useState(DEFAULT_EXTENDED_KEY_FORM);
  const [error, setError] = useState("");

  useEffect(() => {
    if (extendedKey) {
      setFormData({
        name: extendedKey.name,
        key: extendedKey.key,
        derivationPath: extendedKey.derivationPath,
        gapLimit: extendedKey.gapLimit,
        initialAddresses: extendedKey.initialAddresses,
        skip: extendedKey.skip,
        monitor: extendedKey.monitor || {
          ...DEFAULT_EXTENDED_KEY_FORM.monitor,
        },
      });
    } else {
      // Reset form to empty state
      setFormData({
        name: "",
        key: "",
        derivationPath: "",
        gapLimit: DEFAULT_EXTENDED_KEY_FORM.gapLimit,
        initialAddresses: DEFAULT_EXTENDED_KEY_FORM.initialAddresses,
        skip: DEFAULT_EXTENDED_KEY_FORM.skip,
        monitor: { ...DEFAULT_EXTENDED_KEY_FORM.monitor },
      });
    }
  }, [extendedKey]);

  const handleChange = (field, value) => {
    console.log(`handleChange called for ${field} with value:`, value);
    setFormData((prev) => {
      const newData = {
        ...prev,
        [field]:
          field === "name" || field === "key" || field === "derivationPath"
            ? value
            : Number(value),
      };

      if (field === "key" && value && !prev.derivationPath) {
        // default to "m/0"
        newData.derivationPath = "m/0";
      }

      console.log("New form data:", newData);
      return newData;
    });
    setError("");
  };

  const handleSubmit = async () => {
    console.log("Form data at submit:", formData);
    // Ensure all required fields are present
    if (!formData.name || !formData.key || !formData.derivationPath) {
      console.log("Missing fields:", {
        name: formData.name,
        key: formData.key,
        derivationPath: formData.derivationPath,
      });
      setError("Name, key, and derivation path are required");
      return;
    }

    console.log("Submitting extended key with data:", formData);
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
      aria-labelledby="extended-key-dialog-title"
      data-testid="extended-key-dialog"
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle id="extended-key-dialog-title">
        {extendedKey ? "Edit Extended Key" : "Add Extended Key"}
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
                helperText="A friendly name for this extended key"
                fullWidth
                inputProps={{
                  "data-testid": "extended-key-name-input",
                  "aria-label": "Extended key name",
                }}
              />
            </Grid>
            <Grid item xs={12} sx={{ width: "100%" }}>
              <TextField
                label="Extended Key"
                name="key"
                value={formData.key}
                onChange={(e) => handleChange("key", e.target.value)}
                helperText="The extended public key (xpub, ypub, zpub)"
                fullWidth
                inputProps={{
                  "data-testid": "extended-key-key-input",
                  "aria-label": "Extended public key",
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
              <Autocomplete
                options={DERIVATION_PATH_OPTIONS}
                value={formData.derivationPath}
                onChange={(event, newValue) => {
                  console.log("Autocomplete onChange event:", event);
                  console.log("Autocomplete onChange newValue:", newValue);
                  // Handle both string input and option selection
                  const path =
                    typeof newValue === "string"
                      ? newValue
                      : newValue?.path || "";
                  console.log("Setting path to:", path);
                  handleChange("derivationPath", path);
                }}
                onInputChange={(event, newInputValue) => {
                  console.log("Autocomplete onInputChange:", newInputValue);
                  handleChange("derivationPath", newInputValue);
                }}
                freeSolo
                getOptionLabel={(option) => {
                  if (typeof option === "string") return option;
                  return option.path;
                }}
                renderOption={(props, option) => (
                  <li {...props}>
                    <Box sx={{ display: "flex", flexDirection: "column" }}>
                      <Typography variant="body1">{option.path}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {option.label}
                      </Typography>
                    </Box>
                  </li>
                )}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Derivation Path"
                    helperText="Enter any valid derivation path (e.g. m/0, m/84/0/0)"
                    fullWidth
                    inputProps={{
                      ...params.inputProps,
                      "data-testid": "extended-key-path-input",
                      "aria-label": "Derivation path",
                    }}
                  />
                )}
              />
            </Grid>
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
                  "data-testid": "extended-key-gap-input",
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
                  "data-testid": "extended-key-initial-input",
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
                  "data-testid": "extended-key-skip-input",
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
