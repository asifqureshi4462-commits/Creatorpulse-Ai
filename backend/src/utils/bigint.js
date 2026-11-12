// Prisma returns BigInt for large counters; serialize them as plain numbers.
BigInt.prototype.toJSON = function toJSON() {
  return Number(this);
};
