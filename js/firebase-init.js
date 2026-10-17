(function () {
  "use strict";

  const config = window.SITE_CONFIG && window.SITE_CONFIG.firebase;
  const required = ["apiKey", "authDomain", "databaseURL", "projectId", "appId"];
  const configured = config && required.every((key) => typeof config[key] === "string" && config[key].trim());

  window.firebaseReady = Boolean(configured && window.firebase);
  if (!window.firebaseReady) {
    console.info("Firebase is not configured. Add the project values in assets/assets.js to enable orders and analytics.");
    return;
  }

  if (!firebase.apps.length) firebase.initializeApp(config);
  window.firebaseApp = firebase.app();
  window.firebaseDb = firebase.database();
  window.firebaseAuth = typeof firebase.auth === "function" ? firebase.auth() : null;
  window.chatDatabase = null;
  window.chatAuthReady = Promise.resolve(null);
  if (document.body.hasAttribute("data-track-visit") && typeof firebase.auth === "function") {
    try {
      const chatApp = firebase.apps.find((app) => app.name === "visitorChat")
        || firebase.initializeApp(config, "visitorChat");
      const chatAuth = chatApp.auth();
      window.chatDatabase = chatApp.database();
      window.chatAuthReady = new Promise((resolve, reject) => {
        let settled = false;
        let signInStarted = false;
        let unsubscribe = () => {};
        const finish = (callback, value) => {
          if (settled) return;
          settled = true;
          unsubscribe();
          callback(value);
        };
        unsubscribe = chatAuth.onAuthStateChanged((user) => {
          if (user) {
            if (user.isAnonymous) finish(resolve, user);
            else finish(reject, new Error("Visitor chat requires an anonymous account."));
            return;
          }
          if (signInStarted) return;
          signInStarted = true;
          chatAuth.signInAnonymously()
            .then(({ user: anonymousUser }) => finish(resolve, anonymousUser))
            .catch((error) => finish(reject, error));
        }, (error) => finish(reject, error));
      });
    } catch (error) {
      window.chatAuthReady = Promise.reject(error);
    }
  }
  window.chatAuthReady.catch((error) => console.error("Could not start secure visitor messaging.", error));

  window.siteServicesReady = new Promise((resolve) => {
    let initialSnapshotReceived = false;
    const fallbackTimer = window.setTimeout(() => {
      if (initialSnapshotReceived) return;
      initialSnapshotReceived = true;
      resolve(window.SITE_CONFIG.services);
    }, 2500);
    const servicesRef = window.firebaseDb.ref("siteContent/services");
    servicesRef.on("value", (snapshot) => {
      if (snapshot.exists()) {
        const value = snapshot.val();
        const services = Object.entries(value)
          .filter(([, service]) => service && typeof service === "object" && typeof service.title === "string")
          .map(([id, service], index) => {
            const serviceDetails = { ...service };
            delete serviceDetails.price;
            return {
              ...serviceDetails,
              id,
              features: Array.isArray(service.features) ? service.features.filter((feature) => typeof feature === "string") : [],
              displayOrder: Number.isFinite(Number(service.displayOrder)) ? Number(service.displayOrder) : index
            };
          })
          .sort((first, second) => first.displayOrder - second.displayOrder);
        window.SITE_CONFIG.services = services;
        window.dispatchEvent(new CustomEvent("site-services-updated", { detail: services }));
      }
      if (!initialSnapshotReceived) {
        initialSnapshotReceived = true;
        window.clearTimeout(fallbackTimer);
        resolve(window.SITE_CONFIG.services);
      }
    }, (error) => {
      console.error("Could not listen for live service updates.", error);
      if (!initialSnapshotReceived) {
        initialSnapshotReceived = true;
        window.clearTimeout(fallbackTimer);
        resolve(window.SITE_CONFIG.services);
      }
    });
  });

  if (document.body.hasAttribute("data-track-visit")) {
    const dateKey = new Date().toISOString().slice(0, 10);
    Promise.all([
      window.firebaseDb.ref("analytics/totalVisits").transaction((value) => (Number(value) || 0) + 1),
      window.firebaseDb.ref(`analytics/visitsByDate/${dateKey}`).transaction((value) => (Number(value) || 0) + 1)
    ]).then((results) => {
      if (results.some((result) => !result.committed)) throw new Error("A visitor-count transaction was not committed.");
    }).catch((error) => console.error("Could not record this visit in Firebase analytics.", error));
  }
})();
