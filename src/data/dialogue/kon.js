// Kon コン, the night-market vendor on Do evenings. Playful, riddling, very fond of fried tofu.
// Secretly a kitsune; the secret comes out slowly, in heart events.
export default {
  intro: '[happy] A customer at my little lamp! How lucky. I am Kon. I sell things that are hard to find, at night, to people who are awake. Are you awake? You look awake.',
  tiers: [
    [
      'Only on Do nights. By day I am... elsewhere. Sleeping. Being elsewhere.',
      '[happy] Rare seeds, strange stones, a charm or two. Nothing illegal. Nothing quite legal either.',
      'Your shadow is very well behaved. Mine wanders.',
      'Okiku\'s inari are the best in the valley. Do not tell her I said so. Do not tell her I exist.',
      '[neutral] Prices change with the moon. Tonight the moon is generous. Probably.',
      'I heard a rumour that a fox lives in the Hollow Grove. Silly. Foxes live everywhere.',
    ],
    [
      'You came back to my lamp! I knew you would. I did not know. I hoped. Foxes hope, you know.',
      '[happy] Here, a riddle. What walks on the shrine steps at midnight and leaves no tracks? ...You. If you are careful.',
      'Sakuya thinks I cheat at trading. I do not cheat. I simply know things.',
      'I like your farm. It smells of rice and effort. My two favourite smells.',
      '[neutral] The shrine used to put out fried tofu at New Year. Nobody does now. The foxes are very hungry. So I hear.',
      'Tomoe looks at me strangely. Shrine maidens are very perceptive. It is inconvenient.',
    ],
    [
      '[sad] The mountain is sick. Something old and angry is leaning on the seals. The small spirits feel it first.',
      'I have been in this valley longer than you would believe. Longer than the bridge. Longer than the shrine.',
      '[happy] You left fried tofu at the Hollow Grove shrine. Somebody enjoyed it very much. Thank you, from that somebody.',
      'I do not sell things to people who would misuse them. I can always tell. The eyes, you know.',
      'Jirōbei used to buy a charm from me every year. For the fields. He never asked what was in it. It was hope.',
      '[neutral] If I told you a secret, would you keep it? Think carefully. Foxes can tell a lie from very far away.',
    ],
    [
      '[neutral] Yes. I am what you think I am. One tail, not nine. I am very young for a fox.',
      '[sad] When the shrine went quiet, many of us left. I stayed. Somebody had to watch the valley.',
      'The spirits in the mine are not evil. They are frightened, and something is feeding their fear.',
      '[happy] You did not run when you knew. Most people run. Or try to sell me to a travelling show.',
      'On Hyakki Yagyō night I walk in the parade. You could walk beside me, if you like.',
      'My lamp burns without oil. Please do not tell Chōbei; he will want to sell it.',
    ],
    [
      '[happy] {name}. I have decided you are my person. Foxes do this. It is very serious and you cannot refuse.',
      'I will watch your fields at night. Nothing will trouble them. Not crows, not blights, not magistrates.',
      'When you are very old, I will still be very young. I will tell stories about you to other foxes.',
      '[happy] Here. One of my whiskers, wrapped in paper. Keep it. If you are ever lost, it will point home.',
      'The shrine is waking. I can feel it. Because of you. The valley has not felt this warm in a hundred years.',
      'Thank you for seeing me. Not the lamp, not the goods. Me.',
    ],
  ],
  when: [
    { season: 'autumn', text: '[happy] Autumn nights are long. My favourite. More night, more market.' },
    { season: 'winter', text: 'Snow makes the lamp glow twice. Once in the air, once on the ground.' },
    { rain: true, text: 'Rain on the paper lamp. It does not go out. It never goes out. Curious, is it not?' },
    { flag: 'restored_kodama', text: '[happy] The kodama are back on the shrine hill! They are terrible gossips. I adore them.' },
    { weekday: 5, text: 'Do night! Market night! The best night. Everyone else is asleep, which makes us the whole world.' },
    { flag: 'hyakki_seen', text: 'You saw the parade. Now you know what walks at night. Do not be frightened. Most of us are friendly.' },
  ],
  gift: {
    loved: '[happy] Fried tofu! Oh, oh, you understand me completely. I am going to eat it very rudely right now.',
    liked: '[happy] How kind! I shall keep this somewhere very secret.',
    neutral: 'A gift at night is a gift twice. Thank you.',
    disliked: '[neutral] Iron is... uncomfortable. For me. For some people. For foxes, I hear.',
    hated: '[angry] That draught is for wounds of the flesh. It stings things that are not quite flesh. Take it away, please.',
  },
  birthday: '[happy] A birthday gift! I have had so many birthdays that I stopped counting. You have given me a reason to start again.',
};
