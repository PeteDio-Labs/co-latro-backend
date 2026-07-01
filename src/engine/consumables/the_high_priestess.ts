import type { ConsumableDef } from "../consumables.ts";

const def: ConsumableDef = {
    id: "the_high_priestess",
    name: "The High Priestess",
    description: "Creates up to 2 random Planet cards",
    kind: "tarot",
    cost: 3,
    effect: {
      kind: "create_consumable",
      kind2: "planet",
      count: 2
    }
  };

export default def;
