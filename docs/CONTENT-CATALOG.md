# Content Catalog — Balatro Parity Checklist

Parity checklist for the PET-67 umbrella. Enumerates every Balatro content family, the full source
list, and the current state on `main`. Legend per row:

- `IN` — implemented and live in the listed source file
- `PEND <PET-n>` — staged for the listed ticket, not yet on `main`
- `DEF` — deferred (out of pre-alpha scope; may land later)
- `MISS` — known gap, no owner yet

Source files referenced are relative to `src/`.

---

## Jokers (~150 in Balatro)

Catalog: `engine/jokers.ts`. Current count on `main`: **20 / ~150**. PET-74 adds **~20 more**;
the remaining long tail is the post-MVP backlog. Editions on jokers (foil/holo/poly/negative
applied to a joker copy) are **deferred** — only card-applied editions land via PET-75.

### Commons

| Name | Effect | State |
|---|---|---|
| Joker | +4 Mult | IN |
| Greedy Joker | +3 Mult per ♦ scored | IN |
| Lusty Joker | +3 Mult per ♥ scored | IN |
| Wrathful Joker | +3 Mult per ♠ scored | IN |
| Gluttonous Joker | +3 Mult per ♣ scored | IN |
| Jolly Joker | +8 Mult if hand has a Pair | IN |
| Zany Joker | +12 Mult if hand has 3-of-a-kind | IN |
| Mad Joker | +10 Mult if hand has Two Pair | IN |
| Crazy Joker | +12 Mult if hand has a Straight | IN |
| Droll Joker | +10 Mult if hand has a Flush | IN |
| Sly Joker | +50 Chips if hand has a Pair | IN |
| Wily Joker | +100 Chips if hand has 3-of-a-kind | PEND PET-74 |
| Clever Joker | +80 Chips if hand has Two Pair | IN |
| Devious Joker | +100 Chips if hand has a Straight | PEND PET-74 |
| Crafty Joker | +80 Chips if hand has a Flush | IN |
| Half Joker | +20 Mult if 3 or fewer cards played | IN |
| Joker Stencil | ×Mult equal to empty joker slots | PEND PET-74 |
| Four Fingers | Flushes / straights need 4 cards | DEF |
| Mime | Retrigger held-in-hand abilities | DEF |
| Credit Card | Go into −$20 debt | DEF |
| Ceremonial Dagger | Sacrifice right-neighbor joker for +2 Mult permanent | DEF |
| Banner | +30 Chips per remaining discard | IN |
| Mystic Summit | +15 Mult when 0 discards remain | PEND PET-74 |
| Marble Joker | Adds Stone card to deck on blind start | DEF |
| Loyalty Card | ×4 Mult every 6 hands | DEF |
| 8 Ball | 8s have 1/4 chance to spawn a Tarot | DEF |
| Misprint | Random +0 to +23 Mult | DEF |
| Dusk | Retrigger all played cards on final hand | DEF |
| Raised Fist | Adds 2× lowest card-in-hand rank to Mult | DEF |
| Chaos the Clown | First reroll each shop is free | PEND PET-74 |
| Fibonacci | A/2/3/5/8 give +8 Mult on scoring | PEND PET-74 |
| Steel Joker | ×0.2 Mult per Steel card in full deck | DEF (needs steel cards) |
| Scary Face | +30 Chips per face card scored | IN |
| Abstract Joker | +3 Mult per Joker owned | IN |
| Delayed Gratification | $2 per discard not used (round end) | PEND PET-74 |
| Hack | Retrigger 2/3/4/5 scored | DEF |
| Pareidolia | All cards count as face cards | DEF |
| Gros Michel | +15 Mult, 1/6 destroyed at round end | DEF |
| Even Steven | +4 Mult per even card scored | IN |
| Odd Todd | +31 Chips per odd card scored | IN |
| Scholar | Aces give +20 Chips +4 Mult on scoring | PEND PET-74 |
| Business Card | Face cards 1/2 to give $2 on scoring | DEF |
| Supernova | +Mult equal to # times poker hand played this run | DEF |
| Ride the Bus | +1 Mult per consecutive hand w/o face cards | DEF |
| Egg | +$3 sell value each round | PEND PET-74 |
| Runner | +15 Chips per Straight played (perm) | DEF |
| Ice Cream | +100 Chips, −5 Chips per hand played | DEF |
| Splash | Every played card scores | DEF |
| Blue Joker | +2 Chips per remaining deck card | DEF |
| Faceless Joker | $5 if 3+ face cards discarded | DEF |
| Green Joker | +1 Mult per hand, −1 per discard | DEF |
| Cavendish | ×3 Mult, 1/1000 destroyed at round end | DEF |
| Red Card | +3 Mult per booster pack skipped | DEF |
| Square Joker | +4 Chips per 4-card hand played (perm) | DEF |
| Riff-Raff | +2 Common Jokers on blind start (consumed) | DEF |
| Photograph | First face card scored ×2 Mult | PEND PET-74 |
| Reserved Parking | Held face cards 1/2 to give $1 | DEF |
| Mail-in Rebate | $5 per discarded card of round's rebate rank | DEF |
| Hallucination | 1/2 to add Tarot on pack open | DEF |
| Fortune Teller | +1 Mult per Tarot used this run | DEF |
| Juggler | +1 hand size | DEF |
| Drunkard | +1 discard per round | DEF |
| Stone Joker | +25 Chips per Stone card in deck | DEF |
| Golden Joker | +$4 at round end | PEND PET-74 |
| Lucky Cat | ×0.25 Mult per Lucky card successful trigger | DEF |
| Baseball Card | Uncommon jokers ×1.5 Mult | DEF |
| Bull | +2 Chips per $1 owned | DEF |
| Diet Cola | Sell to spawn free Double Tag | DEF |
| Trading Card | Discarding single card destroys it for +$3 | DEF |
| Flash Card | +2 Mult per reroll | DEF |
| Popcorn | +20 Mult, −4 per round | DEF |
| Trousers | +2 Mult per Two Pair scored (perm) | DEF |
| Ancient Joker | ×1.5 Mult per scored card of suit (suit rotates) | DEF |
| Ramen | ×2 Mult, −0.01 per card discarded | DEF |
| Walkie Talkie | 10s/4s give +10 Chips +4 Mult | DEF |
| Seltzer | Next 10 hands retrigger all scored cards | DEF |
| Castle | +3 Chips per discarded card of suit (perm) | DEF |
| Smiley Face | Face cards give +5 Mult on scoring | PEND PET-74 |
| Campfire | ×0.5 Mult per card sold (resets each boss) | DEF |
| Acrobat | ×3 Mult on final hand of round | DEF |
| Sock and Buskin | Retrigger face cards | DEF |
| Swashbuckler | +Mult equal to sell value of other jokers | DEF |
| Troubadour | +2 hand size, −1 hand per round | DEF |
| Certificate | Random card with random seal added on blind start | DEF |
| Smeared Joker | ♥↔♦, ♠↔♣ count as same suit | DEF |
| Throwback | ×0.25 Mult per blind skipped this run | DEF |
| Hanging Chad | Retrigger first scored card +2 | DEF |
| Rough Gem | ♦ cards give $1 on scoring | DEF |
| Bloodstone | ♥ cards 1/2 for ×1.5 Mult | DEF |
| Arrowhead | ♠ cards give +50 Chips | DEF |
| Onyx Agate | ♣ cards give +7 Mult | DEF |
| Glass Joker | ×Mult per Glass destroyed | DEF |
| Showman | Duplicate jokers/consumables can appear | DEF |
| Flower Pot | ×3 Mult if hand has all 4 suits | DEF |
| Blueprint | Copy joker to the right | DEF |
| Wee Joker | +8 Chips per 2 scored (perm) | DEF |
| Merry Andy | +1 discard per round, −1 hand | DEF |
| Oops! All 6s | Doubles all listed probabilities | DEF |
| The Idol | Suit-of-the-round + rank gives ×2 Mult | DEF |
| Seeing Double | ×2 Mult if hand has clubs + non-clubs | DEF |
| Matador | $8 if boss-blind ability triggered | DEF |
| Hit the Road | ×0.5 Mult per Jack discarded (resets each round) | DEF |
| The Duo | ×2 Mult if hand has a Pair | IN |
| The Trio | ×3 Mult if hand has 3-of-a-kind | PEND PET-74 |
| The Family | ×4 Mult if hand has 4-of-a-kind | PEND PET-74 |
| The Order | ×3 Mult if hand has a Straight | PEND PET-74 |
| The Tribe | ×2 Mult if hand has a Flush | PEND PET-74 |
| Stuntman | +250 Chips, −2 hand size | DEF |
| Invisible Joker | After 2 rounds sell to duplicate random joker | DEF |
| Brainstorm | Copy leftmost joker | DEF |
| Satellite | $1 per unique Planet used this run (round end) | DEF |
| Shoot the Moon | Each Queen held-in-hand +13 Mult | DEF |
| Driver's License | ×3 Mult if 16+ deck cards have enhancements | DEF |
| Cartomancer | Create Tarot on blind start | DEF |
| Astronomer | All Planets/Celestial packs free | DEF |
| Burnt Joker | Upgrade poker hand level of first discarded hand | DEF |
| Bootstraps | +2 Mult per $5 owned | DEF |
| Caino | ×1 Mult per face card destroyed (Legendary) | DEF |
| Triboulet | ×2 Mult per K/Q scored (Legendary) | DEF |
| Yorick | ×1 Mult per 23 discarded (Legendary) | DEF |
| Chicot | Disables boss-blind effect (Legendary) | DEF |
| Perkeo | Copy a random consumable on shop entry (Legendary) | DEF |

