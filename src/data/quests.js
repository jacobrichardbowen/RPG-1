// Quests. Each quest has one or more stages; each stage has objectives.
// Objective types:
//   kill    { tag, count }          creatures whose type tag matches
//   collect { item, count }         items in your bags (removed on turn-in if `take`)
//   talk    { npc, topic? }         completes when you speak to the NPC (optionally about a topic)
//   interact{ id }                  completes when you use a world object with that id
//   flag    { flag }                completes when a story flag is set (by dialog choices or events)
//   level   { level }
// `poi` marks the area on the map. `journal` text is written into your journal (first person).
// Rewards: xp, gold, items (always given), choice (pick one).

export const QUESTS = {
  fresh_boat: {
    name: 'Fresh Off the Boat', giver: 'ilsa', turnIn: 'orvel', level: 1,
    offer: "Another one off the prison hulk. Don't look at me like that, I only keep the docks. Your papers say you've been pardoned by order of the Sea-Regent herself, which means somebody important wants you alive and somebody unimportant has to do the paperwork.\n\nThat somebody is Tidewarden Orvel Garrow. His Hall is the big stone building on the square, up the road from the docks. Take him your release papers and he'll make you a free subject of the Crown. Mostly free.",
    progress: 'Well? Garrow\'s Hall is the stone building on the village square. Big blue banners. You can\'t miss it.',
    complete: "Let me see those. Hm. The Sea-Regent's own seal, and no word of what you did or why you're pardoned. That's not unusual. The Crown has its reasons and it doesn't share them with tidewardens on the edge of the map.\n\nWell, {name}, you're a free subject of the Crown, and free subjects need coin. Here's your stipend. Brackwater is small, but there's always work here for someone who doesn't mind getting muddy.",
    stages: [{ objectives: [{ type: 'talk', npc: 'orvel', text: 'Take your release papers to Tidewarden Orvel Garrow' }], poi: { x: 42, z: 150, r: 8 } }],
    onAccept: (g) => g.giveItem('release_papers', 1, true),
    onComplete: (g) => { g.removeItem('release_papers', 1); g.learnTopic('work'); g.learnTopic('Corwin Pell'); },
    rewards: { xp: 120, gold: 30 },
    journal: {
      accept: 'The ship has finally docked at a muddy little town called Brackwater. The harbormaster, Ilsa Vane, told me to take my release papers to Tidewarden Orvel Garrow at the Hall on the village square.',
      complete: 'Tidewarden Garrow made my pardon official and gave me a few coins. I am free, more or less. He suggested I look for work around Brackwater.',
    },
  },

  snapper_season: {
    name: 'Snapper Season', giver: 'maela', turnIn: 'maela', level: 1,
    offer: "You've got the look of someone who can swing a stick. Good. Mudsnappers have come up the Strand thick as fleas this year. Crabs the size of a cart wheel, and mean with it. They've cut my nets to ribbons and nearly had my brother's foot.\n\nGo east along the road to Snapper Strand and thin them out. Six should do it, enough that the rest learn some manners. I'll make it worth your while. I've some gear from my late husband that's no use to me.",
    progress: 'Back already? I still hear them clacking from here. Six snappers, east along the road on the Strand.',
    complete: "Six! You've a strong arm, stranger. My nets will last the month now. Here, take your pick. Boots, cap, or the old shell buckler. Gods know they're better on you than in my chest.",
    stages: [{ objectives: [{ type: 'kill', tag: 'mudsnapper', count: 6, text: 'Mudsnappers slain' }], poi: { x: 188, z: 60, r: 40 } }],
    rewards: { xp: 320, gold: 8, choice: ['snapper_buckler', 'tideworn_boots', 'fisher_cap'] },
    journal: {
      accept: 'Maela Strand, a fisherwoman in Brackwater, asked me to kill six mudsnappers on Snapper Strand, east of the village.',
      complete: 'I culled the mudsnappers and Maela rewarded me with some of her late husband\'s gear.',
    },
  },

  snapper_supper: {
    name: 'A Taste of the Strand', giver: 'bram', turnIn: 'bram', level: 1, requires: { quests: ['snapper_season'] },
    offer: "Maela tells me you've been cracking snappers. Don't waste the meat! Snapper leg, fried in lard with a pinch of salt and a squeeze of marsh-lemon, is the finest thing this island has ever produced, and I've eaten everything this island has ever produced.\n\nBring me four pieces of snapper meat and I'll fry you a basket of legs for the road.",
    progress: "Four pieces of snapper meat, friend. My pan's getting cold.",
    complete: "Ahh, look at these. Stringy, but they'll fry up lovely. Here, take a basket of legs, still warm. Eat one when the fighting's done and you'll feel ten years younger.",
    stages: [{ objectives: [{ type: 'collect', item: 'snapper_meat', count: 4, take: true, text: 'Stringy Snapper Meat' }], poi: { x: 188, z: 60, r: 40 } }],
    rewards: { xp: 150, items: [['fried_snapper', 5]] },
    journal: {
      accept: 'Bram Hollis, keeper of the Drowned Lantern, wants four pieces of snapper meat. He has promised to fry some for me.',
      complete: 'Bram fried me a basket of snapper legs. They were delicious.',
    },
  },

  glowcap_harvest: {
    name: 'Glowcap Harvest', giver: 'ysolde', turnIn: 'ysolde', level: 2,
    offer: "You're the pardoned one. Everyone's talking. I'm Ysolde. I make the draughts that keep this village from coughing itself to death every rainy season.\n\nI need glowcaps: small blue mushrooms that grow among the reeds in Glowcap Fen, west along the Fen road. They glow at night, which makes them easy to find after dark and dangerous to look for, because the boglings come out then. Bring me five and I'll pay you in something more useful than coin.",
    progress: 'Five glowcaps, from the Fen to the west. They grow in clusters by the water. Mind the boglings.',
    complete: "Lovely, and fresh, still glowing. These will make a month of draughts. Here. Take one of these, and a pair of healing draughts besides. You'll need them if you keep wandering the Fen.",
    stages: [{ objectives: [{ type: 'collect', item: 'glowcap', count: 5, take: true, text: 'Glowcaps gathered' }], poi: { x: -150, z: 15, r: 50 } }],
    onComplete: (g) => g.learnTopic('boglings'),
    rewards: { xp: 420, items: [['healing_draught', 2]], choice: ['fenwalker_leggings', 'glowcap_circlet', 'alchemist_gloves'] },
    journal: {
      accept: 'Ysolde Fenn, Brackwater\'s alchemist, wants five glowcaps from Glowcap Fen, west of the village. Boglings infest the marsh.',
      complete: 'I brought Ysolde her glowcaps.',
    },
  },

  fen_king: {
    name: 'The Fen-King', giver: 'ysolde', turnIn: 'hessa', level: 3, requires: { quests: ['glowcap_harvest'] },
    offer: "While you were in the Fen, did you see their chieftain? A great swollen thing they call Grubgut. The boglings were never this bold before he crowned himself. They've been stealing from the farms at the edge of the marsh, and last week they dragged off one of Tobin's carts, oxen and all.\n\nCaptain Rook won't spare the guard to go into the marsh. But you aren't the guard. Kill Grubgut and the rest will scatter back into the reeds. Tell the Captain when it's done. She'll want to know, and she pays bounties.",
    progress: 'Is the Fen-King dead? No? Then the boglings will keep coming.',
    complete: "Grubgut? Dead? Ha! I've had six farmers in my office this month complaining about that fat toad. You've done the Watch a service, and the Watch pays its debts. Here's the bounty, with my thanks.",
    stages: [{ objectives: [{ type: 'kill', tag: 'grubgut', count: 1, text: 'Grubgut the Fat slain' }], poi: { x: -176, z: 38, r: 16 } }],
    rewards: { xp: 520, gold: 45, items: [['healing_draught', 1]] },
    journal: {
      accept: 'Ysolde says the boglings are led by a chieftain named Grubgut the Fat, who lairs in their camp deep in Glowcap Fen. If I kill him, Captain Hessa Rook of the Watch will pay a bounty.',
      complete: 'Grubgut the Fat is dead and Captain Rook paid me the bounty.',
    },
  },

  taxman: {
    name: "The Taxman's Ledger", giver: 'orvel', turnIn: 'orvel', level: 1, requires: { quests: ['fresh_boat'] },
    offer: "Since you're looking for work, there's a matter I'd rather not hand to the Watch. Corwin Pell, my tax collector, hasn't been seen in three days. Pell is not a man who goes missing. Pell is a man who turns up at your door at dawn with an inkpot and a list of what you owe.\n\nHe was last seen at the Drowned Lantern. Ask Bram what he knows. And {name}: Pell carried a ledger with every debt on this island written in it. If he's come to harm, that ledger matters more than he does. Bring it to me.",
    progress: 'Any word of Pell? Bram at the Drowned Lantern may know where he went.',
    stages: [
      { objectives: [{ type: 'talk', npc: 'bram', topic: 'Corwin Pell', text: 'Ask Bram at the Drowned Lantern about Corwin Pell' }], poi: { x: -24, z: 150, r: 8 },
        journal: 'Tidewarden Garrow asked me to find his missing tax collector, Corwin Pell, and to bring back Pell\'s ledger. Pell was last seen at the Drowned Lantern tavern.' },
      { objectives: [{ type: 'interact', id: 'pell_body', text: "Search for Pell along the Fen road" }], poi: { x: -100, z: 34, r: 18 },
        journal: 'Bram says Pell argued with a man named Darro Vex the night he vanished, then left west along the Fen road toward Glowcap Fen.' },
      { objectives: [{ type: 'talk', npc: 'darro', topic: "Pell's ledger", text: 'Confront Darro Vex about the ledger' }], poi: { x: -24, z: 150, r: 8 },
        journal: "I found Corwin Pell dead beside the Fen road. Boglings had been at the body, but the wound that killed him was a single thin blade between the ribs, not a bogling spear. His ledger shows Darro Vex owes the Crown more than three hundred crowns in back taxes. Darro drinks at the Drowned Lantern." },
      { objectives: [{ type: 'flag', flag: 'darro_resolved', text: 'Deal with Darro Vex' }], poi: { x: -24, z: 150, r: 8 } },
    ],
    onComplete: (g) => {
      if (g.flags.bribed) g.removeItem('pell_ledger', 99);
      else g.removeItem('pell_ledger', 1);
    },
    complete: "Pell, dead on the Fen road. Gods. He was a tiresome man, but he was mine. And Darro Vex, of course. I should have seen it.\n\nYou did well, {name}. This ledger will keep half the village honest for a year. Wear this signet. It marks you as a friend of the Hall, and folk around here will treat you accordingly.",
    rewards: { xp: 650, gold: 80, items: [['tidewarden_signet', 1]] },
    journal: {
      complete: 'I returned Pell\'s ledger to Tidewarden Garrow. He gave me his signet ring.',
    },
  },

  bottle: {
    name: 'Message in a Bottle', giver: 'brannoc', turnIn: 'brannoc', level: 3,
    offer: "Twenty years I've kept this light, and the sea's taken plenty from me in that time. But the Gilded Gull took the worst of it. She broke up on the rocks of Wrecker's Cove, up the north-west shore, with a bottle of Lantern Rum in her strongbox that I'd been saving for my retirement.\n\nNow her crew walks that beach, drowned and still not done with it. You look sturdy. Fetch my bottle from the wreck's strongbox and you'll have my old coat. It's kept me warm through forty winters on this rock.",
    progress: "The bottle's in the Gull's strongbox, on the wreck up at Wrecker's Cove. Mind the drowned. They don't like visitors.",
    complete: "Is that... it is! Not a crack in her. Ohh, I'll save her a while yet. Here's the coat, as promised. Salt-stiff, but nothing gets through it.",
    stages: [{ objectives: [{ type: 'collect', item: 'brannoc_bottle', count: 1, take: true, text: "Brannoc's Bottle" }], poi: { x: -170, z: -168, r: 20 } }],
    rewards: { xp: 460, gold: 30, items: [['keeper_coat', 1]] },
    journal: {
      accept: "Old Brannoc, the lighthouse keeper on Lantern Point, wants me to recover his bottle of rum from the strongbox of the Gilded Gull, a ship wrecked at Wrecker's Cove on the north-west shore. Drowned sailors haunt the beach.",
      complete: 'I returned Brannoc\'s bottle of rum. He gave me his old coat.',
    },
  },

  spire: {
    name: 'Whispers from the Spire', giver: 'hessa', turnIn: 'hessa', level: 3,
    offer: "You've earned a reputation in a short while, {name}, so I'll be plain. Strange lights have burned on Vael's Tor every night this past fortnight, up by the old Spire. My scouts came back talking about robed folk, chanting, and an eye that hangs in the air. One of them didn't come back.\n\nThey call themselves the Drowned Eye. I need to know what they're planning before they come down the hill. Go north to the Tor, break up their camp, and bring me any orders they're carrying. The adepts, the ones in purple, will have them.",
    progress: "The cult's camp sits on the southern slope of Vael's Tor, below the Spire. Bring me their orders.",
    stages: [
      { objectives: [
        { type: 'kill', tag: 'cultist', count: 6, text: 'Drowned Eye cultists slain' },
        { type: 'collect', item: 'cult_orders', count: 1, text: 'Sodden Orders (carried by adepts)' },
      ], poi: { x: 36, z: -120, r: 26 },
      journal: "Captain Hessa Rook asked me to scout Vael's Tor, north of the village. A cult called the Drowned Eye has camped near the ancient Spire. I'm to kill their zealots and bring back any orders the adepts carry." },
      { objectives: [{ type: 'talk', npc: 'hessa', text: 'Bring the orders to Captain Rook' }], poi: { x: -4, z: 120, r: 8 },
        journal: "The orders are signed by one 'Sister Morwen, Voice of the Deep'. She means to wake something called the Eye at the Spire's summit when the twin moons align. Captain Rook needs to see this." },
      { objectives: [{ type: 'kill', tag: 'morwen', count: 1, text: 'Sister Morwen slain' }], poi: { x: 30, z: -152, r: 18 },
        journal: "Captain Rook read the orders and went grey. She asked me to climb to the Drowned Spire and stop Sister Morwen before the ritual is finished." },
    ],
    onStage: (g, stage) => { if (stage === 1) g.learnTopic('Sister Morwen'); },
    complete: "Then it's over. Whatever was looking at us out of that hill has closed its eye. The whole island owes you, {name}, and the Watch most of all. I had this armory's best set aside for the day someone finished this. Choose whatever suits your hand.\n\nAnd go and see Ilsa at the docks. A ship's come in from the mainland, and I'd wager it's looking for you.",
    rewards: { xp: 900, gold: 100, choice: ['spirebreaker', 'tidecaller', 'eyepiercer'] },
    onComplete: (g) => g.setFlag('spire_done'),
    journal: { complete: 'Sister Morwen is dead and the Eye above the Spire has gone dark. Captain Rook rewarded me from the Watch armory and told me a ship from the mainland waits at the docks.' },
  },

  passage: {
    name: 'Passage to the Mainland', giver: 'hessa', turnIn: 'ilsa', level: 1, requires: { quests: ['spire'] }, autoOffer: true,
    offer: "Go on, Ilsa's waiting at the docks. Don't keep a ship's captain waiting. They charge by the hour.",
    progress: 'Ilsa is at the docks.',
    complete: "There you are. The Regent's own courier came in on the morning tide with a letter bearing your name, and a berth on the Grey Heron, sailing for the mainland whenever you're ready.\n\nYou came here a prisoner and you'll leave a hero. Not bad for a few weeks in the mud.",
    stages: [{ objectives: [{ type: 'talk', npc: 'ilsa', text: 'Speak with Ilsa Vane at the docks' }], poi: { x: 13, z: 216, r: 6 } }],
    rewards: { xp: 200 },
    onComplete: (g) => g.ui.showEnding(),
    journal: {
      accept: 'Captain Rook says a ship from the mainland has arrived, asking after me. Ilsa Vane is waiting at the docks.',
      complete: 'A ship waits to carry me to the mainland. Whatever the Sea-Regent wants with me, I will find out soon.',
    },
  },
};

// Order shown in the journal/quest log.
export const QUEST_ORDER = ['fresh_boat', 'taxman', 'snapper_season', 'snapper_supper', 'glowcap_harvest', 'fen_king', 'bottle', 'spire', 'passage'];
