/**
 * The routine guide: for each care, how often and why, for the pet's species and life stage.
 * General, widely shared guidance only (no doses, no diagnoses); anything medical points to the vet.
 * Strings are English source keys, translated with t() at render time (tools/i18n).
 */
import type { CareType, Species } from '../domain/care';
import type { StageId } from '../domain/lifeStage';

export type Point = { title: string; body: string };
export type Rec = {
  care: CareType;
  /** what the card proposes: a daily routine, a few days a week, or a vet visit */
  kind: 'daily' | 'weekly' | 'visit';
  /** reminder times for the routine (24 h) */
  times: string[];
  /** weekdays for 'weekly' (0 = Sunday) */
  days?: number[];
  /** usual amount per time for timed cares (walk/play minutes) */
  portion?: number;
  headline: string;
  why: string;
  points: Point[];
};

export const STAGE_LABEL: Record<Species, Record<StageId, string>> = {
  dog: {
    baby: 'Young puppy · under 3 months',
    young: 'Puppy · 3 to 6 months',
    junior: 'Junior · 6 to 12 months',
    adult: 'Adult · 1 to 7 years',
    senior: 'Senior · 7 years and up',
  },
  cat: {
    baby: 'Young kitten · under 3 months',
    young: 'Kitten · 3 to 6 months',
    junior: 'Junior · 6 to 12 months',
    adult: 'Adult · 1 to 11 years',
    senior: 'Senior · 11 years and up',
  },
};

const VET_CHANGES: Point = { title: 'Changes are worth a call', body: 'Eating, drinking or sleeping much more or less than usual is worth asking your vet about.' };
const LEAN: Point = { title: 'Keep them lean', body: 'You should feel the ribs easily without seeing them. Weigh monthly and adjust portions with your vet.' };
const SLOW_SWITCH: Point = { title: 'Change food slowly', body: 'When switching food, mix old and new over about 7 days to avoid an upset tummy.' };
const RECORDS: Point = { title: 'Keep every date in Records', body: 'Add each vaccine, treatment and visit to Records so your vet sees the whole story.' };

const WATER: Record<Species, Point> = {
  dog: { title: 'Wash the bowl daily', body: 'Rinse and refill rather than topping up. A clean bowl keeps them drinking.' },
  cat: { title: 'Cats love moving water', body: 'A fountain, or a bowl away from food and litter, often helps cats drink more. Wet food adds water too.' },
};

function water(species: Species, stage: StageId): Rec {
  const why =
    stage === 'baby' || stage === 'young'
      ? 'Growing pets get thirsty fast. Water should always be within reach, day and night.'
      : stage === 'senior'
        ? 'Older pets dehydrate more easily. Keep bowls easy to reach, on every floor if you can.'
        : 'Water should always be available. Refreshing it twice a day keeps it inviting.';
  return {
    care: 'water',
    kind: 'daily',
    times: ['08:00', '19:00'],
    headline: 'Fresh water, refreshed twice a day',
    why,
    points: [WATER[species], { title: 'Notice big changes', body: 'Drinking much more than usual can be an early sign of illness — mention it to your vet.' }],
  };
}

