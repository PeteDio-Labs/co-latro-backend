import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "baron",
    name: "Baron",
    description: "×1.5 Mult per King held in hand",
    cost: 8,
    rarity: "rare",
    effect: {
      kind: "held_rank_x_mult",
      rank: 13,
      xMult: 1.5
    }
  };

export default def;
