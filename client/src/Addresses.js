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
import CloseIcon from "@mui/icons-material/Close";
import Tooltip from "@mui/material/Tooltip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Collapse from "@mui/material/Collapse";
import Alert from "@mui/material/Alert";
import "./theme.css";
import { ExpandLess, ExpandMore } from "@mui/icons-material";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import TextField from "@mui/material/TextField";
import Grid from "@mui/material/Grid";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import EditIcon from "@mui/icons-material/Edit";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CrystalNotification from "./components/CrystalNotification";
import { formatSatoshis } from "./utils/format";

const BalanceCell = ({
  displayBtc,
  error,
  expect,
  label,
  monitor,
  pending,
  type,
  value,
}) => {
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
      {label && <Typography className="crystal-text">{label}</Typography>}
      {isVerified ? (
        <CheckIcon className="crystal-text-success" sx={{ fontSize: "1rem" }} />
      ) : (
        <WarningIcon
          className="crystal-text-warning"
          sx={{ fontSize: "1rem" }}
        />
      )}
      <Box className="crystal-flex crystal-flex-start crystal-gap-1">
        <Typography className="crystal-text">
          {formatSatoshis(value, displayBtc)}
        </Typography>
        {!isVerified && (
          <Typography
            className={`crystal-text ${
              diff > 0 ? "crystal-text-success" : "crystal-text-danger"
            }`}
            sx={{ fontSize: "0.9em", fontWeight: 500, ml: 1 }}
          >
            ({diff > 0 ? "+" : ""}
            {formatSatoshis(diff, displayBtc)})
          </Typography>
        )}
      </Box>
      {monitor && type && (
        <Box
          className="crystal-flex crystal-flex-start crystal-gap-1"
          sx={{ ml: 1 }}
        >
          <Tooltip
            title={`Incoming: ${
              monitor[`${type}_in`] === "alert"
                ? "Alert on changes"
                : "Auto-accept changes"
            }`}
          >
            {monitor[`${type}_in`] === "alert" ? (
              <NotificationsActiveIcon
                className="crystal-text-warning"
                sx={{ fontSize: "1rem" }}
              />
            ) : (
              <CheckCircleIcon
                className="crystal-text-success"
                sx={{ fontSize: "1rem" }}
              />
            )}
          </Tooltip>
          <Tooltip
            title={`Outgoing: ${
              monitor[`${type}_out`] === "alert"
                ? "Alert on changes"
                : "Auto-accept changes"
            }`}
          >
            {monitor[`${type}_out`] === "alert" ? (
              <NotificationsActiveIcon
                className="crystal-text-warning"
                sx={{ fontSize: "1rem" }}
              />
            ) : (
              <CheckCircleIcon
                className="crystal-text-success"
                sx={{ fontSize: "1rem" }}
              />
            )}
          </Tooltip>
        </Box>
      )}
    </Box>
  );
};

