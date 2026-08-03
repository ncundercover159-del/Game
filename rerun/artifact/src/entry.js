// Single-file solo build. Pulls in the whole client, then the solo-only
// chrome on top so its rules win the cascade.
import '../../client/src/main.js';
import './solo.css';
