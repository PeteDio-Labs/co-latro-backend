import type { ConsumableDef } from "../consumables.ts";

const def: ConsumableDef = {
    id: "wraith",
    name: "Wraith",
    description: "Creates a random Rare Joker, sets your money to $0",
    kind: "spectral",
    cost: 4,
    effect: {
      kind: "wraith"
    }
  };

export default def;
