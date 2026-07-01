import type { ConsumableDef } from "../consumables.ts";

const def: ConsumableDef = {
    id: "ectoplasm",
    name: "Ectoplasm",
    description: "Add Negative edition to a random Joker. (-1 hand size deferred.)",
    kind: "spectral",
    cost: 4,
    effect: {
      kind: "apply_joker_edition_negative"
    }
  };

export default def;
