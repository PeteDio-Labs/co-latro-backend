import type { ConsumableDef } from "../consumables.ts";

const def: ConsumableDef = {
    id: "immolate",
    name: "Immolate",
    description: "Destroys 5 random cards in hand, gain $20",
    kind: "spectral",
    cost: 4,
    effect: {
      kind: "immolate",
      destroy: 5,
      money: 20
    }
  };

export default def;
