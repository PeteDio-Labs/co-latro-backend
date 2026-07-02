import type { ConsumableDef } from "../consumables.ts";

const def: ConsumableDef = {
    id: "ectoplasm",
    name: "Ectoplasm",
    description: "Add Negative edition to a random Joker. -1 hand size.",
    kind: "spectral",
    cost: 4,
    effect: {
      kind: "apply_joker_edition_negative",
      handSizeDelta: -1
    }
  };

export default def;
