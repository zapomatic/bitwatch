import React, { useState } from "react";
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
import ExtendedKeyInfo from "./ExtendedKeyInfo";
import AddressRow from "./AddressRow";
import DescriptorInfo from "./DescriptorInfo";
import BalanceCell from "./BalanceCell";
import ExtendedKeyDialog from "./ExtendedKeyDialog";
import DescriptorDialog from "./DescriptorDialog";
import AddressDialog from "./AddressDialog";
import { calculateCollectionTotals } from "../utils/collection";
import CheckBoxIcon from "@mui/icons-material/CheckBox";

const CollectionRow = ({
  collection,
  onSaveExpected,
  onDelete,
  onAddAddress,
  onAddExtendedKey,
  onAddDescriptor,
  onRenameCollection,
  onEditAddress,
  displayBtc,
  setNotification,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [newName, setNewName] = useState(collection.name);
  const [isEditing, setIsEditing] = useState(false);
  const [extendedKeyDialogOpen, setExtendedKeyDialogOpen] = useState(false);
  const [descriptorDialogOpen, setDescriptorDialogOpen] = useState(false);
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);

  const handleExpandClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleAddClick = () => {
    setAddressDialogOpen(true);
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
    setNewName(collection.name);
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
                  style={{
                    flex: 1,
                    marginRight: "8px",
                  }}
                />
                <IconButtonStyled
                  icon={<CheckBoxIcon />}
                  onClick={handleRenameCollection}
                  tooltip="Save"
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
                <Typography variant="body2">{collection.name}</Typography>
                <IconButtonStyled
                  icon={<EditIcon />}
                  onClick={() => setIsEditing(true)}
                  tooltip="Rename collection"
                />
              </Box>
            )}
          </Box>
        </TableCell>
        <TableCell className="crystal-table-cell">
          {(collection.addresses || []).length}
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
        <TableCell>
          <Box sx={{ display: "flex", gap: 1 }}>
            <IconButtonStyled
              onClick={handleAddClick}
              icon={<VpnKeyIcon />}
              title="Add Address"
              data-testid={`${collection.name}-add-address`}
              aria-label="Add address to collection"
            />
            <IconButtonStyled
              onClick={() => setExtendedKeyDialogOpen(true)}
              icon={<KeyIcon />}
              title="Add Extended Key"
              data-testid={`${collection.name}-add-extended-key`}
              aria-label="Add extended key to collection"
            />
            <IconButtonStyled
              onClick={() => setDescriptorDialogOpen(true)}
              icon={<GroupsIcon />}
              title="Add Descriptor"
              data-testid={`${collection.name}-add-descriptor`}
              aria-label="Add descriptor to collection"
            />
            <IconButtonStyled
              onClick={() => onDelete({ collection: collection.name })}
              icon={<DeleteIcon />}
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
            <Box sx={{ margin: 1 }}>
              {/* Single Addresses Table */}
              {collection.addresses?.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography
                    variant="subtitle1"
                    sx={{
                      mt: 2,
                      mb: 1,
                      color: "var(--theme-secondary)",
                      fontWeight: "bold",
                      borderBottom: "1px solid var(--theme-secondary)",
                      paddingBottom: "8px",
                    }}
                  >
                    Single Addresses
                  </Typography>
                  <Table
                    size="small"
                    className="crystal-table address-subtable"
                  >
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Address</TableCell>
                        <TableCell>On-Chain</TableCell>
                        <TableCell>Mempool</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {collection.addresses.map((address) => (
                        <AddressRow
                          key={address.address}
                          address={address}
                          collection={collection}
                          onEditAddress={onEditAddress}
                          onSaveExpected={onSaveExpected}
                          onDelete={onDelete}
                          displayBtc={displayBtc}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              )}

              {/* Extended Keys and Descriptors Table */}
              {(collection.extendedKeys?.length > 0 ||
                collection.descriptors?.length > 0) && (
                <Box sx={{ mb: 3 }}>
                  <Typography
                    variant="subtitle1"
                    sx={{
                      mt: 2,
                      mb: 1,
                      color: "var(--theme-secondary)",
                      fontWeight: "bold",
                      borderBottom: "1px solid var(--theme-secondary)",
                      paddingBottom: "8px",
                    }}
                  >
                    Key-Derived Addresses
                  </Typography>
                  <Table
                    size="small"
                    className="crystal-table address-subtable"
                  >
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Key/Descriptor</TableCell>
                        <TableCell>Derivation Path</TableCell>
                        <TableCell>Gap Limit</TableCell>
                        <TableCell>Skip</TableCell>
                        <TableCell>Initial Addresses</TableCell>
                        <TableCell>Address Count</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(collection.extendedKeys || []).map((extendedKey) => (
                        <ExtendedKeyInfo
                          key={extendedKey.key}
                          extendedKey={extendedKey}
                          collection={collection}
                          onDelete={() => onDelete({ extendedKey })}
                          onSaveExpected={onSaveExpected}
                          displayBtc={displayBtc}
                        />
                      ))}
                      {(collection.descriptors || []).map((descriptor) => (
                        <DescriptorInfo
                          key={descriptor.descriptor}
                          descriptor={descriptor}
                          collection={collection}
                          onEdit={onEditAddress}
                          onDelete={onDelete}
                          onEditAddress={onEditAddress}
                          onSaveExpected={onSaveExpected}
                          displayBtc={displayBtc}
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
        onClose={() => setExtendedKeyDialogOpen(false)}
        onSave={onAddExtendedKey}
        collection={collection.name}
      />
      <DescriptorDialog
        open={descriptorDialogOpen}
        onClose={() => setDescriptorDialogOpen(false)}
        onSave={onAddDescriptor}
        collection={collection.name}
      />
      <AddressDialog
        open={addressDialogOpen}
        onClose={() => setAddressDialogOpen(false)}
        onSave={(data) =>
          onAddAddress(collection.name, data.name, data.address, () =>
            setAddressDialogOpen(false)
          )
        }
      />
    </>
  );
};

export default CollectionRow;
