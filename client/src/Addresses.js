import React, { useCallback, useEffect, useState } from "react";
import Button from "@mui/material/Button";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Title from "./Title";
import socketIO from "./io";
import Box from "@mui/material/Box";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckIcon from "@mui/icons-material/Check";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import WarningIcon from "@mui/icons-material/Warning";
import RefreshIcon from "@mui/icons-material/Refresh";
import Tooltip from "@mui/material/Tooltip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Collapse from "@mui/material/Collapse";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import "./theme.css";
import { ExpandLess, ExpandMore } from "@mui/icons-material";

const CrystalNotification = ({ open, onClose, message, severity = "info" }) => (
  <Snackbar
    open={open}
    autoHideDuration={6000}
    onClose={onClose}
    anchorOrigin={{ vertical: "top", horizontal: "right" }}
    sx={{
      position: "fixed",
      top: "16px",
      right: "16px",
      zIndex: 9999,
    }}
  >
    <Alert
      onClose={onClose}
      severity={severity}
      sx={{
        width: "100%",
        background: "var(--theme-surface)",
        color: "var(--theme-text)",
        border: "1px solid rgba(77, 244, 255, 0.3)",
        boxShadow: "0 0 15px var(--theme-glow-secondary)",
        "& .MuiAlert-icon": {
          color:
            severity === "error"
              ? "var(--theme-danger)"
              : severity === "warning"
              ? "var(--theme-warning)"
              : "var(--theme-success)",
        },
      }}
    >
      {message}
    </Alert>
  </Snackbar>
);

const formatSatoshis = (sats, displayBtc = true) => {
  if (!sats && sats !== 0) return "—";
  if (displayBtc) {
    const btc = sats / 100000000;
    return `${btc.toLocaleString(undefined, {
      minimumFractionDigits: 8,
      maximumFractionDigits: 8,
    })} ₿`;
  }
  return `${sats.toLocaleString()} sat`;
};

const BalanceCell = ({ value, expect, displayBtc, error, pending }) => {
  if (pending) {
    return (
      <Box className="crystal-flex crystal-flex-start crystal-gap-1">
        <Typography className="crystal-text" sx={{ opacity: 0.5 }}>
          Loading...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box className="crystal-flex crystal-flex-start crystal-gap-1">
        <Typography className="crystal-text" sx={{ opacity: 0.5 }}>
          —
        </Typography>
        <Tooltip title="Failed to fetch balance">
          <WarningIcon
            className="crystal-text-warning"
            sx={{ fontSize: "1rem" }}
          />
        </Tooltip>
      </Box>
    );
  }

  const diff = value - (expect || 0);
  const isVerified = diff === 0;

  return (
    <Box className="crystal-flex crystal-flex-start crystal-gap-1">
      {isVerified ? (
        <CheckIcon className="crystal-text-success" sx={{ fontSize: "1rem" }} />
      ) : (
        <WarningIcon
          className="crystal-text-warning"
          sx={{ fontSize: "1rem" }}
        />
      )}
      <Typography className="crystal-text">
        {formatSatoshis(value, displayBtc)}
      </Typography>
      {!isVerified && (
        <Typography
          className={`crystal-text ${
            diff > 0 ? "crystal-text-success" : "crystal-text-danger"
          }`}
          sx={{ fontSize: "0.8em", opacity: 0.8 }}
        >
          ({diff > 0 ? "+" : ""}
          {formatSatoshis(diff, displayBtc)})
        </Typography>
      )}
    </Box>
  );
};

