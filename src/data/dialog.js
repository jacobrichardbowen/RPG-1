// Dialogue. Morrowind-style topics: words in [[double brackets]] become links and are added
// to your known topics. Each topic has a default answer and per-NPC answers. An answer can be a
// string, or a list of variants { if(g), text, choices: [{ label, if(g), do(g), reply }] }.
// `g` is the game; helpers: g.q(id) quest state, g.flags, g.player, g.learnTopic(...).

const done = (id) => (g) => g.questDone(id);
const active = (id, stage) => (g) => g.questActive(id) && (stage === undefined || g.questStage(id) === stage);

export const START_TOPICS = ['Brackwater', 'latest rumors', 'little advice', 'background'];

export const GREETINGS = {
  ilsa: [
    { if: (g) => !g.questStarted('fresh_boat'), text: "Easy on the gangplank, it's older than you are. Welcome to Brackwater, end of the world, last stop before nowhere. I'm Ilsa Vane, harbormaster. You'll be the one with the [[release papers]]." },
    { if: done('spire'), text: "Well, if it isn't the hero of Vael's Tor. I'd buy you a drink, but Bram would only charge me double." },
    { text: 'Back again? The docks are as you left them: wet.' },
  ],
  kell: [
    { if: (g) => !g.questStarted('fresh_boat'), text: "On your feet, prisoner. We've reached Brackwater. Get down that gangplank and see the harbormaster, Ilsa Vane. She's on the dock." },
    { text: "You're free now, or so the papers say. Off my ship." },
  ],
  sailor: [{ text: "First time on the island? Mind the crabs. And the boglings. And the fog. And Bram's cooking, if you've a weak stomach." }],
  orvel: [
    { if: (g) => g.questActive('fresh_boat'), text: 'Yes? Ah, a new arrival. Ilsa sent you up with your papers, I expect. Let\'s have a look.' },
    { if: (g) => g.flags.bribed, text: "Pell's ledger never turned up. Strange, that. A whole island of debts, gone into the mud. Was there something you wanted?" },
    { if: done('taxman'), text: "{name}. Always a pleasure. The Hall's doors are open to you." },
    { text: 'Tidewarden Orvel Garrow, servant of the Crown and keeper of this Hall. What business do you have?' },
  ],
  clerk: [{ text: "Nessa Wick, clerk of the Hall. If it needs stamping, filing or forgetting, it comes through me." }],
  maela: [
    { if: done('snapper_season'), text: 'My nets have never been so quiet. What can I do for you?' },
    { text: "Mind the fish racks. If you knock one over you're cleaning it up." },
  ],
  ysolde: [
    { if: done('fen_king'), text: "The boglings have gone quiet since their fat little king died. I can actually hear myself think." },
    { text: 'Mm. Come to buy, or come to stare? Either is fine, but buying is better for both of us.' },
  ],
  darro: [
    { if: (g) => g.flags.bribed, text: 'Friend! Sit, have a drink. On me. Anything for my good friend.' },
    { text: "You're blocking my light, stranger." },
  ],
  bram: [
    { if: done('snapper_supper'), text: 'My favourite customer! Hungry? Course you are.' },
    { text: "Welcome to the Drowned Lantern! Best tavern on the island. Also the only tavern on the island. What'll it be?" },
  ],
  patron: [{ text: "Hic. Don't mind me. I'm just resting my eyes with a drink." }],
  hessa: [
    { if: active('spire', 1), text: "You're back from the Tor in one piece. Orders? Give them here.\n\n...'Sister Morwen, Voice of the Deep.' 'The last verse will be sung and it will open.' Gods above. This isn't a cult of lunatics, {name}, it's a ritual, and it's nearly finished. I can't march the Watch up that hill in time. You can. Climb to the Spire and stop this Morwen, whatever it takes." },
    { if: done('spire'), text: '{name}. The Watch salutes you. Literally, if you wait a moment, I\'ll get the lads out.' },
    { text: 'Captain Hessa Rook, Brackwater Watch. Keep your blade sheathed in the village and we\'ll get along.' },
  ],
  tobin: [
    { text: 'Welcome, welcome, warm-blood. Tobin has many things and you have, let us hope, many coins.' },
  ],
  brannoc: [
    { if: done('bottle'), text: "Ah, it's my rum-runner! The bottle's still sealed. I'm saving her for a special occasion. Like Tuesday." },
    { text: "Eh? Visitors at the light? Don't get many. Mind the step. Mind the other step too." },
  ],
  guard1: [{ text: 'Keep your nose clean, citizen.' }, { text: 'Move along.' }],
  guard2: [{ text: 'Stay off the docks after dark. The tide comes in fast.' }],
  fisher: [{ text: "The catch was poor again. Something's scaring the fish out past the Spire." }],
  villager: [{ text: 'Another stranger! Brackwater\'s getting crowded. That makes, oh, three this year.' }],
};

