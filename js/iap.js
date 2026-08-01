'use strict';

/* In-app purchase: a single non-consumable "Remove Ads".
 *
 * Backed by cordova-plugin-purchase (window.CdvPurchase), which Capacitor
 * loads alongside the native plugins. Off-device it falls back to a
 * simulated flow so the unlock, the restore path and the UI states can all
 * be tested in a browser. */
const IAP = {
  ready: false,
  price: null,
  _product: null,

  get store() {
    return (window.CdvPurchase && window.CdvPurchase.store) || null;
  },

  get native() { return IapConfig.enabled && !!this.store; },

  get owned() { return !!Store.data.removeAds; },

  priceString() { return this.price || IapConfig.fallbackPrice; },

  async init() {
    if (!IapConfig.enabled) return;
    const store = this.store;
    if (!store) { this.ready = true; return; }   // simulator mode

    try {
      const CdvPurchase = window.CdvPurchase;
      const { ProductType, Platform } = CdvPurchase;

      store.register([{
        id: IapConfig.removeAdsProductId,
        type: ProductType.NON_CONSUMABLE,
        platform: Platform.APPLE_APPSTORE,
      }]);

      // Apple requires the app to handle purchases that complete outside
      // the buy button (restores, family sharing, interrupted payments).
      store.when()
        .productUpdated(() => this.refreshPrice())
        .approved(t => t.verify())
        .verified(receipt => {
          if (this.receiptHasRemoveAds(receipt)) this.grant();
          receipt.finish();
        });

      store.error(err => console.warn('[IAP]', err && err.message));

      await store.initialize([Platform.APPLE_APPSTORE]);
      this.refreshPrice();
      this.ready = true;
    } catch (e) {
      console.warn('[IAP] initialize failed', e);
      this.ready = false;
    }
  },

  receiptHasRemoveAds(receipt) {
    try {
      const items = (receipt && receipt.collection) || [];
      return items.some(p => p.id === IapConfig.removeAdsProductId);
    } catch (e) {
      return true;   // a verified receipt we cannot read still means paid
    }
  },

  refreshPrice() {
    const store = this.store;
    if (!store) return;
    try {
      const product = store.get(IapConfig.removeAdsProductId);
      this._product = product || null;
      const offer = product && product.getOffer && product.getOffer();
      const pricing = offer && offer.pricingPhases && offer.pricingPhases[0];
      if (pricing && pricing.price) this.price = pricing.price;
    } catch (e) { /* keep the fallback price */ }
  },

  /* Unlocks the entitlement and pays out the bonus exactly once. */
  grant(silent) {
    if (Store.data.removeAds) return false;
    Store.data.removeAds = true;
    Store.addCoins(IapConfig.bonusCoins);
    Store.save();
    Ads.hideBanner();
    if (!silent) SFX.coin();
    if (typeof UI !== 'undefined' && UI.onAdsRemoved) UI.onAdsRemoved();
    return true;
  },

  async buy() {
    if (!IapConfig.enabled) return false;
    if (this.owned) return true;

    const store = this.store;
    if (!store) {
      const ok = await this.simulate(`Buy Remove Ads for ${this.priceString()}?`);
      if (ok) this.grant();
      return ok;
    }

    try {
      const product = store.get(IapConfig.removeAdsProductId);
      const offer = product && product.getOffer && product.getOffer();
      if (!offer) { UI.toast('Store unavailable — try again later'); return false; }
      const err = await offer.order();
      if (err) { if (err.code !== 6777006) UI.toast('Purchase not completed'); return false; }
      // The `verified` handler above is what actually grants it.
      return true;
    } catch (e) {
      UI.toast('Purchase failed');
      return false;
    }
  },

  /* Apple rejects apps that sell a non-consumable without a visible way to
   * restore it on a new device. */
  async restore() {
    if (!IapConfig.enabled) return false;
    const store = this.store;
    if (!store) {
      const ok = await this.simulate('Restore previous purchases?');
      if (ok) this.grant();
      return ok;
    }
    try {
      await store.restorePurchases();
      return this.owned;
    } catch (e) {
      return false;
    }
  },

  simulate(question) {
    return new Promise((resolve) => {
      UI.dialog({
        title: 'App Store',
        body: `<p>${question}</p><p style="opacity:.7;font-size:13px">
               Simulated — on a device this is a real StoreKit prompt.</p>`,
        row: true,
        buttons: [
          { label: 'Cancel', cls: 'btn-ghost', onClick: () => resolve(false) },
          { label: 'Confirm', cls: 'btn-green', onClick: () => resolve(true) },
        ],
      });
    });
  },
};
