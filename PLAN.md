# EMBERFALL — *A Kingdom Under a Dying Sun*

A text-based RPG for the terminal. Python 3.10+, standard library only (`rich` is optional and detected at runtime).

---

## 1. Premise

For a thousand years the kingdom of **Vael** has lived under **Aurun, the Dawnfather**, a god who hangs in the sky as a second, golden sun. Twelve years ago Aurun's light began to stutter. Three years ago his heart cracked: the **Sundering**. Four burning shards, the **Embers**, fell across the kingdom. Since then:

- **The Pall**, a grey ash-fog, creeps out from wherever the god's light fails. Inside it the dead don't stay down, and the living slowly forget their names.
- Prayers that used to heal now fail half the time, and sometimes they burn.
- The king is dead. The kingdom has split three ways over a single question: **what should be done with a dying god?**

The player is a **Lanternbearer**. You wake on a funeral pyre in the village of Greyhallow with a sliver of the god's light lodged in your chest, and the pyre won't burn you. You can sense the Embers, hold them, and carry them without being consumed. That makes you the most valuable person in Vael, and everyone wants to own you.

**Tone:** serious, melancholy and atmospheric: ash, candlelight, cold cathedrals, rotten marshes. The humor comes from people being stubbornly human at the end of the world: a gravedigger running a betting pool on which corpses get back up, a skeleton that only wants its hat back, a monk who has given up on everything except wine, and a scout who answers prophecy with sarcasm.

---

## 2. Factions

Each faction tracks standing from **−100 to +100**: Hostile ≤ −50 · Distrusted ≤ −15 · Neutral · Friendly ≥ 25 · Allied ≥ 60.

| Faction | Leader | What they want for the god | Flavor |
|---|---|---|---|
| **The Ember Synod** (the Church) | Hierarch **Ysolde Varr**, iron-willed and sincerely devout | **Rekindle** Aurun, whatever it costs: the old rites say the god must be fed souls | Incense, bells, inquisitors in white-and-gold |
| **The Iron Regency** (the Crown) | Lord-Marshal **Caddoc Thorne**, regent of the dead king | **Usurp** the god's power: forge the Embers into the **Ember Crown** and put a mortal on Heaven's throne | Martial law, ledgers, curfews, steel |
| **The Ashborn** (heretics and the dispossessed) | **Mother Wren**, a blind ex-priestess | **Release** the god: let Aurun die with dignity so mortals are free of gods altogether | Lantern-lit undercrofts, songs, desperate hope |

A hidden fourth power is the **Hollow King**, Aurun's shadow-twin and lord of the Pall. He is not a faction with reputation; he offers a pact instead.

Faction standing changes NPC greetings and prices, which areas you can enter, random-encounter tables (a hostile faction sends hunters after you), which quests are offered, the Act 3 route, and which endings are available.

---

## 3. Companions

Both companions have an **approval** score (−100 to +100), interject in dialogue, react to major decisions, fight beside you under AI control, and have a loyalty quest. Either one **leaves for good** if approval drops to −50 or if you commit a "hard betrayal" of their values. When that happens they get a farewell scene and their gear is returned. Neither companion is ever required, so losing one can't trap the player.

| | **Brother Hask** | **Sabine Vey** |
|---|---|---|
| Who | Defrocked Synod monk and field-medic. Drinks, deadpans, and is gentler than he admits. | Regency deserter, crossbow scout, quick-tongued and pragmatic |
| Joins | Greyhallow (Act 1), after you save the village from the Pyre Warden | Solmarch (Act 1): break her out of the Citadel stockade, or pay her bail |
| Role | Healer/support (mending, cleanse, "Blessed Wine") | Damage/control (pinning shot, smoke, crit) |
| Values | Mercy, protecting the helpless | Freedom, honesty, loyalty to friends |
| Approves | Sparing the defeated, feeding the poor, the Mercy Rite | Defying tyrants, telling the truth, keeping promises |
| **Hard betrayal** | Burning the Ashborn refugees (Synod Duskfall) or executing a surrendered foe | Executing Mother Wren (Regency Duskfall), or selling her out to her old captain |
| Loyalty quest | **The Bell of Saint Orrin**: unlocks *Last Rites* | **The Deserter's Debt**: unlocks *Killing Shot* |

---

## 4. Story Outline

### ACT 1: *The Cinder Road* (≈ 45–70 min)

