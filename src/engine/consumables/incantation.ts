import type { ConsumableDef } from "../consumables.ts";

const def: ConsumableDef = {
    id: "incantation",
    name: "Incantation",
    description: "Destroys 1 random card in hand, adds 4 random numbered (2-9) cards to your deck",
    kind: "spectral",
    cost: 4,
    effect: {
      kind: "incantation",
      destroy: 1,
      add: 4
    }
  };

export default def;
