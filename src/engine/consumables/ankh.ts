import type { ConsumableDef } from "../consumables.ts";

const def: ConsumableDef = {
    id: "ankh",
    name: "Ankh",
    description: "Creates a copy of a random Joker, destroys all other Jokers",
    kind: "spectral",
    cost: 4,
    effect: {
      kind: "ankh"
    }
  };

export default def;