const AddressCell = ({ address }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Failed to copy address:", err);
    }
  };

  return (
    <Box
      className="crystal-flex crystal-flex-start crystal-gap-1"
      sx={{ width: "100%" }}
    >
      <Box
        component="a"
        href={`https://mempool.space/address/${address}`}
        target="_blank"
        rel="noopener noreferrer"
        className="crystal-link"
      >
        {`${address.slice(0, 8)}...`}
      </Box>
      <Tooltip title={copied ? "Copied!" : "Copy full address"}>
        <IconButton
          size="small"
          onClick={handleCopy}
          className="crystal-icon-button"
        >
          <ContentCopyIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

const calculateCollectionTotals = (addresses) => {
  const totals = addresses.reduce(
    (totals, addr) => {
      if (!addr.actual || addr.error) return totals;
      return {
        chain_in: (totals.chain_in || 0) + (addr.actual.chain_in || 0),
        chain_out: (totals.chain_out || 0) + (addr.actual.chain_out || 0),
        mempool_in: (totals.mempool_in || 0) + (addr.actual.mempool_in || 0),
        mempool_out: (totals.mempool_out || 0) + (addr.actual.mempool_out || 0),
        expect_chain_in:
          (totals.expect_chain_in || 0) + (addr.expect?.chain_in || 0),
        expect_chain_out:
          (totals.expect_chain_out || 0) + (addr.expect?.chain_out || 0),
        expect_mempool_in:
          (totals.expect_mempool_in || 0) + (addr.expect?.mempool_in || 0),
        expect_mempool_out:
          (totals.expect_mempool_out || 0) + (addr.expect?.mempool_out || 0),
      };
    },
    {
      chain_in: 0,
      chain_out: 0,
      mempool_in: 0,
      mempool_out: 0,
      expect_chain_in: 0,
      expect_chain_out: 0,
      expect_mempool_in: 0,
      expect_mempool_out: 0,
    }
  );

  // Check if any address has an error or is pending
  const hasError = addresses.some((addr) => addr.error);
  const hasPending = addresses.some((addr) => !addr.actual && !addr.error);

  return {
    ...totals,
    hasError,
    hasPending,
  };
};

const CollectionRow = ({
  collection,
  onSaveExpected,
  onDelete,
  onAddAddress,
  autoShowAddForm,
  displayBtc,
  onRenameCollection,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(collection.name);
  const [newAddress, setNewAddress] = useState(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  // Calculate totals from addresses
  const totals = calculateCollectionTotals(collection.addresses);

  const handleAddClick = () => {
    setIsExpanded(true);
    setNewAddress({ name: "", address: "" });
  };

  // Initialize newAddress if autoShowAddForm is true
  useEffect(() => {
    if (autoShowAddForm) {
      setIsExpanded(true);
      setNewAddress({ name: "", address: "" });
    }
  }, [autoShowAddForm]);

  const handleSubmitAddress = () => {
    if (newAddress.name && newAddress.address) {
      onAddAddress(
        collection.name,
        newAddress.name,
        newAddress.address,
        setNewAddress
      );
    }
  };

  const handleRenameCollection = () => {
    if (editedName.trim() && editedName !== collection.name) {
      onRenameCollection(collection.name, editedName.trim());
    }
    setIsEditingName(false);
  };

  return (
    <>
      <TableRow className="crystal-table-row collection-row">
        <TableCell>
          <Box className="crystal-flex crystal-flex-start crystal-gap-1">
            <IconButton
              size="small"
              onClick={() => setIsExpanded(!isExpanded)}
              className="crystal-icon-button"
            >
              {isExpanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
            {isEditingName ? (
              <Box
                className="crystal-flex crystal-flex-end crystal-gap-1"
                sx={{ flex: 1 }}
              >
                <input
                  className="crystal-input"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && editedName.trim()) {
                      handleRenameCollection();
                    }
                  }}
                  style={{ width: "calc(100% - 80px)" }}
                />
                <IconButton
                  size="small"
                  onClick={handleRenameCollection}
                  className="crystal-icon-button crystal-icon-button-success"
                >
                  <CheckIcon />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => {
                    setIsEditingName(false);
                    setEditedName(collection.name);
                  }}
                  className="crystal-icon-button crystal-icon-button-danger"
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
            ) : (
              <Typography
                className="crystal-text"
                onClick={() => setIsEditingName(true)}
                sx={{ cursor: "pointer" }}
              >
                {collection.name}
              </Typography>
            )}
          </Box>
        </TableCell>
        <TableCell className="crystal-table-cell">
          {collection.addresses.length}
        </TableCell>
        <TableCell className="crystal-table-cell">
          <Box className="crystal-flex crystal-flex-start">
            <BalanceCell
              value={totals.chain_in}
              expect={totals.expect_chain_in}
              displayBtc={displayBtc}
              error={totals.hasError}
              pending={totals.hasPending}
            />
          </Box>
        </TableCell>
        {!isMobile && (
          <TableCell className="crystal-table-cell">
            <Box className="crystal-flex crystal-flex-start">
              <BalanceCell
                value={totals.mempool_in}
                expect={totals.expect_mempool_in}
                displayBtc={displayBtc}
                error={totals.hasError}
                pending={totals.hasPending}
              />
            </Box>
          </TableCell>
        )}
        <TableCell>
          <Box className="crystal-flex crystal-flex-center crystal-gap-1">
            <IconButton
              size="small"
              onClick={handleAddClick}
              className="crystal-icon-button"
            >
              <AddIcon />
            </IconButton>
            {collection.name !== "Satoshi" && (
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete({ collection: collection.name });
                }}
                className="crystal-icon-button crystal-icon-button-danger"
              >
                <DeleteIcon />
              </IconButton>
            )}
          </Box>
        </TableCell>
      </TableRow>
      <TableRow style={{ height: isExpanded ? "auto" : 0 }}>
        <TableCell
          colSpan={6}
          style={{
            padding: 0,
            borderBottom: "none",
            height: isExpanded ? "auto" : 0,
          }}
        >
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 0 }}>
              <Table size="small" className="crystal-table address-subtable">
                <TableHead>
                  <TableRow>
                    <TableCell className="crystal-table-header">Name</TableCell>
                    <TableCell className="crystal-table-header">
                      Address
                    </TableCell>
                    <TableCell className="crystal-table-header">
                      On-Chain
                    </TableCell>
                    {!isMobile && (
                      <TableCell className="crystal-table-header">
                        Mempool
                      </TableCell>
                    )}
                    <TableCell className="crystal-table-header"></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {newAddress && (
                    <TableRow className="crystal-table-row">
                      <TableCell
                        colSpan={isMobile ? 4 : 5}
                        className="crystal-table-cell"
                      >
                        <Box className="crystal-flex crystal-flex-start crystal-gap-2">
                          <Box
                            className="crystal-flex crystal-flex-start crystal-gap-1"
                            sx={{ flex: 1 }}
                          >
                            <input
                              className="crystal-input"
                              placeholder="Name"
                              value={newAddress.name}
                              onChange={(e) =>
                                setNewAddress((prev) => ({
                                  ...prev,
                                  name: e.target.value,
                                }))
                              }
                            />
                            <input
                              className="crystal-input"
                              placeholder="Address"
                              value={newAddress.address}
                              onChange={(e) =>
                                setNewAddress((prev) => ({
                                  ...prev,
                                  address: e.target.value,
                                }))
                              }
                            />
                            <IconButton
                              size="small"
                              onClick={handleSubmitAddress}
                              className="crystal-icon-button crystal-icon-button-success"
                            >
                              <CheckIcon />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => {
                                setNewAddress(null);
                                setIsExpanded(false);
                              }}
                              className="crystal-icon-button crystal-icon-button-danger"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Box>
                        </Box>
                      </TableCell>
                    </TableRow>
                  )}
                  {collection.addresses.map((address, index) => (
                    <TableRow
                      key={index}
                      className="crystal-table-row address-row"
                    >
                      <TableCell>
                        <Box className="crystal-flex crystal-flex-start crystal-gap-1">
                          <Typography className="crystal-text">
                            {address.name}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell className="crystal-table-cell">
                        <AddressCell address={address.address} />
                      </TableCell>
                      <TableCell className="crystal-table-cell">
                        <Box className="crystal-flex crystal-flex-start">
                          <BalanceCell
                            value={address.actual?.chain_in}
                            expect={address.expect?.chain_in || 0}
                            displayBtc={displayBtc}
                            error={address.error}
                            pending={!address.actual && !address.error}
                          />
                        </Box>
                      </TableCell>
                      {!isMobile && (
                        <TableCell className="crystal-table-cell">
                          <Box className="crystal-flex crystal-flex-start">
                            <BalanceCell
                              value={address.actual?.mempool_in}
                              expect={address.expect?.mempool_in || 0}
                              displayBtc={displayBtc}
                              error={address.error}
                              pending={!address.actual && !address.error}
                            />
                          </Box>
                        </TableCell>
                      )}
                      <TableCell>
                        <Box className="crystal-flex crystal-flex-center crystal-gap-1">
                          {address.actual?.chain_in !==
                            address.expect?.chain_in && (
                            <IconButton
                              size="small"
                              onClick={() =>
                                onSaveExpected({
                                  collection: collection.name,
                                  address: address.address,
                                  actual: address.actual,
                                  expect: address.actual,
                                })
                              }
                              className="crystal-action-button crystal-action-button-success"
                            >
                              <CheckIcon />
                            </IconButton>
                          )}
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete({
                                collection: collection.name,
                                address: address.address,
                              });
                            }}
                            className="crystal-action-button crystal-action-button-danger"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

export default function Addresses() {
  const [collections, setCollections] = useState({});
  const [newCollection, setNewCollection] = useState(null);
  const [justCreatedCollection, setJustCreatedCollection] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    address: null,
    collection: null,
  });
  const [displayBtc, setDisplayBtc] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notification, setNotification] = useState({
    open: false,
    message: "",
    severity: "info",
  });
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  useEffect(() => {
    // Initial state fetch
    socketIO.emit("getState", {}, (response) => {
      console.log({ response });
      setCollections(response.collections || {});
    });

    // Listen for ongoing state updates
    const handleStateUpdate = (updatedState) => {
      console.log("State update received:", updatedState);
      setCollections(updatedState.collections || {});

      // If we're in a refresh operation, check for errors
      if (refreshing) {
        const hasErrors = Object.values(updatedState.collections || {}).some(
          (collection) => collection.addresses.some((addr) => addr.error)
        );

        setNotification({
          open: true,
          message: hasErrors
            ? "Some addresses failed to refresh. Perhaps the API is not synced."
            : "Data refreshed successfully",
          severity: hasErrors ? "warning" : "success",
        });
        setRefreshing(false);
      }
    };

    socketIO.on("updateState", handleStateUpdate);

    // Cleanup listener on unmount
    return () => {
      socketIO.off("updateState", handleStateUpdate);
    };
  }, [refreshing]);

  const handleAddCollection = () => {
    if (!newCollection?.name) return;
    const collection = newCollection.name.trim();
    if (collections[collection]) {
      alert("Collection already exists");
      return;
    }
    socketIO.emit("add", { collection }, (response) => {
      if (response.error) {
        alert(response.error);
      } else {
        setJustCreatedCollection(collection);
        setNewCollection(null);
      }
    });
  };

  const handleAddAddress = (collection, name, address, setNewAddress) => {
    socketIO.emit("add", { collection, name, address }, (response) => {
      console.log("add", response);
      if (response.error) {
        setNotification({
          open: true,
          message: response.error,
          severity: "error",
        });
      } else if (response.status === "ok" && response.record) {
        // The address was added successfully and is in a loading state
        // The UI will update automatically when the updateState event is received
        setNewAddress(null);
      }
    });
  };

  const saveExpected = useCallback((row) => {
    const updatedRow = {
      ...row,
      expect: row.actual,
    };
    socketIO.emit("saveExpected", updatedRow, (response) => {
      if (response?.error) {
        console.error("Error saving expected state:", response.error);
      } else {
        // Update local state to reflect the new expected values
        setCollections((prevCollections) => {
          const newCollections = { ...prevCollections };
          const collection = newCollections[row.collection];
          if (collection) {
            const address = collection.addresses.find(
              (addr) => addr.address === row.address
            );
            if (address) {
              address.expect = { ...address.actual };
            }
          }
          return newCollections;
        });
      }
    });
  }, []);

  const handleDelete = useCallback(({ address, collection }) => {
    if (address) {
      setDeleteDialog({
        open: true,
        address,
        collection,
        message: "Remove this address from the collection?",
      });
    } else {
      setDeleteDialog({
        open: true,
        collection,
        message: "Delete this collection and all its addresses?",
      });
    }
  }, []);

  const confirmDelete = useCallback(() => {
    const { address, collection } = deleteDialog;
    socketIO.emit("delete", { address, collection }, (response) => {
      if (response.error) {
        alert(response.error);
      }
      setDeleteDialog({ open: false, address: null, collection: null });
    });
  }, [deleteDialog]);

  const handleRenameCollection = useCallback((oldName, newName) => {
    socketIO.emit("renameCollection", { oldName, newName }, (response) => {
      if (response.error) {
        alert(response.error);
      }
    });
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    socketIO.emit("refresh", {}, (response) => {
      if (response?.error) {
        console.error("Error refreshing data:", response.error);
        setNotification({
          open: true,
          message: "Failed to refresh data. Please try again.",
          severity: "error",
        });
        setRefreshing(false);
      }
      // Note: We don't set refreshing to false here anymore
      // It will be set to false when we receive the updateState event
    });
  }, []);

  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };

  return (
    <>
      <div className="crystal-panel">
        <Title>
          <Toolbar
            sx={{
              flexDirection: isMobile ? "column" : "row",
              gap: isMobile ? 2 : 0,
              alignItems: isMobile ? "stretch" : "center",
            }}
          >
            <Typography
              component="h1"
              variant="h6"
              color="inherit"
              noWrap
              sx={{
                flexGrow: 1,
                color: "var(--theme-secondary)",
                textAlign: isMobile ? "center" : "left",
              }}
            >
              Watch List
            </Typography>
            <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
              <Button
                className="crystal-button"
                onClick={handleRefresh}
                disabled={refreshing}
                startIcon={
                  <RefreshIcon
                    sx={{
                      animation: refreshing
                        ? "spin 1s linear infinite"
                        : "none",
                      "@keyframes spin": {
                        "0%": { transform: "rotate(0deg)" },
                        "100%": { transform: "rotate(360deg)" },
                      },
                    }}
                  />
                }
                sx={{
                  background: "var(--theme-surface)",
                  color: "var(--theme-text)",
                  "&:hover": {
                    background: "rgba(77, 244, 255, 0.1)",
                    boxShadow: "0 0 10px var(--theme-glow-secondary)",
                  },
                }}
              >
                {refreshing ? "Refreshing..." : "Refresh"}
              </Button>
              <Button
                className="crystal-button"
                onClick={() => setDisplayBtc(!displayBtc)}
                sx={{
                  background: "var(--theme-surface)",
                  color: "var(--theme-text)",
                  "&:hover": {
                    background: "rgba(77, 244, 255, 0.1)",
                    boxShadow: "0 0 10px var(--theme-glow-secondary)",
                  },
                }}
              >
                {displayBtc ? "Show Satoshis" : "Show Bitcoin"}
              </Button>
              <Button
                className="crystal-button"
                onClick={() => setNewCollection({ name: "" })}
                startIcon={<AddIcon />}
                sx={{
                  background:
                    "linear-gradient(135deg, var(--theme-primary), var(--theme-secondary))",
                  color: "var(--theme-background)",
                  borderRadius: "8px",
                  border: "1px solid rgba(77, 244, 255, 0.3)",
                  boxShadow: "0 0 10px var(--theme-glow-primary)",
                  "&:hover": {
                    background:
                      "linear-gradient(135deg, var(--theme-secondary), var(--theme-primary))",
                    boxShadow: "0 0 15px var(--theme-glow-primary)",
                  },
                }}
              >
                Add Collection
              </Button>
            </Box>
          </Toolbar>
        </Title>
        <Box
          className="scrollable-container"
          sx={{
            overflowX: "auto",
            "&:hover": {
              "&::-webkit-scrollbar-thumb": {
                boxShadow: "0 0 15px var(--theme-glow-secondary)",
              },
            },
          }}
        >
          <Table size="small" className="crystal-table">
            <TableHead>
              <TableRow>
                <TableCell className="crystal-table-header">
                  Collection
                </TableCell>
                <TableCell className="crystal-table-header">Info</TableCell>
                <TableCell className="crystal-table-header">On-Chain</TableCell>
                {!isMobile && (
                  <TableCell className="crystal-table-header">
                    Mempool
                  </TableCell>
                )}
                <TableCell className="crystal-table-header"></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {newCollection && (
                <TableRow>
                  <TableCell>
                    <input
                      type="text"
                      className="crystal-input"
                      value={newCollection.name}
                      onChange={(e) =>
                        setNewCollection({
                          ...newCollection,
                          name: e.target.value,
                        })
                      }
                      placeholder="Collection Name"
                      style={{ width: "100%" }}
                      onKeyPress={(e) => {
                        if (e.key === "Enter" && newCollection.name.trim()) {
                          handleAddCollection();
                        }
                      }}
                      autoFocus
                    />
                  </TableCell>
                  <TableCell colSpan={!isMobile ? 3 : 2}></TableCell>
                  <TableCell>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "center",
                        gap: 1,
                      }}
                    >
                      <Button
                        className="crystal-button"
                        onClick={handleAddCollection}
                        disabled={!newCollection.name.trim()}
                        sx={{
                          background:
                            "linear-gradient(135deg, var(--theme-primary), var(--theme-secondary))",
                          color: "var(--theme-background)",
                          "&:hover": {
                            background:
                              "linear-gradient(135deg, var(--theme-secondary), var(--theme-primary))",
                            boxShadow: "0 0 15px var(--theme-glow-primary)",
                          },
                        }}
                      >
                        Add
                      </Button>
                      <Button
                        className="crystal-button"
                        onClick={() => setNewCollection(null)}
                        sx={{
                          background:
                            "linear-gradient(135deg, var(--theme-danger), var(--theme-warning))",
                          color: "var(--theme-background)",
                          "&:hover": {
                            background:
                              "linear-gradient(135deg, var(--theme-warning), var(--theme-danger))",
                            boxShadow: "0 0 15px var(--theme-glow-primary)",
                          },
                        }}
                      >
                        Cancel
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
              {Object.entries(collections).map(([name, collection]) => (
                <CollectionRow
                  key={name}
                  collection={{ ...collection, name }}
                  onSaveExpected={saveExpected}
                  onDelete={handleDelete}
                  onAddAddress={handleAddAddress}
                  onRenameCollection={handleRenameCollection}
                  autoShowAddForm={name === justCreatedCollection}
                  displayBtc={displayBtc}
                />
              ))}
            </TableBody>
          </Table>
        </Box>

        {/* Delete confirmation dialog */}
        <Dialog
          open={deleteDialog.open}
          onClose={() =>
            setDeleteDialog({ open: false, address: null, collection: null })
          }
          PaperProps={{
            sx: {
              background: "var(--theme-surface)",
              border: "1px solid rgba(77, 244, 255, 0.3)",
            },
          }}
        >
          <DialogTitle sx={{ color: "var(--theme-secondary)" }}>
            Confirm Delete
          </DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ color: "var(--theme-text)" }}>
              {deleteDialog.message}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() =>
                setDeleteDialog({
                  open: false,
                  address: null,
                  collection: null,
                })
              }
              className="crystal-button"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              className="crystal-button"
              sx={{
                background:
                  "linear-gradient(135deg, var(--theme-danger), var(--theme-warning))",
                color: "var(--theme-background)",
                "&:hover": {
                  background:
                    "linear-gradient(135deg, var(--theme-warning), var(--theme-danger))",
                  boxShadow: "0 0 15px var(--theme-glow-primary)",
                },
              }}
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </div>

      <CrystalNotification
        open={notification.open}
        onClose={handleCloseNotification}
        message={notification.message}
        severity={notification.severity}
      />
    </>
  );
}
