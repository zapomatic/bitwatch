import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import { styled } from "@mui/material/styles";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import Addresses from "./Addresses";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import CssBaseline from "@mui/material/CssBaseline";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import MuiAppBar from "@mui/material/AppBar";
import Paper from "@mui/material/Paper";
import React, { useCallback, useEffect, useState } from "react";
import SettingsIcon from "@mui/icons-material/Settings";
import socketIO from "./io";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Integrations from "./Integrations";
import Configuration from "./Configuration";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import Footer from "./Footer";
import WatchListIcon from "@mui/icons-material/List";
import IntegrationIcon from "@mui/icons-material/Extension";

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
  const navigate = useNavigate();

  const onSocketConnect = useCallback(() => {
    socketIO.emit("client", {}, ({ version }) => {
      console.log("client loaded", {
        version,
      });
      setVersion(version);
    });
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

    return () => {
      socketIO.removeAllListeners("info");
      socketIO.removeAllListeners("connect");
      socketIO.removeAllListeners("reconnect");
      socketIO.removeAllListeners("reload");
    };
  }, [onSocketConnect]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <CssBaseline />
      <AppBar position="absolute">
        <Toolbar sx={{ pr: "24px" }}>
          <img
            src="/bitwatch-512-transparent.png"
            alt="favicon"
            width="42"
            height="42"
            sx={{}}
          />
          <Typography
            component="h1"
            variant="h6"
            color="inherit"
            noWrap
            sx={{ flexGrow: 1, marginTop: "3" }}
          >
            itwatch {version}
          </Typography>
          <Box sx={{ display: "flex", gap: 1 }}>
            <IconButton
              color="inherit"
              onClick={() => navigate("/")}
              className="header-nav-icon"
            >
              <WatchListIcon />
            </IconButton>
            <IconButton
              color="inherit"
              onClick={() => navigate("/integrations")}
              className="header-nav-icon"
            >
              <IntegrationIcon />
            </IconButton>
            <IconButton
              color="inherit"
              onClick={() => navigate("/config")}
              className="header-nav-icon"
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
          pt: 8,
        }}
      >
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
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
          <Footer sx={{ pt: 4 }} />
        </Container>
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
