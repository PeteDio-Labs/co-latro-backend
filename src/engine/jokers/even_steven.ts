import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "even_steven",
    name: "Even Steven",
    description: "+4 Mult per even card scored",
    cost: 4,
    rarity: "common",
    effect: {
      kind: "per_parity_mult",
      parity: "even",
      mult: 4
    }
  };

export default def;