1. **Greyhallow (tutorial).** You wake on the pyre-field. The village is cut off by the Pall, and the village's own dead have risen as the **Pyre Warden**, a burning colossus made from the funeral pyre. You meet Brother Hask in the drowned chapel. Exploring teaches look, take, talk, search and use. **Boss 1: The Pyre Warden.** Hask joins.
2. **The Cinder Road.** This is a crossroads hub that opens up as you progress: a burned waystation, Old Tobble's graveyard, the Toll Bridge (where you get your first taste of Regency soldiers), and **Sallow Fen**. In the fen, the Ember's pull leads you to **Mother Mire**, a marsh-witch twisted by grief. **Boss 2: Mother Mire, the Bog Matron.** Beneath her hut you find the **first Ember** (the Ember of Mercy).
3. **Solmarch, the capital.** All three factions find out what you're carrying. You explore the Market, the Cathedral Quarter, the Citadel, the Undercroft slums and the Lamplighter's Rest inn. Sabine can join here. Each faction leader gives an audience, a pitch, and a small trial quest.
4. **The Vigil of Lanterns (Act 1 climax).** At the cathedral vigil, the Regency's champion **Ser Corvin the Oathbroken** tries to seize the Ember by force. **Boss 3: Ser Corvin.** If you found his unsent letters, he can be talked into yielding.

**▶ ACT 1 DECISION: "Who holds the Ember?"**
- **Synod:** give it to Hierarch Varr. → Synod path
- **Regency:** give it to Lord-Marshal Thorne. → Regency path
- **Ashborn:** give it to Mother Wren. → Ashborn path
- **Keep it** and trust nobody. → **Unbound** path: every faction is wary, but none is closed off, and this is the only path that can keep all three at Neutral or better.

The choice sets your **patron**: your base in Solmarch, your Act 2 quest-giver, which faction hunts you, and starting reputation shifts (+30 to the patron, −20 to its rival; Unbound gets −10 to all three).

### ACT 2: *The Three Embers* (≈ 60–100 min)

The other three Embers lie in three regions, which can be done in **any order**. Each region has a dungeon, a boss, an alternate solution unlocked by a side quest, and faction-specific scenes that depend on your patron. Enemy level scales with how many regions you've finished.

- **Saltmere and the Drowned Abbey** (Ember of Sorrow). A coastal abbey flooded by a tide that answers to its mad abbot. **Boss 4: The Drowned Abbot.** His water rises every few turns and makes him stronger. Opening the **Sluice Gates** first removes the tide mechanic.
- **Thornwatch Pass and the Iron Foundry** (Ember of Wrath). The Regency is forging the Ember Crown here and has built a war-machine powered by the Ember. **Boss 5: Gorrath, the Iron Colossus.** It has armor plates that soak physical damage until they're broken. If you finished *The Foundry Saboteur*, it starts with one plate already gone. (Regency patrons are welcomed here and get the Ember Crown blueprint. Everyone else has to sneak in or fight in.)
- **Whisperwood and the Ashen Barrows** (Ember of Memory). A forest where the Pall has turned memories into ghosts. **Boss 6: The Antlered Widow.** She mirrors the last ability you used. Answer her three riddles (with INT/WIS checks, or the names you gathered in *Antlers in the Snow*) and she yields without a fight.

Back in Solmarch the Pall thickens. NPCs you helped, or failed to help, show up changed: refugees, converts, corpses, or allies.

**▶ ACT 2 DECISION: "Duskfall"**
With three Embers secured, your patron calls in the debt and demands something unforgivable:

| Patron | The demand | Comply | Defy |
|---|---|---|---|
| Synod | Burn the Ashborn Undercroft so their souls can "kindle" the god | Synod Allied, Ashborn destroyed, Wren dies, **Hask leaves** | Fight **Grand Inquisitor Maelis**; Synod Hostile |
| Regency | Publicly execute Mother Wren | Regency Allied, Ashborn Hostile, **Sabine leaves** | Fight **Lord-Marshal Thorne** at the gallows; Regency Hostile |
| Ashborn | Assassinate Hierarch Varr during the Dusk Mass | Synod Hostile, the Mass turns into a massacre, Hask's approval drops sharply | Wren's zealot lieutenant **Kestrel** turns on you; Ashborn splits |
| Unbound | All three factions try to take your Embers by force, and you must pick one to stand with or face them all | Joining one turns this into that faction's version of the "comply" scene above | Fight **Kestrel/Maelis/Thorne's champion**, picked by whichever faction you've angered most |

