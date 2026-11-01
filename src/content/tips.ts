/**
 * Short care tips shown as swipeable cards in the Home feed. General everyday guidance only —
 * never a diagnosis; anything health-related points to the vet.
 */
import { Species } from '../domain/care';
import { pickL } from '../i18n/core';

type L = { en: string; fr: string };
export type Tip = { id: string; species: Species[]; color: string; tint: string; kicker: L; title: L; slides: { title: L; body: L }[]; pro: boolean };

export const TIPS: Tip[] = [
  {
    id: 'water', species: ['dog', 'cat'], color: '#0C8FD1', tint: '#DDF3FE', pro: false,
    kicker: { en: 'Daily habit', fr: 'Habitude' }, title: { en: 'Fresh water, every day', fr: 'De l’eau fraîche, chaque jour' },
    slides: [
      { title: { en: 'Change it, don’t top it up', fr: 'Changez-la, ne complétez pas' }, body: { en: 'Empty, rinse and refill the bowl at least once a day. Old water collects dust and saliva.', fr: 'Videz, rincez et remplissez la gamelle au moins une fois par jour. L’eau stagnante accumule poussière et salive.' } },
      { title: { en: 'Wash the bowl', fr: 'Lavez la gamelle' }, body: { en: 'A quick wash with hot water and a little dish soap a few times a week keeps slime away.', fr: 'Un lavage à l’eau chaude et un peu de liquide vaisselle quelques fois par semaine évite le dépôt glissant.' } },
      { title: { en: 'More bowls, more sips', fr: 'Plus de gamelles, plus de gorgées' }, body: { en: 'Many pets drink more with a second bowl in another room — cats often prefer it away from their food.', fr: 'Beaucoup d’animaux boivent plus avec une deuxième gamelle dans une autre pièce — les chats la préfèrent souvent loin de leur repas.' } },
    ],
  },
  {
    id: 'walk-sniff', species: ['dog'], color: '#3E8E17', tint: '#E6F7DA', pro: false,
    kicker: { en: 'Walks', fr: 'Balades' }, title: { en: 'Let them sniff', fr: 'Laissez-le renifler' },
    slides: [
      { title: { en: 'Sniffing is exercise for the brain', fr: 'Renifler fait travailler le cerveau' }, body: { en: 'A slow walk with time to sniff can tire a dog out as much as a fast one.', fr: 'Une balade lente avec du temps pour renifler fatigue autant qu’une balade rapide.' } },
      { title: { en: 'Mix up the route', fr: 'Variez le parcours' }, body: { en: 'New streets mean new smells. Even reversing your usual loop makes it more interesting.', fr: 'Nouvelles rues, nouvelles odeurs. Même faire votre boucle à l’envers la rend plus intéressante.' } },
      { title: { en: 'Mind the pavement', fr: 'Attention au bitume' }, body: { en: 'On hot days, put your hand on the ground for 5 seconds. Too hot for you is too hot for paws.', fr: 'Par forte chaleur, posez la main au sol 5 secondes. Trop chaud pour vous, trop chaud pour ses coussinets.' } },
    ],
  },
  {
    id: 'cat-play', species: ['cat'], color: '#E2477C', tint: '#FFE6EF', pro: false,
    kicker: { en: 'Play', fr: 'Jeu' }, title: { en: 'Play like a hunter', fr: 'Jouez comme un chasseur' },
    slides: [
      { title: { en: 'Short and often', fr: 'Court et souvent' }, body: { en: 'Two or three 10-minute sessions a day suit most cats better than one long one.', fr: 'Deux ou trois séances de 10 minutes par jour conviennent mieux à la plupart des chats qu’une longue.' } },
      { title: { en: 'Stalk, chase, catch', fr: 'Guetter, poursuivre, attraper' }, body: { en: 'Move the toy like prey — away from your cat, hiding behind things — and let them catch it at the end.', fr: 'Faites bouger le jouet comme une proie — en s’éloignant, en se cachant — et laissez-le l’attraper à la fin.' } },
      { title: { en: 'End with a snack', fr: 'Terminez par une friandise' }, body: { en: 'A small treat or meal after play completes the hunt and helps them settle.', fr: 'Une petite friandise ou un repas après le jeu termine la chasse et aide à se calmer.' } },
    ],
  },
  {
    id: 'brush', species: ['dog', 'cat'], color: '#7C5CE6', tint: '#EEE8FE', pro: false,
    kicker: { en: 'Grooming', fr: 'Toilettage' }, title: { en: 'Make brushing a treat', fr: 'Faire du brossage un plaisir' },
    slides: [
      { title: { en: 'Start tiny', fr: 'Commencez petit' }, body: { en: 'A few strokes, a reward, done. Build up the time over days instead of one long session.', fr: 'Quelques coups de brosse, une récompense, terminé. Allongez sur plusieurs jours plutôt qu’en une fois.' } },
      { title: { en: 'Check as you go', fr: 'Vérifiez en passant' }, body: { en: 'Brushing is a good moment to notice lumps, ticks or sore spots. Anything new? Ask your vet.', fr: 'Le brossage est le bon moment pour repérer bosses, tiques ou zones sensibles. Quelque chose de nouveau ? Demandez à votre vétérinaire.' } },
      { title: { en: 'Same time, same place', fr: 'Même heure, même endroit' }, body: { en: 'A routine makes it predictable — add a brushing routine in Care to get a reminder.', fr: 'Une routine rend le moment prévisible — ajoutez une routine de brossage dans Soins pour un rappel.' } },
    ],
  },
  {
    id: 'meals', species: ['dog', 'cat'], color: '#C77800', tint: '#FFF1DC', pro: true,
    kicker: { en: 'Meals', fr: 'Repas' }, title: { en: 'Regular meal times', fr: 'Des repas à heure fixe' },
    slides: [
      { title: { en: 'Predictable is calming', fr: 'Prévisible, c’est rassurant' }, body: { en: 'Feeding at the same times each day helps many pets feel settled.', fr: 'Nourrir aux mêmes heures chaque jour aide beaucoup d’animaux à se sentir en confiance.' } },
      { title: { en: 'Measure it', fr: 'Mesurez' }, body: { en: 'Use a scale or measuring cup rather than guessing — portions creep up over time.', fr: 'Utilisez une balance ou un verre doseur plutôt qu’à l’œil — les portions augmentent sans qu’on s’en rende compte.' } },
      { title: { en: 'Count the treats', fr: 'Comptez les friandises' }, body: { en: 'Treats add up. Your vet can tell you a sensible daily amount for your pet.', fr: 'Les friandises s’additionnent. Votre vétérinaire peut vous indiquer une quantité raisonnable.' } },
    ],
  },
  {
    id: 'weigh', species: ['dog', 'cat'], color: '#2F9E44', tint: '#E3F6E7', pro: true,
    kicker: { en: 'Health', fr: 'Santé' }, title: { en: 'Why weigh regularly', fr: 'Pourquoi peser régulièrement' },
    slides: [
      { title: { en: 'Changes are gradual', fr: 'Les changements sont lents' }, body: { en: 'Day to day you won’t see a difference. A monthly weigh-in shows the trend.', fr: 'D’un jour à l’autre, on ne voit rien. Une pesée mensuelle montre la tendance.' } },
      { title: { en: 'Same scale, same time', fr: 'Même balance, même moment' }, body: { en: 'Weigh at the same time of day for comparable numbers. Small pets: weigh yourself holding them, then subtract.', fr: 'Pesez au même moment de la journée. Petit animal : pesez-vous en le portant, puis soustrayez.' } },
      { title: { en: 'Bring the chart', fr: 'Montrez la courbe' }, body: { en: 'Share your care summary from Records at the next vet visit — they’ll know what the trend means.', fr: 'Partagez le résumé depuis Dossiers lors de la prochaine visite — le vétérinaire saura interpréter la tendance.' } },
    ],
  },
  {
    id: 'litter', species: ['cat'], color: '#8A5A34', tint: '#F4E9DF', pro: true,
    kicker: { en: 'Litter', fr: 'Litière' }, title: { en: 'A box they love', fr: 'Une litière qu’il adore' },
    slides: [
      { title: { en: 'Scoop daily', fr: 'Ramassez chaque jour' }, body: { en: 'Most cats prefer a clean box. Daily scooping keeps them using it.', fr: 'La plupart des chats préfèrent une litière propre. Ramasser chaque jour les encourage à l’utiliser.' } },
      { title: { en: 'Quiet spot', fr: 'Un coin calme' }, body: { en: 'Away from loud appliances and their food, with an easy way in and out.', fr: 'Loin des appareils bruyants et de la nourriture, facile d’accès.' } },
      { title: { en: 'Notice changes', fr: 'Remarquez les changements' }, body: { en: 'Going more or less often than usual is worth a call to your vet.', fr: 'Y aller beaucoup plus ou moins souvent que d’habitude mérite un appel au vétérinaire.' } },
    ],
  },
  {
    id: 'calm', species: ['dog', 'cat'], color: '#0E9AA5', tint: '#DDF6F7', pro: true,
    kicker: { en: 'Wellbeing', fr: 'Bien-être' }, title: { en: 'A calm corner', fr: 'Un coin tranquille' },
    slides: [
      { title: { en: 'Everyone needs a hideout', fr: 'Chacun a besoin d’un refuge' }, body: { en: 'A bed or box in a quiet spot gives your pet somewhere to retreat when the house is busy.', fr: 'Un panier ou un carton dans un coin calme offre un refuge quand la maison s’agite.' } },
      { title: { en: 'Leave them be', fr: 'Laissez-le tranquille' }, body: { en: 'When they go there, let them rest — especially with visitors and kids.', fr: 'Quand il s’y installe, laissez-le se reposer — surtout avec des invités et des enfants.' } },
      { title: { en: 'Familiar smells', fr: 'Des odeurs familières' }, body: { en: 'An old T-shirt of yours in the bed can be comforting.', fr: 'Un vieux t-shirt à vous dans le panier peut être réconfortant.' } },
    ],
  },
];

export const tipText = (l: L) => pickL(l);
