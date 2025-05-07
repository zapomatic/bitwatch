import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import { styled } from "@mui/material/styles";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import Addresses from "./Addresses/index.js";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import CssBaseline from "@mui/material/CssBaseline";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import MuiAppBar from "@mui/material/AppBar";
import Paper from "@mui/material/Paper";
import React, { useCallback, useEffect, useState } from "react";
import SettingsIcon from "@mui/icons-material/Settings";
import socketIO from "./io.js";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Integrations from "./Integrations";
import Configuration from "./Configuration";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import WatchListIcon from "@mui/icons-material/List";
import IntegrationIcon from "@mui/icons-material/Extension";
import Tooltip from "@mui/material/Tooltip";

const AppBar = styled(MuiAppBar)(({ theme }) => ({
  zIndex: theme.zIndex.drawer + 1,
  backgroundColor: "#2a1b50",
  backgroundImage: "none",
  borderBottom: "1px solid rgba(77, 244, 255, 0.3)",
  backdropFilter: "blur(5px)",
}));

const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#ff61d8",
    },
    secondary: {
      main: "#4df4ff",
    },
    success: {
      main: "#7bffa0",
    },
    error: {
      main: "#ff5757",
    },
    warning: {
      main: "#ff9b3d",
    },
    background: {
      default: "#1a1040",
      paper: "#2a1b50",
    },
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "#2a1b50",
          backgroundImage: "none",
          borderBottom: "1px solid rgba(77, 244, 255, 0.3)",
          backdropFilter: "blur(5px)",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: "#2a1b50",
          backgroundImage: "none",
          border: "none",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          fontFamily: '"Roboto Mono", monospace',
        },
      },
    },
    MuiTypography: {
      styleOverrides: {
        root: {
          fontFamily: '"Roboto Mono", monospace',
        },
      },
    },
  },
  typography: {
    fontFamily: '"Roboto Mono", monospace',
  },
});

