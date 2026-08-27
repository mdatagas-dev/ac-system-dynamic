// Pure. How closely a scanned value matches the registered value for the same field.
// Position-by-position match over the overlap, divided by the registered length.
// A scan is rejected when accuracy <= 5% (matches legacy rdps.js).

const MIN_ACCURACY_PERCENT = 5;

function accuracyPercent(registered, scanned) {
  if (!registered) return 0;
  const min = Math.min(registered.length, scanned.length);
  let same = 0;
  for (let i = 0; i < min; i++) {
    if (registered[i] === scanned[i]) same++;
  }
  return (same / registered.length) * 100;
}

function isAccuracyTooLow(registered, scanned) {
  if (!registered) return false;
  return accuracyPercent(registered, scanned) <= MIN_ACCURACY_PERCENT;
}

module.exports = { accuracyPercent, isAccuracyTooLow, MIN_ACCURACY_PERCENT };