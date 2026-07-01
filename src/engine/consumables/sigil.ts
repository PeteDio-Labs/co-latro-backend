import type { ConsumableDef } from "../consumables.ts";

const def: ConsumableDef = {
    id: "sigil",
    name: "Sigil",
    description: "Converts all cards in hand to a single random suit",
    kind: "spectral",
    cost: 4,
    effect: {
      kind: "suit_convert_hand"
    }
  };

export default def;
