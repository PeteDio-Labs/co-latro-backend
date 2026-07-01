import type { ConsumableDef } from "../consumables.ts";

const def: ConsumableDef = {
    id: "cryptid",
    name: "Cryptid",
    description: "Creates 2 copies of 1 selected card",
    kind: "spectral",
    cost: 4,
    needsSelection: {
      min: 1,
      max: 1,
      from: "hand"
    },
    effect: {
      kind: "cryptid_duplicate",
      copies: 2
    }
  };

export default def;