function medication(species: Species, stage: StageId): Rec {
  const baby = species === 'dog' ? 'Puppies usually get vaccines every 3 to 4 weeks until about 16 weeks old, and regular deworming. Your vet sets the exact plan.' : 'Kittens usually get vaccines every 3 to 4 weeks until about 16 weeks old, and regular deworming. Your vet sets the exact plan.';
  const by: Record<StageId, Omit<Rec, 'care' | 'kind' | 'times'>> = {
    baby: { headline: 'Vaccines and deworming start now', why: baby, points: [{ title: 'Bring their papers', body: 'The breeder’s or shelter’s records tell your vet what has already been done.' }, RECORDS] },
    young: {
      headline: 'Finish the first vaccines',
      why: 'The last baby vaccines are usually given around 16 weeks. It’s also the time to ask about flea, tick and worm prevention.',
      points: [{ title: 'Ask about neutering', body: 'Your vet will tell you the right age for your pet — it depends on species, size and lifestyle.' }, RECORDS],
    },
    junior: {
      headline: 'Boosters, prevention and neutering',
      why: 'The first booster usually comes about a year after the first vaccines. Many vets discuss neutering between 6 and 12 months.',
      points: [{ title: 'Prevention on a schedule', body: 'Flea, tick and worm prevention work best given regularly, on the schedule your vet recommends.' }, RECORDS],
    },
    adult: {
      headline: 'A check-up every year',
      why: 'A yearly check-up with the boosters your vet advises, and flea, tick and worm prevention on their schedule.',
      points: [{ title: 'Teeth count too', body: 'Dental disease is very common in adult pets. Ask about it at the yearly visit.' }, RECORDS],
    },
    senior: {
      headline: 'A check-up every 6 months',
      why: 'Problems show up faster with age. Twice-yearly visits, often with a blood test, catch them early.',
      points: [VET_CHANGES, RECORDS],
    },
  };
  return { care: 'medication', kind: 'visit', times: [], ...by[stage] };
}

