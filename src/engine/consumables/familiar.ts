import type { ConsumableDef } from "../consumables.ts";

const def: ConsumableDef = {
    id: "familiar",
    name: "Familiar",
    description: "Destroys 1 random card in hand, adds 3 random face cards to your deck",
    kind: "spectral",
    cost: 4,
    effect: {
      kind: "familiar",
      destroy: 1,
      add: 3
    }
  };

export default def;
