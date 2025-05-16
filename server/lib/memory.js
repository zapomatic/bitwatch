import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

// Ensure data directory exists
const dataDir = path.join(__dirname, "../data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbFile = path.join(dataDir, "db.json");
const sampleDbFile = path.join(
  dataDir,
  process.env.NODE_ENV === "test" ? "../db.test.json" : "../db.sample.json"
);

// Initialize db.json if it doesn't exist
if (!fs.existsSync(dbFile)) {
  // Read the sample database file
  const sampleDb = JSON.parse(fs.readFileSync(sampleDbFile, "utf8"));

  // Update the API URL if environment variable is set
  if (process.env.MEMPOOL_API) {
    sampleDb.api = process.env.MEMPOOL_API;
  }

  // Write the initialized database
  fs.writeFileSync(dbFile, JSON.stringify(sampleDb, null, 2));
}

const loadDb = () => {
  const data = fs.readFileSync(dbFile, "utf8");
  const db = JSON.parse(data);

  // If monitor settings are missing, get them from sample db
  if (!db.monitor) {
    const sampleDb = JSON.parse(fs.readFileSync(sampleDbFile, "utf8"));
    db.monitor = sampleDb.monitor;
  }

  if (process.env.DEBUG) {
    db.debugLogging = true;
  }

  return db;
};

const saveDb = () => {
  // Create a clean copy of the database without ephemeral data
  const cleanDb = {
    ...memory.db,
    collections: Object.fromEntries(
      Object.entries(memory.db.collections).map(([name, collection]) => [
        name,
        {
          ...collection,
          addresses: collection.addresses.map((addr) => ({
            address: addr.address,
            name: addr.name,
            expect: addr.expect,
            actual: addr.actual,
            alerted: addr.alerted,
            trackWebsocket: addr.trackWebsocket,
            monitor: addr.monitor
              ? {
                  chain_in: addr.monitor.chain_in,
                  chain_out: addr.monitor.chain_out,
                  mempool_in: addr.monitor.mempool_in,
                  mempool_out: addr.monitor.mempool_out,
                }
              : memory.db.monitor,
          })),
          extendedKeys: collection.extendedKeys?.map((extKey) => ({
            key: extKey.key,
            name: extKey.name,
            derivationPath: extKey.derivationPath,
            gapLimit: extKey.gapLimit,
            skip: extKey.skip,
            initialAddresses: extKey.initialAddresses,
            monitor: extKey.monitor
              ? {
                  chain_in: extKey.monitor.chain_in,
                  chain_out: extKey.monitor.chain_out,
                  mempool_in: extKey.monitor.mempool_in,
                  mempool_out: extKey.monitor.mempool_out,
                }
              : memory.db.monitor,
            addresses: extKey.addresses.map((addr) => ({
              address: addr.address,
              name: addr.name,
              index: addr.index,
              expect: addr.expect,
              actual: addr.actual,
              alerted: addr.alerted,
              trackWebsocket: addr.trackWebsocket,
              monitor: addr.monitor
                ? {
                    chain_in: addr.monitor.chain_in,
                    chain_out: addr.monitor.chain_out,
                    mempool_in: addr.monitor.mempool_in,
                    mempool_out: addr.monitor.mempool_out,
                  }
                : extKey.monitor
                ? {
                    chain_in: extKey.monitor.chain_in,
                    chain_out: extKey.monitor.chain_out,
                    mempool_in: extKey.monitor.mempool_in,
                    mempool_out: extKey.monitor.mempool_out,
                  }
                : memory.db.monitor,
            })),
          })),
          descriptors: collection.descriptors?.map((desc) => ({
            descriptor: desc.descriptor,
            name: desc.name,
            gapLimit: desc.gapLimit,
            skip: desc.skip,
            initialAddresses: desc.initialAddresses,
            type: desc.type,
            scriptType: desc.scriptType,
            requiredSignatures: desc.requiredSignatures,
            totalSignatures: desc.totalSignatures,
            monitor: desc.monitor
              ? {
                  chain_in: desc.monitor.chain_in,
                  chain_out: desc.monitor.chain_out,
                  mempool_in: desc.monitor.mempool_in,
                  mempool_out: desc.monitor.mempool_out,
                }
              : memory.db.monitor,
            addresses: desc.addresses.map((addr) => ({
              address: addr.address,
              name: addr.name,
              index: addr.index,
              expect: addr.expect,
              actual: addr.actual,
              alerted: addr.alerted,
              trackWebsocket: addr.trackWebsocket,
              monitor: addr.monitor
                ? {
                    chain_in: addr.monitor.chain_in,
                    chain_out: addr.monitor.chain_out,
                    mempool_in: addr.monitor.mempool_in,
                    mempool_out: addr.monitor.mempool_out,
                  }
                : desc.monitor
                ? {
                    chain_in: desc.monitor.chain_in,
                    chain_out: desc.monitor.chain_out,
                    mempool_in: desc.monitor.mempool_in,
                    mempool_out: desc.monitor.mempool_out,
                  }
                : memory.db.monitor,
            })),
          })),
        },
      ])
    ),
  };
  fs.writeFileSync(dbFile, JSON.stringify(cleanDb, null, 2));
  return true;
};

const memory = {
  state: {
    collections: {},
    websocketState: "DISCONNECTED",
    apiState: "UNKNOWN",
  },
  dirUI: path.join(__dirname, "../client/build"),
  dbFile,
  dataDir,
  db: loadDb(),
  loadDb,
  saveDb,
};

export default memory;