const DOG: Record<StageId, Rec[]> = {
  baby: [
    {
      care: 'meal', kind: 'daily', times: ['07:00', '11:00', '15:00', '19:00'],
      headline: '4 small meals a day',
      why: 'Small tummy, big growth: little and often keeps a young puppy’s energy steady.',
      points: [
        { title: 'Puppy food only', body: 'Feed a complete food made for puppies. Split the daily amount on the label into 4 meals.' },
        { title: 'Meals make house-training easier', body: 'Most puppies need to go out right after eating. Regular meal times mean predictable potty breaks.' },
      ],
    },
    {
      care: 'walk', kind: 'daily', times: ['08:00', '13:00', '18:00'], portion: 5,
      headline: 'Short 5-minute outings',
      why: 'Until the vaccines are done, stay in your garden or places your vet says are safe. Little legs tire fast.',
      points: [
        { title: 'Potty breaks are the real routine', body: 'Take them out after waking, eating and playing — every 1 to 2 hours at this age.' },
        { title: 'Meet the world gently', body: 'Calm, happy meetings with new sounds, people and places now prevent fears later.' },
      ],
    },
    {
      care: 'play', kind: 'daily', times: ['09:00', '12:00', '16:00', '19:30'], portion: 5,
      headline: '4 short play sessions',
      why: 'Puppies learn through play. Keep it short and stop before they’re overtired — they sleep 18 to 20 hours a day.',
      points: [
        { title: 'Teach a soft mouth', body: 'If teeth touch skin, pause the game for a moment. They learn that gentle play keeps the fun going.' },
        { title: 'Chew toys save shoes', body: 'Teething puppies need to chew. Swap anything precious for a toy and praise them.' },
      ],
    },
    {
      care: 'grooming', kind: 'daily', times: ['19:00'],
      headline: 'A few minutes of handling every day',
      why: 'Gently touch paws, ears and mouth with treats. Grooming, nail trims and vet visits stay easy for life.',
      points: [{ title: 'A soft brush, short sessions', body: 'One or two minutes is enough. End before they wriggle, with a reward.' }],
    },
  ],
  young: [
    {
      care: 'meal', kind: 'daily', times: ['07:30', '12:30', '18:00'],
      headline: '3 meals a day',
      why: 'Between 3 and 6 months, most puppies move from 4 meals to 3.',
      points: [
        { title: 'Weigh, don’t guess', body: 'Use the feeding chart for their current weight and check it every 2 weeks — they grow fast.' },
        { title: 'Puppy food only', body: 'Keep feeding a complete puppy food. Split the daily amount on the label into 3 meals.' },
      ],
    },
    {
      care: 'walk', kind: 'daily', times: ['08:00', '18:00'], portion: 15,
      headline: '2 walks of about 15 minutes',
      why: 'A common rule of thumb: about 5 minutes of walking per month of age, twice a day.',
      points: [
        { title: 'Easy on growing joints', body: 'Avoid long runs, lots of stairs and jumping down from heights while they’re growing.' },
        { title: 'Sniffing counts', body: 'Let them explore. Sniffing tires young brains in a good way.' },
      ],
    },
    {
      care: 'play', kind: 'daily', times: ['10:00', '15:00', '19:30'], portion: 10,
      headline: '3 play sessions of about 10 minutes',
      why: 'Short games several times a day burn energy and teach good manners.',
      points: [{ title: 'Teach a soft mouth', body: 'If teeth touch skin, pause the game for a moment. They learn that gentle play keeps the fun going.' }],
    },
    {
      care: 'grooming', kind: 'daily', times: ['19:00'],
      headline: 'A few minutes of handling every day',
      why: 'Keep touching paws, ears and mouth with treats, and start brushing teeth with a pet toothpaste.',
      points: [{ title: 'A soft brush, short sessions', body: 'One or two minutes is enough. End before they wriggle, with a reward.' }],
    },
  ],
  junior: [
    {
      care: 'meal', kind: 'daily', times: ['08:00', '18:00'],
      headline: '2 meals a day',
      why: 'From around 6 months, two meals suit most dogs. Keep puppy food until your vet says to switch — often at 12 months, later for large breeds.',
      points: [SLOW_SWITCH, LEAN],
    },
    {
      care: 'walk', kind: 'daily', times: ['08:00', '18:00'], portion: 30,
      headline: '2 walks of about 30 minutes',
      why: 'Energy peaks in adolescence. Two good walks a day help with chewing and jumping up at home.',
      points: [
        { title: 'Train on the go', body: 'Practise recall and loose-lead walking in short bits during every walk.' },
        { title: 'Large breeds: wait to jog', body: 'No long runs until your vet says the joints are ready — often 12 to 18 months.' },
      ],
    },
    {
      care: 'play', kind: 'daily', times: ['12:00', '19:30'], portion: 15,
      headline: '2 play sessions of 15 minutes',
      why: 'Fetch, tug and food puzzles burn energy and build your bond.',
      points: [{ title: 'Brain games tire too', body: 'Ten minutes of sniffing out hidden treats can tire a young dog as much as a walk.' }],
    },
    {
      care: 'grooming', kind: 'weekly', times: ['19:00'], days: [1, 3, 5],
      headline: 'Brushing 3 times a week',
      why: 'The adult coat is coming in. Regular brushing removes loose hair and lets you check the skin.',
      points: [{ title: 'Teeth every day if you can', body: 'Daily tooth brushing with a pet toothpaste is the best way to prevent dental disease.' }],
    },
  ],
  adult: [
    {
      care: 'meal', kind: 'daily', times: ['08:00', '18:00'],
      headline: '2 meals a day',
      why: 'Two measured meals keep hunger and digestion steady for most adult dogs.',
      points: [LEAN, { title: 'Rest after big meals', body: 'No hard running for an hour after eating, especially for large, deep-chested dogs.' }],
    },
    {
      care: 'walk', kind: 'daily', times: ['08:00', '18:30'], portion: 30,
      headline: '2 walks a day, 30 to 60 minutes in total',
      why: 'Most adult dogs need at least 30 to 60 minutes of activity a day. Working and sporty breeds need more.',
      points: [
        { title: 'Mix it up', body: 'One slow, sniffy walk and one brisker one gives body and brain a workout.' },
        { title: 'Mind the heat', body: 'On hot days walk early and late. Hold your hand on the pavement for 5 seconds: too hot for you is too hot for paws.' },
      ],
    },
    {
      care: 'play', kind: 'daily', times: ['12:30', '19:30'], portion: 15,
      headline: '2 play sessions of 15 minutes',
      why: 'Fetch, tug and food puzzles burn energy and build your bond.',
      points: [{ title: 'Brain games tire too', body: 'Ten minutes of sniffing out hidden treats can tire a dog as much as a walk.' }],
    },
    {
      care: 'grooming', kind: 'weekly', times: ['19:00'], days: [1, 4],
      headline: 'Brushing 2 to 3 times a week',
      why: 'Brushing keeps the coat healthy and is the best moment to find ticks, lumps or sore spots. Long coats need it daily.',
      points: [{ title: 'Teeth every day if you can', body: 'Daily tooth brushing with a pet toothpaste is the best way to prevent dental disease.' }],
    },
  ],
  senior: [
    {
      care: 'meal', kind: 'daily', times: ['08:00', '18:00'],
      headline: '2 smaller, easy meals',
      why: 'Older dogs often need fewer calories but still good protein. Ask your vet whether a senior food suits them.',
      points: [{ title: 'Weigh monthly', body: 'Weight loss or gain is often the first sign something has changed.' }, VET_CHANGES],
    },
    {
      care: 'walk', kind: 'daily', times: ['08:30', '13:00', '18:00'], portion: 15,
      headline: '3 short, gentle walks',
      why: 'Shorter, more frequent walks keep older joints moving without overdoing it.',
      points: [
        { title: 'Let them set the pace', body: 'Slower walks with time to sniff are perfect. Turn back before they tire.' },
        { title: 'Watch for stiffness', body: 'Stiffness, heavy panting or lagging behind are worth mentioning to your vet.' },
      ],
    },
    {
      care: 'play', kind: 'daily', times: ['16:00'], portion: 10,
      headline: '1 gentle play session a day',
      why: 'Gentle games and food puzzles keep older minds sharp.',
      points: [{ title: 'Brain games tire too', body: 'Ten minutes of sniffing out hidden treats can tire a dog as much as a walk.' }],
    },
    {
      care: 'grooming', kind: 'weekly', times: ['19:00'], days: [1, 3, 5],
      headline: 'Brushing 3 times a week, with a lump check',
      why: 'Run your hands over their whole body as you brush. New lumps are common with age and worth showing your vet.',
      points: [{ title: 'Nails and paws', body: 'Less active dogs wear their nails down less. Check them every couple of weeks.' }],
    },
  ],
};

