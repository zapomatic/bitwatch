import memory from "./memory.js";
import logger from "./logger.js";
import enqueue from "./queue/enqueue.js";
import emitState from "./emitState.js";

const BALANCE_TYPES = [
  ["chain_in", "Chain In"],
  ["chain_out", "Chain Out"],
  ["mempool_in", "Mempool In"],
  ["mempool_out", "Mempool Out"],
];

const emptyBalance = {
  chain_in: 0,
  chain_out: 0,
  mempool_in: 0,
  mempool_out: 0,
};

const escapeHtml = (value) =>
  `${value ?? ""}`
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const formatSats = (sats) => {
  const numericSats = Number(sats) || 0;
  return `${numericSats.toLocaleString()} sats`;
};

const getCollectionItems = () =>
  Object.entries(memory.db.collections || {}).flatMap(
    ([collectionName, collection]) => {
      const rootAddresses = (collection.addresses || []).map((address) => ({
        collectionName,
        address,
      }));

      const extendedKeyAddresses = (collection.extendedKeys || []).flatMap(
        (extendedKey) =>
          (extendedKey.addresses || []).map((address) => ({
            collectionName,
            extendedKeyName: extendedKey.name,
            address,
          }))
      );

      const descriptorAddresses = (collection.descriptors || []).flatMap(
        (descriptor) =>
          (descriptor.addresses || []).map((address) => ({
            collectionName,
            descriptorName: descriptor.name,
            address,
          }))
      );

      return [...rootAddresses, ...extendedKeyAddresses, ...descriptorAddresses];
    }
  );

const getItemPath = (item) =>
  [
    item.collectionName,
    item.extendedKeyName || item.descriptorName,
    item.address.name,
  ]
    .filter(Boolean)
    .join("/");

const getBalanceChanges = (address) => {
  if (!address.actual) return [];

  const actual = { ...emptyBalance, ...address.actual };
  const expected = { ...emptyBalance, ...address.expect };

  return BALANCE_TYPES.flatMap(([type, label]) => {
    if (actual[type] === expected[type]) return [];
    const diff = actual[type] - expected[type];
    return [
      {
        type,
        label,
        actual: actual[type],
        expected: expected[type],
        diff,
      },
    ];
  });
};

