import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "scary_face",
    name: "Scary Face",
    description: "+30 Chips per face card scored",
    cost: 4,
    rarity: "common",
    effect: {
      kind: "per_face_chips",
      chips: 30
    }
  };

export default def;
