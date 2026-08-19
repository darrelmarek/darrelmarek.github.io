/** Stable traits — assigned per hamster, rarely change. */
export type Personality = "chill" | "playful" | "shy" | "dramatic" | "foodie";

/** Moment-to-moment feeling — derived from needs for now. */
export type Mood = "happy" | "content" | "hungry" | "sleepy" | "grumpy";

export const PERSONALITIES: Personality[] = [
  "chill",
  "playful",
  "shy",
  "dramatic",
  "foodie",
];

/** Accent color per personality (fill + outlines). */
export const PERSONALITY_COLORS: Record<
  Personality,
  { hex: number; css: string }
> = {
  chill: { hex: 0x7eb8d4, css: "#7eb8d4" }, // soft sky blue
  playful: { hex: 0xe4b56a, css: "#e4b56a" }, // honey apricot
  shy: { hex: 0xb8a6d9, css: "#b8a6d9" }, // quiet lavender
  dramatic: { hex: 0xd4788c, css: "#d4788c" }, // stage rose
  foodie: { hex: 0x8ebf9a, css: "#8ebf9a" }, // soft sage
};

export function personalityColor(personality: Personality): {
  hex: number;
  css: string;
} {
  return PERSONALITY_COLORS[personality];
}

/** Per-personality need / chatter tuning. */
export interface PersonalityTraits {
  /** Multiplier on passive hunger drain. */
  hungerDrain: number;
  /** Multiplier on walk + kick energy costs. */
  energyCost: number;
  /** Multiplier on happiness loss while hungry/sleepy. */
  happinessDrain: number;
  /** Seek a bed when energy falls below this. */
  energySeekBelow: number;
  /** Multiplier on how long they stay in bed. */
  sleepDuration: number;
  /** Multiplier on auto-talk gaps (higher = quieter). */
  chatterCooldown: number;
  /** Chance to actually speak when a chatter roll comes due (0–1). */
  chatterChance: number;
}

export const PERSONALITY_TRAITS: Record<Personality, PersonalityTraits> = {
  chill: {
    hungerDrain: 1,
    energyCost: 1.45,
    happinessDrain: 1,
    energySeekBelow: 65,
    sleepDuration: 1.5,
    chatterCooldown: 1,
    chatterChance: 0.35,
  },
  playful: {
    hungerDrain: 1,
    energyCost: 0.55,
    happinessDrain: 1,
    energySeekBelow: 45,
    sleepDuration: 1,
    chatterCooldown: 1,
    chatterChance: 0.35,
  },
  shy: {
    hungerDrain: 1,
    energyCost: 1,
    happinessDrain: 1,
    energySeekBelow: 45,
    sleepDuration: 1,
    chatterCooldown: 2.4,
    chatterChance: 0.12,
  },
  dramatic: {
    hungerDrain: 1,
    energyCost: 1,
    happinessDrain: 1.75,
    energySeekBelow: 45,
    sleepDuration: 1,
    chatterCooldown: 1,
    chatterChance: 0.35,
  },
  foodie: {
    hungerDrain: 1.75,
    energyCost: 1,
    happinessDrain: 1,
    energySeekBelow: 45,
    sleepDuration: 1,
    chatterCooldown: 1,
    chatterChance: 0.35,
  },
};

export function personalityTraits(personality: Personality): PersonalityTraits {
  return PERSONALITY_TRAITS[personality];
}

/**
 * First-person talk lines keyed by personality → mood.
 * Should sound like something a little hamster would actually say out loud.
 */