export const TOPICS = {
  'release papers': {
    default: 'Your papers say you\'re pardoned, and the Tidewarden makes it official.',
    by: {
      ilsa: "Signed and sealed by the [[Sea-Regent]]'s chancery, no less. Take them up to [[Tidewardens|Tidewarden Garrow]] at the Hall on the square. He'll do the rest.",
      kell: "Don't lose them. Without those papers you're just an escaped convict standing in a puddle.",
    },
  },
  Brackwater: {
    default: "Brackwater's a fishing village on the south shore of the isle. A tavern, a Hall, a trader and a lot of mud. The Crown keeps it for the [[Tidewardens]] and the fish keep it for everyone else. East is [[Snapper Strand]], west is [[Glowcap Fen]], north is [[Parasol Wood]] and beyond it [[Vael's Tor]].",
    by: {
      ilsa: "Fishing village, port of call, and the only spot of civilization on this rock. Everything worth having comes through my docks: salt, nails, ale, and the occasional pardoned convict. If you're after coin, ask around about [[work]].",
      orvel: "Brackwater is a holding of the Crown, administered by this office. Population: one hundred and forty-two, or one hundred and forty-one if [[Corwin Pell]] doesn't turn up.",
      bram: "It's home! Fog in the morning, rain at noon, crabs at night. Best place in the world. Stay a while and you'll never want to leave. Mostly because the ship only comes twice a season. And try my fried [[mudsnappers|snapper]] legs.",
      tobin: "A village of warm-bloods who complain about the wet. Tobin does not complain. Tobin sells them cloaks.",
      brannoc: "Brackwater? Bah. When I was a lad it was six huts and a gibbet. Now they've got a shrine and paved roads. Well, gravelled. Well, muddy. I keep to myself out on [[Lantern Point]].",
    },
  },
  Tidewardens: {
    default: "The Tidewardens administer the Crown's island holdings: taxes, tariffs, law. Orvel Garrow is Tidewarden here. You'll find him in the Hall on the square.",
    by: {
      orvel: "We are the Crown's hand on the outer isles. Every barrel landed, every acre fished, every crown owed passes through a Tidewarden's ledger. Thankless work. Literally. Nobody has ever thanked me.",
      darro: "The Tidewardens. Leeches in nice coats. They take a tenth of everything that comes off a boat and give back stamps.",
      clerk: "Garrow's a good sort, for a Tidewarden. He signs what I put in front of him and doesn't ask why. That's rare.",
    },
  },
  'Sea-Regent': {
    default: "The Sea-Regent rules the Crown's fleets and isles in the young King's name. Nobody here has ever seen her. Nobody here wants to.",
    by: {
      orvel: "The Regent's seal on a convict's pardon. I've seen it twice in thirty years, and both times the convict was someone the Regent intended to use. I don't say that to frighten you. Only... be careful whose debt you're in.",
      ilsa: "If the Regent wants you free, you're free. If she wants something else later, well. Cross that bridge.",
    },
  },
  'latest rumors': {
    default: "I hear strange lights burn on [[Vael's Tor]] at night. Folk say it's the old ghosts of the Spire.",
    by: {
      ilsa: "Fishermen won't go out past [[Wrecker's Cove]] any more. Say the water's gone cold and still, like something's holding its breath. Superstitious lot. Still, I don't sail there either.",
      bram: "Gus there swears he saw a man fall out of the sky last week north of the village. Then again, Gus also swears my stew's too salty, so what does he know.",
      patron: "Tell you what I heard. Hic. I heard [[Darro Vex]] owes the Hall a fortune and Pell was going to make him pay. And now Pell's gone. Hic. Just saying.",
      tobin: "Tobin hears the [[boglings]] have a king now. A fat one. Boglings with a king are boglings with plans. Plans are bad for business.",
      maela: "There's an old crab up the far end of the Strand, big as a boat. [[Old Grandclaw]], my husband called him. Shell's thick with barnacles. I'd stay clear if I were you. Or I wouldn't, if I fancied a pearl or two.",
      hessa: "[[the Drowned Eye|The cult]] up on [[Vael's Tor|the Tor]] has the farmers spooked. I've doubled the night watch, but doubled from two is still only four.",
      brannoc: "I keep the light, I see things. Boats that aren't there. Lights on the Tor. Drowned men walking [[Wrecker's Cove|the cove up north]]. Seeing things is the job.",
      ysolde: '[[Glowcap Fen|Glowcaps]] are blooming early this year. That usually means a wet winter. Or a death in the marsh. Mushrooms are like that.',
      guard1: 'Something has the [[boglings]] riled. They\'ve been raiding the fen farms every night this week.',
      guard2: 'They found a smuggler\'s cache on [[Gull Rock]] last spring. Empty, of course. Somebody got there first.',
      darro: "I hear people who listen to rumors end up as rumors.",
      sailor: "The Grey Heron's due in from [[the mainland]] any day. They say she's carrying a royal courier.",
      fisher: 'They say the old Gilded Gull still has gold aboard, down in [[Wrecker\'s Cove]]. Nobody goes for it. The crew never left.',
      villager: 'I heard the lighthouse keeper talks to his lamp. Long conversations. Very polite.',
    },
  },
  'little advice': {
    default: "Keep a healing draught on your belt. Rest between fights; you heal quickly when you're not bleeding. And never pick a fight with more than one snapper at once.",
    by: {
      hessa: "Fight where you choose, not where they choose. Pull one enemy at a time if you can, a thrown stone or a spell will draw a single foe to you. And don't fight in deep water. Swords don't swim.",
      ysolde: "Mana returns faster when you stop casting for a few breaths. Mages who forget this become very expensive funerals.",
      bram: "Eat! Food mends you better than any potion, as long as you sit still and nobody's stabbing you.",
      tobin: "Sell what you don't need. Tobin buys everything. Claws, hides, knucklebones. Tobin does not ask what they are for. Tobin knows.",
      ilsa: "Don't jump off the end of the pier. Everybody does it once. The water's colder than you think.",
      brannoc: "If you're ever lost, look for my light. It's on Lantern Point, south-west of the village. Follow it home.",
      orvel: 'Read everything. Books, letters, notices. Half of solving any problem is knowing it exists.',
    },
  },
  background: {
    default: "Me? Born here, likely die here. Not much more to tell.",
    by: {
      ilsa: "Twenty years a sailor, ten years harbormaster. I traded my ship for a desk and a dock that doesn't sink. Most days I think I got the better deal.",
      orvel: "I was a junior clerk in the Admiralty when they offered me this post. 'A quiet island,' they said. 'Good for your health.' That was nineteen years ago.",
      maela: "Born in Brackwater, married in Brackwater, widowed in Brackwater. The sea took my Tam five winters back. I still fish the same waters. Somebody has to.",
      ysolde: "I'm Ashborn, if the grey skin and red eyes didn't give it away. I came to the isle to study the fungi of [[Glowcap Fen]]. That was eleven years ago. The fungi are very interesting.",
      darro: "I'm a merchant. I move things from where they are to where people want them. It's honest work. Mostly.",
      bram: "Tuskari, from the Ironjaw highlands. Came down to the coast for the fish and stayed for the beer. I've run the Lantern for fifteen years. Best years of my life.",
      hessa: "Twelve years in the Crown's marines, three as captain of the Brackwater Watch. This posting was meant to be a rest. I'm still waiting.",
      tobin: "Tobin is Skarn, from the drowned forests far south. Tobin has six scales on his brow, see? Lucky. Tobin sails, Tobin trades, Tobin is very lucky.",
      brannoc: "Forty years on this rock. Kept the light through storms and fogs and that winter the sea froze. Never once let her go dark. Not once.",
      kell: "I guard prisoners. Then I take them places. Then I go back and guard more prisoners. It's a living.",
      clerk: "I keep the Hall's records. I know who owes what, who married whom and who shouldn't have. Knowledge is a terrible burden. I enjoy it immensely.",
    },
  },
  work: {
    default: "Work? Try [[Maela Strand]] by the fish racks, or [[Ysolde]] the alchemist. Captain [[Hessa Rook]] at the North Watch pays bounties too.",
    by: {
      orvel: "If you want honest work, [[Maela Strand]] has been complaining about [[mudsnappers]] for weeks, and [[Ysolde]] the alchemist always needs hands. And I have a delicate matter of my own concerning [[Corwin Pell]].",
      ilsa: "Ask around the village. Maela's always got crab trouble, and the Watch can use anyone who can swing a sword.",
      bram: 'Maela by the racks, Ysolde behind the Hall, and the Captain up at the North Watch. Or wash dishes for me! No? Thought not.',
    },
  },
  'Maela Strand': {
    default: 'Maela fishes the east waters. You\'ll find her by the drying racks at the east end of the village.',
    by: { maela: "That's me. Fisherwoman, widow, crab-hater." },
  },
  Ysolde: {
    default: "Ysolde Fenn, the alchemist. Ashborn. Odd, but her draughts work. Her shop is the stilt house south-east of the Hall.",
    by: { ysolde: 'Yes, I am aware of myself, thank you.' },
  },
  'Hessa Rook': {
    default: 'Captain Rook commands the Watch. You\'ll find her at the North Watch tower, where the road leaves the village.',
    by: { hessa: "That's Captain to you." },
  },
  'Corwin Pell': {
    default: "Pell? The tax collector. Haven't seen him in days. Can't say I miss him.",
    by: {
      orvel: [
        { if: (g) => !g.questStarted('taxman'), text: "My tax collector. He's been missing for three days. If you're looking for work, I could use someone discreet to find him." },
        { if: done('taxman'), text: "Pell is buried behind the shrine. I attended. So did nobody else." },
        { text: 'Have you found him? Bram at the Drowned Lantern may know where he went.' },
      ],
      bram: [
        { if: active('taxman', 0), text: "Pell? He was in here three nights back, drinking alone as usual, until [[Darro Vex]] came over to his table. They had words, loud ones. Pell said something about 'debts the Crown doesn't forget', and Darro said something about Pell's health. Then Pell went out. West, toward the Fen road. Nobody's seen him since.", do: (g) => g.learnTopic('Darro Vex') },
        { text: 'Poor Pell. Never tipped, never smiled, and now he never will.' },
      ],
      darro: "Pell? The taxman? Haven't seen him. Haven't looked. If you find him, tell him I'm still not paying.",
      patron: 'Pell owed ME money, if you can believe it. A tax collector in debt. Hic. The world\'s gone mad.',
      clerk: "Pell had a ledger he never let out of his sight. Every debt on the island, written in his horrible little hand. If he's dead, someone will want that ledger.",
      hessa: "Garrow told me Pell was missing. I can't spare men to search for a man nobody likes. If you find him, tell me.",
    },
  },
  'Darro Vex': {
    default: 'Darro? Calls himself a merchant. Drinks at the Drowned Lantern most nights, in the corner by the window.',
    by: {
      bram: "Darro's a regular. Pays in coin, never says where it comes from. I don't ask. A tavern-keeper who asks questions is a tavern-keeper with an empty tavern.",
      darro: 'That\'s me. What of it?',
      orvel: 'Vex has been on my list of debtors for three years. Somehow he always has an excuse and never has coin.',
      hessa: 'Smuggler. Can\'t prove it. Yet.',
    },
  },
  "Pell's ledger": {
    default: "Pell's ledger? You should take that to the Tidewarden.",
    by: {
      darro: [
        { if: (g) => g.questStage('taxman') === 2 && g.hasItem('pell_ledger'), text: "...Where did you get that? Keep your voice down. Sit.\n\nYes, I owed him. Yes, he was going to have the Watch seize my boat. I didn't mean for it to end that way. He pulled a knife first, on my oath. Now. That ledger is the only thing tying me to the Fen road. Hand it over, forget you found it, and I'll make it worth your while. A hundred and fifty crowns, and a blade worth twice that.",
          choices: [
            { label: 'Accept the bribe and hand over the ledger.', do: (g) => g.darroBribe() },
            { label: 'Refuse. You\'re coming with me to the Watch.', do: (g) => g.darroFight() },
          ] },
        { if: (g) => g.flags.bribed, text: "What ledger? I don't know anything about a ledger. Neither do you." },
        { text: "I don't know what you're talking about." },
      ],
      orvel: [
        { if: (g) => g.hasItem('pell_ledger') && !g.flags.darro_resolved, text: 'You found it! And Darro Vex\'s debts circled three times in red. Pell certainly had his suspicions. Confront Vex if you must, but be careful. Desperate men do desperate things.' },
        { text: 'The ledger is the Crown\'s business.' },
      ],
    },
  },
  'the Drowned Eye': {
    default: 'The cult on the Tor? They wear green and teal and pray to something under the sea. Stay well away.',
    by: {
      hessa: "Lunatics in robes, or worse than lunatics. They think something sleeps under the isle, an eye as big as a ship, and that it'll wake if they sing to it long enough. I'd laugh if they hadn't killed my scout.",
      ysolde: 'There is something in the Spire. I have felt it in the marsh fungi. They grow toward the Tor, every one of them, like sunflowers toward the sun.',
      brannoc: "My grandfather told me stories. Before the Crown, before the village, the old folk built the Spire to watch the sea. Or to watch something IN the sea. The stories never agreed.",
      tobin: "Tobin does not trade with them. Their coins are wet. Always wet. Even in summer.",
    },
  },
  'Sister Morwen': {
    default: 'Morwen? Never heard the name.',
    by: {
      hessa: "If those orders are true, Morwen leads the cult. She means to finish her ritual at the Spire's summit. You have to stop her, {name}. The Watch can't climb that hill fast enough.",
      ysolde: "Morwen... there was an Ashborn priestess of that name who came through the village two summers ago, asking about the old Spire. She paid in pearls. Pale, beautiful, very quiet. I didn't like her.",
    },
  },
  "Vael's Tor": {
    default: "Vael's Tor is the big hill north of the village, with the ruined Spire on top. Folk don't go up there any more, not since [[the Drowned Eye]] came.",
    by: {
      hessa: "The cult has its camp on the southern slope, and the Spire itself on the summit. The road from the village runs straight up to it.",
      brannoc: "You can see the Tor from my light on a clear day. These past weeks there's been a green glow on top, every night, like a lighthouse built for something else.",
    },
  },
  'Glowcap Fen': {
    default: 'The Fen is west of the village, along the Fen road. Pools, reeds, mud to the knee, and [[boglings]].',
    by: {
      ysolde: "Glowcap Fen is the most interesting place on this island. The fungi there glow, sing (very quietly), and occasionally eat small birds. And the [[boglings]] live there, which makes collecting difficult.",
    },
  },
  boglings: {
    default: "Little marsh-goblins with spears and big ears. Cowards alone, vicious in packs. They'll run when they're losing, then come back with friends.",
    by: {
      ysolde: 'They have a king now. [[Grubgut]], they call him. He is very fat and very loud.',
      hessa: "If you fight boglings, watch for the hexers. The ones in hoods throw curses from the back while the spearmen keep you busy. Kill the hexers first.",
    },
  },
  Grubgut: {
    default: 'The bogling chieftain. Fat as a barrel and twice as mean, they say.',
    by: { ysolde: "He lairs in the middle of the bogling camp, deep in the Fen. You'll smell him before you see him." },
  },
  'Snapper Strand': {
    default: 'The long beach east of the village. Good fishing, if the [[mudsnappers]] let you. Watch for [[Old Grandclaw]] at the far end.',
  },
  mudsnappers: {
    default: 'Giant crabs, the size of a cartwheel. Their shells are thick, so hit them hard.',
    by: {
      maela: "Nasty things. Their claws can snap an oar. But they're slow to turn, so get behind them if you can.",
      bram: 'Mudsnapper legs, fried in lard. Nothing finer. Bring me the meat and I\'ll show you.',
    },
  },
  'Old Grandclaw': {
    default: 'A giant crab, old as the island. Lives at the far end of Snapper Strand.',
    by: { maela: "Tam fought him once, and lost the tip of his ear. Grandclaw's shell is crusted with pearls and barnacles. A fortune, if you can crack it." },
  },
  'Parasol Wood': {
    default: 'The mushroom forest north of the village. The great parasols are older than anyone can say. Fen stalkers hunt there, on the way to [[Vael\'s Tor]].',
  },
  "Wrecker's Cove": {
    default: 'A rocky cove up the north-west shore, where the [[Gilded Gull]] broke up years ago. The drowned crew still walks the beach.',
  },
  'Gilded Gull': {
    default: 'A merchant ship that wrecked in the cove up north. Twenty souls lost.',
    by: { brannoc: "My light was burning that night. I'll swear to it till I die. She sailed straight onto the rocks anyway, like her captain was steering for something only he could see." },
  },
  'Lantern Point': {
    default: "The headland south-west of the village, with Old Brannoc's lighthouse on it.",
  },
  'Gull Rock': {
    default: 'A little islet off the south-east shore. Only gulls live there. And possibly smugglers.',
    by: { darro: "Never heard of it. Lovely place, I'm told. Wouldn't know." },
  },
  'the mainland': {
    default: "The mainland's a long way east. A week's sail in good weather. Ships come twice a season.",
    by: { ilsa: "When you're ready to leave, if they let you leave, talk to me. I know every captain who drops anchor here." },
  },
};

// Topic aliases: [[link|Display]] lets text show a different word than the topic name.
