import {
  DEFAULT_GAP_LIMIT,
  DEFAULT_INITIAL_ADDRESSES,
  DEFAULT_SKIP_ADDRESSES,
  DEFAULT_MONITOR_SETTINGS,
  DEFAULT_EXPECTED_BALANCES,
} from "../config";

export const defaultAddressForm = {
  name: "",
  address: "",
  expect: DEFAULT_EXPECTED_BALANCES,
  monitor: DEFAULT_MONITOR_SETTINGS,
};

export const defaultExtendedKeyForm = {
  name: "",
  key: "",
  gapLimit: DEFAULT_GAP_LIMIT,
  initialAddresses: DEFAULT_INITIAL_ADDRESSES,
  derivationPath: "m/0",
  skip: DEFAULT_SKIP_ADDRESSES,
};

export const defaultDescriptorForm = {
  name: "",
  descriptor: "",
  gapLimit: DEFAULT_GAP_LIMIT,
  initialAddresses: DEFAULT_INITIAL_ADDRESSES,
  skip: DEFAULT_SKIP_ADDRESSES,
};
