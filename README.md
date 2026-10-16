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
5. Service updates are usually managed from the admin panel. Each service has a numeric `price`, used for sales analytics and automatically displayed on the website as `Starting from Rs. <price>`.

## Firebase setup

1. In the [Firebase console](https://console.firebase.google.com/), create a project. Analytics is optional; it is not needed for this site.
2. In **Project settings → General → Your apps**, create a **Web app** and copy its configuration object.
3. In **Build → Realtime Database**, create a database and choose the region closest to your customers. Copy its `databaseURL`.
4. In **Build → Authentication → Sign-in method**, enable **Email/Password**.
5. In **Build → Authentication → Sign-in method**, enable **Anonymous** so visitors can use private live chat without creating an account.
6. In **Authentication → Users**, create the owner's user with a strong password. Open that user and copy their **UID**.
7. The web app values for the configured Arslan Graphic Firebase project are already filled into `firebase` in `assets/assets.js`. Paste the owner's UID into `adminUid`. Do not put the owner's password in the source code.
8. In **Realtime Database → Rules**, replace `REPLACE_WITH_ADMIN_UID` below with the same admin UID, then publish the rules.
9. Add the deployed GitHub Pages domain (and `localhost` for local development) under **Authentication → Settings → Authorized domains**.

Firebase web-app configuration is public by design. The database rules below—not hidden configuration—protect customer order data. These rules allow unauthenticated visitors to create new `Pending` orders, permit only the configured owner to read/change/delete orders, and allow visit counters to increase by exactly one per database write. The admin read permission is set on the parent `/orders` path because the dashboard reads the collection as one query. Realtime Database transactions need to read their current counter, so the aggregate analytics counters are publicly readable; they do not contain customer data. Each load of a public page marked for visit tracking is counted, including page reloads and navigation between tracked pages. The admin dashboard listens to the counters and order data in realtime. Because counting runs in the public browser, it can be deliberately manipulated; for abuse-resistant analytics, move counting to a trusted Cloud Function and/or enable Firebase App Check.

In **Realtime Database → Rules**, replace the existing rules with the complete JSON below, replace every `REPLACE_WITH_ADMIN_UID` with the owner's Firebase Authentication UID, and click **Publish**. Keep the `/orders` `.read` rule directly inside `"orders"` (at the same level as `.indexOn`), not inside `"$orderId"`; otherwise the dashboard cannot read the orders collection. Do not make `/orders` publicly readable because orders contain customer contact details.

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "orders": {
      ".read": "auth != null && auth.uid == 'REPLACE_WITH_ADMIN_UID'",
      ".indexOn": ["createdAt"],
      "$orderId": {
        ".write": "(auth != null && auth.uid == 'REPLACE_WITH_ADMIN_UID') || ((auth == null || auth.token.firebase.sign_in_provider == 'anonymous') && !data.exists() && newData.exists())",
        ".validate": "newData.hasChildren(['orderId', 'name', 'phone', 'email', 'service', 'serviceId', 'price', 'message', 'status', 'createdAt', 'dateKey']) && newData.child('orderId').val() == $orderId && newData.child('name').isString() && newData.child('name').val().length <= 100 && newData.child('phone').isString() && newData.child('phone').val().length <= 30 && newData.child('email').isString() && newData.child('email').val().length <= 150 && newData.child('service').isString() && newData.child('service').val().length <= 100 && newData.child('serviceId').isString() && newData.child('serviceId').val().length <= 100 && newData.child('price').isNumber() && newData.child('price').val() >= 0 && newData.child('message').isString() && newData.child('message').val().length <= 2000 && newData.child('createdAt').isNumber() && newData.child('dateKey').isString() && newData.child('dateKey').val().matches(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/) && (auth != null && auth.uid == 'REPLACE_WITH_ADMIN_UID' ? newData.child('status').val().matches(/^(Pending|In Progress|Completed|Cancelled)$/) : newData.child('status').val() == 'Pending') && (!newData.child('budget').exists() || (newData.child('budget').isNumber() && newData.child('budget').val() >= 0)) && (!newData.child('sampleImageUrl').exists() || (newData.child('sampleImageUrl').isString() && newData.child('sampleImageUrl').val().length <= 2048))"
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
    },
    "siteContent": {
      "services": {
        ".read": true,
        ".write": "auth != null && auth.uid == 'REPLACE_WITH_ADMIN_UID'"
      }
    },
    "chats": {
      ".read": "auth != null && auth.uid == 'REPLACE_WITH_ADMIN_UID'",
      "$visitorUid": {
        ".read": "auth != null && (auth.uid == 'REPLACE_WITH_ADMIN_UID' || auth.uid == $visitorUid)",
        ".write": "auth != null && auth.uid == 'REPLACE_WITH_ADMIN_UID'",
        "profile": {
          ".write": "auth != null && auth.uid == $visitorUid && !data.exists()",
          ".validate": "newData.hasChildren(['name', 'email', 'phone', 'service', 'createdAt']) && newData.child('name').isString() && newData.child('name').val().length >= 2 && newData.child('name').val().length <= 100 && newData.child('email').isString() && newData.child('email').val().length <= 150 && newData.child('phone').isString() && newData.child('phone').val().length <= 30 && (newData.child('email').val().length > 0 || newData.child('phone').val().length > 0) && newData.child('service').isString() && newData.child('service').val().length <= 100 && newData.child('createdAt').isNumber()"
        },
        "messages": {
          "$messageId": {
            ".write": "auth != null && ((auth.uid == $visitorUid && !data.exists() && newData.child('sender').val() == 'client') || auth.uid == 'REPLACE_WITH_ADMIN_UID')",
            ".validate": "newData.hasChildren(['sender', 'text', 'createdAt']) && newData.child('sender').isString() && newData.child('sender').val().matches(/^(client|admin)$/) && newData.child('text').isString() && newData.child('text').val().length >= 2 && newData.child('text').val().length <= 2000 && newData.child('createdAt').isNumber()"
          }
        },
        "settings": {
          "notificationsEnabled": {
            ".write": "auth != null && auth.uid == 'REPLACE_WITH_ADMIN_UID'",
            ".validate": "newData.isBoolean()"
          }
        },
        "meta": {
          "clientReadAt": {
            ".write": "auth != null && (auth.uid == $visitorUid || auth.uid == 'REPLACE_WITH_ADMIN_UID')",
            ".validate": "newData.isNumber()"
          }
        }
      }
    }
  }
}
```

The admin UID is intentionally repeated in `assets/assets.js` and the rules: the browser uses it to reject other signed-in accounts, and the database independently enforces it for protected reads and writes. The `siteContent/services` path is publicly readable so the website can display live service changes, but only the configured admin can add, edit, or delete services. Live messages require Anonymous sign-in: each visitor can read their own conversation, and only the configured admin can read all conversations, reply as the admin, change that visitor's bell setting, or delete a conversation. The admin UID is not a secret; a GitHub Pages visitor can inspect public source, so never add credentials or treat the admin page's unlisted URL as a security boundary.

## Deploy with GitHub Pages

1. Commit and push the site files to the repository's publishing branch (commonly `main`).
2. On GitHub, open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/ (root)`, then save.
3. Wait for the Pages deployment and open the provided URL. The site uses relative links and requires no build step.
4. Confirm the deployed origin is listed under Firebase Authentication's authorized domains. Verify that service links, the order form, and the WhatsApp button use the expected URLs.
5. Confirm an order appears in `admin.html`, then verify the dashboard's status updates and analytics. A local preview can be served from the repository root with `python3 -m http.server 8000`; add `localhost` to Firebase's authorized domains before testing login locally.