const AddressCell = ({ address }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const textarea = document.createElement("textarea");
    textarea.value = address;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);

    try {
      textarea.select();
      const successful = document.execCommand("copy");
      if (successful) {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch (err) {
      console.error("Failed to copy address:", err);
    } finally {
      document.body.removeChild(textarea);
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
        onClick={(e) => e.stopPropagation()}
      >
        {`${address.slice(0, 8)}...`}
      </Box>
      <IconButtonStyled
        size="small"
        onClick={handleCopy}
        icon={<ContentCopyIcon fontSize="small" />}
        title={copied ? "Copied!" : "Copy full address"}
      />
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

const AddressRow = ({
  address,
  collection,
  onEditAddress,
  onSaveExpected,
  onDelete,
  displayBtc,
  isMobile,
}) => (
  <TableRow className="crystal-table-row address-row">
    <TableCell>
      <Box className="crystal-flex crystal-flex-start crystal-gap-1">
        <Typography className="crystal-text">{address.name}</Typography>
      </Box>
    </TableCell>
    <TableCell className="crystal-table-cell">
      <AddressCell address={address.address} />
    </TableCell>
    <TableCell className="crystal-table-cell">
      <Box className="crystal-flex crystal-flex-start">
        <BalanceCell
          label="⬅️"
          value={address.actual?.chain_in}
          expect={address.expect?.chain_in || 0}
          displayBtc={displayBtc}
          error={address.error}
          pending={!address.actual && !address.error}
          monitor={address.monitor}
          type="chain"
        />
      </Box>
      <Box className="crystal-flex crystal-flex-start" sx={{ mt: 1 }}>
        <BalanceCell
          label="➡️"
          value={address.actual?.chain_out}
          expect={address.expect?.chain_out || 0}
          displayBtc={displayBtc}
          error={address.error}
          pending={!address.actual && !address.error}
          monitor={address.monitor}
          type="chain"
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
            monitor={address.monitor}
            type="mempool"
          />
        </Box>
        <Box className="crystal-flex crystal-flex-start" sx={{ mt: 1 }}>
          <BalanceCell
            value={address.actual?.mempool_out}
            expect={address.expect?.mempool_out || 0}
            displayBtc={displayBtc}
            error={address.error}
            pending={!address.actual && !address.error}
            monitor={address.monitor}
            type="mempool"
          />
        </Box>
      </TableCell>
    )}
    <TableCell>
      <Box className="crystal-flex crystal-flex-center crystal-gap-1">
        <IconButtonStyled
          size="small"
          onClick={() => onEditAddress(collection.name, address)}
          icon={<EditIcon fontSize="small" />}
        />
        {(address.actual?.chain_in !== address.expect?.chain_in ||
          address.actual?.chain_out !== address.expect?.chain_out ||
          address.actual?.mempool_in !== address.expect?.mempool_in ||
          address.actual?.mempool_out !== address.expect?.mempool_out) && (
          <IconButtonStyled
            size="small"
            onClick={() =>
              onSaveExpected({
                collection: collection.name,
                address: address.address,
                actual: address.actual,
                expect: address.actual,
              })
            }
            icon={<CheckIcon fontSize="small" />}
            variant="success"
          />
        )}
        <IconButtonStyled
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            onDelete({
              collection: collection.name,
              address: address.address,
            });
          }}
          icon={<DeleteIcon fontSize="small" />}
          variant="danger"
        />
      </Box>
    </TableCell>
  </TableRow>
);