const findMatches = (query) => {
  const normalizedQuery = `${query || ""}`.trim().toLowerCase();
  if (!normalizedQuery) return [];

  return getCollectionItems().filter((item) => {
    const searchable = [
      item.address.address,
      item.address.name,
      item.collectionName,
      item.extendedKeyName,
      item.descriptorName,
      getItemPath(item),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchable.includes(normalizedQuery);
  });
};

const resolveSingleMatch = (query) => {
  const matches = findMatches(query);
  if (matches.length === 0) {
    return { error: `No address matched "${query}".` };
  }
  if (matches.length > 1) {
    const options = matches.slice(0, 8).map((item) => `- ${getItemPath(item)}`);
    return {
      error: `Multiple addresses matched "${query}". Try a full address or path.\n${options.join(
        "\n"
      )}`,
    };
  }
  return { item: matches[0] };
};

const formatChangeLines = (changes) =>
  changes.map(
    (change) =>
      `${change.label}: ${formatSats(change.expected)} -> ${formatSats(
        change.actual
      )} (${change.diff > 0 ? "+" : ""}${formatSats(change.diff)})`
  );

const acceptItem = (item) => {
  if (!item.address.actual) return false;
  item.address.expect = { ...emptyBalance, ...item.address.actual };
  item.address.alerted = {
    chain_in: false,
    chain_out: false,
    mempool_in: false,
    mempool_out: false,
  };
  return true;
};

export const getTelegramHelp = () =>
  [
    "<b>Bitwatch Telegram commands</b>",
    "/status - show collection and pending-change summary",
    "/address &lt;name|address|path&gt; - show address details and balances",
    "/accept &lt;name|address|path&gt; - accept one address's current balance",
    "/accept all - accept all pending balance changes",
    "/addaddress &lt;collection&gt; | &lt;name&gt; | &lt;address&gt; - add a tracked address",
    "/refresh &lt;name|address|path&gt; - queue a balance refresh",
    "/backup - download the Bitwatch database",
  ].join("\n");

export const getStatusMessage = () => {
  const collections = Object.entries(memory.db.collections || {});
  const items = getCollectionItems();
  const pendingItems = items.filter(
    (item) => getBalanceChanges(item.address).length
  );
  const pendingLines = pendingItems
    .slice(0, 10)
    .map((item) => `- ${escapeHtml(getItemPath(item))}`);

  return [
    "<b>Bitwatch Status</b>",
    `Collections: ${collections.length}`,
    `Tracked addresses: ${items.length}`,
    `Pending changes: ${pendingItems.length}`,
    pendingLines.length ? "" : null,
    ...pendingLines,
    pendingItems.length > pendingLines.length
      ? `...and ${pendingItems.length - pendingLines.length} more`
      : null,
  ]
    .filter((line) => line !== null)
    .join("\n");
};

export const getAddressMessage = (query) => {
  const { item, error } = resolveSingleMatch(query);
  if (error) return { error };

  const actual = { ...emptyBalance, ...item.address.actual };
  const expected = { ...emptyBalance, ...item.address.expect };
  const changes = getBalanceChanges(item.address);
  const apiEndpoint = memory.db.api || "https://mempool.space";

  const lines = [
    `<b>${escapeHtml(getItemPath(item))}</b>`,
    `<a href="${escapeHtml(apiEndpoint)}/address/${escapeHtml(
      item.address.address
    )}">${escapeHtml(item.address.address)}</a>`,
    "",
    "<b>Actual</b>",
    ...BALANCE_TYPES.map(
      ([type, label]) => `${label}: ${formatSats(actual[type])}`
    ),
    "",
    "<b>Expected</b>",
    ...BALANCE_TYPES.map(
      ([type, label]) => `${label}: ${formatSats(expected[type])}`
    ),
  ];

  if (changes.length) {
    lines.push("", "<b>Pending changes</b>", ...formatChangeLines(changes));
  }

  return { message: lines.join("\n") };
};

export const acceptChanges = (query) => {
  const normalizedQuery = `${query || ""}`.trim();
  if (!normalizedQuery) {
    return { error: "Usage: /accept <name|address|path> or /accept all" };
  }

  if (normalizedQuery.toLowerCase() === "all") {
    const pendingItems = getCollectionItems().filter(
      (item) => getBalanceChanges(item.address).length
    );
    pendingItems.forEach(acceptItem);
    if (pendingItems.length) {
      memory.saveDb();
      emitState({ collections: memory.db.collections });
    }
    logger.telegram(`Accepted ${pendingItems.length} Telegram balance changes`);
    return {
      message: `Accepted ${pendingItems.length} pending balance change${
        pendingItems.length === 1 ? "" : "s"
      }.`,
    };
  }

  const { item, error } = resolveSingleMatch(normalizedQuery);
  if (error) return { error };

  const changes = getBalanceChanges(item.address);
  if (!changes.length) {
    return {
      message: `${escapeHtml(getItemPath(item))} has no pending changes.`,
    };
  }

  acceptItem(item);
  memory.saveDb();
  emitState({ collections: memory.db.collections });
  logger.telegram(`Accepted Telegram balance change for ${getItemPath(item)}`);
  return {
    message: `Accepted current balance for ${escapeHtml(getItemPath(item))}.`,
  };
};

export const addAddressFromCommand = (text) => {
  const parts = `${text || ""}`
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length !== 3) {
    return {
      error: "Usage: /addaddress <collection> | <name> | <address>",
    };
  }

  const [collectionName, name, address] = parts;
  const existingAddress = getCollectionItems().find(
    (item) =>
      item.collectionName === collectionName && item.address.address === address
  );
  if (existingAddress) {
    return { error: "Address already exists in this collection." };
  }

  if (!memory.db.collections[collectionName]) {
    memory.db.collections[collectionName] = {
      addresses: [],
      extendedKeys: [],
      descriptors: [],
    };
  }

  const collection = memory.db.collections[collectionName];
  collection.addresses.push({
    address,
    name,
    expect: { ...emptyBalance },
    monitor: { ...(memory.db.monitor || {}) },
    trackWebsocket: false,
    actual: null,
    error: false,
    errorMessage: null,
  });

  memory.saveDb();
  enqueue({ collectionName, address });
  logger.telegram(`Added Telegram address ${collectionName}/${name}`);
  return {
    message: `Added ${escapeHtml(collectionName)}/${escapeHtml(
      name
    )} and queued a balance refresh.`,
  };
};

export const refreshAddress = (query) => {
  const { item, error } = resolveSingleMatch(query);
  if (error) return { error };

  enqueue({
    collectionName: item.collectionName,
    extendedKeyName: item.extendedKeyName,
    descriptorName: item.descriptorName,
    address: item.address.address,
  });

  return { message: `Queued refresh for ${escapeHtml(getItemPath(item))}.` };
};

export const _test = {
  getBalanceChanges,
  getCollectionItems,
  findMatches,
};