## Notes

- The administrator page is intentionally not linked from the public website and includes `noindex, nofollow`. Its URL being unlisted is not a substitute for Firebase Authentication and database rules.
- Sign in to the admin panel and use **Manage services** to open the animated add/edit dialog or remove a service. Service updates are stored in the database and stream to the home page and service details live. In **View orders**, click an order row or its ID to open the full order-details dialog. Publish the `siteContent/services` access rules above first.
- Visitors can send a private message from the Contact Us form. Reply in **User messages**; the chat bell appears automatically with the first admin reply unless the owner explicitly switches it off. The visitor chat uses a separate anonymous Firebase session, so signing into the admin panel in the same browser does not replace the visitor chat identity. Anonymous sign-in and the `chats` rules above must be enabled/published for messaging to work.
- To enable optional customer sample-image uploads, set `imgbbApiKey` in `assets/assets.js` to your ImgBB API key. The browser sends selected images (JPG, PNG, WebP, or GIF, up to 10 MB) directly to ImgBB and stores the returned image URL on the order; the admin order-details dialog then displays the image. Because this is a public GitHub Pages site, this exposes the ImgBB key to visitors and allows its quota to be used by others. Use this only if you accept that risk; for private credentials, route uploads through a secured server/serverless endpoint. Republish the updated Realtime Database order validation rules above so optional `sampleImageUrl` is accepted. The key was not present in the information received for this change; the code will show a setup message until you fill in `imgbbApiKey`.
- Firebase can be left unconfigured while designing the static site. Online order submission and analytics remain unavailable until the Firebase web-app configuration and rules are set up.
- External font loading requires an internet connection. The site otherwise uses no framework, build tool, chart package, or runtime dependency beyond the Firebase CDN SDK when Firebase is configured.