export const QUIPS: Record<Personality, Record<Mood, string[]>> = {
  chill: {
    happy: [
      "i'm feeling pretty good",
      "this is nice",
      "i like it here",
      "everything's soft today",
      "i'm in a good mood",
      "yeah… i'm happy",
      "today feels easy",
      "i could stay like this",
      "i'm cozy",
      "life's alright",
      "i feel calm and happy",
      "mmm, good vibes",
    ],
    content: [
      "hey",
      "oh, hi",
      "just hanging out",
      "what's up?",
      "i'm just here",
      "did you need me?",
      "hi there",
      "i'm alright",
      "just watching things",
      "nothing much going on",
      "hey friend",
      "i'm chillin'",
    ],
    hungry: [
      "i'm getting hungry…",
      "i could really use a snack",
      "my tummy's rumbling a little",
      "is there food nearby?",
      "i think i need to eat soon",
      "seeds would be nice right now",
      "i'm kinda hungry",
      "food sounds really good…",
      "i should find something to nibble",
      "my belly wants a snack",
    ],
    sleepy: [
      "i'm getting sleepy…",
      "i could use a nap",
      "my eyes feel heavy",
      "i need a warm nest",
      "bed sounds amazing right now",
      "i'm so tired…",
      "i think i'll go lie down",
      "can i take a little nap?",
      "i'm about to fall asleep standing up",
      "i need to rest for a bit",
    ],
    grumpy: [
      "i'm not really in the mood…",
      "leave me alone for a minute",
      "i'm feeling off today",
      "ugh… not now",
      "i need a minute to myself",
      "i'm kinda grumpy",
      "everything feels a little wrong",
      "i'll be nicer later… maybe",
      "don't poke me right now",
      "i just want to be left alone",
    ],
  },

  playful: {
    happy: [
      "hehe hi!!",
      "this is the best!",
      "wanna play with me?",
      "i feel so zoomy!",
      "you're my favorite!",
      "let's run around!",
      "i'm so happy i could bounce",
      "yay, it's you!",
      "today is a play day!",
      "i've got the zoomies!",
      "hehehe",
      "come play come play!",
    ],
    content: [
      "hi hi!",
      "what are you doing?",
      "wanna see something cool?",
      "i'm bored… entertain me!",
      "poke me again!",
      "are we playing or what?",
      "heyyy",
      "tell me a secret!",
      "i missed you!",
      "got any games?",
      "squeak! i mean hi!",
      "don't just stand there, talk!",
    ],
    hungry: [
      "feed me so i can zoom better!",
      "i'm hungry AND silly",
      "snack me, please please please",
      "my tummy wants treats NOW",
      "if you feed me i'll be extra fun",
      "hungry hungry hamster!!",
      "i need food for my chaos",
      "is it snack time yet?!",
      "my belly is making weird noises",
      "feed the zoomies!!",
    ],
    sleepy: [
      "i'm sleepy but i don't wanna stop…",
      "okay fine… nap time",
      "i'll play more after i sleep",
      "carry me to bed? please?",
      "i'm too tired to bounce…",
      "nap first, chaos later!",
      "my energy ran away…",
      "don't let me miss anything while i sleep",
      "i'm crashing… hehe",
      "bed! then more playing!",
    ],
    grumpy: [
      "hey! i'm not having fun!",
      "this is boring and i hate it",
      "fix me with a game!",
      "hmph!!",
      "nobody wants to play with me…",
      "i'm spicy today, watch out",
      "ugh, my mood is broken",
      "make it fun again!",
      "i shake my tiny fist at you!",
      "i need a silly reset, please",
    ],
  },

  shy: {
    happy: [
      "…hi. i'm really happy",
      "you noticed me… thank you",
      "i feel safe with you",
      "this is really nice…",
      "i'm quietly happy",
      "i like when you visit",
      "…i'm glad you're here",
      "my heart feels warm",
      "thank you for being gentle",
      "i'm smiling… just a little",
      "days like this are my favorite",
      "i feel brave enough to say hi",
    ],
    content: [
      "…oh. hello",
      "um… hi",
      "i didn't see you there…",
      "just… hanging out",
      "do you need something?",
      "i'm okay… thanks",
      "hi… i'll stay right here",
      "you can sit with me if you want",
      "i'm a little nervous… but hi",
      "…present and accounted for",
      "soft hello…",
      "i was just thinking quietly",
    ],
    hungry: [
      "…i'm hungry, if that's okay to say",
      "could i maybe have a snack…?",
      "my tummy is asking for food…",
      "i don't want to be a bother, but i'm hungry",
      "seeds would help a lot…",
      "i think i need to eat soon…",
      "is there food… for me?",
      "i'm shy-hungry… which is still hungry",
      "please don't watch me eat too hard…",
      "a little nibble would be nice…",
    ],
    sleepy: [
      "…i'm really sleepy",
      "i need a quiet place to rest…",
      "can i go nap now…?",
      "my eyes keep closing…",
      "i'd like a warm nest, please…",
      "i'm too tired to be brave…",
      "i think bed is calling me…",
      "yawn… sorry…",
      "i'll just… curl up somewhere soft",
      "goodnight… almost…",
    ],
    grumpy: [
      "…please give me some space",
      "i'm upset… i don't want to talk much",
      "that hurt my feelings a little…",
      "i need to be alone for a bit",
      "…not right now",
      "i'm hiding in my mood",
      "please be gentle with me today",
      "i'll come out when i feel better…",
      "everything feels too loud…",
      "i'm quietly mad… sorry",
    ],
  },

  dramatic: {
    happy: [
      "what a glorious day for me!",
      "i feel absolutely legendary!",
      "behold! a happy hamster!",
      "the world loves me today!",
      "i require an encore of pets!",
      "joy has entered the chat!!",
      "i am thriving, obviously",
      "someone write this happiness down!",
      "i sparkle with delight!",
      "today i am the main character!",
      "my fluff has never felt better!",
      "applaud me… softly!",
    ],
    content: [
      "you summoned me…?",
      "yes? i am listening",
      "speak! i am ready",
      "ah… my public arrives",
      "i was just narrating my day",
      "go on, i'm intrigued",
      "a quiet scene… for now",
      "do you bring news?",
      "i've been waiting dramatically",
      "hello, dear audience",
      "hmm… interesting timing",
      "state your purpose!",
    ],
    hungry: [
      "i am STARVING, this is a tragedy!",
      "this lack of snacks is a betrayal!",
      "feed me before i perish dramatically!",
      "hunger! my greatest villain!",
      "without seeds, i cannot go on!",
      "this tummy deserves a feast!",
      "alas… no crumbs…",
      "i demand a culinary rescue!",
      "my hunger arc is getting intense!",
      "bring food, or bring tissues!",
    ],
    sleepy: [
      "i must recline immediately!",
      "carry me to my nest… please…",
      "sleep claims me once again!",
      "fade to black… i need a nap!",
      "even legends need rest!",
      "my energy has left the stage!",
      "to bed! dramatically!",
      "i collapse… softly… onto pillows!",
      "this is my tired era!",
      "wake me for Act Two!",
    ],
    grumpy: [
      "i am OUTRAGED!",
      "how dare the day treat me like this!",
      "my feelings! ruined!",
      "i shall pout forever… or an hour!",
      "this is an insult to my fluff!",
      "darkness… and also mild annoyance!",
      "i'm in my villain era!",
      "someone has wronged me today!",
      "i demand emotional compensation!",
      "leave me to my tragic mood!",
    ],
  },

  foodie: {
    happy: [
      "i ate well and i feel amazing",
      "that snack changed my whole day",
      "i'm full, happy, and adorable",
      "good food, good life!",
      "my belly is doing a happy dance",
      "i love a well-timed treat",
      "yum… still thinking about it",
      "fed hamsters are happy hamsters",
      "i could write a poem about seeds",
      "my heart (and tummy) are full",
      "best flavor day ever!",
      "i'm glowing… it's the snacks",
    ],
    content: [
      "got any snacks on you?",
      "i was just thinking about food…",
      "what's for later?",
      "hey… smell that? crumbs?",
      "i'm always snack-curious",
      "tell me your favorite seed",
      "did you bring any food?",
      "i could go for a little something",
      "food chat? i'm in",
      "don't mind my sniffing",
      "i rate every room by snack access",
      "hi! also: hungry later probably",
    ],
    hungry: [
      "i need food. like, actually need it",
      "please feed me, i'm so hungry",
      "my tummy is yelling for seeds!",
      "an empty tummy is not for me",
      "i would do anything for a snack right now",
      "is lunch a thing that exists here?!",
      "i'm hangry and i know it",
      "seeds. seeds. SEEDS.",
      "help… culinary emergency…",
      "if i don't eat soon i'll get dramatic",
      "my soul needs a crunchy snack",
      "feed me before i start begging louder",
    ],
    sleepy: [
      "i want a nap… maybe after a snack",
      "food coma is calling my name",
      "i'm tired… and also thinking about breakfast",
      "can my nest be near the snack stash?",
      "i'll dream about crumbs tonight",
      "sleepy, peckish, complicated",
      "bed first… unless there's food",
      "i need rest for future snacking",
      "yawn… save me a seed for later",
      "nap now, feast later!",
    ],
    grumpy: [
      "no snacks means no peace from me",
      "i'm upset and underfed",
      "fix this mood with food, please",
      "an empty tummy hurt my feelings",
      "i'm salty and not in a tasty way",
      "feed me and maybe i'll forgive everyone",
      "my grump is 80% hunger",
      "don't talk to me until there's crunch",
      "i miss being full…",
      "this is a food-based emotional crisis",
    ],
  },
};

export function pickPersonality(seed?: string): Personality {
  if (!seed) {
    return PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];
  }
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash + seed.charCodeAt(i) * (i + 1)) % 997;
  }
  return PERSONALITIES[hash % PERSONALITIES.length];
}

export function moodFromNeeds(
  needs: {
    hunger: number;
    energy: number;
    happiness: number;
  },
  energySeekBelow = 45,
): Mood {
  if (needs.hunger < 50 || needs.energy < energySeekBelow) {
    // Prefer sleepy when energy is the more pressing of the two.
    if (needs.energy < energySeekBelow && needs.energy <= needs.hunger) {
      return "sleepy";
    }
    if (needs.hunger < 50) return "hungry";
    return "sleepy";
  }
  if (needs.happiness < 40) return "grumpy";
  if (needs.happiness >= 75) return "happy";
  return "content";
}

export function pickQuip(personality: Personality, mood: Mood): string {
  const byMood = QUIPS[personality];
  const primary = byMood[mood];
  const fallback = byMood.content;
  const pool = primary.length > 0 ? primary : fallback;
  return pool[Math.floor(Math.random() * pool.length)] ?? "…";
}