**Parity: ~13% live (20/150). Post-PET-74: ~27% live (40/150).** Remainder is post-MVP backlog.

---

## Planets (12 total — 9 standard + 3 secret)

Catalog: `engine/shop.ts` `PLANETS`. Levels are applied directly via `levelUpHand`.

| Name | Hand levelled | State |
|---|---|---|
| Pluto | High Card | IN (PET-73) |
| Mercury | Pair | IN (PET-73) |
| Uranus | Two Pair | IN (PET-73) |
| Venus | Three of a Kind | IN (PET-73) |
| Saturn | Straight | IN (PET-73) |
| Jupiter | Flush | IN (PET-73) |
| Earth | Full House | IN (PET-73) |
| Mars | Four of a Kind | IN (PET-73) |
| Neptune | Straight Flush (+ Royal Flush shared level) | IN (PET-73) |
| Planet X | Five of a Kind | IN (PET-73) |
| Ceres | Flush House | IN (PET-73) |
| Eris | Flush Five | IN (PET-73) |

**Parity: 100% (12/12).** Note: secret planets are gated in Balatro by ever scoring the hand;
co-latro currently offers all 12 in the shop pool unconditionally — see PET-73 follow-up.

---

## Tarot (22 cards)

Catalog target: `engine/consumables.ts` (kind `tarot`). Currently empty. PET-71 lands ~17 of 22;
5 are deferred (selection-heavy or deck-mutating effects beyond the pre-alpha needs).

