// Courting and marriage. `court`: taking the Red Thread; `vow`: taking the Shrine Vow; `spouse`:
// what they say once you share the farmhouse (half the time; the rest are their usual lines).
// Romance is never gated by the player's gender.
export const ROMANCE = {
  tomoe: {
    court: '[surprised] A red thread. For me? ...The kami tie these between people who are meant to meet. I will wear it on my wrist, where I can see it while I sweep.',
    vow: '[happy] I have written vows for other people all my life. I never let myself imagine writing my own. Yes. Yes, with all of the shrine as witness.',
    spouse: [
      '[happy] I left rice out by the cedar on our farm too. Something ate it. I choose to believe in kodama.',
      'I will go up to the shrine after breakfast. Come and sweep with me later? The leaves like you.',
      '[happy] You snore a little. Like a very small temple bell. I do not mind.',
      'I blessed the fields at dawn. Do not tell the magistrate; he will tax the blessing.',
      '[neutral] The house feels like a shrine in the morning. Quiet, and swept, and waiting for someone.',
      '[happy] Welcome home. I say it every day because every day it is still a little bit of a miracle.',
    ],
  },
  ume: {
    court: '[surprised] ...A red thread. Is this a joke? It is not a joke. Your face is doing the serious thing. Fine. Fine! Yes. Do not make me say it twice.',
    vow: '[happy] You want to marry the sharpest tongue in Yamabuki. On purpose. ...I accept, before you come to your senses.',
    spouse: [
      '[neutral] Drink this. It is for your back. No, I do not care that it tastes of bark.',
      '[happy] I planted mugwort by the door. For luck, and for your cuts, which you keep getting.',
      'Yuzu came by to gossip. I let her. I am becoming soft. It is your fault.',
      '[happy] You came home without a single bruise. Suspicious. Come here and let me check.',
      'The herbs on the windowsill are for cooking. The ones in the blue jar are for enemies. Do not mix them up.',
      '[happy] I sleep better with you in the house. That is a medical observation. Nothing more.',
    ],
  },
  daigo: {
    court: '[happy] A red thread! For me? Ha! I will tie it to the ferry pole so the whole river knows! No? Just my wrist? Fine. The wrist. The whole river will know anyway.',
    vow: '[happy] Yes! Yes! I have to tell someone. I have to tell everyone. I am going to row to every house in the valley and tell them!',
    spouse: [
      '[happy] Good morning! I caught breakfast. It is a fish. It is always a fish. You married a fisherman!',
      'I told Kinta you are the bravest farmer in Shinano. He already knew. I told him again.',
      '[happy] Let us go out on the river tonight. No talking. You know I can manage it now.',
      'The ferry is quiet without me some days. I like being quiet here better.',
      '[neutral] I checked the pond. Your carp are fat and happy. So am I.',
      '[happy] Taichi would have liked you. He would have told you all my embarrassing stories. I will tell them instead.',
    ],
  },
  kaito: {
    court: '[surprised] You... me? Hah! I mean... yes. Obviously yes. I knew it. I did not know it. Yes.',
    vow: '[happy] Marry you. Me. The paddy by the river. I would not trade this for all of Edo. I checked. I asked the map.',
    spouse: [
      '[happy] Our rice is taller than my old rice. Do not tell my old rice.',
      'I still read the Edo map sometimes. Then I look out of the window and put it away.',
      '[happy] Race you to the well! Loser cooks. ...You cheated. You did not cheat. I cook.',
      'The persimmon tree we planted has a leaf now. One leaf. I talked to it.',
      '[neutral] My mother says you are the best thing that ever happened to our family. She is correct.',
      '[happy] I love this farm. I love the mud. I love that you are in the mud. That came out wrong.',
    ],
  },
  soken: {
    court: '[surprised] A red thread, for a monk. ...I took vows once, long ago, of the kind that do not forbid this. I have checked, just now, very quickly. Yes.',
    vow: '[happy] I have renounced a great many things. I find I cannot renounce you. The Buddha will understand. He was very understanding.',
    spouse: [
      '[happy] I lit a candle for the house this morning. The house did not ask. It seemed pleased.',
      'Breathe in for four. You are rushing. The weeds will still be there.',
      '[happy] I wrote another bad poem. It is about your elbow. I will not read it to you.',
      'Sometimes I wake and forget where I am. Then I hear you breathing and remember I am home.',
      '[neutral] The helmet is in the tansu now. With the winter blankets. It seemed right.',
      '[happy] Tea is ready. It is slightly too hot. It is teaching us patience together.',
    ],
  },
  rin: {
    court: '[surprised] ...A red thread. You know I am the kind who leaves. You are asking anyway. Then I am the kind who stays. Yes.',
    vow: '[happy] Yes. I have said yes to very few things in my life. This one I would say at the point of a sword.',
    spouse: [
      '[neutral] I walked the farm\'s edge at dawn. Nothing came near. Nothing will.',
      '[happy] I planted the slow thing. It came up. I watched it for an hour.',
      'My sword is on the wall. It sleeps like a cat now. So do I.',
      '[happy] Draw with me before breakfast. Not a duel. Just the drawing. It is better with two.',
      'Kinta wants lessons again. I said after his chores. I have become a mother of some kind.',
      '[neutral] I do not look at the road anymore. I look at the door, for you.',
    ],
  },
  tatsu: {
    court: '[surprised] ...Red thread. For me. I... measured this conversation many times. It never went like this. It went better like this. Yes.',
    vow: '[happy] I built this house bigger for two. I pretended it was for you and someone. It was for you and me. Yes.',
    spouse: [
      '[neutral] I fixed the sticking door. It slides true now. It was bothering me in my sleep.',
      '[happy] I made you a box. For nothing in particular. It closes very well.',
      'The porch is almost finished. Then we sit on it. That is the whole plan.',
      '[happy] You left your tools out in the rain. I oiled them. Do not do it again. Do it again, I like oiling them.',
      'Every morning I check the joint by the hearth. Still there. So are you.',
      '[neutral] I am not good with words. I am good with you. That is the same thing, I think.',
    ],
  },
  yuzu: {
    court: '[surprised] A red thread! For me? From you? Oh, I am telling EVERYONE. No, I will not. Yes I will. Yes!',
    vow: '[happy] Yes! A thousand times! The bathhouse will close for three days and I will charge nobody for anything!',
    spouse: [
      '[happy] The bath is hot and the gossip is fresh! Both for you, for free, forever.',
      'I heard Chōbei is secretly writing poetry. I heard it from Chōbei. He tells me things now that I am respectable.',
      '[happy] You smell like soil and I smell like yuzu. Together we smell like dinner.',
      'One day we will see the sea. Until then I pour a little salt in the bath and pretend.',
      '[neutral] Tatsu came to check the tub. I told him we are fine. He checked anyway.',
      '[happy] My favourite rumour is still that I married the best farmer in Yamabuki. It is also true.',
    ],
  },
  sakuya: {
    court: '[surprised] You are giving me a red thread. For nothing. No price, no bargain. ...I accept. And I have never accepted anything without haggling in my life.',
    vow: '[happy] A merchant who stops. Who marries. Who stays. Yes. I have sold my cart. Well. I have lent it to someone.',
    spouse: [
      '[happy] I went to the market today as a customer. It was terrifying. I bought daikon. We grow daikon!',
      'I keep the accounts for the farm now. You were being robbed, gently, by everyone. It has stopped.',
      '[happy] The hairpin is still in my hair. I check it every morning, like a coin in my sleeve.',
      'Sometimes I miss the road. Then I remember the road never made supper.',
      '[neutral] Kuroda\'s clerks tried to buy our rice at a bad price. I made them buy it at a good one. You are welcome.',
      '[happy] I stopped counting days. I count mornings with you now. It is a much better number.',
    ],
  },
};

// Said when someone you could court is handed a Red Thread too early, or a Shrine Vow before you are ready.
export const NOT_YET = {
  court: '[surprised] A red thread? That is... sweet. But we do not know each other that well yet.',
  vowHearts: '[neutral] A vow. Not yet. Ask me again when you are sure. When we are both sure.',
  vowHouse: '[happy] Yes, in my heart. But where would we live? Your farmhouse is barely big enough for your boots. Talk to Tatsu.',
  other: '[neutral] A charm like that is for someone special. I am flattered, but it is not meant for me.',
  taken: '[sad] You are already courting someone. The thread is not a thing to tie twice.',
};
