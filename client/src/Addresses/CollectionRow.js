import React, { useState, useEffect } from "react";
import {
  TableRow,
  TableCell,
  Box,
  IconButton,
  Typography,
  Collapse,
  Table,
  TableHead,
  TableBody,
} from "@mui/material";
import { ExpandLess, ExpandMore } from "@mui/icons-material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import KeyIcon from "@mui/icons-material/Key";
import GroupsIcon from "@mui/icons-material/Groups";
import IconButtonStyled from "../components/IconButtonStyled";
import ExtendedKeyRow from "./ExtendedKeyRow";
import DescriptorRow from "./DescriptorRow";
import BalanceCell from "./BalanceCell";
import ExtendedKeyDialog from "./ExtendedKeyDialog";
import DescriptorDialog from "./DescriptorDialog";
import AddressDialog from "./AddressDialog";
import { calculateCollectionTotals } from "../utils/collection";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import AddressTable from "./AddressTable";

const CollectionRow = ({
  collection,
  onSaveExpected,
  onDelete,
  onAddAddress,
  onAddExtendedKey,
  onAddDescriptor,
  onEditDescriptor,
  onEditExtendedKey,
  onRenameCollection,
  onEditAddress,
  displayBtc,
  setNotification,
  autoShowAddForm,
}) => {
  const [isExpanded, setIsExpanded] = useState(autoShowAddForm);
  const [newName, setNewName] = useState(collection.name);
  const [isEditing, setIsEditing] = useState(false);
  const [extendedKeyDialogOpen, setExtendedKeyDialogOpen] = useState(false);
  const [descriptorDialogOpen, setDescriptorDialogOpen] = useState(false);
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [editingDescriptor, setEditingDescriptor] = useState(null);
  const [editingExtendedKey, setEditingExtendedKey] = useState(null);

  useEffect(() => {
    if (
      collection.addresses?.length > 0 ||
      collection.extendedKeys?.length > 0 ||
      collection.descriptors?.length > 0
    ) {
      setIsExpanded(true);
    }
  }, [
    collection.addresses?.length,
    collection.extendedKeys?.length,
    collection.descriptors?.length,
  ]);

  const handleExpandClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleAddClick = () => {
    setAddressDialogOpen(true);
  };

  const handleAddExtendedKey = () => {
    setExtendedKeyDialogOpen(true);
    setIsExpanded(true);
  };

  const handleAddDescriptor = () => {
    setDescriptorDialogOpen(true);
    setIsExpanded(true);
  };

  const handleEditDescriptor = (descriptor) => {
    setEditingDescriptor(descriptor);
    setDescriptorDialogOpen(true);
  };

  const handleEditExtendedKey = (extendedKey) => {
    setEditingExtendedKey(extendedKey);
    setExtendedKeyDialogOpen(true);
  };

  const handleRenameCollection = () => {
    if (!newName) {
      setNotification({
        message: "Please provide a name for the collection",
        severity: "error",
      });
      return;
    }

    if (newName === collection.name) {
      setIsEditing(false);
      return;
    }

    onRenameCollection(collection.name, newName);
    setIsEditing(false);
  };

  const totals = calculateCollectionTotals(collection);

  return (
    <>
      <TableRow
        className="crystal-table-row collection-row"
        sx={{ "& > *": { borderBottom: "unset" } }}
      >
        <TableCell>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <IconButton size="small" onClick={handleExpandClick} sx={{ mr: 1 }}>
              {isExpanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
            {isEditing ? (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                }}
              >
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleRenameCollection();
                    } else if (e.key === "Escape") {
                      setNewName(collection.name);
                      setIsEditing(false);
                    }
                  }}
                  autoFocus
                  className="crystal-input"
                  data-testid={`${collection.name}-edit-input`}
                  style={{
                    flex: 1,
                    marginRight: "8px",
                  }}
                />
                <IconButtonStyled
                  icon={<CheckBoxIcon />}
                  onClick={handleRenameCollection}
                  tooltip="Save"
                  data-testid={`${collection.name}-save`}
                />
              </Box>
            ) : (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                }}
              >
                <Typography
                  variant="body2"
                  data-testid={`${collection.name}-name`}
                >
                  {collection.name}
                </Typography>
                <IconButtonStyled
                  icon={<EditIcon />}
                  onClick={() => setIsEditing(true)}
                  tooltip="Rename collection"
                  data-testid={`${collection.name}-edit`}
                />
              </Box>
            )}
          </Box>
        </TableCell>
        <TableCell className="crystal-table-cell">
          {(collection.addresses || []).length +
            (collection.extendedKeys || []).reduce(
              (sum, key) => sum + (key.addresses.length || 0),
              0
            ) +
            (collection.descriptors || []).reduce(
              (sum, desc) => sum + (desc.addresses.length || 0),
              0
            )}
        </TableCell>
        <TableCell className="crystal-table-cell">
          <Box className="crystal-flex crystal-flex-start">
            <BalanceCell
              value={totals.chain_in - totals.chain_out}
              expect={totals.expect_chain_in - totals.expect_chain_out}
              displayBtc={displayBtc}
              error={totals.hasError}
              pending={totals.hasPending}
            />
          </Box>
        </TableCell>
        <TableCell className="crystal-table-cell">
          <Box className="crystal-flex crystal-flex-start">
            <BalanceCell
              value={totals.mempool_in - totals.mempool_out}
              expect={totals.expect_mempool_in - totals.expect_mempool_out}
              displayBtc={displayBtc}
              error={totals.hasError}
              pending={totals.hasPending}
            />
          </Box>
        </TableCell>
        <TableCell align="right">
          <Box className="crystal-flex crystal-flex-right crystal-gap-1">
            <IconButtonStyled
              onClick={handleAddClick}
              icon={<VpnKeyIcon />}
              size="small"
              title="Add Address"
              data-testid={`${collection.name}-add-address`}
              aria-label="Add address to collection"
            />
            <IconButtonStyled
              onClick={handleAddExtendedKey}
              icon={<KeyIcon />}
              size="small"
              title="Add Extended Key"
              data-testid={`${collection.name}-add-extended-key`}
              aria-label="Add extended key to collection"
            />
            <IconButtonStyled
              onClick={handleAddDescriptor}
              icon={<GroupsIcon />}
              size="small"
              title="Add Descriptor"
              data-testid={`${collection.name}-add-descriptor`}
              aria-label="Add descriptor to collection"
            />
            <IconButtonStyled
              onClick={() => onDelete({ collectionName: collection.name })}
              icon={<DeleteIcon />}
              size="small"
              variant="danger"
              title="Delete Collection"
              data-testid={`${collection.name}-delete`}
              aria-label="Delete collection"
            />
          </Box>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={5}>
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 0 }}>
              {/* Single Addresses Table */}
              {collection.addresses?.length > 0 && (
                <Box sx={{ mb: 0 }}>
                  <AddressTable
                    addresses={collection.addresses}
                    collection={collection}
                    displayBtc={displayBtc}
                    setNotification={setNotification}
                    onDelete={onDelete}
                    onEditAddress={onEditAddress}
                    dataTestId={`${collection.name}-address-list`}
                  />
                </Box>
              )}

              {/* Extended Keys and Descriptors Table */}
              {(collection.extendedKeys?.length > 0 ||
                collection.descriptors?.length > 0) && (
                <Box sx={{ mb: 1 }}>
                  <Table
                    size="small"
                    className="crystal-table address-subtable"
                  >
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Key/Descriptor</TableCell>
                        <TableCell>Path</TableCell>
                        <TableCell>Gap</TableCell>
                        <TableCell>Skip</TableCell>
                        <TableCell>Initial</TableCell>
                        <TableCell>Count</TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(collection.extendedKeys || []).map((extendedKey) => (
                        <ExtendedKeyRow
                          key={extendedKey.key}
                          extendedKey={extendedKey}
                          onEdit={() => handleEditExtendedKey(extendedKey)}
                          onDelete={onDelete}
                          collection={collection}
                          displayBtc={displayBtc}
                          setNotification={setNotification}
                          onEditAddress={onEditAddress}
                        />
                      ))}
                      {(collection.descriptors || []).map((descriptor) => (
                        <DescriptorRow
                          key={descriptor.descriptor}
                          descriptor={descriptor}
                          collection={collection}
                          onEdit={handleEditDescriptor}
                          onDelete={onDelete}
                          onEditAddress={onEditAddress}
                          onSaveExpected={onSaveExpected}
                          displayBtc={displayBtc}
                          setNotification={setNotification}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
      <ExtendedKeyDialog
        open={extendedKeyDialogOpen}
        onClose={() => {
          setExtendedKeyDialogOpen(false);
          setEditingExtendedKey(null);
        }}
        onSave={editingExtendedKey ? onEditExtendedKey : onAddExtendedKey}
        collection={collection.name}
        extendedKey={editingExtendedKey}
      />
      <DescriptorDialog
        open={descriptorDialogOpen}
        onClose={() => {
          setDescriptorDialogOpen(false);
          setEditingDescriptor(null);
        }}
        onSave={editingDescriptor ? onEditDescriptor : onAddDescriptor}
        collection={collection.name}
        descriptor={editingDescriptor}
      />
      <AddressDialog
        open={addressDialogOpen}
        onClose={() => setAddressDialogOpen(false)}
        onSave={(data) =>
          onAddAddress(
            collection.name,
            data.name,
            data.address,
            data.monitor,
            data.trackWebsocket,
            () => setAddressDialogOpen(false)
          )
        }
      />
    </>
  );
};

export default CollectionRow;
