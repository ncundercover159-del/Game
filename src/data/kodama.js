// Kodama (木霊), the tree spirits who come back to the shrine hill with the Altar of Chūgi. At dusk
// one waits among the cedars along the stair. Give it something from the forest (or rice) and it
// follows you home to a hokora on your farm, where it tends the crops around it every night.
export const KODAMA = {
  max: 5,                         // friends in all
  radius: 3,                      // a kodama waters a 7x7 square around its hokora
  hours: [17 * 60, 22 * 60],      // when one waits on the shrine stair
  // Where it waits: at the foot of a cedar beside the stair, or under the sacred tree.
  spots: [[15, 18], [24, 19], [15, 24], [24, 27], [15, 30], [24, 33], [15, 36], [24, 40], [9, 10]],
};

// What a kodama at home says when you visit (a wooden rattle, mostly; Tsukikage translates).
export const KODAMA_LINES = [
  'The kodama rattles its head at you: karakara, karakara. It seems pleased with the radishes.',
  'The kodama is asleep in the hokora doorway, snoring like a cricket.',
  'The kodama has lined up seven pebbles in front of its shrine. It will not say why.',
  'The kodama tilts its head, then tilts it the other way. Tsukikage: "It says your watering is adequate. For a human."',
  'The kodama is watching a beetle with enormous concentration.',
  'The kodama pats the soil of the nearest bed twice, firmly, as if tucking it in.',
];