**Boss 7 (path-dependent):** Grand Inquisitor Maelis / Lord-Marshal Thorne / Kestrel the Ashen Knight. Each has unique mechanics, described in §6.

At the end of Duskfall, the **Hollow King** speaks to you for the first time and offers a **pact**: give him the Embers in exchange for power over the Pall. You can accept here (the Pale Crown route), accept later in Act 3, or refuse.

### ACT 3: *Sunfall* (≈ 30–50 min)

The Pall swallows Solmarch. Aurun's light gutters, and the old cathedral cracks open to reveal what it was built over: the **Sunfall Spire**, the god's fallen body, ribs of white stone reaching up into the clouds.

1. **Solmarch under the Pall.** You decide who to save. Your allies (faction troops, companions, side-quest NPCs) appear in the defense of the city, and the evidence from *The Crown's Ledger* lets you turn Regency soldiers.
2. **The Ribs of God → The Choir of Ash → The Heart Chamber.** This is a vertical dungeon whose route depends on your path, though every route reaches the top.
3. **Boss 8: The Hollow King**, a three-phase fight. Each Ember you carry weakens one of his phases. If you made the pact, he is *not* fought. Instead you fight **Aurun's Fever**, the god's dying madness, in the same arena, so every route has a final boss.
4. **The Heart Altar: final decision.** Every option your flags allow is listed. At least two options (Rekindle and Shatter) are **always** available, so there is no dead end.

### Secret content
- **The Star Fragments.** Seven lore shards are hidden across all three acts. Collecting them reveals a hidden passage at the bottom of Greyhallow's well that leads to the **Sunken Observatory**.
- **Secret Boss: The First Lanternbearer**, the bearer before you, who refused every choice and has been waiting at the bottom of the world for three hundred years. This is the hardest fight in the game. Beating them grants the relic *Dawnfather's Last Light* and the truth about Aurun, which unlocks the golden ending.
- More hidden areas: Old Tobble's crypt, a smuggler tunnel under Solmarch market, and the Widow's Hollow. These are found with `search` or through dialogue.

---

## 5. Branch Map

```
                         ACT 1
  Greyhallow ─► Cinder Road ─► Sallow Fen ─► Solmarch ─► Vigil of Lanterns
                                                               │
                              ┌──────────── WHO HOLDS THE EMBER? ───────────┐
                              │              │              │               │
                           SYNOD         REGENCY         ASHBORN        UNBOUND
                              │              │              │               │
                         ACT 2 (same three regions, any order; scenes vary by patron)
                    Drowned Abbey  ·  Iron Foundry  ·  Whisperwood
                              │              │              │               │
                              └──────────────── DUSKFALL ───────────────────┘
                                   comply │ defy │ (+ Hollow King pact offer)
                                          ▼
                         ACT 3: Solmarch under the Pall ─► Sunfall Spire
                                          │
                       Hollow King (or Aurun's Fever if pact made)
                                          │
                                   ┌── HEART ALTAR ──┐
     ┌──────────────┬──────────────┼──────────────┬──┴───────────┬───────────────┐
  REKINDLE        CROWN          RELEASE      LANTERN KEEPER   PALE CROWN      SHATTER
 (always)     (needs Crown)    (needs Ashborn)  (secret/gold)  (needs pact)    (always)
     │              │              │              │               │               │
  E1 / E1b       E2 / E2b       E3 / E3b          E4              E5              E6
```

### Ending requirements and variants