| Card | Effect | State |
|---|---|---|
| The Fool | Copy last used Tarot/Planet | DEF (state-tracking) |
| The Magician | Enhance up to 2 selected to Lucky | PEND PET-71 |
| The High Priestess | Create up to 2 random Planet cards | PEND PET-71 |
| The Empress | Enhance up to 2 selected to Mult | PEND PET-71 |
| The Emperor | Create up to 2 random Tarot cards | PEND PET-71 |
| The Hierophant | Enhance up to 2 selected to Bonus | PEND PET-71 |
| The Lovers | Enhance 1 selected to Wild | PEND PET-71 |
| The Chariot | Enhance 1 selected to Steel | PEND PET-71 |
| Justice | Enhance 1 selected to Glass | PEND PET-71 |
| The Hermit | Doubles money (cap $20) | PEND PET-71 |
| The Wheel of Fortune | 1/4 to add random edition to a joker | DEF (joker-edition deferred) |
| Strength | +1 rank to up to 2 selected | PEND PET-71 |
| The Hanged Man | Destroy up to 2 selected | PEND PET-71 |
| Death | Convert left into right (1 pair) | PEND PET-71 |
| Temperance | Add total sell value of jokers (cap $50) | PEND PET-71 |
| The Devil | Enhance 1 selected to Gold | PEND PET-71 |
| The Tower | Enhance 1 selected to Stone | PEND PET-71 |
| The Star | Convert up to 3 selected to ♦ | PEND PET-71 |
| The Moon | Convert up to 3 selected to ♣ | PEND PET-71 |
| The Sun | Convert up to 3 selected to ♥ | PEND PET-71 |
| Judgement | Create a random Joker | DEF (rarity-roll polish) |
| The World | Convert up to 3 selected to ♠ | PEND PET-71 |

