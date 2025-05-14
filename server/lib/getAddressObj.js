import memory from "./memory.js";
import logger from "./logger.js";
// getAddressObj returns an object with:
// - collectionName: name of the collection
// - address: address object (reference in memory.db.collections)
// - extendedKey: extendedKey obj's key (extendedKey.key)
// - descriptor: descriptor obj's descriptor (descriptor.descriptor)
export default ({
  address,
  extendedKeyName,
  descriptorName,
  collectionName,
}) => {
  // logger.debug(
  //   `getAddressObj: ${collectionName}/${
  //     extendedKeyName || descriptorName || "root"
  //   }/${address} `
  // );
  if (descriptorName && collectionName) {
    const desc = memory.db.collections[collectionName]?.descriptors?.find(
      (d) => d.name === descriptorName
    );
    const addrObj = desc?.addresses?.find((a) => a.address === address);
    if (addrObj) {
      return {
        collectionName,
        address: addrObj,
        extendedKeyName: undefined,
        descriptorName,
      };
    }
    return null;
  }
  if (extendedKeyName && collectionName) {
    const key = memory.db.collections[collectionName]?.extendedKeys?.find(
      (k) => k.name === extendedKeyName
    );
    const addrObj = key?.addresses?.find((a) => a.address === address);
    if (addrObj) {
      return {
        collectionName,
        address: addrObj,
        extendedKeyName,
        descriptorName: undefined,
      };
    }
    return null;
  }
  if (collectionName) {
    const addrObj = memory.db.collections[collectionName]?.addresses?.find(
      (a) => a.address === address
    );
    if (addrObj) {
      return {
        collectionName,
        address: addrObj,
        extendedKeyName: undefined,
        descriptorName: undefined,
      };
    }
    return null;
  }
  // legacy support for getting by only address and no other info
  logger.warning(
    `getAddressObj: ${address} No collectionName, extendedKeyName, or descriptorName provided, using legacy support`
  );
  for (const [collectionName, collection] of Object.entries(
    memory.db.collections
  )) {
    // Check regular addresses
    const addrObj = collection.addresses.find((a) => a.address === address);
    if (addrObj) {
      return {
        collectionName,
        address: addrObj,
        extendedKeyName: undefined,
        descriptorName: undefined,
      };
    }
    // Check extended key addresses
    if (collection.extendedKeys) {
      for (const key of collection.extendedKeys) {
        const addrObj = key.addresses.find((a) => a.address === address);
        if (addrObj) {
          return {
            collectionName,
            address: addrObj,
            extendedKeyName: key.key,
            descriptorName: undefined,
          };
        }
      }
    }
    // Check descriptor addresses
    if (collection.descriptors) {
      for (const desc of collection.descriptors) {
        const addrObj = desc.addresses.find((a) => a.address === address);
        if (addrObj) {
          return {
            collectionName,
            address: addrObj,
            extendedKeyName: undefined,
            descriptorName: desc.descriptor,
          };
        }
      }
    }
  }
  return null;
};
