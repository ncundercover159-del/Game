'use strict';

/* Screens, dialogs, the level map and the in-game HUD. */
const UI = {
  MAX_LEVEL: 60,
  CONTINUE_COST: 900,
  REFILL_COST: 600,

  BOOSTERS: [
    { type: 'hammer', icon: 'hammer', name: 'Hammer', cost: 50, hint: 'Tap any tile to smash it' },
    { type: 'rocket', icon: 'rocketV', name: 'Rocket', cost: 150, hint: 'Turn a gem into a rocket' },
    { type: 'tnt', icon: 'tnt', name: 'TNT', cost: 250, hint: 'Turn a gem into TNT' },
  ],

  game: null,
  goalNodes: [],
  currentLevel: 1,
  _toastTimer: null,

  coinText(n) { return '<span class="coin">●</span> ' + Utils.formatNumber(n); },

  init() {
    this.screens = {
      home: document.getElementById('screen-home'),
      game: document.getElementById('screen-game'),
    };
    this.els = {
      coins: document.getElementById('coins-value'),
      lives: document.getElementById('lives-value'),
      livesTimer: document.getElementById('lives-timer'),
      livesPill: document.getElementById('lives-pill'),
      map: document.getElementById('level-map'),
      playBtn: document.getElementById('btn-play'),
      playLevel: document.getElementById('btn-play-level'),
      settings: document.getElementById('btn-settings'),
      back: document.getElementById('btn-back'),
      moves: document.getElementById('moves-value'),
      score: document.getElementById('score-value'),
      levelChip: document.getElementById('level-chip'),
      goals: document.getElementById('goals'),
      boosters: document.getElementById('boosters'),
      banner: document.getElementById('board-banner'),
      overlay: document.getElementById('overlay'),
      dialog: document.getElementById('dialog'),
      toast: document.getElementById('toast'),
      canvas: document.getElementById('board'),
      offers: document.getElementById('home-offers'),
    };

    this.game = new Game(this.els.canvas, {
      onHud: (s) => this.updateHud(s),
      onGoal: (g) => this.bumpGoal(g),
      onBanner: (t) => this.banner(t),
      onToast: (t) => this.toast(t),
      onWin: (r) => this.showWin(r),
      onLose: (r) => this.showLose(r),
      onBoosterUsed: (type) => this.payForBooster(type),
      onBoosterDone: () => this.clearArmedBooster(),
    });

    this.els.playBtn.addEventListener('click', () => {
      SFX.resume(); SFX.button();
      this.openLevelDialog(Math.min(Store.data.level, this.MAX_LEVEL));
    });
    this.els.settings.addEventListener('click', () => { SFX.button(); this.showSettings(); });
    this.els.back.addEventListener('click', () => { SFX.button(); this.confirmQuit(); });
    this.els.livesPill.addEventListener('click', () => { SFX.button(); this.showLives(); });

    this.buildBoosters();
    this.buildMap();
    this.buildOffers();
    this.refreshTop();
    setInterval(() => this.refreshTop(), 1000);

    // Keep the canvas sized correctly when the mobile browser chrome moves.
    window.addEventListener('orientationchange', () => setTimeout(() => this.game.resize(), 250));
  },

  // ------------------------------------------------------------- screens

  showScreen(name) {
    for (const key in this.screens) this.screens[key].classList.toggle('is-active', key === name);
    // A banner belongs on the map, never over the board.
    if (name === 'home') Ads.showBanner();
    else Ads.hideBanner();
  },

  refreshTop() {
    const lives = Store.lives();
    this.els.coins.textContent = Utils.formatNumber(Store.coins());
    this.els.lives.textContent = lives;
    if (lives >= Store.MAX_LIVES) {
      this.els.livesTimer.textContent = 'full';
    } else {
      this.els.livesTimer.textContent = Utils.formatTime(Store.msToNextLife());
    }
    this.els.playLevel.textContent = 'Level ' + Math.min(Store.data.level, this.MAX_LEVEL);
    this.refreshOffers();
  },

  // ------------------------------------------------------------ level map

  buildMap() {
    const map = this.els.map;
    map.innerHTML = '';
    for (let i = 1; i <= this.MAX_LEVEL; i++) {
      const unlocked = Store.isUnlocked(i);
      const stars = Store.starsFor(i);
      const isCurrent = i === Store.data.level;

      const node = Utils.el('button', 'map-node' + (unlocked ? '' : ' locked') + (isCurrent ? ' current' : ''));
      node.textContent = unlocked ? i : '\u{1F512}';
      node.dataset.level = i;
      // gentle S-curve so the map reads as a path
      const offset = Math.sin(i * 0.8) * 76;
      node.style.transform = `translateX(${offset.toFixed(1)}px)`;

      if (unlocked) {
        const starWrap = Utils.el('span', 'stars');
        for (let s = 0; s < 3; s++) starWrap.appendChild(Utils.el('i', s < stars ? 'on' : '', '★'));
        node.appendChild(starWrap);
        node.addEventListener('click', () => { SFX.button(); this.openLevelDialog(i); });
      }
      map.appendChild(node);

      if (i < this.MAX_LEVEL) {
        const dots = Utils.el('div', 'map-dots');
        const mid = (offset + Math.sin((i + 1) * 0.8) * 76) / 2;
        dots.style.transform = `translateX(${mid.toFixed(1)}px)`;
        dots.innerHTML = '<i></i><i></i><i></i>';
        map.appendChild(dots);
      }
    }
    // park the view on the level the player is up to
    requestAnimationFrame(() => {
      const current = map.querySelector('.map-node.current') || map.querySelector('.map-node');
      if (current) map.scrollTop = Math.max(0, current.offsetTop - map.clientHeight / 2);
    });
  },

  // --------------------------------------------------------------- offers

  /* Two entry points on the home screen: a rewarded-video coin top-up, and
   * the Remove Ads purchase (which disappears once owned). */
  buildOffers() {
    const wrap = this.els.offers;
    if (!wrap) return;
    wrap.innerHTML = '';

    this.freeCoinsBtn = Utils.el('button', 'offer-btn');
    this.freeCoinsBtn.innerHTML = '<span class="offer-icon">▶</span><span class="offer-text">'
      + '<b>Free Coins</b><i id="free-coins-sub">Watch an ad</i></span>';
    this.freeCoinsBtn.addEventListener('click', () => { SFX.button(); this.watchForCoins(); });
    wrap.appendChild(this.freeCoinsBtn);

    this.removeAdsBtn = Utils.el('button', 'offer-btn offer-buy');
    this.removeAdsBtn.addEventListener('click', () => { SFX.button(); this.buyRemoveAds(); });
    wrap.appendChild(this.removeAdsBtn);

    this.refreshOffers();
  },

  refreshOffers() {
    if (!this.els.offers) return;

    if (this.freeCoinsBtn) {
      const wait = Store.msToFreeCoins();
      const sub = document.getElementById('free-coins-sub');
      if (sub) sub.textContent = wait > 0 ? 'Ready in ' + Utils.formatTime(wait) : 'Watch an ad';
      this.freeCoinsBtn.disabled = wait > 0;
      this.freeCoinsBtn.classList.toggle('hidden', !AdConfig.enabled);
    }

    if (this.removeAdsBtn) {
      const owned = IAP.owned;
      this.removeAdsBtn.classList.toggle('hidden', owned || !IapConfig.enabled);
      this.removeAdsBtn.innerHTML = '<span class="offer-icon">✦</span><span class="offer-text">'
        + '<b>Remove Ads</b><i>' + IAP.priceString() + '</i></span>';
    }
  },

  async watchForCoins() {
    if (Store.msToFreeCoins() > 0) return;
    const watched = await Ads.showRewarded();
    if (!watched) return;
    Store.noteFreeCoins();
    Store.addCoins(AdConfig.rewards.freeCoins);
    SFX.coin();
    this.refreshTop();
    this.toast('+' + AdConfig.rewards.freeCoins + ' coins!');
  },

  async buyRemoveAds() {
    const ok = await IAP.buy();
    if (ok && IAP.owned) this.onAdsRemoved();
  },

  /* Called after a successful purchase or restore. */
  onAdsRemoved() {
    Ads.hideBanner();
    this.refreshTop();
    this.refreshOffers();
    this.toast('Ads removed — thank you!');
  },

  /* Between-levels ad, run on the way out of a finished level. */
  async levelTransition(next) {
    await Ads.maybeShowInterstitial();
    next();
  },

  // -------------------------------------------------------------- dialogs

  dialog(config) {
    const d = this.els.dialog;
    d.innerHTML = '';
    if (config.title) d.appendChild(Utils.el('h2', '', config.title));
    if (config.body) {
      const body = Utils.el('div');
      if (typeof config.body === 'string') body.innerHTML = config.body;
      else body.appendChild(config.body);
      d.appendChild(body);
    }
    if (config.buttons && config.buttons.length) {
      const actions = Utils.el('div', 'actions' + (config.row ? ' row' : ''));
      for (const b of config.buttons) {
        const btn = Utils.el('button', 'btn ' + (b.cls || ''), b.label);
        if (b.disabled) btn.disabled = true;
        btn.addEventListener('click', () => {
          SFX.button();
          if (b.keepOpen !== true) this.closeDialog();
          if (b.onClick) b.onClick();
        });
        actions.appendChild(btn);
      }
      d.appendChild(actions);
    }
    this.els.overlay.classList.remove('hidden');
    if (this.game) this.game.paused = true;
    return d;
  },

  closeDialog() {
    this.els.overlay.classList.add('hidden');
    if (this.game) this.game.paused = false;
  },

  toast(text) {
    const t = this.els.toast;
    t.textContent = text;
    t.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.add('hidden'), 1600);
  },

  banner(text) {
    const b = this.els.banner;
    if (!text) { b.classList.add('hidden'); return; }
    b.textContent = text;
    b.classList.remove('hidden');
  },

  // --------------------------------------------------------- level start

  goalStrip(goals, size) {
    const wrap = Utils.el('div', 'dlg-goals');
    for (const g of goals) {
      const item = Utils.el('div', 'dlg-goal');
      item.appendChild(Levels.goalIcon(g, size || 42));
      item.appendChild(Utils.el('span', '', String(g.count)));
      wrap.appendChild(item);
    }
    return wrap;
  },

  openLevelDialog(id) {
    const level = Levels.get(id);
    const stars = Store.starsFor(id);
    const best = Store.bestFor(id);

    const body = Utils.el('div');
    body.appendChild(Utils.el('p', '', 'Clear the goals in <b>' + level.moves + ' moves</b>.'));
    body.appendChild(this.goalStrip(level.goals));
    const starRow = Utils.el('div', 'dlg-stars');
    for (let i = 0; i < 3; i++) starRow.appendChild(Utils.el('i', i < stars ? 'on' : '', '★'));
    body.appendChild(starRow);
    if (best) body.appendChild(Utils.el('p', '', 'Best score: <b>' + Utils.formatNumber(best) + '</b>'));

    this.dialog({
      title: 'Level ' + id,
      body,
      buttons: [
        { label: 'Play', cls: 'btn-green', onClick: () => this.startLevel(id) },
        { label: 'Back', cls: 'btn-ghost' },
      ],
    });
  },

  startLevel(id) {
    if (Store.lives() <= 0) { this.showLives(); return; }
    if (!Store.spendLife()) { this.showLives(); return; }
    this.refreshTop();
    this.currentLevel = id;
    this.clearArmedBooster();
    this.showScreen('game');
    this.els.levelChip.textContent = 'Level ' + id;
    this.buildGoals(Levels.get(id));
    // wait for the layout to settle before measuring the board area
    requestAnimationFrame(() => {
      this.game.start(id);
      requestAnimationFrame(() => this.game.resize());
    });
  },

  confirmQuit() {
    if (this.game.state === 'over') { this.quitToMap(); return; }
    this.dialog({
      title: 'Leave level?',
      body: '<p>Your progress in this level will be lost.</p>',
      row: true,
      buttons: [
        { label: 'Stay', cls: 'btn-ghost' },
        { label: 'Leave', cls: 'btn-red', onClick: () => this.quitToMap() },
      ],
    });
  },

  quitToMap() {
    this.game.state = 'idle';
    this.game.stop();
    this.banner(null);
    this.clearArmedBooster();
    this.buildMap();
    this.refreshTop();
    this.showScreen('home');
  },

  // ------------------------------------------------------------- in-game

  buildGoals(level) {
    const wrap = this.els.goals;
    wrap.innerHTML = '';
    this.goalNodes = [];
    for (const goal of level.goals) {
      const node = Utils.el('div', 'goal');
      node.appendChild(Levels.goalIcon(goal, 28));
      const count = Utils.el('span', 'count', String(goal.count));
      node.appendChild(count);
      wrap.appendChild(node);
      this.goalNodes.push({ goal, node, count });
    }
  },

  updateHud(state) {
    this.els.moves.textContent = state.moves;
    this.els.moves.classList.toggle('low', state.moves <= 5);
    this.els.score.textContent = Utils.formatNumber(state.score);
    for (const entry of this.goalNodes) {
      const g = state.goals.find(x => x.type === entry.goal.type && x.color === entry.goal.color) || entry.goal;
      const left = Math.max(0, g.count - g.done);
      if (left === 0) {
        entry.count.textContent = '✓';
        entry.count.classList.add('done');
      } else {
        entry.count.textContent = left;
        entry.count.classList.remove('done');
      }
    }
  },

  bumpGoal(goal) {
    const entry = this.goalNodes.find(e => e.goal.type === goal.type && e.goal.color === goal.color);
    if (!entry) return;
    entry.node.classList.add('bump');
    setTimeout(() => entry.node.classList.remove('bump'), 160);
  },

  // ------------------------------------------------------------ boosters

  buildBoosters() {
    const wrap = this.els.boosters;
    wrap.innerHTML = '';
    this.boosterNodes = [];
    for (const b of this.BOOSTERS) {
      const node = Utils.el('button', 'booster');
      node.appendChild(Art.iconNode(b.icon, 1, 42));
      node.appendChild(Utils.el('span', 'cost', '● ' + b.cost));
      node.addEventListener('click', () => { SFX.button(); this.armBooster(b); });
      wrap.appendChild(node);
      this.boosterNodes.push({ conf: b, node });
    }
  },

  armBooster(conf) {
    if (this.game.state !== 'playing' || this.game.busy) return;
    if (Store.coins() < conf.cost) {
      this.toast('Not enough coins');
      return;
    }
    const armed = this.game.armBooster(conf.type);
    for (const entry of this.boosterNodes) {
      entry.node.classList.toggle('armed', entry.conf.type === armed);
    }
    if (armed) this.toast(conf.hint);
  },

  clearArmedBooster() {
    if (this.game) this.game.armedBooster = null;
    if (this.boosterNodes) for (const e of this.boosterNodes) e.node.classList.remove('armed');
  },

  payForBooster(type) {
    const conf = this.BOOSTERS.find(b => b.type === type);
    if (!conf) return false;
    if (!Store.spendCoins(conf.cost)) { this.toast('Not enough coins'); return false; }
    SFX.coin();
    this.refreshTop();
    return true;
  },

  // -------------------------------------------------------------- results

  showWin(result) {
    const id = result.level.id;
    const reward = 40 + result.stars * 30;
    Store.completeLevel(id, result.stars, result.score);
    Store.addCoins(reward);
    this.refreshTop();

    const body = Utils.el('div');
    const starRow = Utils.el('div', 'dlg-stars');
    for (let i = 0; i < 3; i++) starRow.appendChild(Utils.el('i', i < result.stars ? 'on' : '', '★'));
    body.appendChild(starRow);
    body.appendChild(Utils.el('div', 'dlg-score', Utils.formatNumber(result.score)));
    body.appendChild(Utils.el('p', '', 'Reward: <b>' + this.coinText(reward) + '</b>'));

    for (let i = 0; i < result.stars; i++) setTimeout(() => SFX.star(i), 220 + i * 190);

    Ads.noteLevelEnd();
    const next = Math.min(id + 1, this.MAX_LEVEL);
    this.dialog({
      title: 'Victory!',
      body,
      buttons: [
        {
          label: 'Next Level',
          cls: 'btn-green',
          onClick: () => this.levelTransition(() => { this.game.stop(); this.startLevel(next); }),
        },
        { label: 'Level Map', cls: 'btn-ghost', onClick: () => this.levelTransition(() => this.quitToMap()) },
      ],
    });
  },

  showLose(result) {
    const body = Utils.el('div');
    body.appendChild(Utils.el('p', '', 'You ran out of moves before finishing the goals.'));
    const remaining = result.goals.filter(g => g.done < g.count)
      .map(g => Object.assign({}, g, { count: g.count - g.done }));
    if (remaining.length) body.appendChild(this.goalStrip(remaining));

    Ads.noteLevelEnd();
    const canBuy = Store.coins() >= this.CONTINUE_COST;
    const buttons = [];

    // Watching an ad is offered ahead of the coin option: it is free for
    // the player and it is the placement that actually earns.
    if (AdConfig.enabled) {
      buttons.push({
        label: '+' + AdConfig.rewards.extraMoves + ' Moves &nbsp; <span class="offer-icon">▶</span> Watch Ad',
        cls: 'btn-green',
        onClick: async () => {
          const watched = await Ads.showRewarded();
          if (!watched) { this.showLose(result); return; }
          this.game.grantMoves(AdConfig.rewards.extraMoves);
        },
      });
    }

    this.dialog({
      title: 'Out of Moves',
      body,
      buttons: buttons.concat([
        {
          label: '+5 Moves &nbsp; ' + this.coinText(this.CONTINUE_COST),
          cls: 'btn-gold',
          disabled: !canBuy,
          onClick: () => {
            if (!Store.spendCoins(this.CONTINUE_COST)) { this.toast('Not enough coins'); return; }
            SFX.coin();
            this.refreshTop();
            this.game.grantMoves(5);
          },
        },
        {
          label: 'Retry',
          cls: AdConfig.enabled ? 'btn-ghost' : 'btn-green',
          onClick: () => this.levelTransition(() => {
            this.game.stop();
            if (Store.lives() <= 0) { this.showLives(); this.quitToMap(); return; }
            this.startLevel(result.level.id);
          }),
        },
        { label: 'Level Map', cls: 'btn-ghost', onClick: () => this.levelTransition(() => this.quitToMap()) },
      ]),
    });
  },

  // --------------------------------------------------------------- lives

  showLives() {
    const lives = Store.lives();
    const full = lives >= Store.MAX_LIVES;
    const body = Utils.el('div');
    body.appendChild(Utils.el('p', '', '❤️ '.repeat(Math.max(1, lives)).trim()));
    body.appendChild(Utils.el('p', '', full
      ? 'You have all your lives.'
      : 'Next life in <b>' + Utils.formatTime(Store.msToNextLife()) + '</b>'));

    const buttons = [];
    if (AdConfig.enabled && !full) {
      buttons.push({
        label: 'Free Life &nbsp; <span class="offer-icon">▶</span> Watch Ad',
        cls: 'btn-green',
        onClick: async () => {
          const watched = await Ads.showRewarded();
          if (!watched) return;
          Store.addLives(1);
          SFX.coin();
          this.refreshTop();
          this.toast('+1 life!');
        },
      });
    }

    this.dialog({
      title: 'Lives',
      body,
      buttons: buttons.concat([
        {
          label: 'Refill &nbsp; ' + this.coinText(this.REFILL_COST),
          cls: 'btn-gold',
          disabled: full || Store.coins() < this.REFILL_COST,
          onClick: () => {
            if (!Store.spendCoins(this.REFILL_COST)) { this.toast('Not enough coins'); return; }
            Store.refillLives();
            SFX.coin();
            this.refreshTop();
            this.toast('Lives refilled!');
          },
        },
        { label: 'Close', cls: 'btn-ghost' },
      ]),
    });
  },

  // ------------------------------------------------------------ settings

  showSettings() {
    const body = Utils.el('div');

    const row = Utils.el('div', 'dlg-row');
    row.appendChild(Utils.el('span', '', 'Sound'));
    const sw = Utils.el('button', 'switch' + (Store.data.sound ? ' on' : ''));
    sw.addEventListener('click', () => {
      const on = !Store.data.sound;
      Store.setSound(on);
      sw.classList.toggle('on', on);
      if (on) SFX.button();
    });
    row.appendChild(sw);
    body.appendChild(row);

    const stats = Utils.el('div', 'dlg-row');
    stats.appendChild(Utils.el('span', '', 'Stars collected'));
    stats.appendChild(Utils.el('b', '', '★ ' + Store.data.totalStars));
    body.appendChild(stats);

    if (IapConfig.enabled) {
      const ads = Utils.el('div', 'dlg-row');
      ads.appendChild(Utils.el('span', '', 'Ads'));
      if (IAP.owned) {
        ads.appendChild(Utils.el('b', '', 'Removed ✓'));
      } else {
        const buy = Utils.el('button', 'btn btn-gold btn-inline', 'Remove ' + IAP.priceString());
        buy.addEventListener('click', async () => {
          SFX.button();
          this.closeDialog();
          await this.buyRemoveAds();
        });
        ads.appendChild(buy);
      }
      body.appendChild(ads);

      // Apple requires a visible restore path for non-consumables.
      const restore = Utils.el('div', 'dlg-row');
      restore.appendChild(Utils.el('span', '', 'Purchases'));
      const rbtn = Utils.el('button', 'btn btn-ghost btn-inline', 'Restore');
      rbtn.addEventListener('click', async () => {
        SFX.button();
        this.closeDialog();
        const ok = await IAP.restore();
        this.toast(ok ? 'Purchases restored' : 'Nothing to restore');
      });
      restore.appendChild(rbtn);
      body.appendChild(restore);
    }

    this.dialog({
      title: 'Settings',
      body,
      buttons: [
        { label: 'Close', cls: 'btn-green' },
        {
          label: 'Reset progress',
          cls: 'btn-red',
          onClick: () => {
            this.dialog({
              title: 'Reset everything?',
              body: '<p>All levels, stars and coins will be erased.</p>',
              row: true,
              buttons: [
                { label: 'Cancel', cls: 'btn-ghost' },
                {
                  label: 'Reset',
                  cls: 'btn-red',
                  onClick: () => {
                    Store.reset();
                    this.buildMap();
                    this.refreshTop();
                    this.toast('Progress reset');
                  },
                },
              ],
            });
          },
        },
      ],
    });
  },
};
