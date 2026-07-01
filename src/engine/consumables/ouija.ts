import type { ConsumableDef } from "../consumables.ts";

const def: ConsumableDef = {
    id: "ouija",
    name: "Ouija",
    description: "Converts all cards in hand to a single random rank, -1 hand size",
    kind: "spectral",
    cost: 4,
    effect: {
      kind: "rank_convert_hand",
      handSizeDelta: -1
    }
  };

export default def;
