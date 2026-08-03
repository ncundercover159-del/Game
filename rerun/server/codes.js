import { CODE_ALPHABET } from '../shared/constants.js';

/** 4 characters, no ambiguous glyphs, checked against live rooms. */
export function makeCode(rooms) {
  for (let attempt = 0; attempt < 400; attempt++) {
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += CODE_ALPHABET[(Math.random() * CODE_ALPHABET.length) | 0];
    }
    if (!rooms.has(code)) return code;
  }
  // 923k possibilities; if we get here the party is over anyway.
  let code;
  do {
    code = '';
    for (let i = 0; i < 5; i++) code += CODE_ALPHABET[(Math.random() * CODE_ALPHABET.length) | 0];
  } while (rooms.has(code));
  return code;
}
