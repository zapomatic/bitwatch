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
import Title from "../Title";
import socketIO from "../io";
import AddIcon from "@mui/icons-material/Add";
import RefreshIcon from "@mui/icons-material/Refresh";
import "../theme.css";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import CrystalNotification from "../components/CrystalNotification";
import AddressDialog from "./AddressDialog";
import CollectionRow from "./CollectionRow";
import { calculateCollectionTotals } from "../utils/collection";

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
  const [displayBtc, setDisplayBtc] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
    collection: null,
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
    // Initial state fetch
    socketIO.emit("getState", {}, (response) => {
      console.log({ response });
      setCollections(response.collections || {});
    });

    // Listen for ongoing state updates
    const handleStateUpdate = (updatedState) => {
      console.log("State update received:", updatedState);
      if (updatedState.collections) {
        setCollections(updatedState.collections);
      }

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
    if (!newCollection?.name?.trim()) return;
    const collection = newCollection.name.trim();
    if (collections[collection]) {
      setNotification({
        open: true,
        message: "Collection already exists",
        severity: "error",
      });
      return;
    }
    socketIO.emit(
      "add",
      {
        collection,
        extendedKeys: [],
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
          setJustCreatedCollection(collection);
          setNewCollection(null);
        }
      }
    );
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

  const handleDelete = useCallback(
    ({ address, collection, extendedKey, descriptor }) => {
      if (address) {
        setDeleteDialog({
          open: true,
          address,
          collection,
          extendedKey: null,
          descriptor: null,
          message: "Remove this address from the collection?",
        });
      } else if (extendedKey) {
        setDeleteDialog({
          open: true,
          collection: extendedKey.collection,
          address: null,
          extendedKey,
          descriptor: null,
          message: "Delete this extended key and all its derived addresses?",
        });
      } else if (descriptor) {
        setDeleteDialog({
          open: true,
          collection: descriptor.collection,
          address: null,
          extendedKey: null,
          descriptor,
          message: "Delete this descriptor and all its derived addresses?",
        });
      } else {
        setDeleteDialog({
          open: true,
          collection,
          address: null,
          extendedKey: null,
          descriptor: null,
          message: "Delete this collection and all its addresses?",
        });
      }
    },
    []
  );

  const confirmDelete = useCallback(() => {
    const { address, collection, extendedKey, descriptor } = deleteDialog;
    socketIO.emit(
      "delete",
      { address, collection, extendedKey, descriptor },
      (response) => {
        if (response.error) {
          setNotification({
            open: true,
            message: response.error,
            severity: "error",
          });
        }
        setDeleteDialog({
          open: false,
          address: null,
          collection: null,
          extendedKey: null,
          descriptor: null,
          message: "",
        });
      }
    );
  }, [deleteDialog]);

  const handleRenameCollection = useCallback((oldName, newName) => {
    socketIO.emit("renameCollection", { oldName, newName }, (response) => {
      if (response.error) {
        setNotification({
          open: true,
          message: response.error,
          severity: "error",
        });
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

  const handleEditAddress = (collection, address) => {
    setEditDialog({
      open: true,
      collection,
      address,
    });
  };

  const handleSaveAddress = (updatedAddress) => {
    socketIO.emit(
      "updateAddress",
      {
        collection: editDialog.collection,
        address: updatedAddress,
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
        }
        setEditDialog({ open: false, collection: null, address: null });
      }
    );
  };

  const handleAddExtendedKey = (collection, data) => {
    socketIO.emit(
      "addExtendedKey",
      {
        collection,
        name: data.name,
        key: data.key,
        gapLimit: parseInt(data.gapLimit) || 2,
        initialAddresses: parseInt(data.initialAddresses) || 10,
        derivationPath: data.derivationPath,
        skip: parseInt(data.skip) || 0,
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

  const handleAddDescriptor = (collection, data) => {
    socketIO.emit(
      "addDescriptor",
      {
        collection,
        name: data.name,
        descriptor: data.descriptor,
        gapLimit: parseInt(data.gapLimit) || 2,
        initialAddresses: parseInt(data.initialAddresses) || 10,
        skip: parseInt(data.skip) || 0,
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
                onClick={() => setDisplayBtc(!displayBtc)}
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
                startIcon={<AddIcon />}
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
                >
                  <Box className="crystal-flex crystal-flex-start crystal-gap-1">
                    Info
                    {sortConfig.field === "addresses" && (
                      <span>{sortConfig.direction === "asc" ? "↑" : "↓"}</span>
                    )}
                  </Box>
                </TableCell>
                <TableCell
                  className="crystal-table-header"
                  onClick={() => handleSort("chain_in")}
                  sx={{ cursor: "pointer" }}
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
              {getSortedCollections().map(([name, collection]) => (
                <CollectionRow
                  key={name}
                  collection={{ ...collection, name }}
                  onSaveExpected={saveExpected}
                  onDelete={handleDelete}
                  onAddAddress={handleAddAddress}
                  onAddExtendedKey={handleAddExtendedKey}
                  onAddDescriptor={handleAddDescriptor}
                  onRenameCollection={handleRenameCollection}
                  onEditAddress={handleEditAddress}
                  autoShowAddForm={name === justCreatedCollection}
                  displayBtc={displayBtc}
                  setNotification={setNotification}
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
