import type { JokerDef } from "../jokers.ts";

// PET-232 exemplar for the x_mult_if effect kind. Blackboard: ×3 Mult when every card still
// HELD in hand (not played) is a Spade or Club. An empty held hand vacuously satisfies this
// (matches Balatro), so it also fires when you play your whole hand.
const def: JokerDef = {
  id: "blackboard",
  name: "Blackboard",
  description: "×3 Mult if all cards held in hand are Spades or Clubs",
  cost: 6,
  rarity: "uncommon",
  effect: {
    kind: "x_mult_if",
    condition: { kind: "all_held_suits_in", suits: ["spades", "clubs"] },
    xMult: 3,
  },
};

export default def;
