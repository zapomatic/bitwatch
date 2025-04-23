export const formatSatoshis = (sats, displayBtc = true) => {
  if (!sats && sats !== 0) return "—";
  if (displayBtc) {
    const btc = sats / 100000000;
    return `${btc.toLocaleString(undefined, {
      minimumFractionDigits: 8,
      maximumFractionDigits: 8,
    })} ₿`;
  }
  return `${sats.toLocaleString()} sat`;
};
