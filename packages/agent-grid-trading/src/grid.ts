export interface GridLevel {
  price: number;
  side: "buy" | "sell";
  filled: boolean;
}

export interface GridConfig {
  levels: GridLevel[];
  pair: { base: `0x${string}`; quote: `0x${string}` };
}

export interface TriggeredLevel extends GridLevel {
  index: number;
}

/**
 * PancakeSwap has no native grid-order primitive — this is the whole
 * mechanism: agent-side state, evaluated against a live price. Pure
 * function, no chain calls, easy to unit test on its own.
 */
export function findTriggeredLevels(config: GridConfig, currentPrice: number): TriggeredLevel[] {
  return config.levels
    .map((level, index) => ({ ...level, index }))
    .filter((level) => {
      if (level.filled) return false;
      return level.side === "buy" ? currentPrice <= level.price : currentPrice >= level.price;
    });
}

/** Even spacing between a floor and ceiling — the common case; skew later if needed. */
export function buildEvenGrid(
  floor: number,
  ceiling: number,
  levelCount: number,
  pair: GridConfig["pair"],
): GridConfig {
  const step = (ceiling - floor) / (levelCount - 1);
  const mid = floor + (ceiling - floor) / 2;
  const levels: GridLevel[] = Array.from({ length: levelCount }, (_, i) => {
    const price = floor + step * i;
    return { price, side: price <= mid ? "buy" : "sell", filled: false };
  });
  return { levels, pair };
}
