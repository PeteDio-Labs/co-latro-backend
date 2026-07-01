import type { ConsumableDef } from "../consumables.ts";

const def: ConsumableDef = {
    id: "grim",
    name: "Grim",
    description: "Destroys 1 random card in hand, adds 2 random Aces to your deck",
    kind: "spectral",
    cost: 4,
    effect: {
      kind: "grim",
      destroy: 1,
      add: 2
    }
  };

export default def;
