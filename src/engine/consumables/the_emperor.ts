import type { ConsumableDef } from "../consumables.ts";

const def: ConsumableDef = {
    id: "the_emperor",
    name: "The Emperor",
    description: "Creates up to 2 random Tarot cards",
    kind: "tarot",
    cost: 3,
    effect: {
      kind: "create_consumable",
      kind2: "tarot",
      count: 2
    }
  };

export default def;
