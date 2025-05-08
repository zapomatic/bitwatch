import React from "react";
import {
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

const MonitorSettings = ({
  value,
  onChange,
  title = "Monitoring Settings",
}) => {
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
        <MenuItem
          value="alert"
          data-testid={`address-monitor-${label
            .toLowerCase()
            .replace(" ", "-")}-alert`}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <NotificationsActiveIcon
              color="warning"
              sx={{ fontSize: "1rem" }}
            />
            <Typography>Alert</Typography>
          </Box>
        </MenuItem>
        <MenuItem
          value="auto-accept"
          data-testid={`address-monitor-${label
            .toLowerCase()
            .replace(" ", "-")}-auto-accept`}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CheckCircleIcon color="success" sx={{ fontSize: "1rem" }} />
            <Typography>Auto Accept</Typography>
          </Box>
        </MenuItem>
      </Select>
    </FormControl>
  );

  const handleMonitorChange = (field, newValue) => {
    onChange({
      ...value,
      [field]: newValue,
    });
  };

  return (
    <>
      <Typography variant="subtitle1" sx={{ mt: 2 }}>
        {title}
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
          {renderMonitorSelect("Chain In", value.chain_in, (e) =>
            handleMonitorChange("chain_in", e.target.value)
          )}
        </Grid>
        <Grid item>
          {renderMonitorSelect("Chain Out", value.chain_out, (e) =>
            handleMonitorChange("chain_out", e.target.value)
          )}
        </Grid>
        <Grid item>
          {renderMonitorSelect("Mempool In", value.mempool_in, (e) =>
            handleMonitorChange("mempool_in", e.target.value)
          )}
        </Grid>
        <Grid item>
          {renderMonitorSelect("Mempool Out", value.mempool_out, (e) =>
            handleMonitorChange("mempool_out", e.target.value)
          )}
        </Grid>
      </Grid>
    </>
  );
};

export default MonitorSettings;