**Parity: 0% live, ~77% pending (17/22 via PET-71). 5 deferred.**

---

## Spectral (~18 cards)

Catalog target: `engine/consumables.ts` (kind `spectral`). Currently empty. PET-72 is **blocked**
pending PET-71 (spectrals share the enhancement/edition machinery with tarots).

| Card | Effect | State |
|---|---|---|
| Familiar | Destroy 1 random scored card, add 3 random enhanced face cards | PEND PET-72 |
| Grim | Destroy 1 random scored card, add 2 random Aces | PEND PET-72 |
| Incantation | Destroy 1 random scored card, add 4 random number cards | PEND PET-72 |
| Talisman | Add Gold Seal to selected | PEND PET-72 |
| Aura | Add Foil/Holo/Poly edition to selected (in hand) | PEND PET-72 (card-edition) |
| Wraith | Random Rare Joker, sets money to $0 | PEND PET-72 |
| Sigil | Convert all hand cards to a single suit | PEND PET-72 |
| Ouija | Convert all hand cards to a single rank, −1 hand size | PEND PET-72 |
| Ectoplasm | Add Negative edition to random joker, −1 hand | DEF (joker-edition deferred) |
| Immolate | Destroy 5 random hand cards, +$20 | PEND PET-72 |
| Ankh | Copy a joker, destroy other jokers | DEF (joker-copy semantics) |
| Deja Vu | Add Red Seal to selected | PEND PET-72 |
| Hex | Negative-edition random joker, destroy other jokers | DEF |
| Trance | Add Blue Seal to selected | PEND PET-72 |
| Medium | Add Purple Seal to selected | PEND PET-72 |
| Cryptid | Create 2 copies of a selected card | PEND PET-72 |
| The Soul | Spawns Legendary Joker (booster-only) | DEF (legendaries deferred) |
| Black Hole | Upgrade every poker hand by 1 level | PEND PET-72 |

**Parity: 0% live, ~67% pending (12/18 via PET-72). 6 deferred (joker-edition / legendary-tied).**

---

## Playing-card enhancements (8)

Type: `CardEnhancement` in `src/cards.ts` (declared, no scoring hook yet). PET-75 wires the
scoring fold and the tarot enhancement creators.

| Enhancement | Effect | State |
|---|---|---|
| Bonus | +30 Chips on scoring | PEND PET-75 |
| Mult | +4 Mult on scoring | PEND PET-75 |
| Wild | Counts as any suit | PEND PET-75 |
| Glass | ×2 Mult, 1/4 destroyed after scoring | PEND PET-75 |
| Steel | ×1.5 Mult while held in hand | PEND PET-75 |
| Stone | +50 Chips, no rank/suit (always scores) | PEND PET-75 |
| Gold | +$3 if held in hand at round end | PEND PET-75 |
| Lucky | 1/5 +20 Mult, 1/15 +$20 on scoring | PEND PET-75 |

**Parity: 0% live, 100% pending (8/8 via PET-75).**

---

## Editions (4)

Type: `CardEdition` in `src/cards.ts`. Applied to playing cards via PET-75; joker-applied
editions are **deferred** out of pre-alpha.

| Edition | Effect | Card-applied | Joker-applied |
|---|---|---|---|
| Foil | +50 Chips | PEND PET-75 | DEF |
| Holo | +10 Mult | PEND PET-75 | DEF |
| Poly | ×1.5 Mult | PEND PET-75 | DEF |
| Negative | +1 consumable slot (joker) / +1 joker slot (card N/A) | N/A | DEF |

**Parity: 0% live; card-side 100% pending (4/4 via PET-75); joker-side 0% (deferred).**

---

## Seals (4)

Type: `CardSeal` in `src/cards.ts`. PET-75 lands Red; remaining three are deferred (each
requires its own trigger hook into discard / score / round-end loops).

