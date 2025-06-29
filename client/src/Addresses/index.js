import React, { useCallback, useEffect, useState } from "react";
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Toolbar,
  Typography,
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Alert,
} from "@mui/material";
import Title from "../Title.js";
import socketIO from "../io";
import AddIcon from "@mui/icons-material/Add";
import RefreshIcon from "@mui/icons-material/Refresh";
import "../theme.css";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import CrystalNotification from "../components/CrystalNotification.js";
import AddressDialog from "./AddressDialog.js";
import CollectionRow from "./CollectionRow.js";
import { calculateCollectionTotals } from "../utils/collection.js";
import { defaultMonitorSettings } from "../config";

const STORAGE_KEY = "bitwatch_display_unit";

const getStoredDisplayUnit = () => {
  if (typeof window === "undefined") return true;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  console.log("Getting stored display unit:", stored);
  return stored ? JSON.parse(stored) : true;
};

export default function Addresses() {
  const [collections, setCollections] = useState({});
  const [newCollection, setNewCollection] = useState(null);
  const [justCreatedCollection, setJustCreatedCollection] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    address: null,
    collection: null,
    extendedKey: null,
    descriptor: null,
    message: "",
  });
  const [displayBtc, setDisplayBtc] = useState(() => getStoredDisplayUnit());
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState({
    open: false,
    message: "",
    severity: "info",
  });
  const [sortConfig, setSortConfig] = useState({
    field: "name",
    direction: "asc",
  });
  const [importDialog, setImportDialog] = useState({
    open: false,
    file: null,
    error: null,
  });
  const [editDialog, setEditDialog] = useState({
    open: false,
    collectionName: null,
    address: null,
  });

  const handleSort = (field) => {
    setSortConfig((prevConfig) => ({
      field,
      direction:
        prevConfig.field === field && prevConfig.direction === "asc"
          ? "desc"
          : "asc",
    }));
  };

  const getSortedCollections = () => {
    const collectionEntries = Object.entries(collections);
    return collectionEntries.sort(
      ([nameA, collectionA], [nameB, collectionB]) => {
        const totalsA = calculateCollectionTotals(collectionA);
        const totalsB = calculateCollectionTotals(collectionB);

        let comparison = 0;
        switch (sortConfig.field) {
          case "name":
            comparison = nameA.localeCompare(nameB);
            break;
          case "addresses":
            comparison =
              collectionA.addresses.length - collectionB.addresses.length;
            break;
          case "chain_in":
            comparison = (totalsA.chain_in || 0) - (totalsB.chain_in || 0);
            break;
          case "mempool_in":
            comparison = (totalsA.mempool_in || 0) - (totalsB.mempool_in || 0);
            break;
          default:
            comparison = 0;
        }

        return sortConfig.direction === "asc" ? comparison : -comparison;
      }
    );
  };

  useEffect(() => {
    // Set loading state when component mounts
    setLoading(true);

    // Request initial state when component mounts
    socketIO.emit("requestState");

    // Listen for state updates
    const handleStateUpdate = (updatedState) => {
      // console.log("State update received:", updatedState);
      if (updatedState?.collections) {
        // Replace the entire collections state instead of merging
        setCollections(updatedState.collections);
        setLoading(false);
      }

      // Update monitor settings if provided
      if (updatedState?.monitor) {
        Object.assign(defaultMonitorSettings, updatedState.monitor);
      }

      // If we're in a refresh operation, check for errors
      if (refreshing) {
        const hasErrors = Object.values(updatedState.collections || {}).some(
          (collection) => {
            // Check regular addresses
            if (collection.addresses.some((addr) => addr.error)) {
              return true;
            }
            // Check extended key addresses
            if (
              collection.extendedKeys?.some((key) =>
                key.addresses.some((addr) => addr.error)
              )
            ) {
              return true;
            }
            // Check descriptor addresses
            if (
              collection.descriptors?.some((desc) =>
                desc.addresses.some((addr) => addr.error)
              )
            ) {
              return true;
            }
            return false;
          }
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

    // Add visibility change listener to request state update when page becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        console.log("Page became visible, requesting state update...");
        setLoading(true);
        socketIO.emit("requestState");
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Cleanup listeners on unmount
    return () => {
      socketIO.off("updateState", handleStateUpdate);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshing]);

  const handleAddCollection = () => {
    if (!newCollection?.name?.trim()) return;
    const collectionName = newCollection.name.trim();
    if (collections[collectionName]) {
      setNotification({
        open: true,
        message: "Collection already exists",
        severity: "error",
      });
      return;
    }
    socketIO.emit(
      "addCollection",
      {
        collectionName,
        extendedKeys: [],
        descriptors: [],
        addresses: [],
      },
      (response) => {
        if (response.error) {
          setNotification({
            open: true,
            message: response.error,
            severity: "error",
          });
        } else {
          setJustCreatedCollection(collectionName);
          setNewCollection(null);
        }
      }
    );
  };

  const handleAddAddress = (
    collectionName,
    name,
    address,
    monitor,
    trackWebsocket,
    setNewAddress
  ) => {
    console.log("addAddress", {
      collectionName,
      name,
      address,
      monitor,
      trackWebsocket,
    });
    socketIO.emit(
      "addAddress",
      {
        collectionName,
        name,
        address,
        monitor,
        trackWebsocket,
      },
      (response) => {
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
      }
    );
  };

  const saveExpected = useCallback((row) => {
    const updatedRow = {
      ...row,
      expect: row.actual,
    };
    socketIO.emit("saveExpected", updatedRow, (response) => {
      if (response?.error) {
        console.error("Error saving expected state:", response.error);
        setNotification({
          open: true,
          message: `Failed to save expected balance: ${response.error}`,
          severity: "error",
        });
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
        setNotification({
          open: true,
          message: "Expected balance saved",
          severity: "success",
        });
      }
    });
  }, []);

  const handleDelete = useCallback(
    ({ address, collectionName, extendedKeyName, descriptorName, message }) => {
      if (message) {
        setDeleteDialog({
          open: true,
          address,
          collectionName,
          extendedKeyName,
          descriptorName,
          message,
        });
      } else if (address && descriptorName) {
        setDeleteDialog({
          open: true,
          address,
          collectionName,
          extendedKeyName: null,
          descriptorName,
          message: "Remove this address from the descriptor set?",
        });
      } else if (address && extendedKeyName) {
        setDeleteDialog({
          open: true,
          address,
          collectionName,
          extendedKeyName,
          descriptorName: null,
          message: "Remove this address from the extended key set?",
        });
      } else if (address) {
        setDeleteDialog({
          open: true,
          address,
          collectionName,
          extendedKeyName: null,
          descriptorName: null,
          message: "Remove this address from the collection?",
        });
      } else if (descriptorName) {
        setDeleteDialog({
          open: true,
          collectionName,
          address: null,
          extendedKeyName: null,
          descriptorName,
          message: "Delete this descriptor and all its derived addresses?",
        });
      } else if (extendedKeyName) {
        setDeleteDialog({
          open: true,
          collectionName,
          address: null,
          extendedKeyName,
          descriptorName: null,
          message: "Delete this extended key and all its derived addresses?",
        });
      } else if (collectionName) {
        // Handle direct collection name string (only for collection deletion)
        setDeleteDialog({
          open: true,
          collectionName,
          address: null,
          extendedKeyName: null,
          descriptorName: null,
          message: "Delete this collection and all its addresses?",
        });
      }
    },
    []
  );

  const confirmDelete = useCallback(() => {
    const { address, collectionName, extendedKeyName, descriptorName } =
      deleteDialog;
    socketIO.emit(
      "delete",
      { address, collectionName, extendedKeyName, descriptorName },
      (response) => {
        if (response.error) {
          setNotification({
            open: true,
            message: response.error,
            severity: "error",
          });
        } else if (response.success) {
          setNotification({
            open: true,
            message: "Successfully deleted",
            severity: "success",
          });
        }
        setDeleteDialog({
          open: false,
          address: null,
          collectionName: null,
          extendedKeyName: null,
          descriptorName: null,
          message: "",
        });
      }
    );
  }, [deleteDialog]);

  const handleRenameCollection = useCallback((oldName, newName) => {
    socketIO.emit("editCollection", { oldName, newName }, (response) => {
      if (response.error) {
        setNotification({
          open: true,
          message: response.error,
          severity: "error",
        });
      } else {
        setNotification({
          open: true,
          message: "Collection renamed successfully",
          severity: "success",
        });
      }
    });
  }, []);

  // refresh all collections
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    for (const collection of Object.values(collections)) {
      socketIO.emit("refreshBalance", {
        collectionName: collection.name,
      });
    }
  }, [collections]);

  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };

  const handleExport = () => {
    const exportData = {
      collections: collections,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bitwatch-collections.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const parseResult = JSON.parse(e.target.result);

      if (
        !parseResult ||
        !parseResult.collections ||
        typeof parseResult.collections !== "object"
      ) {
        setImportDialog({
          open: true,
          file: null,
          error: "Invalid file format. Expected a collections object.",
        });
        return;
      }

      // Validate the structure of each collection
      for (const [name, collection] of Object.entries(
        parseResult.collections
      )) {
        if (!collection.addresses || !Array.isArray(collection.addresses)) {
          setImportDialog({
            open: true,
            file: null,
            error: `Invalid collection structure for ${name}`,
          });
          return;
        }
        for (const addr of collection.addresses) {
          if (!addr.address || !addr.name || !addr.expect) {
            setImportDialog({
              open: true,
              file: null,
              error: `Invalid address structure in collection ${name}`,
            });
            return;
          }
        }
        if (collection.extendedKeys) {
          for (const extKey of collection.extendedKeys) {
            if (
              !extKey.key ||
              !extKey.name ||
              !extKey.derivationPath ||
              !extKey.addresses
            ) {
              setImportDialog({
                open: true,
                file: null,
                error: `Invalid extended key structure in collection ${name}`,
              });
              return;
            }
          }
        }
      }

      setImportDialog({
        open: true,
        file: parseResult,
        error: null,
      });
    };

    reader.onerror = () => {
      setImportDialog({
        open: true,
        file: null,
        error: "Failed to read file.",
      });
    };

    reader.readAsText(file);
  };

  const confirmImport = () => {
    if (!importDialog.file) return;

    socketIO.emit("importCollections", importDialog.file, (response) => {
      if (response.error) {
        setNotification({
          open: true,
          message: response.error,
          severity: "error",
        });
      } else {
        setNotification({
          open: true,
          message: "Collections imported successfully",
          severity: "success",
        });
      }
      setImportDialog({ open: false, file: null, error: null });
    });
  };

  const handleEditAddress = (collectionName, address) => {
    setEditDialog({
      open: true,
      collectionName,
      address: {
        ...address,
        parentKey: address.parentKey || null, // Preserve parentKey if it exists
      },
    });
  };

  const handleSaveAddress = (updatedAddress) => {
    socketIO.emit(
      "editAddress",
      {
        collectionName: editDialog.collectionName,
        address: editDialog.address.address,
        name: updatedAddress.name,
        monitor: updatedAddress.monitor,
        trackWebsocket: updatedAddress.trackWebsocket,
        parentKey: editDialog.address.parentKey,
      },
      (response) => {
        if (response.error) {
          setNotification({
            open: true,
            message: response.error,
            severity: "error",
          });
        } else {
          setNotification({
            open: true,
            message: "Address updated successfully",
            severity: "success",
          });
          // Wait for notification to be shown before closing dialog
          setTimeout(() => {
            setEditDialog({ open: false, collectionName: null, address: null });
          }, 100);
        }
      }
    );
  };

  const handleAddExtendedKey = (collectionName, data) => {
    console.log("handleAddExtendedKey", { collectionName, data });
    socketIO.emit(
      "addExtendedKey",
      {
        collectionName,
        ...data,
      },
      (response) => {
        if (response.error) {
          setNotification({
            open: true,
            message: `Error adding extended key: ${response.error}`,
            severity: "error",
          });
        } else {
          setNotification({
            open: true,
            message: "Extended key added successfully",
            severity: "success",
          });
        }
      }
    );
  };

  const handleAddDescriptor = (collectionName, data) => {
    socketIO.emit(
      "addDescriptor",
      {
        collectionName,
        ...data,
      },
      (response) => {
        if (response.error) {
          setNotification({
            open: true,
            message: `Error adding descriptor: ${response.error}`,
            severity: "error",
          });
        } else {
          setNotification({
            open: true,
            message: "Descriptor added successfully",
            severity: "success",
          });
        }
      }
    );
  };

  const handleEditDescriptor = (collectionName, data) => {
    console.log("handleEditDescriptor", { collectionName, data });
    socketIO.emit(
      "editDescriptor",
      {
        collectionName,
        ...data,
      },
      (response) => {
        if (response.error) {
          setNotification({
            open: true,
            message: `Error updating descriptor: ${response.error}`,
            severity: "error",
          });
        } else {
          setNotification({
            open: true,
            message: "Descriptor updated successfully",
            severity: "success",
          });
        }
      }
    );
  };

  const handleEditExtendedKey = (collectionName, data) => {
    socketIO.emit(
      "editExtendedKey",
      {
        collectionName,
        ...data,
      },
      (response) => {
        if (response.error) {
          setNotification({
            open: true,
            message: `Error updating extended key: ${response.error}`,
            severity: "error",
          });
        } else {
          setNotification({
            open: true,
            message: "Extended key updated successfully",
            severity: "success",
          });
        }
      }
    );
  };

  const handleToggleDisplayUnit = () => {
    const newDisplayBtc = !displayBtc;
    console.log("Setting display unit to:", newDisplayBtc);
    setDisplayBtc(newDisplayBtc);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(newDisplayBtc));
      console.log("Successfully saved to localStorage");
    } catch (error) {
      console.error("Failed to save to localStorage:", error);
    }
  };

  // Add loading state to the UI
  if (loading) {
    return (
      <div className="crystal-panel">
        <Title>
          <Toolbar
            sx={{
              flexDirection: "row",
              gap: 2,
              alignItems: "center",
              maxWidth: "1200px",
              margin: "0 auto",
              width: "100%",
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
              }}
            >
              Loading...
            </Typography>
          </Toolbar>
        </Title>
      </div>
    );
  }

  return (
    <>
      <div className="crystal-panel">
        <Title>
          <Toolbar
            sx={{
              flexDirection: "row",
              gap: 2,
              alignItems: "center",
              maxWidth: "1200px",
              margin: "0 auto",
              width: "100%",
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
              }}
            >
              Watch List
            </Typography>
            <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
              <Button
                className="crystal-button"
                onClick={handleExport}
                startIcon={<FileDownloadIcon />}
                sx={{
                  background: "var(--theme-surface)",
                  color: "var(--theme-text)",
                  "&:hover": {
                    background: "rgba(77, 244, 255, 0.1)",
                    boxShadow: "0 0 10px var(--theme-glow-secondary)",
                  },
                }}
              >
                Export
              </Button>
              <input
                type="file"
                accept=".json"
                style={{ display: "none" }}
                id="import-file"
                onChange={handleImport}
              />
              <label htmlFor="import-file">
                <Button
                  component="span"
                  className="crystal-button"
                  startIcon={<FileUploadIcon />}
                  sx={{
                    background: "var(--theme-surface)",
                    color: "var(--theme-text)",
                    "&:hover": {
                      background: "rgba(77, 244, 255, 0.1)",
                      boxShadow: "0 0 10px var(--theme-glow-secondary)",
                    },
                  }}
                >
                  Import
                </Button>
              </label>
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
                onClick={handleToggleDisplayUnit}
                sx={{
                  background: "var(--theme-surface)",
                  color: "var(--theme-text)",
                  "&:hover": {
                    background: "rgba(77, 244, 255, 0.1)",
                    boxShadow: "0 0 10px var(--theme-glow-secondary)",
                  },
                  "& .unit-icon": {
                    fontFamily: "monospace",
                    fontWeight: "bold",
                    fontSize: "1.1em",
                  },
                }}
                data-testid="display-unit-toggle"
              >
                {displayBtc ? (
                  <>
                    <span className="unit-icon">sat</span>
                  </>
                ) : (
                  <>
                    <span className="unit-icon">₿</span>
                  </>
                )}
              </Button>
              <Button
                className="crystal-button crystal-button-primary"
                onClick={() => setNewCollection({ name: "" })}
                size="small"
                startIcon={<AddIcon />}
                data-testid="new-collection-button"
                aria-label="New Collection"
              >
                Collection
              </Button>
            </Box>
          </Toolbar>
        </Title>
        <Box
          className="scrollable-container"
          sx={{
            overflowX: "auto",
            maxWidth: "1200px",
            margin: "0 auto",
            width: "100%",
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
                <TableCell
                  className="crystal-table-header"
                  onClick={() => handleSort("name")}
                  sx={{ cursor: "pointer" }}
                  data-testid="sort-by-name"
                  aria-label={`Sort by name ${
                    sortConfig.field === "name"
                      ? sortConfig.direction === "asc"
                        ? "descending"
                        : "ascending"
                      : "ascending"
                  }`}
                >
                  <Box className="crystal-flex crystal-flex-start crystal-gap-1">
                    Collection
                    {sortConfig.field === "name" && (
                      <span>{sortConfig.direction === "asc" ? "↑" : "↓"}</span>
                    )}
                  </Box>
                </TableCell>
                <TableCell
                  className="crystal-table-header"
                  onClick={() => handleSort("addresses")}
                  sx={{ cursor: "pointer" }}
                  data-testid="sort-by-addresses"
                  aria-label={`Sort by addresses ${
                    sortConfig.field === "addresses"
                      ? sortConfig.direction === "asc"
                        ? "descending"
                        : "ascending"
                      : "ascending"
                  }`}
                >
                  <Box className="crystal-flex crystal-flex-start crystal-gap-1">
                    Addresses
                    {sortConfig.field === "addresses" && (
                      <span>{sortConfig.direction === "asc" ? "↑" : "↓"}</span>
                    )}
                  </Box>
                </TableCell>
                <TableCell
                  className="crystal-table-header"
                  onClick={() => handleSort("chain_in")}
                  sx={{ cursor: "pointer" }}
                  data-testid="sort-by-chain"
                  aria-label={`Sort by chain balance ${
                    sortConfig.field === "chain_in"
                      ? sortConfig.direction === "asc"
                        ? "descending"
                        : "ascending"
                      : "ascending"
                  }`}
                >
                  <Box className="crystal-flex crystal-flex-start crystal-gap-1">
                    On-Chain
                    {sortConfig.field === "chain_in" && (
                      <span>{sortConfig.direction === "asc" ? "↑" : "↓"}</span>
                    )}
                  </Box>
                </TableCell>
                <TableCell
                  className="crystal-table-header"
                  onClick={() => handleSort("mempool_in")}
                  sx={{ cursor: "pointer" }}
                  data-testid="sort-by-mempool"
                  aria-label={`Sort by mempool balance ${
                    sortConfig.field === "mempool_in"
                      ? sortConfig.direction === "asc"
                        ? "descending"
                        : "ascending"
                      : "ascending"
                  }`}
                >
                  <Box className="crystal-flex crystal-flex-start crystal-gap-1">
                    Mempool
                    {sortConfig.field === "mempool_in" && (
                      <span>{sortConfig.direction === "asc" ? "↑" : "↓"}</span>
                    )}
                  </Box>
                </TableCell>
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
                      aria-label="Collection Name"
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
                  <TableCell colSpan={3}></TableCell>
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
                        aria-label="Add Collection"
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
                        aria-label="Cancel Collection"
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
              {getSortedCollections().map(([name, collection]) => (
                <CollectionRow
                  key={name}
                  collection={{ ...collection, name }}
                  onSaveExpected={saveExpected}
                  onDelete={handleDelete}
                  onAddAddress={handleAddAddress}
                  onAddExtendedKey={handleAddExtendedKey}
                  onAddDescriptor={handleAddDescriptor}
                  onEditDescriptor={handleEditDescriptor}
                  onEditExtendedKey={handleEditExtendedKey}
                  onRenameCollection={handleRenameCollection}
                  onEditAddress={handleEditAddress}
                  displayBtc={displayBtc}
                  setNotification={setNotification}
                  autoShowAddForm={justCreatedCollection === name}
                />
              ))}
            </TableBody>
          </Table>
        </Box>

        {/* Delete confirmation dialog */}
        <Dialog
          open={deleteDialog.open}
          onClose={() =>
            setDeleteDialog({
              open: false,
              address: null,
              collection: null,
              extendedKey: null,
              descriptor: null,
              message: "",
            })
          }
          PaperProps={{
            sx: {
              background: "var(--theme-surface)",
              border: "1px solid rgba(77, 244, 255, 0.3)",
            },
          }}
          data-testid="delete-confirmation-dialog"
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
                  extendedKey: null,
                  descriptor: null,
                  message: "",
                })
              }
              className="crystal-button"
              data-testid="delete-confirmation-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              className="crystal-button"
              data-testid="delete-confirmation-confirm"
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

        {/* Import confirmation dialog */}
        <Dialog
          open={importDialog.open}
          onClose={() =>
            setImportDialog({ open: false, file: null, error: null })
          }
          PaperProps={{
            sx: {
              background: "var(--theme-surface)",
              border: "1px solid rgba(77, 244, 255, 0.3)",
            },
          }}
        >
          <DialogTitle sx={{ color: "var(--theme-secondary)" }}>
            Import Collections
          </DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ color: "var(--theme-text)" }}>
              {importDialog.error ? (
                <Alert severity="error">{importDialog.error}</Alert>
              ) : (
                "This will overwrite all existing collections. Are you sure you want to continue?"
              )}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() =>
                setImportDialog({ open: false, file: null, error: null })
              }
              className="crystal-button"
            >
              Cancel
            </Button>
            {!importDialog.error && (
              <Button
                onClick={confirmImport}
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
                Import
              </Button>
            )}
          </DialogActions>
        </Dialog>

        <AddressDialog
          open={editDialog.open}
          onClose={() =>
            setEditDialog({ open: false, collection: null, address: null })
          }
          address={editDialog.address}
          onSave={handleSaveAddress}
        />
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
