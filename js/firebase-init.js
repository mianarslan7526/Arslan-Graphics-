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

  if (document.body.hasAttribute("data-track-visit")) {
    try {
      if (!sessionStorage.getItem("ag-visit-counted")) {
        const dateKey = new Date().toISOString().slice(0, 10);
        Promise.all([
          window.firebaseDb.ref("analytics/totalVisits").transaction((value) => (Number(value) || 0) + 1),
          window.firebaseDb.ref(`analytics/visitsByDate/${dateKey}`).transaction((value) => (Number(value) || 0) + 1)
        ]).then((results) => {
          if (results.some((result) => !result.committed)) throw new Error("A visitor-count transaction was not committed.");
          sessionStorage.setItem("ag-visit-counted", "1");
        }).catch((error) => console.error("Could not record this visit in Firebase analytics.", error));
      }
    } catch (error) {
      console.error("Could not access session storage for visitor counting.", error);
    }
  }
})();