| Seal | Effect | State |
|---|---|---|
| Red | Retrigger the card once when scored | PEND PET-75 |
| Blue | Create the corresponding Planet card on round end if held | DEF |
| Gold | $3 when scored | DEF |
| Purple | Create a Tarot card on discard | DEF |

**Parity: 0% live; 25% pending (1/4 via PET-75); 3 deferred.**

---

## Vouchers (full Balatro tree — 32, 16 base + 16 tier-2 upgrades)

Catalog target: `engine/vouchers.ts`. Currently empty. PET-76 lands ~10 entries covering the
slot / hand / discard / shop levers. The full upgrade tree (each base has a tier-2 upgrade
that requires the base) is **partial** — only the bases needed for the slot economy land.

### Base vouchers (Tier 1)

| Voucher | Effect | State |
|---|---|---|
| Overstock | +1 shop slot | PEND PET-76 |
| Clearance Sale | 25% off all shop items | PEND PET-76 |
| Hone | Foil/Holo/Poly cards 2× more common | DEF |
| Reroll Surplus | Rerolls $2 cheaper | PEND PET-76 |
| Crystal Ball | +1 consumable slot | PEND PET-76 |
| Telescope | Celestial packs always have used Planet | DEF |
| Grabber | +1 hand per round | PEND PET-76 |
| Wasteful | +1 discard per round | PEND PET-76 |
| Tarot Merchant | Tarots 2× more common in shop | DEF |
| Planet Merchant | Planets 2× more common in shop | DEF |
| Seed Money | Interest cap +$5 | PEND PET-76 |
| Blank | No effect (placeholder for tier-2) | DEF |
| Magic Trick | Playing cards purchasable in shop | DEF |
| Hieroglyph | −1 ante, −1 hand per round | DEF |
| Director's Cut | Reroll boss-blind for $10 | DEF |
| Paint Brush | +1 hand size | PEND PET-76 |

### Upgrades (Tier 2 — requires base)

| Voucher | Effect | Requires | State |
|---|---|---|---|
| Overstock Plus | +1 shop slot (additive) | Overstock | DEF |
| Liquidation | 50% off all shop items | Clearance Sale | DEF |
| Glow Up | Foil/Holo/Poly 4× more common | Hone | DEF |
| Reroll Glut | Rerolls $2 cheaper (stacks to $4) | Reroll Surplus | DEF |
| Omen Globe | Spectrals appear in Arcana packs | Crystal Ball | DEF |
| Observatory | Planets in slot give ×1.5 Mult | Telescope | DEF |
| Nacho Tong | +1 hand per round (stacks) | Grabber | DEF |
| Recyclomancy | +1 discard per round (stacks) | Wasteful | DEF |
| Tarot Tycoon | Tarots 4× more common | Tarot Merchant | DEF |
| Planet Tycoon | Planets 4× more common | Planet Merchant | DEF |
| Money Tree | Interest cap +$10 | Seed Money | PEND PET-76 |
| Antimatter | +1 joker slot | Blank | PEND PET-76 |
| Illusion | Playing cards may have enhancement/edition/seal | Magic Trick | DEF |
| Petroglyph | −1 ante (stacks), −1 discard per round | Hieroglyph | DEF |
| Retcon | Reroll boss-blind free | Director's Cut | DEF |
| Palette | +1 hand size (stacks) | Paint Brush | DEF |

**Parity: 0% live, ~30% pending (10/32 via PET-76). Tree is partial — most tier-2 deferred.**

---

## Booster packs (5 kinds × 3 sizes = 15 SKUs)

Target: shop offers booster packs that present a choose-K-from-N preview. Currently no pack
infrastructure exists; PET-70 is **blocked** behind the consumable + spectral + planet streams
landing first (a pack offers cards drawn from those pools).

| Kind | Sizes | Contents | State |
|---|---|---|---|
| Arcana | Normal / Jumbo / Mega | Pick 1-of-3 / 1-of-5 / 2-of-5 Tarots | PEND PET-70 |
| Celestial | Normal / Jumbo / Mega | Pick 1-of-3 / 1-of-5 / 2-of-5 Planets | PEND PET-70 |
| Spectral | Normal / Jumbo / Mega | Pick 1-of-2 / 1-of-4 / 2-of-4 Spectrals | PEND PET-70 |
| Standard | Normal / Jumbo / Mega | Pick 1-of-3 / 1-of-5 / 2-of-5 playing cards (possibly enhanced/sealed) | PEND PET-70 |
| Buffoon | Normal / Jumbo / Mega | Pick 1-of-2 / 1-of-4 / 2-of-4 Jokers | PEND PET-70 |

