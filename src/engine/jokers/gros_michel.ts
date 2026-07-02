import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "gros_michel",
    name: "Gros Michel",
    description: "+15 Mult; 1 in 6 chance this card is destroyed at end of round",
    cost: 5,
    rarity: "common",
    effect: {
      kind: "chance_mult",
      mult: 15,
      chancePct: 100 / 6,
      onFail: "destroy_self"
    }
  };

export default def;
