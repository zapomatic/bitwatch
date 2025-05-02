export const defaultAddressForm = {
  name: "",
  address: "",
  expect: {
    chain_in: 0,
    chain_out: 0,
    mempool_in: 0,
    mempool_out: 0,
  },
  monitor: {
    chain_in: "auto-accept",
    chain_out: "alert",
    mempool_in: "auto-accept",
    mempool_out: "alert",
  },
};

export const defaultExtendedKeyForm = {
  name: "",
  key: "",
  gapLimit: 2,
  initialAddresses: 5,
  derivationPath: "m/0",
  skip: 0,
};

export const defaultDescriptorForm = {
  name: "",
  descriptor: "",
  gapLimit: 20,
  initialAddresses: 10,
  skip: 0,
};