| # | Ending | Altar option appears if… | Variant decided by… |
|---|---|---|---|
| **E1** | **The Rekindled Dawn**: Aurun lives again. You give your own soul through the Mercy Rite, and a gentle theocracy follows. | Always | Learned *The Mercy Rite* → E1 (you are the only sacrifice) |
| **E1b** | **The Thousand Candles**: Aurun lives, fed on a thousand souls of the Pall-touched. The Synod rules through fear. | Always | Did *not* learn the Mercy Rite |
| **E2** | **The Iron Sun**: Thorne wears the Ember Crown, and order becomes tyranny. | Has the `ember_crown` item **and** Thorne is alive and Regency ≥ 25 | — |
| **E2b** | **The Lantern Throne**: *you* wear the Crown and become a mortal god-king. The epilogue reflects your choices (benevolent or cruel). | Has `ember_crown` and Thorne is dead or Regency < 25 | Your "mercy" score (count of merciful flags) |
| **E3** | **The Long Dusk**: Aurun dies peacefully to Wren's Requiem. Mortals inherit a darker but free world. | Ashborn ≥ 25 **or** Wren alive and allied | Completed *Wren's Requiem* → E3 |
| **E3b** | **The Cold Dark**: the god dies screaming. Freedom comes at a terrible price, and the Pall lingers for a generation. | (same) | Without the Requiem |
| **E4** | **The Lantern Keeper** (golden): you split the god's light among the people, and no one ever again holds it alone. | Both companions in the party **and** loyal (loyalty quests done), **all** factions ≥ 0, **and** `truth_of_the_lantern` (from the secret boss *or* 4 key lore items) | — |
| **E5** | **The Pale Crown**: eternal twilight. You rule the Pall beside the Hollow King. | `pact_hollow_king` flag | — |
| **E6** | **Shattered Heaven**: you destroy the heart. No god, no light, no Pall. Only silence, and whatever grows after. | Always | — |

That gives **6 main endings plus 3 variants**. Every epilogue then adds short slides for each companion, faction leader and major side-quest NPC, chosen by flags, so two runs that reach the same ending still read differently.

### What makes a second playthrough different
- Your Act 1 patron changes the Solmarch hub, the faction quests, the hunters you face, the Duskfall scene, the Duskfall boss, and your Act 3 route.
- Class-gated dialogue: about 40 lines need a specific class, plus many stat checks.
- Bosses with peaceful resolutions (Mire, Corvin, Widow) play out completely differently.
- Companions can be recruited, lost, or never met.
- Endings E2, E3, E4 and E5 are mutually exclusive in any single run.

---

## 6. Bosses