**Parity: 0% live, 100% pending (15/15 via PET-70).**

---

## Tags (~24)

Catalog target: `engine/tags.ts`. Currently empty. PET-78 lands ~10 covering the immediate /
shop-entry / next-blind levers; ~6 are deferred (pack-tied or edition-roll tags).

| Tag | Trigger | Effect | State |
|---|---|---|---|
| Uncommon Tag | on_shop_enter | Free Uncommon Joker in next shop | PEND PET-78 |
| Rare Tag | on_shop_enter | Free Rare Joker in next shop | PEND PET-78 |
| Negative Tag | on_shop_enter | Next shop joker is Negative | DEF |
| Foil Tag | on_shop_enter | Next shop joker is Foil | DEF |
| Holographic Tag | on_shop_enter | Next shop joker is Holo | DEF |
| Polychrome Tag | on_shop_enter | Next shop joker is Poly | DEF |
| Investment Tag | immediate | +$25 after defeating next boss | PEND PET-78 |
| Voucher Tag | on_shop_enter | Adds a Voucher to next shop | PEND PET-78 |
| Boss Tag | immediate | Rerolls next boss blind | DEF |
| Standard Tag | on_pack_open | Free Mega Standard pack | PEND PET-78 |
| Charm Tag | on_pack_open | Free Mega Arcana pack | PEND PET-78 |
| Meteor Tag | on_pack_open | Free Mega Celestial pack | PEND PET-78 |
| Buffoon Tag | on_pack_open | Free Mega Buffoon pack | DEF |
| Handy Tag | immediate | +$1 per hand played this run | PEND PET-78 |
| Garbage Tag | immediate | +$1 per unused discard this run | PEND PET-78 |
| Ethereal Tag | on_pack_open | Free Spectral pack | DEF |
| Coupon Tag | on_shop_enter | All shop items in next shop are free | PEND PET-78 |
| Double Tag | immediate | Duplicate next tag (non-Double) | DEF |
| Juggle Tag | on_next_blind_start | +3 hand size for next round | PEND PET-78 |
| D6 Tag | on_shop_enter | Next shop rerolls start at $0 | DEF |
| Top-up Tag | immediate | Creates 2 Common jokers | DEF |
| Speed Tag | immediate | $5 per skipped blind this run | DEF |
| Orbital Tag | on_next_blind_start | Levels a random poker hand 3× | DEF |
| Economy Tag | on_shop_enter | Doubles money (cap $40) | DEF |

**Parity: 0% live, ~42% pending (10/24 via PET-78). 14 deferred.**

---

## Roll-up

| Family | Live on `main` | Pending (post-cycle) | Deferred / Backlog |
|---|---|---|---|
| Jokers | 20/150 (~13%) | +20 via PET-74 → ~27% | ~110 backlog |
| Planets | 12/12 (100%) | — | — |
| Tarots | 0/22 (0%) | 17/22 via PET-71 (~77%) | 5 |
| Spectrals | 0/18 (0%) | 12/18 via PET-72 (~67%) | 6 |
| Card enhancements | 0/8 (0%) | 8/8 via PET-75 (100%) | — |
| Editions (card) | 0/4 (0%) | 4/4 via PET-75 (100%) | joker-side deferred |
| Seals | 0/4 (0%) | 1/4 via PET-75 (25%) | 3 |
| Vouchers | 0/32 (0%) | 10/32 via PET-76 (~30%) | 22 (tier-2 mostly) |
| Booster packs | 0/15 (0%) | 15/15 via PET-70 (100%) | — |
| Tags | 0/24 (0%) | 10/24 via PET-78 (~42%) | 14 |

**Aggregate pre-alpha target (post-PET-67):** ~109 of the ~313 cataloged items live — roughly
**35% parity** with Balatro's full content surface, with every family represented and the
slot / scoring / shop economy fully wired. The remaining ~204 items are post-MVP backlog,
clustered in the joker long tail, voucher tier-2 tree, and edition/seal trigger hooks.
