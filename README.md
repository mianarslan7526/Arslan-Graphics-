# Arslan Graphics

A responsive, animated graphic-design portfolio and order-management dashboard built with plain HTML, CSS, and vanilla JavaScript. The public site is suitable for GitHub Pages hosting; Firebase Realtime Database and Authentication enable orders, visitor analytics, and the private dashboard.

## Files

- `index.html` — home, services, about, and contact
- `service.html?id=<service-id>` — dynamically generated service details and order form
- `admin.html` — unlinked, no-index owner dashboard
- `assets/assets.js` — brand, contact, services, social links, and Firebase settings
- `css/` and `js/` — page styles and browser code

## Configure your content

1. Open [`assets/assets.js`](./assets/assets.js).
2. Paste direct image URLs into `logoUrl`, `faviconUrl`, `heroImageUrl`, `aboutImageUrl`, and each service's `imageUrl`. Keep an image URL empty to use the built-in artwork.
3. Update `contact` details, `aboutTitle`, `aboutText`, `stats`, and `skills` as needed.
4. Add social profile URLs to `socialLinks`. Links with an empty or invalid URL are hidden. Built-in social icons are selected by the `icon` field; an optional `iconUrl` replaces that icon.
5. To add or remove a service, edit only the `services` array. Give each service a unique, URL-safe `id`; its card, detail page, and order form option are generated from that array. `price` is a numeric amount used in sales analytics. Update `priceLabel` for the wording displayed to customers.

## Firebase setup

1. In the [Firebase console](https://console.firebase.google.com/), create a project. Analytics is optional; it is not needed for this site.
2. In **Project settings → General → Your apps**, create a **Web app** and copy its configuration object.
3. In **Build → Realtime Database**, create a database and choose the region closest to your customers. Copy its `databaseURL`.
4. In **Build → Authentication → Sign-in method**, enable **Email/Password**.
5. In **Authentication → Users**, create the owner's user with a strong password. Open that user and copy their **UID**.
6. The web app values for the configured Arslan Graphic Firebase project are already filled into `firebase` in `assets/assets.js`. Paste the owner's UID into `adminUid`. Do not put the owner's password in the source code.
7. In **Realtime Database → Rules**, replace `REPLACE_WITH_ADMIN_UID` below with the same admin UID, then publish the rules.
8. Add the deployed GitHub Pages domain (and `localhost` for local development) under **Authentication → Settings → Authorized domains**.

Firebase web-app configuration is public by design. The database rules below—not hidden configuration—protect customer order data. These rules allow unauthenticated visitors to create new `Pending` orders, permit only the configured owner to read/change/delete orders, and allow visit counters to increase by exactly one per database write. Realtime Database transactions need to read their current counter, so the aggregate analytics counters are publicly readable; they do not contain customer data. Each load of a public page marked for visit tracking is counted, including page reloads and navigation between tracked pages. The admin dashboard listens to the counters and order data in realtime. Because counting runs in the public browser, it can be deliberately manipulated; for abuse-resistant analytics, move counting to a trusted Cloud Function and/or enable Firebase App Check.

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "orders": {
      ".indexOn": ["createdAt"],
      "$orderId": {
        ".read": "auth != null && auth.uid == 'REPLACE_WITH_ADMIN_UID'",
        ".write": "(auth != null && auth.uid == 'REPLACE_WITH_ADMIN_UID') || (auth == null && !data.exists() && newData.exists())",
        ".validate": "newData.hasChildren(['orderId', 'name', 'phone', 'email', 'service', 'serviceId', 'price', 'message', 'status', 'createdAt', 'dateKey']) && newData.child('orderId').val() == $orderId && newData.child('name').isString() && newData.child('name').val().length <= 100 && newData.child('phone').isString() && newData.child('phone').val().length <= 30 && newData.child('email').isString() && newData.child('email').val().length <= 150 && newData.child('service').isString() && newData.child('service').val().length <= 100 && newData.child('serviceId').isString() && newData.child('serviceId').val().length <= 100 && newData.child('price').isNumber() && newData.child('price').val() >= 0 && newData.child('message').isString() && newData.child('message').val().length <= 2000 && newData.child('createdAt').isNumber() && newData.child('dateKey').isString() && newData.child('dateKey').val().matches(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/) && (auth != null && auth.uid == 'REPLACE_WITH_ADMIN_UID' ? newData.child('status').val().matches(/^(Pending|In Progress|Completed|Cancelled)$/) : newData.child('status').val() == 'Pending') && (!newData.child('budget').exists() || (newData.child('budget').isNumber() && newData.child('budget').val() >= 0))"
      }
    },
    "analytics": {
      ".read": true,
      ".write": false,
      "totalVisits": {
        ".write": true,
        ".validate": "newData.isNumber() && newData.val() == (data.val() == null ? 1 : data.val() + 1)"
      },
      "visitsByDate": {
        "$dateKey": {
          ".write": "$dateKey.matches(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)",
          ".validate": "newData.isNumber() && newData.val() == (data.val() == null ? 1 : data.val() + 1)"
        }
      }
    }
  }
}
```

The admin UID is intentionally repeated in `assets/assets.js` and the rules: the browser uses it to reject other signed-in accounts, and the database independently enforces it for protected reads and writes. A GitHub Pages visitor can inspect the public website source, so never add credentials or treat the admin page's unlisted URL as a security boundary.

## Deploy with GitHub Pages

1. Commit and push the site files to the repository's publishing branch (commonly `main`).
2. On GitHub, open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/ (root)`, then save.
3. Wait for the Pages deployment and open the provided URL. The site uses relative links and requires no build step.
4. Confirm the deployed origin is listed under Firebase Authentication's authorized domains. Verify that service links, the order form, and the WhatsApp button use the expected URLs.
5. Confirm an order appears in `admin.html`, then verify the dashboard's status updates and analytics. A local preview can be served from the repository root with `python3 -m http.server 8000`; add `localhost` to Firebase's authorized domains before testing login locally.

## Notes

- The administrator page is intentionally not linked from the public website and includes `noindex, nofollow`. Its URL being unlisted is not a substitute for Firebase Authentication and database rules.
- Firebase can be left unconfigured while designing the static site. Online order submission and analytics remain unavailable until the Firebase web-app configuration and rules are set up.
- External font loading requires an internet connection. The site otherwise uses no framework, build tool, chart package, or runtime dependency beyond the Firebase CDN SDK when Firebase is configured.