| # | Boss | Where | Mechanics | Alternate resolution |
|---|---|---|---|---|
| 1 | **The Pyre Warden** | Greyhallow | Phase 2 at 50% HP: *Ignite*, a burn aura that applies Burn every turn. Weak to water and frost. | Use the **Well Bucket** (*Water for the Pyre*) to douse it, which skips phase 2 entirely |
| 2 | **Mother Mire, the Bog Matron** | Sallow Fen | Summons Leechlings every 3 turns, applies Poison, heals off poisoned targets | Give her the **Drowned Locket** (*The Drowned Locket*): she weeps, gives you the Ember, and becomes a merchant |
| 3 | **Ser Corvin the Oathbroken** | Solmarch Cathedral | Honor duel: he Parries (counters) after you attack twice in a row, and turns berserk below 30% | Show him his **Unsent Letters** (*Letters Never Sent*) or pass CHA 16: he yields and can reappear in Act 3 |
| 4 | **The Drowned Abbot** | Drowned Abbey | Tide counter: every 3 turns the water rises (+ATK, +regen, then *Undertow* stun) | Open the **Sluice Gates** first: no tide |
| 5 | **Gorrath, the Iron Colossus** | Iron Foundry | 3 armor plates (−75% physical damage while any remain), broken by stun or lightning. Telegraphs *Siege Slam* one turn ahead, so you can Defend against it. | *The Foundry Saboteur*: starts with one plate gone and its core exposed |
| 6 | **The Antlered Widow** | Whisperwood | **Mirror**: copies your last ability back at you. Swapping abilities each turn beats her. | Answer 3 riddles (INT/WIS checks, or the names from *Antlers in the Snow*): no fight, and you get her blessing |
| 7a | **Grand Inquisitor Maelis** | Duskfall (Synod/Unbound) | *Silence* (abilities sealed for 2 turns), *Purifying Fire* (strips your buffs) | Hask's *Last Rites* (from his loyalty quest) breaks his zeal at 50% |
| 7b | **Lord-Marshal Thorne** | Duskfall (Regency/Unbound) | Calls soldiers each phase, rallies (buffs allies), and is shielded while any soldier lives | With *The Crown's Ledger*, his soldiers desert mid-fight |
| 7c | **Kestrel the Ashen Knight** | Duskfall (Ashborn/Unbound) | Ash Form: dodges every other turn, and *Cinder Pact* burns both of you | Sabine's loyalty and a talk check: Kestrel stands down |
| 8 | **The Hollow King** | Heart Chamber | 3 phases: (1) shadow duplicates that need the `search`-style "reveal" action, (2) *Eclipse*, which inverts healing into damage, (3) a desperation flurry. Each Ember you carry dims one phase. | — (pact route fights **Aurun's Fever** instead: a burn/blind god-madness fight) |
| ★ | **The First Lanternbearer** (secret) | Sunken Observatory | Uses *your* class's abilities against you, and has Ember-charged phases that rotate elemental immunities | — |

That is **11 boss encounters** in total. A single run meets at least 9: bosses 1–6, one Duskfall boss, and the final boss, plus the optional secret boss.

---

## 7. Quests

### Main quests (journal entries)
| ID | Title | Act |
|---|---|---|
| `mq_wake` | Ashes to Ashes | 1 |
| `mq_road` | The Cinder Road | 1 |
| `mq_fen` | What the Fen Keeps | 1 |
| `mq_capital` | The City of Lanterns | 1 |
| `mq_vigil` | The Vigil | 1 |
| `mq_embers` | Three Embers, Three Roads (with sub-objectives per region) | 2 |
| `mq_abbey` / `mq_foundry` / `mq_wood` | The Ember of Sorrow / Wrath / Memory | 2 |
| `mq_duskfall` | Duskfall | 2 |
| `mq_pall` | The City Drowns in Ash | 3 |
| `mq_spire` | Sunfall | 3 |

### Side quests (16)
| # | Quest | Location | Mini-story | Ties into |
|---|---|---|---|---|
| 1 | **Water for the Pyre** | Greyhallow | Recover the well bucket from a drowned miller's ghost | Boss 1 alternate |
| 2 | **The Drowned Locket** | Sallow Fen | Find out how Mire's daughter drowned, and whose fault it was | Boss 2 peaceful resolution |
| 3 | **Old Tobble's Wager** *(comic)* | Cinder Road graveyard | The gravedigger is running bets on which corpses will rise. Rig the pool, put them down, or throw the dead a party. | Star Fragment, humor |
| 4 | **Letters Never Sent** | Solmarch Citadel | Corvin's letters to the daughter he abandoned | Boss 3 yield, Act 3 cameo |
| 5 | **Bread and Ashes** | Solmarch Undercroft | Refugees are starving. Raid the Regency granary, buy grain, or report them. | Ashborn/Regency rep, Hask approval |
| 6 | **Counterfeit Saints** | Solmarch Market | Honest Pell sells fake relics that give people real hope. Expose him, partner with him, or blackmail him. | Synod rep, gold, Act 3 cameo |
| 7 | **The Bell of Saint Orrin** | Ruined chapel (Act 1–2) | Hask's loyalty quest: the bell he failed to ring the night his abbey burned | Hask loyalty, golden ending |
| 8 | **The Deserter's Debt** | Thornwatch (Act 2) | Sabine's loyalty quest: her old captain, who ordered a massacre. Spare him, kill him, or hand her over. | Sabine loyalty, golden ending, hard-betrayal risk |
| 9 | **The Sluice Gates** | Saltmere | A lighthouse keeper's family is trapped behind the tide | Boss 4 mechanic removed |
| 10 | **The Foundry Saboteur** | Thornwatch | An enslaved smith wants out, but sabotage will get the guards hanged | Boss 5 weakened, Regency rep |
| 11 | **Antlers in the Snow** | Whisperwood | Gather the three lost names of the Widow's children from the ghost-memories | Boss 6 riddles |
| 12 | **The Mercy Rite** | Synod Archives | An expunged rite: one willing soul can stand in for a thousand | Ending E1 vs E1b |
| 13 | **Wren's Requiem** | Across Act 2 | Collect four verses of the god's funeral song from the old faithful | Ending E3 vs E3b |
| 14 | **The Crown's Ledger** | Citadel archives | Proof that Thorne poisoned the king | Boss 7b soldiers desert, Act 3 soldiers defect |
| 15 | **The Skeleton's Hat** *(comic)* | Ashen Barrows | A polite skeleton wants its hat back from a very rude ghost | Star Fragment, a fine hat |
| 16 | **The Star Fragments** *(secret)* | Everywhere | Seven pieces of the sky | Sunken Observatory, secret boss, golden ending |

Quests can be **failed**, and the journal records it: letting a timed quest lapse across an act boundary, killing a quest-giver, or picking an exclusive branch. A failed quest never blocks the main story.

---

## 8. Systems Design (summary)

- **Classes:**
  - **Sellsword** (warrior): STR/CON, heavy armor, *Cleave*, *Shield Wall*, *Warcry*
  - **Shade** (rogue): DEX/CHA, *Backstab*, *Poison Blade*, *Vanish*, best at lockpicking and persuasion
  - **Ashwright** (mage): INT, *Cinder Bolt* (burn), *Frost Lattice* (stun), *Ash Ward*
  - **Lightbearer** (cleric): WIS, *Mend*, *Smite* (bonus vs. undead), *Sanctuary*

  Each class learns new abilities at levels 1, 3, 5, 8 and 11.
- **Stats:** STR, DEX, INT, WIS, CON, CHA. Derived: HP, Focus (the mana resource), Attack, Defense, Crit, Dodge.
- **Combat:** turn order by DEX plus a small random roll. Actions: `attack`, `ability <name>`, `item <name>`, `defend`, `flee`, and `auto` (a quality-of-life action that picks a sensible move). Damage = (ATK × skill multiplier − DEF × 0.5) × elemental modifier × crit, with a ±10% roll.
- **Status effects (data-driven):** Poison, Burn, Bleed, Stun, Weakened, Silenced, Blessed (regen), Shielded, Frightened, Exposed.
- **Enemy AI profiles:** aggressive, defensive, caster, healer, coward (flees), berserker, summoner, and boss scripts (phase triggers at HP thresholds or turn counts).
- **Difficulty:** you pick Story, Normal or Hard (enemy HP and ATK multipliers). Enemy level = region base + regions cleared. Level cap is 15.
- **Loot:** five tiers (Common · Uncommon · Rare · Epic · Relic) with weighted loot tables. Equipment slots: weapon, offhand, head, body, feet, and two trinkets. There are 3 or 4 shops, and prices depend on faction standing.
- **Death:** you are never stuck in an unwinnable state. Death sends you back to the last **Ember Shrine** (a checkpoint that also autosaves) and costs 10% of your gold. Bosses can always be retried, and every region has a shop and grindable encounters.
- **Dialogue:** trees of nodes and options. Each option can carry conditions (flag, stat, class, item, reputation, quest state, companion present) and effects (set flags, change reputation or approval, give or take items, start, advance, complete or fail quests, start combat, open a shop, end an act).
- **World-state flags:** one dictionary holds every major decision. Locations can show alternate descriptions and exits based on flags, and NPCs can change dialogue, move, or die.
- **Save/Load:** 5 manual slots plus one autosave, stored as versioned JSON in `saves/`.
- **Output:** a UI layer that uses `rich` when it's installed and plain text otherwise. All game I/O goes through one interface, so tests can drive the game with scripted input and capture its output.

### Data-driven condition and effect mini-language (shared by every content file)
```json
"conditions": {"all": [
  {"flag": "corvin_letters_read"},
  {"stat": "cha", "gte": 16},
  {"rep": "synod", "gte": 25},
  {"class": "lightbearer"},
  {"has_item": "drowned_locket"},
  {"quest": "sq_mercy_rite", "state": "completed"},
  {"companion": "hask", "present": true},
  {"not": {"flag": "wren_dead"}}
]}
"effects": [
  {"set_flag": "mire_spared"}, {"rep": {"ashborn": 10, "regency": -5}},
  {"approval": {"hask": 15}}, {"give_item": "ember_mercy"},
  {"quest_advance": "mq_fen"}, {"start_combat": "boss_mire"}, {"goto": "node_x"}
]
```

---

## 9. File / Folder Structure

```
RPG-/
├── main.py                     # `python main.py`  (flags: --seed N, --script FILE, --plain)
├── PLAN.md  NOTES.md  README.md
├── engine/                     # NO story content in here
│   ├── __init__.py
│   ├── game.py                 # Game object, main loop, act transitions
│   ├── state.py                # GameState dataclass (+ to_dict/from_dict)
│   ├── parser.py               # verb/alias parsing, fuzzy noun matching
│   ├── commands.py             # look, go, talk, take, use, inventory, map, quests, stats, save, load, help…
│   ├── content.py              # loads & indexes /content JSON
│   ├── conditions.py           # condition evaluator
│   ├── effects.py              # effect executor
│   ├── world.py                # locations, exits, hidden areas, flag-variant descriptions
│   ├── entities.py             # Player, Enemy, Companion, stats & derived stats
│   ├── combat.py               # turn engine, AI profiles, boss phase scripts
│   ├── status.py               # status effect engine
│   ├── items.py                # items, equipment, rarity, loot tables
│   ├── progression.py          # XP curve, level-ups, ability unlocks
│   ├── shops.py
│   ├── dialogue.py             # dialogue tree runner
│   ├── quests.py               # quest journal state machine
│   ├── factions.py
│   ├── companions.py           # approval, interjections, departure
│   ├── encounters.py           # random encounter tables
│   ├── endings.py              # altar options + epilogue assembly
│   ├── rng.py                  # single seedable RNG passed everywhere
│   ├── saveload.py
│   └── ui.py                   # rich / plain output, input abstraction
├── content/
│   ├── game.json               # meta: title, start location, act definitions
│   ├── classes.json  abilities.json  status_effects.json  factions.json
│   ├── companions.json  shops.json  loot_tables.json  encounters.json  endings.json
│   ├── items/      weapons.json armor.json trinkets.json consumables.json key_items.json lore.json
│   ├── enemies/    common.json bosses.json
│   ├── locations/  act1_greyhallow.json act1_road.json act1_solmarch.json
│   │               act2_saltmere.json act2_thornwatch.json act2_whisperwood.json
│   │               act3_pall.json act3_spire.json secret.json
│   ├── dialogue/   one file per NPC or scene
│   └── quests/     main.json side.json
├── tools/
│   ├── validate_content.py     # reference + reachability checker
│   └── playtest.py             # runs a command script and prints a transcript
├── tests/                      # stdlib unittest (also runs under pytest)
│   ├── test_combat.py  test_status.py  test_progression.py  test_items.py
│   ├── test_saveload.py  test_quests.py  test_dialogue.py  test_conditions.py
│   ├── test_parser.py  test_validator.py
│   ├── test_playthroughs.py
│   └── playthroughs/           # e1_rekindled.txt … e6_shattered.txt, plus variants
└── saves/                      # gitignored
```

### Validator checks (`python tools/validate_content.py`)
- Every exit, item, enemy, NPC, dialogue node, quest, objective, shop, loot table, ability, status and ending ID resolves.
- Every flag that is *read* somewhere is *set* somewhere (and unused set-flags are reported as warnings).
- Every location is reachable from the start, given the flags that can be set along the way.
- Key items can't be sold or dropped, and every key item can be obtained.
- **Every ending is reachable**: a search over the major-decision flag combinations confirms that each altar option's conditions can be satisfied, and that Rekindle and Shatter are unconditional.
- No dialogue node is orphaned, and every node has an exit.

### Testing
- **Unit tests:** combat math (damage, crits, elements, defend, status ticks), XP and leveling curves, stat growth, save→load round-trip equality, quest state transitions (active → completed/failed), condition and effect evaluation, and parser aliases. All of them use a fixed-seed RNG.
- **Scripted playthroughs:** command lists fed through the real game loop with a fixed seed, one per ending and variant. Each asserts the final `ending_id` and selected flags. They run with `python -m unittest`.

---

## 10. Scope Estimate

| Content | Target |
|---|---|
| Locations | ~95 (Act 1 ~35, Act 2 ~40, Act 3 ~12, secret ~8) |
| NPCs with dialogue | ~45 |
| Enemies (non-boss) | ~35 types |
| Items | ~150 (weapons, armor, trinkets, consumables, key, lore) |
| Lore entries | ~30, including 7 Star Fragments |
| Playtime | 2–4 h for a full playthrough; ~1.5 h for a speedrun on Story difficulty |

Milestones M1–M7 follow the order you specified. After each milestone I run every test plus the validator, update NOTES.md, and give you a summary and instructions for trying out what's new.

---

## 11. Questions for You (defaults in brackets; I'll use these unless you say otherwise)
1. Title **"Emberfall"** and the dying-sun-god setting above? [yes]
2. Three factions plus the Hollow King as a pact-giver rather than a fourth faction? [yes]
3. Two companions, Hask and Sabine, done in depth, rather than three shallower ones? [two]
4. Death returns you to the last shrine (forgiving) rather than reload-only? [shrine respawn]
5. JSON for content (stdlib, no PyYAML dependency)? [JSON]
