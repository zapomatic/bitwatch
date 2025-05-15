import React from "react";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Box,
  Typography,
  Tooltip,
} from "@mui/material";
import AddressRow from "./AddressRow";

const AddressTable = ({
  addresses,
  collectionName,
  descriptorName,
  extendedKeyName,
  displayBtc,
  setNotification,
  onDelete,
  onEditAddress,
  dataTestId,
}) => {
  return (
    <Table size="small" className="crystal-table address-subtable">
      <TableHead>
        <TableRow>
          <TableCell>Name</TableCell>
          <TableCell>Address</TableCell>
          <TableCell>On-Chain</TableCell>
          <TableCell>Mempool</TableCell>
          <TableCell>
            <Box className="crystal-flex crystal-flex-start crystal-gap-1">
              <Tooltip title="Live tracking via mempool.space WebSocket" arrow>
                <Typography
                  variant="body2"
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                  }}
                >
                  <span role="img" aria-label="Live WebSocket tracking">
                    🔌
                  </span>
                </Typography>
              </Tooltip>
            </Box>
          </TableCell>
          <TableCell></TableCell>
        </TableRow>
      </TableHead>
      <TableBody data-testid={dataTestId}>
        {addresses.map((address) => (
          <AddressRow
            key={address.address}
            address={address}
            collectionName={collectionName}
            descriptorName={descriptorName}
            extendedKeyName={extendedKeyName}
            displayBtc={displayBtc}
            setNotification={setNotification}
            onDelete={onDelete}
            onEditAddress={onEditAddress}
          />
        ))}
      </TableBody>
    </Table>
  );
};

export default AddressTable;