const CAT: Record<StageId, Rec[]> = {
  baby: [
    {
      care: 'meal', kind: 'daily', times: ['07:00', '11:00', '15:00', '19:00'],
      headline: '4 small meals a day',
      why: 'Kittens grow very fast and have tiny stomachs: little and often is best.',
      points: [
        { title: 'Kitten food only', body: 'Feed a complete food made for kittens. Split the daily amount on the label into 4 meals.' },
        { title: 'Wet and dry both help', body: 'Some wet food adds water and gets them used to different textures.' },
      ],
    },
    {
      care: 'litter', kind: 'daily', times: ['08:00', '20:00'],
      headline: 'A low box, scooped twice a day',
      why: 'Kittens need a box with a low side they can climb into easily, close to where they spend their time.',
      points: [{ title: 'One box per cat, plus one', body: 'Several boxes in quiet places prevent accidents, especially with more than one cat.' }],
    },
    {
      care: 'play', kind: 'daily', times: ['09:00', '12:00', '16:00', '20:00'], portion: 5,
      headline: '4 short play sessions',
      why: 'Kittens learn to hunt through play. Short bursts are perfect — they sleep a lot.',
      points: [{ title: 'Toys, not hands', body: 'Use wand toys so they learn not to pounce on fingers and feet.' }],
    },
    {
      care: 'grooming', kind: 'daily', times: ['19:00'],
      headline: 'A few minutes of handling every day',
      why: 'Gently touch paws, ears and mouth with treats. Brushing, nail trims and vet visits stay easy for life.',
      points: [{ title: 'A soft brush, short sessions', body: 'One or two minutes is enough. End before they wriggle, with a reward.' }],
    },
  ],
  young: [
    {
      care: 'meal', kind: 'daily', times: ['07:30', '12:30', '18:30'],
      headline: '3 meals a day',
      why: 'Between 3 and 6 months, three meals a day suit most kittens.',
      points: [
        { title: 'Kitten food only', body: 'Keep feeding a complete kitten food. Split the daily amount on the label into 3 meals.' },
        { title: 'Weigh, don’t guess', body: 'Use the feeding chart for their current weight and check it every 2 weeks — they grow fast.' },
      ],
    },
    {
      care: 'litter', kind: 'daily', times: ['08:00', '20:00'],
      headline: 'Scoop twice a day',
      why: 'Cats are very clean. A box that is scooped often is a box they keep using.',
      points: [{ title: 'One box per cat, plus one', body: 'Several boxes in quiet places prevent accidents, especially with more than one cat.' }],
    },
    {
      care: 'play', kind: 'daily', times: ['10:00', '15:00', '20:00'], portion: 10,
      headline: '3 play sessions of about 10 minutes',
      why: 'Play is how kittens burn energy and practise hunting — and it keeps them off the curtains.',
      points: [{ title: 'Toys, not hands', body: 'Use wand toys so they learn not to pounce on fingers and feet.' }],
    },
    {
      care: 'grooming', kind: 'daily', times: ['19:00'],
      headline: 'A few minutes of handling every day',
      why: 'Keep touching paws, ears and mouth with treats so grooming and vet visits stay calm.',
      points: [{ title: 'A soft brush, short sessions', body: 'One or two minutes is enough. End before they wriggle, with a reward.' }],
    },
  ],
  junior: [
    {
      care: 'meal', kind: 'daily', times: ['08:00', '18:30'],
      headline: '2 meals a day',
      why: 'From around 6 months most cats do well on two measured meals. Keep kitten food until about 12 months unless your vet says otherwise.',
      points: [SLOW_SWITCH, { title: 'Watch the weight after neutering', body: 'Neutered cats often need less food. Ask your vet to check their weight a few months later.' }],
    },
    {
      care: 'litter', kind: 'daily', times: ['08:00', '20:00'],
      headline: 'Scoop twice a day',
      why: 'Cats are very clean. A box that is scooped often is a box they keep using.',
      points: [
        { title: 'Change it all regularly', body: 'Replace all the litter and wash the box about once a week (every 2 to 4 weeks with clumping litter).' },
        { title: 'Straining is urgent', body: 'A cat straining in the box with little or no urine needs a vet the same day — it can be an emergency.' },
      ],
    },
    {
      care: 'play', kind: 'daily', times: ['12:00', '20:00'], portion: 15,
      headline: '2 play sessions of 15 minutes',
      why: 'Hunt, catch, eat: a play session followed by a meal matches how cats like to live.',
      points: [{ title: 'End with a catch', body: 'Let them catch the toy at the end so the hunt feels complete.' }],
    },
    {
      care: 'grooming', kind: 'weekly', times: ['19:00'], days: [0, 3],
      headline: 'Brushing once or twice a week',
      why: 'Short coats need a weekly brush; long coats need it daily to prevent mats and hairballs.',
      points: [{ title: 'Nails every few weeks', body: 'Trim just the sharp tips every 2 to 4 weeks, and offer a scratching post.' }],
    },
  ],
  adult: [
    {
      care: 'meal', kind: 'daily', times: ['08:00', '18:30'],
      headline: '2 meals a day',
      why: 'Two measured meals (or the same daily amount split into small portions) keep most adult cats at a healthy weight.',
      points: [LEAN, { title: 'Wet food helps', body: 'Cats don’t drink much. Some wet food each day helps keep kidneys and bladder healthy.' }],
    },
    {
      care: 'litter', kind: 'daily', times: ['08:00', '20:00'],
      headline: 'Scoop twice a day',
      why: 'Cats are very clean. A box that is scooped often is a box they keep using.',
      points: [
        { title: 'Change it all regularly', body: 'Replace all the litter and wash the box about once a week (every 2 to 4 weeks with clumping litter).' },
        { title: 'Straining is urgent', body: 'A cat straining in the box with little or no urine needs a vet the same day — it can be an emergency.' },
      ],
    },
    {
      care: 'play', kind: 'daily', times: ['12:00', '20:00'], portion: 15,
      headline: '2 play sessions of 15 minutes',
      why: 'Indoor cats especially need daily hunting games to stay fit and calm.',
      points: [{ title: 'End with a catch', body: 'Let them catch the toy at the end so the hunt feels complete.' }],
    },
    {
      care: 'grooming', kind: 'weekly', times: ['19:00'], days: [0, 3],
      headline: 'Brushing once or twice a week',
      why: 'Short coats need a weekly brush; long coats need it daily to prevent mats and hairballs.',
      points: [{ title: 'Nails every few weeks', body: 'Trim just the sharp tips every 2 to 4 weeks, and offer a scratching post.' }],
    },
  ],
  senior: [
    {
      care: 'meal', kind: 'daily', times: ['08:00', '13:00', '19:00'],
      headline: '3 smaller meals a day',
      why: 'Older cats often eat better with smaller, more frequent meals. Ask your vet whether a senior food suits them.',
      points: [{ title: 'Weigh monthly', body: 'Weight loss is common in older cats and often the first sign of illness.' }, VET_CHANGES],
    },
    {
      care: 'litter', kind: 'daily', times: ['08:00', '20:00'],
      headline: 'An easy-to-reach box, scooped twice a day',
      why: 'Stiff joints make high sides and stairs hard. A low entry and a box on every floor help.',
      points: [{ title: 'Notice changes', body: 'Bigger clumps or going much more often can mean kidney or thyroid problems — tell your vet.' }],
    },
    {
      care: 'play', kind: 'daily', times: ['12:00', '19:00'], portion: 5,
      headline: '2 short, gentle play sessions',
      why: 'A few minutes of gentle play keeps older cats moving and curious.',
      points: [{ title: 'Low and slow', body: 'Keep toys on the floor — fewer jumps, same fun.' }],
    },
    {
      care: 'grooming', kind: 'weekly', times: ['19:00'], days: [1, 3, 5],
      headline: 'Brushing 3 times a week',
      why: 'Older cats groom themselves less. Gentle brushing keeps the coat clean and lets you check for lumps.',
      points: [{ title: 'Nails every few weeks', body: 'Older cats scratch less, so their nails can overgrow. Check them every 2 weeks.' }],
    },
  ],
};

/** The guide for a pet at this stage, in care order. */
export function guideFor(species: Species, stage: StageId): Rec[] {
  const base = (species === 'dog' ? DOG : CAT)[stage];
  const order: CareType[] = species === 'dog' ? ['meal', 'walk', 'water', 'play', 'grooming', 'medication'] : ['meal', 'water', 'litter', 'play', 'grooming', 'medication'];
  const all = [...base, water(species, stage), medication(species, stage)];
  return order.map((c) => all.find((r) => r.care === c)).filter((r): r is Rec => !!r);
}

/** Every English string in the guide (for the translation tools). */
export function allGuideStrings(): string[] {
  const out = new Set<string>();
  for (const sp of ['dog', 'cat'] as Species[]) {
    for (const st of ['baby', 'young', 'junior', 'adult', 'senior'] as StageId[]) {
      out.add(STAGE_LABEL[sp][st]);
      for (const r of guideFor(sp, st)) {
        out.add(r.headline);
        out.add(r.why);
        for (const p of r.points) {
          out.add(p.title);
          out.add(p.body);
        }
      }
    }
  }
  return [...out];
}