function AppContent() {
  const [version, setVersion] = useState("");
  const [websocketState, setWebsocketState] = useState("DISCONNECTED");
  const [apiState, setApiState] = useState("UNKNOWN");
  const [serverState, setServerState] = useState("DISCONNECTED");
  const [interval, setInterval] = useState(0);
  const intervalRef = React.useRef(0);
  const navigate = useNavigate();

  const onSocketConnect = useCallback(() => {
    socketIO.emit(
      "client",
      {},
      ({ version, websocketState, apiState, interval }) => {
        console.log("client loaded", {
          version,
          websocketState,
          apiState,
          interval,
        });
        setVersion(version);
        setWebsocketState(websocketState);
        setApiState(apiState);
        setServerState("CONNECTED");
        if (interval) {
          intervalRef.current = interval;
          setInterval(interval);
        }
      }
    );
  }, []);

  useEffect(() => {
    socketIO.on("reload", () => {
      console.log("reload sent from backend");
      window.location = "/";
    });
    socketIO.on("info", function (response) {
      console.log(`socket:info`, response);
      setVersion(response.version);
    });
    socketIO.on("connect", onSocketConnect);
    socketIO.on("reconnect", onSocketConnect);
    socketIO.on("disconnect", () => {
      setServerState("DISCONNECTED");
    });
    socketIO.on("updateState", (state) => {
      console.log("Received state update:", state);
      if (state.websocketState) {
        console.log("Updating WebSocket state to:", state.websocketState);
        setWebsocketState(state.websocketState);
      }
      if (state.apiState) {
        console.log("Updating API state to:", state.apiState);
        setApiState(state.apiState);
      }
      if (state.interval) {
        console.log("Updating interval to:", state.interval);
        intervalRef.current = state.interval;
        setInterval(state.interval);
      }
    });

    return () => {
      socketIO.removeAllListeners("info");
      socketIO.removeAllListeners("connect");
      socketIO.removeAllListeners("reconnect");
      socketIO.removeAllListeners("disconnect");
      socketIO.removeAllListeners("reload");
      socketIO.removeAllListeners("updateState");
    };
  }, [onSocketConnect]);

  const getStatusColor = (state) => {
    switch (state) {
      case "CONNECTED":
      case "GOOD":
        return "var(--theme-success)";
      case "CONNECTING":
      case "CHECKING":
        return "var(--theme-warning)";
      case "ERROR":
      case "FAILED":
      case "DISCONNECTED":
        return "var(--theme-danger)";
      default:
        return "var(--theme-text)";
    }
  };

  const StatusIndicator = ({ label, state }) => {
    const color = getStatusColor(state);
    const isConnecting = state === "CONNECTING" || state === "CHECKING";

    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Tooltip title={state} arrow>
          <Box
            aria-label={`${label} status: ${state}`}
            sx={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: color,
              animation: isConnecting ? "pulse 1.5s infinite" : "none",
              "@keyframes pulse": {
                "0%": {
                  boxShadow: `0 0 0 0 ${color}80`,
                },
                "70%": {
                  boxShadow: `0 0 0 6px ${color}00`,
                },
                "100%": {
                  boxShadow: `0 0 0 0 ${color}00`,
                },
              },
            }}
          />
        </Tooltip>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {label}
        </Typography>
      </Box>
    );
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <CssBaseline />
      <AppBar position="absolute">
        <Toolbar sx={{ pr: "24px", minHeight: "48px !important" }}>
          <img
            src="/bitwatch-512-transparent.png"
            alt="favicon"
            width="32"
            height="32"
            sx={{}}
          />
          <Typography
            component="h1"
            variant="h6"
            color="inherit"
            noWrap
            sx={{
              flexGrow: 1,
              cursor: "pointer",
              "&:hover": {
                textShadow: "0 0 8px var(--theme-glow-secondary)",
              },
            }}
            onClick={() => navigate("/")}
          >
            itwatch {version}
          </Typography>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <IconButton
              color="inherit"
              onClick={() => navigate("/")}
              className="header-nav-icon"
              size="small"
              aria-label="Watch List"
              data-testid="watch-list-button"
            >
              <WatchListIcon />
            </IconButton>
            <IconButton
              color="inherit"
              onClick={() => navigate("/integrations")}
              className="header-nav-icon"
              size="small"
              aria-label="Integrations"
              data-testid="integrations-button"
            >
              <IntegrationIcon />
            </IconButton>
            <IconButton
              color="inherit"
              onClick={() => navigate("/config")}
              className="header-nav-icon"
              size="small"
              aria-label="Settings"
              data-testid="settings-button"
            >
              <SettingsIcon />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>
      <Box
        component="main"
        sx={{
          backgroundColor: (theme) =>
            theme.palette.mode === "light"
              ? theme.palette.grey[100]
              : theme.palette.grey[900],
          flexGrow: 1,
          height: "100vh",
          overflow: "auto",
          pt: 5,
          pb: 7,
        }}
      >
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4, px: { xs: 2, sm: 3 } }}>
          <Grid container spacing={3} justifyContent="center">
            <Grid item xs={12} sx={{ maxWidth: "1200px", width: "100%" }}>
              <Paper
                sx={{
                  p: 0,
                  display: "flex",
                  flexDirection: "column",
                  background: "transparent",
                  boxShadow: "none",
                }}
              >
                <Routes>
                  <Route path="/" exact element={<Addresses />} />
                  <Route
                    path="/integrations"
                    exact
                    element={<Integrations />}
                  />
                  <Route path="/config" exact element={<Configuration />} />
                </Routes>
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </Box>
      <Box
        component="footer"
        sx={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: "var(--theme-surface)",
          borderTop: "1px solid rgba(77, 244, 255, 0.3)",
          backdropFilter: "blur(5px)",
          zIndex: 1000,
          py: 1,
          px: 2,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <StatusIndicator label="Server" state={serverState} />
          <StatusIndicator label="WebSocket" state={websocketState} />
          <StatusIndicator label="API" state={apiState} />
          {interval > 0 && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Box
                sx={{
                  width: "100px",
                  height: "8px",
                  backgroundColor: "rgba(77, 244, 255, 0.2)",
                  borderRadius: "4px",
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <Box
                  sx={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    height: "100%",
                    width: "0%",
                    backgroundColor: "var(--theme-secondary)",
                    animation: `progress ${interval}ms linear infinite`,
                    "@keyframes progress": {
                      "0%": { width: "0%" },
                      "100%": { width: "100%" },
                    },
                  }}
                />
              </Box>
            </Box>
          )}
        </Box>
        <Typography
          variant="caption"
          sx={{
            color: "var(--theme-accent)",
            opacity: 0.7,
          }}
        >
          Made with ❤️ and 🤖 by{" "}
          <Link
            color="inherit"
            target="zap"
            href="https://zapomatic.github.io/"
          >
            Zap-O-Matic
          </Link>
        </Typography>
      </Box>
    </Box>
  );
}

function App() {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <div className="App">
        <BrowserRouter basename="/" future={{ v7_startTransition: true }}>
          <AppContent />
        </BrowserRouter>
      </div>
    </ThemeProvider>
  );
}

export default App;
