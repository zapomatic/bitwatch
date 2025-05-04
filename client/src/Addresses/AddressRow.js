import React, { useState } from "react";
import { TableRow, TableCell, Box, Typography } from "@mui/material";
import IconButtonStyled from "../components/IconButtonStyled";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckIcon from "@mui/icons-material/Check";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import BalanceCell from "./BalanceCell";

const AddressCell = ({ address }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const textarea = document.createElement("textarea");
    textarea.value = address;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);

    textarea.select();
    const successful = document.execCommand("copy");
    if (successful) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }

    document.body.removeChild(textarea);
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

const AddressRow = ({
  address,
  collection,
  onEditAddress,
  onSaveExpected,
  onDelete,
  displayBtc,
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
          expect={address.expect?.chain_in}
          displayBtc={displayBtc}
          error={address.error}
          pending={!address.actual && !address.error}
          monitor={address.monitor}
          type="chain_in"
          dataTestId={`${address.address}-chain-in`}
        />
      </Box>
      <Box className="crystal-flex crystal-flex-start" sx={{ mt: 1 }}>
        <BalanceCell
          label="➡️"
          value={address.actual?.chain_out}
          expect={address.expect?.chain_out}
          displayBtc={displayBtc}
          error={address.error}
          pending={!address.actual && !address.error}
          monitor={address.monitor}
          type="chain_out"
          dataTestId={`${address.address}-chain-out`}
        />
      </Box>
    </TableCell>
    <TableCell className="crystal-table-cell">
      <Box className="crystal-flex crystal-flex-start">
        <BalanceCell
          value={address.actual?.mempool_in}
          expect={address.expect?.mempool_in}
          displayBtc={displayBtc}
          error={address.error}
          pending={!address.actual && !address.error}
          monitor={address.monitor}
          type="mempool_in"
          dataTestId={`${address.address}-mempool-in`}
        />
      </Box>
      <Box className="crystal-flex crystal-flex-start" sx={{ mt: 1 }}>
        <BalanceCell
          value={address.actual?.mempool_out}
          expect={address.expect?.mempool_out}
          displayBtc={displayBtc}
          error={address.error}
          pending={!address.actual && !address.error}
          monitor={address.monitor}
          type="mempool_out"
          dataTestId={`${address.address}-mempool-out`}
        />
      </Box>
    </TableCell>
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

export default AddressRow;