const ExtendedKeyInfo = ({
  extendedKey,
  onEdit,
  onDelete,
  collection,
  onEditAddress,
  onSaveExpected,
  displayBtc,
  isMobile,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleExpandClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleEditClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onEdit();
  };

  const handleDeleteClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete();
  };

  return (
    <>
      <TableRow
        className="crystal-table-row address-row"
        sx={{ "& > *": { borderBottom: "unset" } }}
      >
        <TableCell>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <IconButton size="small" onClick={handleExpandClick} sx={{ mr: 1 }}>
              {isExpanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
            <Typography variant="body2">{extendedKey.name}</Typography>
          </Box>
        </TableCell>
        <TableCell>
          <Typography variant="body2">
            {extendedKey.key.slice(0, 8)}...
          </Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2">{extendedKey.derivationPath}</Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2">{extendedKey.gapLimit}</Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2">{extendedKey.skip || 0}</Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2">
            {extendedKey.initialAddresses || 10}
          </Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2">
            {extendedKey.addresses.length}
          </Typography>
        </TableCell>
        <TableCell>
          <Box sx={{ display: "flex", gap: 1 }}>
            <IconButtonStyled onClick={handleEditClick} icon={<EditIcon />} />
            <IconButtonStyled
              onClick={handleDeleteClick}
              icon={<DeleteIcon />}
            />
          </Box>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={8}>
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Address</TableCell>
                    <TableCell>On-Chain</TableCell>
                    <TableCell>Mempool</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {extendedKey.addresses.map((address) => (
                    <AddressRow
                      key={address.address}
                      address={address}
                      collection={collection}
                      onEditAddress={onEditAddress}
                      onSaveExpected={onSaveExpected}
                      onDelete={onDelete}
                      displayBtc={displayBtc}
                      isMobile={isMobile}
                    />
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

const ExtendedKeyDialog = ({ open, onClose, onSave, extendedKey }) => {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [gapLimit, setGapLimit] = useState(2);
  const [initialAddresses, setInitialAddresses] = useState(10);
  const [derivationPath, setDerivationPath] = useState("m/0");
  const [skip, setSkip] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (extendedKey) {
      setName(extendedKey.name || "");
      setKey(extendedKey.key || "");
      setGapLimit(extendedKey.gapLimit || 2);
      setInitialAddresses(extendedKey.initialAddresses || 10);
      setDerivationPath(extendedKey.derivationPath || "m/0");
      setSkip(extendedKey.skip || 0);
    } else {
      setName("");
      setKey("");
      setGapLimit(2);
      setInitialAddresses(10);
      setDerivationPath("m/0");
      setSkip(0);
    }
  }, [extendedKey, open]);

  // Set default derivation path based on key type
  const handleKeyChange = (e) => {
    const newKey = e.target.value;
    setKey(newKey);

    const keyLower = newKey.toLowerCase();
    if (keyLower.startsWith("zpub")) {
      setDerivationPath("m/0");
    } else if (keyLower.startsWith("ypub")) {
      setDerivationPath("m/49/0/0");
    } else if (keyLower.startsWith("xpub")) {
      setDerivationPath("m/44/0/0");
    }
  };

  const handleSave = () => {
    if (!name || !key || !derivationPath) {
      setError("Name, extended key, and derivation path are required");
      return;
    }

    if (!key.match(/^[xyz]pub[a-zA-Z0-9]{107,108}$/)) {
      setError("Invalid extended key format");
      return;
    }

    if (!derivationPath.match(/^m(\/\d+'?)*$/)) {
      setError("Invalid derivation path format");
      return;
    }

    if (derivationPath.includes("'")) {
      setError("Cannot use hardened derivation with extended public keys");
      return;
    }

    onSave({
      name,
      key,
      gapLimit: parseInt(gapLimit),
      initialAddresses: parseInt(initialAddresses),
      derivationPath,
      skip: parseInt(skip),
    });
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
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextField
          margin="dense"
          label="Extended Key"
          fullWidth
          value={key}
          onChange={handleKeyChange}
          helperText="Format: xpub, ypub, or zpub"
        />
        <TextField
          margin="dense"
          label="Derivation Path"
          fullWidth
          value={derivationPath}
          onChange={(e) => setDerivationPath(e.target.value)}
          helperText="Format: m/0 (native segwit), m/49/0/0 (BIP49), m/44/0/0 (BIP44), etc"
        />
        <TextField
          margin="dense"
          label="Initial Addresses to Fetch"
          type="number"
          fullWidth
          value={initialAddresses}
          onChange={(e) => setInitialAddresses(e.target.value)}
          helperText="Number of addresses to fetch initially"
        />
        <TextField
          margin="dense"
          label="Skip Addresses"
          type="number"
          fullWidth
          value={skip}
          onChange={(e) => setSkip(e.target.value)}
          helperText="Number of addresses to skip before starting scan"
        />
        <TextField
          margin="dense"
          label="Gap Limit"
          type="number"
          fullWidth
          value={gapLimit}
          onChange={(e) => setGapLimit(e.target.value)}
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

const CollectionRow = ({
  collection,
  onSaveExpected,
  onDelete,
  onAddAddress,
  onAddExtendedKey,
  onEditExtendedKey,
  onRenameCollection,
  onEditAddress,
  autoShowAddForm,
  displayBtc,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [editingExtendedKey, setEditingExtendedKey] = useState(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(collection.name);
  const [newAddress, setNewAddress] = useState(null);
  const [showExtendedKeyDialog, setShowExtendedKeyDialog] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  // Calculate totals from addresses
  const totals = calculateCollectionTotals(collection.addresses);

  const handleAddClick = () => {
    setExpanded(true);
    setNewAddress({ name: "", address: "" });
  };

  // Initialize newAddress if autoShowAddForm is true
  useEffect(() => {
    if (autoShowAddForm) {
      setExpanded(true);
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

  const handleEditExtendedKey = (extendedKey) => {
    setEditingExtendedKey(extendedKey);
    setShowExtendedKeyDialog(true);
  };

  const handleSaveExtendedKey = (data) => {
    if (editingExtendedKey) {
      onEditExtendedKey(collection.name, {
        ...data,
        initialAddresses: parseInt(data.initialAddresses) || 10,
        gapLimit: parseInt(data.gapLimit) || 2,
        skip: parseInt(data.skip) || 0,
        extendedKeyIndex: collection.extendedKeys.indexOf(editingExtendedKey),
      });
    } else {
      onAddExtendedKey(collection.name, {
        ...data,
        initialAddresses: parseInt(data.initialAddresses) || 10,
        gapLimit: parseInt(data.gapLimit) || 2,
        skip: parseInt(data.skip) || 0,
      });
    }
    setEditingExtendedKey(null);
    setShowExtendedKeyDialog(false);
  };

  const handleDeleteExtendedKey = (extendedKey) => {
    onDelete({ collection: collection.name, extendedKey });
  };

  return (
    <>
      <TableRow className="crystal-table-row collection-row">
        <TableCell>
          <Box className="crystal-flex crystal-flex-start crystal-gap-1">
            <IconButton
              size="small"
              onClick={() => setExpanded(!expanded)}
              className="crystal-icon-button"
            >
              {expanded ? <ExpandLess /> : <ExpandMore />}
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
                <IconButtonStyled
                  size="small"
                  onClick={handleRenameCollection}
                  icon={<CheckIcon />}
                  variant="success"
                />
                <IconButtonStyled
                  onClick={() => {
                    setIsEditingName(false);
                    setEditedName(collection.name);
                  }}
                  size="small"
                  icon={<CloseIcon />}
                  variant="danger"
                />
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
            <IconButtonStyled
              onClick={(e) => {
                e.stopPropagation();
                onDelete({ collection: collection.name });
              }}
              icon={<DeleteIcon />}
              title="Delete Collection (deletes all contents)"
            />
          </Box>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={8}>
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <Table size="small" className="crystal-table address-subtable">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>xPub/yPub/zPub</TableCell>
                  <TableCell>Derivation Path</TableCell>
                  <TableCell>Gap Limit</TableCell>
                  <TableCell>Skip</TableCell>
                  <TableCell>Initial</TableCell>
                  <TableCell>Addresses</TableCell>
                  <TableCell>
                    <IconButtonStyled
                      onClick={() => setShowExtendedKeyDialog(true)}
                      icon={<AddIcon />}
                      title="Add Extended Key"
                    />
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {collection.extendedKeys?.map((extendedKey, index) => (
                  <ExtendedKeyInfo
                    key={index}
                    extendedKey={extendedKey}
                    onEdit={() => handleEditExtendedKey(extendedKey)}
                    onDelete={() => handleDeleteExtendedKey(extendedKey)}
                    collection={collection}
                    onEditAddress={onEditAddress}
                    onSaveExpected={onSaveExpected}
                    displayBtc={displayBtc}
                    isMobile={isMobile}
                  />
                ))}
              </TableBody>
            </Table>
            <Table size="small" className="crystal-table address-subtable">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Single Address</TableCell>
                  <TableCell>On-Chain</TableCell>
                  <TableCell>Mempool</TableCell>
                  <TableCell>
                    <IconButtonStyled
                      size="small"
                      onClick={handleAddClick}
                      icon={<AddIcon />}
                      title="Add Address"
                    />
                  </TableCell>
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
                            onKeyPress={(e) => {
                              if (
                                e.key === "Enter" &&
                                newAddress.name &&
                                newAddress.address
                              ) {
                                handleSubmitAddress();
                              }
                            }}
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
                            onKeyPress={(e) => {
                              if (
                                e.key === "Enter" &&
                                newAddress.name &&
                                newAddress.address
                              ) {
                                handleSubmitAddress();
                              }
                            }}
                          />
                          <IconButtonStyled
                            size="small"
                            onClick={handleSubmitAddress}
                            icon={<CheckIcon fontSize="small" />}
                            variant="success"
                          />
                          <IconButtonStyled
                            size="small"
                            onClick={() => {
                              setNewAddress(null);
                            }}
                            icon={<CloseIcon fontSize="small" />}
                            variant="danger"
                          />
                        </Box>
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
                {collection.addresses.map((address, index) => (
                  <AddressRow
                    key={index}
                    address={address}
                    collection={collection}
                    onEditAddress={onEditAddress}
                    onSaveExpected={onSaveExpected}
                    onDelete={onDelete}
                    displayBtc={displayBtc}
                    isMobile={isMobile}
                  />
                ))}
              </TableBody>
            </Table>
          </Collapse>
        </TableCell>
      </TableRow>
      <ExtendedKeyDialog
        open={showExtendedKeyDialog}
        onClose={() => {
          setShowExtendedKeyDialog(false);
          setEditingExtendedKey(null);
        }}
        onSave={handleSaveExtendedKey}
        extendedKey={editingExtendedKey}
      />
    </>
  );
};

const AddressDialog = ({ open, onClose, address, onSave }) => {
  const [editedAddress, setEditedAddress] = useState(address || {});
  const [monitorSettings, setMonitorSettings] = useState(
    address?.monitor || {
      chain_in: "auto-accept",
      chain_out: "alert",
      mempool_in: "auto-accept",
      mempool_out: "alert",
    }
  );

  useEffect(() => {
    setEditedAddress(address || {});
    setMonitorSettings(
      address?.monitor || {
        chain_in: "auto-accept",
        chain_out: "alert",
        mempool_in: "auto-accept",
        mempool_out: "alert",
      }
    );
  }, [address]);

  const handleSave = () => {
    onSave({ ...editedAddress, monitor: monitorSettings });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{address ? "Edit Address" : "Add Address"}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="Name"
          fullWidth
          value={editedAddress.name || ""}
          onChange={(e) =>
            setEditedAddress({ ...editedAddress, name: e.target.value })
          }
        />
        <TextField
          margin="dense"
          label="Address"
          fullWidth
          value={editedAddress.address || ""}
          onChange={(e) =>
            setEditedAddress({ ...editedAddress, address: e.target.value })
          }
        />
        <Typography variant="subtitle1" sx={{ mt: 0, mb: 1 }}>
          Expected Balances
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <TextField
              margin="dense"
              label="Chain In"
              type="number"
              fullWidth
              value={editedAddress.expect?.chain_in || 0}
              onChange={(e) =>
                setEditedAddress({
                  ...editedAddress,
                  expect: {
                    ...editedAddress.expect,
                    chain_in: parseInt(e.target.value) || 0,
                  },
                })
              }
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              margin="dense"
              label="Chain Out"
              type="number"
              fullWidth
              value={editedAddress.expect?.chain_out || 0}
              onChange={(e) =>
                setEditedAddress({
                  ...editedAddress,
                  expect: {
                    ...editedAddress.expect,
                    chain_out: parseInt(e.target.value) || 0,
                  },
                })
              }
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              margin="dense"
              label="Mempool In"
              type="number"
              fullWidth
              value={editedAddress.expect?.mempool_in || 0}
              onChange={(e) =>
                setEditedAddress({
                  ...editedAddress,
                  expect: {
                    ...editedAddress.expect,
                    mempool_in: parseInt(e.target.value) || 0,
                  },
                })
              }
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              margin="dense"
              label="Mempool Out"
              type="number"
              fullWidth
              value={editedAddress.expect?.mempool_out || 0}
              onChange={(e) =>
                setEditedAddress({
                  ...editedAddress,
                  expect: {
                    ...editedAddress.expect,
                    mempool_out: parseInt(e.target.value) || 0,
                  },
                })
              }
            />
          </Grid>
        </Grid>
        <Typography variant="subtitle1" sx={{ mt: 0, mb: 1 }}>
          Monitoring Settings
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <FormControl fullWidth sx={{ mt: 1 }}>
              <InputLabel sx={{ background: "var(--theme-surface)", px: 1 }}>
                Chain In
              </InputLabel>
              <Select
                value={monitorSettings.chain_in}
                onChange={(e) =>
                  setMonitorSettings({
                    ...monitorSettings,
                    chain_in: e.target.value,
                  })
                }
                sx={{
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "rgba(77, 244, 255, 0.3)",
                  },
                  "&:hover .MuiOutlinedInput-notchedOutline": {
                    borderColor: "var(--theme-secondary)",
                  },
                  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                    borderColor: "var(--theme-primary)",
                  },
                }}
              >
                <MenuItem value="alert">
                  <Box className="crystal-flex crystal-flex-start crystal-gap-1">
                    <NotificationsActiveIcon
                      className="crystal-text-warning"
                      sx={{ fontSize: "1rem" }}
                    />
                    <Typography>Alert</Typography>
                  </Box>
                </MenuItem>
                <MenuItem value="auto-accept">
                  <Box className="crystal-flex crystal-flex-start crystal-gap-1">
                    <CheckCircleIcon
                      className="crystal-text-success"
                      sx={{ fontSize: "1rem" }}
                    />
                    <Typography>Auto Accept</Typography>
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6}>
            <FormControl fullWidth sx={{ mt: 1 }}>
              <InputLabel sx={{ background: "var(--theme-surface)", px: 1 }}>
                Chain Out
              </InputLabel>
              <Select
                value={monitorSettings.chain_out}
                onChange={(e) =>
                  setMonitorSettings({
                    ...monitorSettings,
                    chain_out: e.target.value,
                  })
                }
                sx={{
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "rgba(77, 244, 255, 0.3)",
                  },
                  "&:hover .MuiOutlinedInput-notchedOutline": {
                    borderColor: "var(--theme-secondary)",
                  },
                  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                    borderColor: "var(--theme-primary)",
                  },
                }}
              >
                <MenuItem value="alert">
                  <Box className="crystal-flex crystal-flex-start crystal-gap-1">
                    <NotificationsActiveIcon
                      className="crystal-text-warning"
                      sx={{ fontSize: "1rem" }}
                    />
                    <Typography>Alert</Typography>
                  </Box>
                </MenuItem>
                <MenuItem value="auto-accept">
                  <Box className="crystal-flex crystal-flex-start crystal-gap-1">
                    <CheckCircleIcon
                      className="crystal-text-success"
                      sx={{ fontSize: "1rem" }}
                    />
                    <Typography>Auto Accept</Typography>
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6}>
            <FormControl fullWidth sx={{ mt: 1 }}>
              <InputLabel sx={{ background: "var(--theme-surface)", px: 1 }}>
                Mempool In
              </InputLabel>
              <Select
                value={monitorSettings.mempool_in}
                onChange={(e) =>
                  setMonitorSettings({
                    ...monitorSettings,
                    mempool_in: e.target.value,
                  })
                }
                sx={{
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "rgba(77, 244, 255, 0.3)",
                  },
                  "&:hover .MuiOutlinedInput-notchedOutline": {
                    borderColor: "var(--theme-secondary)",
                  },
                  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                    borderColor: "var(--theme-primary)",
                  },
                }}
              >
                <MenuItem value="alert">
                  <Box className="crystal-flex crystal-flex-start crystal-gap-1">
                    <NotificationsActiveIcon
                      className="crystal-text-warning"
                      sx={{ fontSize: "1rem" }}
                    />
                    <Typography>Alert</Typography>
                  </Box>
                </MenuItem>
                <MenuItem value="auto-accept">
                  <Box className="crystal-flex crystal-flex-start crystal-gap-1">
                    <CheckCircleIcon
                      className="crystal-text-success"
                      sx={{ fontSize: "1rem" }}
                    />
                    <Typography>Auto Accept</Typography>
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6}>
            <FormControl fullWidth sx={{ mt: 1 }}>
              <InputLabel sx={{ background: "var(--theme-surface)", px: 1 }}>
                Mempool Out
              </InputLabel>
              <Select
                value={monitorSettings.mempool_out}
                onChange={(e) =>
                  setMonitorSettings({
                    ...monitorSettings,
                    mempool_out: e.target.value,
                  })
                }
                sx={{
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "rgba(77, 244, 255, 0.3)",
                  },
                  "&:hover .MuiOutlinedInput-notchedOutline": {
                    borderColor: "var(--theme-secondary)",
                  },
                  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                    borderColor: "var(--theme-primary)",
                  },
                }}
              >
                <MenuItem value="alert">
                  <Box className="crystal-flex crystal-flex-start crystal-gap-1">
                    <NotificationsActiveIcon
                      className="crystal-text-warning"
                      sx={{ fontSize: "1rem" }}
                    />
                    <Typography>Alert</Typography>
                  </Box>
                </MenuItem>
                <MenuItem value="auto-accept">
                  <Box className="crystal-flex crystal-flex-start crystal-gap-1">
                    <CheckCircleIcon
                      className="crystal-text-success"
                      sx={{ fontSize: "1rem" }}
                    />
                    <Typography>Auto Accept</Typography>
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
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

const IconButtonStyled = ({
  onClick,
  icon,
  title,
  variant = "default",
  className,
  size = "medium",
  ...props
}) => {
  const buttonClass = `crystal-icon-button ${
    variant === "success"
      ? "crystal-action-button-success"
      : variant === "danger"
      ? "crystal-action-button-danger"
      : ""
  } ${className || ""}`.trim();

  return (
    <IconButton
      size={size}
      onClick={onClick}
      className={buttonClass}
      title={title}
      {...props}
    >
      {icon}
    </IconButton>
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
    extendedKey: null,
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

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
        const totalsA = calculateCollectionTotals(collectionA.addresses);
        const totalsB = calculateCollectionTotals(collectionB.addresses);

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

  const handleDelete = useCallback(({ address, collection, extendedKey }) => {
    if (address) {
      setDeleteDialog({
        open: true,
        address,
        collection,
        extendedKey: null,
        message: "Remove this address from the collection?",
      });
    } else if (extendedKey) {
      setDeleteDialog({
        open: true,
        collection,
        address: null,
        extendedKey,
        message: "Delete this extended key and all its derived addresses?",
      });
    } else {
      setDeleteDialog({
        open: true,
        collection,
        address: null,
        extendedKey: null,
        message: "Delete this collection and all its addresses?",
      });
    }
  }, []);

  const confirmDelete = useCallback(() => {
    const { address, collection, extendedKey } = deleteDialog;
    socketIO.emit(
      "delete",
      { address, collection, extendedKey },
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
          message: "",
        });
      }
    );
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

  const handleExport = () => {
    const exportData = {
      collections: Object.fromEntries(
        Object.entries(collections).map(([name, collection]) => [
          name,
          {
            addresses: collection.addresses.map((addr) => ({
              address: addr.address,
              name: addr.name,
              expect: addr.expect,
            })),
          },
        ])
      ),
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
      try {
        const data = JSON.parse(e.target.result);
        if (!data.collections || typeof data.collections !== "object") {
          setImportDialog({
            open: true,
            file: null,
            error: "Invalid file format. Expected a collections object.",
          });
          return;
        }

        setImportDialog({
          open: true,
          file: data,
          error: null,
        });
      } catch (err) {
        setImportDialog({
          open: true,
          file: null,
          error: "Failed to parse JSON file.",
        });
      }
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
        gapLimit: data.gapLimit,
        derivationPath: data.derivationPath,
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

  const handleEditExtendedKey = (collection, data) => {
    socketIO.emit(
      "editExtendedKey",
      {
        collection,
        ...data,
      },
      (response) => {
        if (response.error) {
          setNotification({
            open: true,
            message: `Error editing extended key: ${response.error}`,
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

  return (
    <>
      <div className="crystal-panel">
        <Title>
          <Toolbar
            sx={{
              flexDirection: isMobile ? "column" : "row",
              gap: isMobile ? 2 : 0,
              alignItems: isMobile ? "stretch" : "center",
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
                textAlign: isMobile ? "center" : "left",
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
                {!isMobile && (
                  <TableCell
                    className="crystal-table-header"
                    onClick={() => handleSort("mempool_in")}
                    sx={{ cursor: "pointer" }}
                  >
                    <Box className="crystal-flex crystal-flex-start crystal-gap-1">
                      Mempool
                      {sortConfig.field === "mempool_in" && (
                        <span>
                          {sortConfig.direction === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </Box>
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
              {getSortedCollections().map(([name, collection]) => (
                <CollectionRow
                  key={name}
                  collection={{ ...collection, name }}
                  onSaveExpected={saveExpected}
                  onDelete={handleDelete}
                  onAddAddress={handleAddAddress}
                  onAddExtendedKey={handleAddExtendedKey}
                  onEditExtendedKey={handleEditExtendedKey}
                  onRenameCollection={handleRenameCollection}
                  onEditAddress={handleEditAddress}
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
            setDeleteDialog({
              open: false,
              address: null,
              collection: null,
              extendedKey: null,
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
