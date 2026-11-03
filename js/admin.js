(function () {
  "use strict";
  const config = window.SITE_CONFIG;
  const authScreen = document.getElementById("auth-screen");
  const dashboard = document.getElementById("dashboard");
  const loginForm = document.getElementById("login-form");
  const loginError = document.getElementById("login-error");
  const loginButton = document.getElementById("login-button");
  const notice = document.getElementById("admin-error");
  const orderCache = new Map();
  let databaseListeners = [];
  let previousOrderIds = new Set();
  let initialOrdersLoaded = false;
  let activeOrderId = "";
  let activeVisitorId = "";
  let activeView = "analytics";
  let ordersReadError = "";
  let orders = [];
  let visitorChats = {};
  let services = config.services.map((service, displayOrder) => ({ ...service, displayOrder }));
  let servicesInitialized = false;
  let visitsByDate = {};
  let totalVisitors = 0;
  let todayVisitors = 0;
  const todayKey = new Date().toISOString().slice(0, 10);

  document.getElementById("today-label").textContent = new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date());
  if (!window.firebaseReady || !window.firebaseAuth || !window.firebaseDb) {
    loginError.textContent = "Admin sign-in is unavailable. Please check the dashboard setup.";
    loginButton.disabled = true;
    return;
  }
  if (!config.adminUid) {
    loginError.textContent = "Admin access is not configured. Add the administrator account ID in assets/assets.js.";
    loginButton.disabled = true;
    return;
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginError.textContent = "";
    loginButton.disabled = true;
    loginButton.textContent = "Signing in…";
    try {
      await window.firebaseAuth.signInWithEmailAndPassword(loginForm.elements.email.value.trim(), loginForm.elements.password.value);
    } catch (error) {
      console.error("Admin sign-in failed.", error);
      loginError.textContent = authMessage(error);
      loginButton.disabled = false;
      loginButton.innerHTML = 'Sign in <span>↗</span>';
    }
  });

  function authMessage(error) {
    if (error.code === "auth/invalid-credential" || error.code === "auth/wrong-password" || error.code === "auth/user-not-found") return "Email or password is incorrect.";
    if (error.code === "auth/too-many-requests") return "Too many sign-in attempts. Please wait and try again.";
    if (error.code === "auth/unauthorized-domain") return "This website address is not enabled for sign-in.";
    return "Sign-in failed. Check your connection and try again.";
  }

  window.firebaseAuth.onAuthStateChanged(async (user) => {
    if (!user) {
      stopListeners();
      dashboard.hidden = true;
      authScreen.hidden = false;
      loginButton.disabled = false;
      loginButton.innerHTML = 'Sign in <span>↗</span>';
      return;
    }
    if (user.uid !== config.adminUid) {
      loginError.textContent = "This account is not authorized to access the admin panel.";
      await window.firebaseAuth.signOut();
      return;
    }
    authScreen.hidden = true;
    dashboard.hidden = false;
    startListeners();
  });

  function stopListeners() {
    databaseListeners.forEach(({ ref, event, callback }) => ref.off(event, callback));
    databaseListeners = [];
    orderCache.clear();
    visitorChats = {};
    orders = [];
    previousOrderIds = new Set();
    initialOrdersLoaded = false;
  }

  function listen(ref, event, callback) {
    ref.on(event, callback, (error) => {
      console.error(`Dashboard data listener failed at ${ref.toString()}.`, error);
      const isOrdersQuery = ref.toString().includes("/orders");
      if (isOrdersQuery) {
        ordersReadError = `Orders read failed${error.code ? ` (${error.code})` : ""}. The published /orders .read rule must match the signed-in admin UID.`;
        if (activeView === "orders") showNotice(ordersReadError);
      } else {
        showNotice(`Dashboard data read failed${error.code ? ` (${error.code})` : ""}: ${error.message}`);
      }
    });
    databaseListeners.push({ ref, event, callback });
  }

  function startListeners() {
    stopListeners();
    const ordersRef = window.firebaseDb.ref("orders");
    listen(ordersRef, "value", applyOrdersSnapshot);
    const totalRef = window.firebaseDb.ref("analytics/totalVisits");
    listen(totalRef, "value", (snapshot) => {
      totalVisitors = Number(snapshot.val()) || 0;
      updateMetrics();
    });
    const todayRef = window.firebaseDb.ref(`analytics/visitsByDate/${todayKey}`);
    listen(todayRef, "value", (snapshot) => {
      todayVisitors = Number(snapshot.val()) || 0;
      updateMetrics();
    });
    const allDatesRef = window.firebaseDb.ref("analytics/visitsByDate");
    listen(allDatesRef, "value", (snapshot) => {
      visitsByDate = snapshot.val() || {};
      drawChart();
    });
    const servicesRef = window.firebaseDb.ref("siteContent/services");
    listen(servicesRef, "value", (snapshot) => {
      if (!snapshot.exists()) {
        if (!servicesInitialized) {
          servicesInitialized = true;
          const initialServices = Object.fromEntries(services.map((service, displayOrder) => [
            service.id,
            { ...service, displayOrder }
          ]));
          servicesRef.set(initialServices).catch((error) => {
            servicesInitialized = false;
            console.error("Could not initialize the service list.", error);
            showNotice("Could not set up the service list. Check the database rules and try again.");
          });
        }
        return;
      }
      servicesInitialized = true;
      services = Object.entries(snapshot.val())
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
      config.services = services;
      renderServiceManager();
      renderOrders();
    });
    const chatsRef = window.firebaseDb.ref("chats");
    listen(chatsRef, "value", (snapshot) => {
      visitorChats = snapshot.val() || {};
      renderVisitorMessages();
      if (activeVisitorId) {
        const activeChat = visitorChats[activeVisitorId];
        if (activeChat) renderVisitorChat(activeVisitorId, activeChat);
        else {
          document.getElementById("visitor-chat-dialog").close();
          activeVisitorId = "";
        }
      }
    });
  }

  function applyOrdersSnapshot(snapshot) {
    const nextOrders = [];
    snapshot.forEach((child) => {
      const order = child.val();
      if (order && typeof order === "object") {
        order.orderId = order.orderId || child.key;
        nextOrders.push(order);
      }
    });
    nextOrders.sort((first, second) =>
      (Number(second.createdAt) || 0) - (Number(first.createdAt) || 0)
    );
    const nextIds = new Set(nextOrders.map((order) => order.orderId));
    if (initialOrdersLoaded) {
      const newest = nextOrders.find((order) => !previousOrderIds.has(order.orderId));
      if (newest) showToast(`New order from ${newest.name || "a client"} · ${newest.service || "Project request"}`);
    }
    initialOrdersLoaded = true;
    previousOrderIds = nextIds;
    orderCache.clear();
    nextOrders.forEach((order) => orderCache.set(order.orderId, order));
    orders = nextOrders;
    renderOrders();
    if (activeOrderId) {
      const activeOrder = orderCache.get(activeOrderId);
      if (activeOrder) renderOrderDetails(activeOrder);
      else {
        document.getElementById("order-detail-dialog").close();
        activeOrderId = "";
      }
    }
    updateMetrics();
  }

  function renderServiceManager() {
    const list = document.getElementById("service-manager-list");
    if (!list) return;
    list.replaceChildren();
    document.getElementById("service-manager-count").textContent = services.length;
    const selectedFilter = document.getElementById("service-filter").value;
    const serviceFilter = document.getElementById("service-filter");
    serviceFilter.replaceChildren(new Option("All services", ""));
    services.forEach((service) => serviceFilter.add(new Option(service.title, service.id)));
    serviceFilter.value = services.some((service) => service.id === selectedFilter) ? selectedFilter : "";

    services.forEach((service) => {
      const item = document.createElement("article");
      item.className = "managed-service";
      const image = document.createElement("div");
      image.className = "managed-service-image";
      if (service.imageUrl) {
        const img = document.createElement("img");
        img.src = service.imageUrl;
        img.alt = "";
        img.loading = "lazy";
        image.append(img);
      } else image.textContent = service.title.slice(0, 1).toUpperCase();
      const details = document.createElement("div");
      details.className = "managed-service-details";
      const title = document.createElement("strong");
      title.textContent = service.title;
      const summary = document.createElement("span");
      summary.textContent = service.deliveryTime || "Delivery time not set";
      details.append(title, summary);
      const actions = document.createElement("div");
      actions.className = "managed-service-actions";
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "admin-button";
      edit.textContent = "Edit";
      edit.addEventListener("click", () => openServiceEditor(service));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "admin-button delete-service-button";
      remove.textContent = "Delete";
      remove.addEventListener("click", () => deleteService(service));
      actions.append(edit, remove);
      item.append(image, details, actions);
      list.append(item);
    });
    document.getElementById("orders-heading-count").textContent = orders.length;
  }

  function renderVisitorMessages() {
    const list = document.getElementById("visitor-message-list");
    const entries = Object.entries(visitorChats)
      .filter(([, chat]) => chat?.profile)
      .sort(([, first], [, second]) => latestMessageAt(second) - latestMessageAt(first));
    list.replaceChildren();
    document.getElementById("message-list-count").textContent = entries.length;
    document.getElementById("message-count-badge").textContent = entries.length;
    document.getElementById("empty-visitor-messages").hidden = entries.length > 0;
    entries.forEach(([uid, chat]) => {
      const messages = Object.values(chat.messages || {}).sort((first, second) => Number(second.createdAt) - Number(first.createdAt));
      const latest = messages[0];
      const card = document.createElement("button");
      card.type = "button";
      card.className = "visitor-message-card";
      const identity = document.createElement("span");
      identity.className = "visitor-message-avatar";
      identity.textContent = String(chat.profile.name || "?").trim().slice(0, 1).toUpperCase();
      const details = document.createElement("span");
      details.className = "visitor-message-summary";
      const name = document.createElement("strong");
      name.textContent = chat.profile.name || "Website visitor";
      const service = document.createElement("small");
      service.textContent = chat.profile.service || "Service not selected";
      const preview = document.createElement("span");
      preview.textContent = latest?.text || "No messages";
      details.append(name, service, preview);
      const meta = document.createElement("span");
      meta.className = "visitor-message-meta";
      const time = document.createElement("time");
      if (latest?.createdAt) {
        time.dateTime = new Date(Number(latest.createdAt)).toISOString();
        time.textContent = formatChatTime(latest.createdAt);
      }
      const bellEnabled = chat.settings?.notificationsEnabled !== false;
      const bell = document.createElement("span");
      bell.className = `visitor-bell-state${bellEnabled ? " enabled" : ""}`;
      bell.textContent = bellEnabled ? "Bell on" : "Bell off";
      meta.append(time, bell);
      card.append(identity, details, meta);
      card.addEventListener("click", () => openVisitorChat(uid));
      list.append(card);
    });
  }

  function latestMessageAt(chat) {
    return Math.max(0, ...Object.values(chat?.messages || {}).map((message) => Number(message.createdAt) || 0));
  }

  function formatChatTime(value) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(Number(value) || Date.now()));
  }

  function openVisitorChat(uid) {
    const chat = visitorChats[uid];
    if (!chat) return;
    activeVisitorId = uid;
    renderVisitorChat(uid, chat);
    const dialog = document.getElementById("visitor-chat-dialog");
    if (!dialog.open) dialog.showModal();
  }

  function renderVisitorChat(uid, chat) {
    const profile = chat.profile || {};
    const heading = document.getElementById("visitor-chat-heading");
    heading.textContent = profile.name || "Website visitor";
    const profileNode = document.getElementById("visitor-profile");
    profileNode.replaceChildren();
    [
      ["Email", profile.email],
      ["Phone / WhatsApp", profile.phone],
      ["Service", profile.service]
    ].filter(([, value]) => value).forEach(([label, value]) => {
      const item = document.createElement("span");
      const caption = document.createElement("small");
      caption.textContent = label;
      const content = document.createElement("strong");
      content.textContent = value;
      item.append(caption, content);
      profileNode.append(item);
    });

    const list = document.getElementById("visitor-admin-messages");
    list.replaceChildren();
    Object.values(chat.messages || {})
      .filter((message) => message && typeof message.text === "string")
      .sort((first, second) => Number(first.createdAt) - Number(second.createdAt))
      .forEach((message) => {
        const bubble = document.createElement("article");
        bubble.className = `chat-message${message.sender === "admin" ? " from-admin" : " from-visitor"}`;
        const sender = document.createElement("span");
        sender.textContent = message.sender === "admin" ? "ARSLAN GRAPHICS" : profile.name || "VISITOR";
        const text = document.createElement("p");
        text.textContent = message.text;
        const time = document.createElement("time");
        time.textContent = formatChatTime(message.createdAt);
        bubble.append(sender, text, time);
        list.append(bubble);
      });
    list.scrollTop = list.scrollHeight;
    document.getElementById("visitor-notification-toggle").checked = chat.settings?.notificationsEnabled !== false;
    document.getElementById("admin-chat-feedback").textContent = "";
  }

  function openServiceEditor(service) {
    const form = document.getElementById("service-form");
    const dialog = document.getElementById("service-dialog");
    form.reset();
    form.elements.serviceId.value = service?.id || "";
    form.elements.title.value = service?.title || "";
    form.elements.imageUrl.value = service?.imageUrl || "";
    form.elements.shortDescription.value = service?.shortDescription || "";
    form.elements.fullDescription.value = service?.fullDescription || "";
    form.elements.deliveryTime.value = service?.deliveryTime || "";
    form.elements.features.value = service?.features?.join("\n") || "";
    document.getElementById("service-form-heading").textContent = service ? "Edit service" : "Add a service";
    document.getElementById("service-form-feedback").textContent = "";
    document.getElementById("save-service-button").disabled = false;
    if (!dialog.open) dialog.showModal();
    requestAnimationFrame(() => form.elements.title.focus());
  }

  function showOrderDetails(order) {
    activeOrderId = order.orderId;
    renderOrderDetails(order);
    const dialog = document.getElementById("order-detail-dialog");
    if (!dialog.open) dialog.showModal();
  }

  function renderOrderDetails(order) {
    const content = document.getElementById("order-detail-body");
    const date = Number(order.createdAt)
      ? new Intl.DateTimeFormat("en", { dateStyle: "full", timeStyle: "short" }).format(new Date(Number(order.createdAt)))
      : "Date unavailable";
    const whatsappNumber = String(order.phone || "").replace(/[^\d]/g, "");
    const entries = [
      ["Client", order.name || "—"],
      ["Service", order.service || "—"],
      ["Order ID", order.orderId],
      ["Date received", date]
    ];
    if (order.budget !== undefined && order.budget !== null && order.budget !== "") entries.splice(3, 0, ["Client budget", money(order.budget)]);

    content.replaceChildren();
    const grid = document.createElement("div");
    grid.className = "order-detail-grid";
    entries.forEach(([label, value]) => {
      const item = document.createElement("div");
      item.className = "order-detail-item";
      const caption = document.createElement("span");
      caption.textContent = label;
      const text = document.createElement("strong");
      text.textContent = value;
      item.append(caption, text);
      grid.append(item);
    });
    content.append(grid);

    const contacts = document.createElement("div");
    contacts.className = "order-detail-contacts";
    if (order.email) {
      const email = document.createElement("a");
      email.href = `mailto:${order.email}`;
      email.textContent = order.email;
      contacts.append(email);
    }
    if (order.phone) {
      const phone = document.createElement("a");
      phone.href = `tel:${order.phone}`;
      phone.textContent = order.phone;
      contacts.append(phone);
    }
    if (whatsappNumber) {
      const whatsapp = document.createElement("a");
      whatsapp.href = `https://wa.me/${encodeURIComponent(whatsappNumber)}?text=${encodeURIComponent(`Hello ${order.name || ""}, I'm following up on your ${order.service || "design"} enquiry.`)}`;
      whatsapp.target = "_blank";
      whatsapp.rel = "noopener noreferrer";
      whatsapp.textContent = "Message on WhatsApp ↗";
      contacts.append(whatsapp);
    }
    if (contacts.childElementCount) content.append(contacts);

    const message = document.createElement("section");
    message.className = "order-detail-message";
    const messageHeading = document.createElement("h3");
    messageHeading.textContent = "Project details";
    const messageText = document.createElement("p");
    messageText.textContent = order.message || "No project details were provided.";
    message.append(messageHeading, messageText);
    content.append(message);

    if (typeof order.sampleImageUrl === "string" && order.sampleImageUrl.startsWith("https://")) {
      const sample = document.createElement("section");
      sample.className = "order-detail-message order-sample-image";
      const sampleHeading = document.createElement("h3");
      sampleHeading.textContent = "Customer sample image";
      const imageLink = document.createElement("a");
      imageLink.href = order.sampleImageUrl;
      imageLink.target = "_blank";
      imageLink.rel = "noopener noreferrer";
      imageLink.setAttribute("aria-label", "Open customer sample image in a new tab");
      const image = document.createElement("img");
      image.src = order.sampleImageUrl;
      image.alt = `Sample supplied by ${order.name || "the customer"}`;
      image.loading = "lazy";
      imageLink.append(image);
      sample.append(sampleHeading, imageLink);
      content.append(sample);
    }

    const actions = document.createElement("div");
    actions.className = "order-detail-actions";
    const statusLabel = document.createElement("label");
    statusLabel.className = "order-detail-status";
    statusLabel.textContent = "Order status";
    const statusSelect = document.createElement("select");
    statusSelect.className = "status-select";
    statusSelect.setAttribute("aria-label", "Change order status");
    ["Pending", "In Progress", "Completed", "Cancelled"].forEach((status) => statusSelect.add(new Option(status, status)));
    statusSelect.value = ["Pending", "In Progress", "Completed", "Cancelled"].includes(order.status) ? order.status : "Pending";
    setStatusClass(statusSelect);
    statusSelect.addEventListener("change", () => changeStatus(order.orderId, statusSelect.value, statusSelect));
    statusLabel.append(statusSelect);
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "admin-button delete-service-button";
    deleteButton.textContent = "Delete order";
    deleteButton.addEventListener("click", () => deleteOrder(order.orderId, order.name));
    actions.append(statusLabel, deleteButton);
    content.append(actions);
  }

  async function deleteService(service) {
    if (services.length < 2) {
      showToast("Keep at least one service on the website.", true);
      return;
    }
    if (!window.confirm(`Remove "${service.title}" from the website? Existing orders will remain in your dashboard.`)) return;
    try {
      await window.firebaseDb.ref(`siteContent/services/${service.id}`).remove();
      showToast(`${service.title} removed from the website.`);
    } catch (error) {
      console.error(`Could not remove service ${service.id}.`, error);
      showToast("Could not remove this service. Check your database rules.", true);
    }
  }

  function showNotice(message) {
    notice.textContent = message;
    notice.hidden = false;
  }
  function showToast(message, isError = false) {
    const toast = document.createElement("div");
    toast.className = `toast${isError ? " error" : ""}`;
    toast.textContent = message;
    document.getElementById("toast-stack").append(toast);
    window.setTimeout(() => toast.remove(), 5500);
  }
  function money(value) {
    return `Rs ${new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(Number(value) || 0)}`;
  }
  function updateMetrics() {
    setMetric("visitors", totalVisitors);
    setMetric("visitorsToday", todayVisitors);
    const todayOrders = orders.filter((order) => order.dateKey === todayKey);
    setMetric("orders", orders.length);
    setMetric("ordersToday", todayOrders.length);
    setMetric("pending", orders.filter((order) => order.status === "Pending").length);
    setMetric("completed", orders.filter((order) => order.status === "Completed").length);
    document.getElementById("order-count-badge").textContent = orders.filter((order) => order.status === "Pending").length;
    document.getElementById("orders-heading-count").textContent = orders.length;
    drawChart();
  }
  function setMetric(name, value) {
    const node = document.querySelector(`[data-metric="${name}"]`);
    if (node) node.textContent = value;
  }

  function filteredOrders() {
    const search = document.getElementById("order-search").value.trim().toLowerCase();
    const status = document.getElementById("status-filter").value;
    const service = document.getElementById("service-filter").value;
    const date = document.getElementById("date-filter").value;
    return orders.filter((order) => {
      const searchable = [order.orderId, order.name, order.email, order.phone, order.service, order.message].join(" ").toLowerCase();
      return (!search || searchable.includes(search))
        && (!status || order.status === status)
        && (!service || order.serviceId === service)
        && (!date || order.dateKey === date);
    });
  }

  function renderOrders() {
    const list = document.getElementById("orders-list");
    list.replaceChildren();
    const filtered = filteredOrders();
    document.getElementById("empty-orders").hidden = filtered.length > 0;
    document.getElementById("results-count").textContent = `${filtered.length} ${filtered.length === 1 ? "order" : "orders"} shown`;
    const template = document.getElementById("order-row-template");
    filtered.forEach((order) => {
      const row = template.content.firstElementChild.cloneNode(true);
      const cells = row.querySelectorAll("td");
      row.classList.add("order-row-clickable");
      row.tabIndex = 0;
      row.setAttribute("aria-label", `View order ${order.orderId} from ${order.name || "client"}`);
      const detailTrigger = document.createElement("button");
      detailTrigger.type = "button";
      detailTrigger.className = "order-detail-trigger";
      detailTrigger.textContent = order.orderId;
      detailTrigger.addEventListener("click", () => showOrderDetails(order));
      cells[0].querySelector("strong").replaceWith(detailTrigger);
      cells[0].querySelector("small").textContent = order.dateKey || "";
      cells[1].querySelector("strong").textContent = order.name || "—";
      const email = cells[1].querySelector("a:not(.client-whatsapp)");
      email.textContent = order.email || "No email";
      email.href = order.email ? `mailto:${order.email}` : "#";
      cells[1].querySelector(".customer-phone").textContent = order.phone || "No phone";
      const whatsapp = cells[1].querySelector(".client-whatsapp");
      const phone = String(order.phone || "").replace(/[^\d]/g, "");
      whatsapp.href = phone ? `https://wa.me/${encodeURIComponent(phone)}?text=${encodeURIComponent(`Hello ${order.name || ""}, I'm following up on your ${order.service || "design"} enquiry.`)}` : "#";
      cells[2].textContent = order.service || "—";
      cells[3].textContent = order.message || "—";
      const date = new Date(Number(order.createdAt) || 0);
      cells[4].textContent = Number(order.createdAt) ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date) : "—";
      const select = row.querySelector(".status-select");
      select.value = ["Pending", "In Progress", "Completed", "Cancelled"].includes(order.status) ? order.status : "Pending";
      setStatusClass(select);
      select.addEventListener("change", () => changeStatus(order.orderId, select.value, select));
      row.querySelector(".delete-order").addEventListener("click", () => deleteOrder(order.orderId, order.name));
      row.addEventListener("click", (event) => {
        if (event.target.closest("button, a, select, input")) return;
        showOrderDetails(order);
      });
      row.addEventListener("keydown", (event) => {
        if (event.target !== row || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        showOrderDetails(order);
      });
      list.append(row);
    });
  }

  function setStatusClass(select) {
    select.className = `status-select status-${select.value.replaceAll(" ", "-")}`;
  }
  async function changeStatus(orderId, status, select) {
    select.disabled = true;
    try {
      await window.firebaseDb.ref(`orders/${orderId}/status`).set(status);
      showToast(`Order status updated to ${status}.`);
    } catch (error) {
      console.error(`Could not update order ${orderId}.`, error);
      showToast("Could not update this order. Check your database rules.", true);
      const current = orderCache.get(orderId);
      select.value = current?.status || "Pending";
    } finally {
      select.disabled = false;
      setStatusClass(select);
    }
  }
  async function deleteOrder(orderId, name) {
    if (!window.confirm(`Delete the order from ${name || "this client"}? This cannot be undone.`)) return;
    try {
      await window.firebaseDb.ref(`orders/${orderId}`).remove();
      if (activeOrderId === orderId) {
        document.getElementById("order-detail-dialog").close();
        activeOrderId = "";
      }
      showToast("Order deleted.");
    } catch (error) {
      console.error(`Could not delete order ${orderId}.`, error);
      showToast("Could not delete this order. Check your database rules.", true);
    }
  }

  function drawChart() {
    const canvas = document.getElementById("activity-chart");
    if (!canvas || dashboard.hidden) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    const width = rect.width;
    const height = rect.height;
    const pad = { top: 15, right: 15, bottom: 30, left: 38 };
    const chartW = width - pad.left - pad.right;
    const chartH = height - pad.top - pad.bottom;
    const dates = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      return date.toISOString().slice(0, 10);
    });
    const visits = dates.map((date) => Number(visitsByDate[date]) || 0);
    const maxVisits = Math.max(...visits, 1);
    ctx.clearRect(0, 0, width, height);
    ctx.font = "9px DM Sans, sans-serif";
    ctx.textBaseline = "middle";
    for (let line = 0; line <= 3; line++) {
      const y = pad.top + chartH * line / 3;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.strokeStyle = "rgba(255,255,255,.07)";
      ctx.stroke();
      ctx.fillStyle = "#777a81";
      ctx.textAlign = "right";
      ctx.fillText(String(Math.round(maxVisits * (1 - line / 3))), pad.left - 8, y);
    }
    const step = chartW / dates.length;
    const barW = Math.min(23, step * .42);
    const visitGradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
    visitGradient.addColorStop(0, "#fff0a6");
    visitGradient.addColorStop(.45, "#d2a43b");
    visitGradient.addColorStop(1, "#8e6418");
    dates.forEach((date, index) => {
      const center = pad.left + step * (index + .5);
      const barH = (visits[index] / maxVisits) * chartH;
      ctx.fillStyle = visitGradient;
      ctx.beginPath();
      ctx.roundRect(center - barW / 2, pad.top + chartH - barH, barW, Math.max(2, barH), 3);
      ctx.fill();
      ctx.fillStyle = "#85878d";
      ctx.textAlign = "center";
      ctx.fillText(new Intl.DateTimeFormat("en", { weekday: "short" }).format(new Date(`${date}T12:00:00`)), center, height - 10);
    });
  }

  document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));
  function switchView(name) {
    activeView = name;
    document.querySelectorAll(".admin-view").forEach((view) => view.classList.toggle("active", view.id === `${name}-view`));
    document.querySelectorAll(".side-link").forEach((link) => link.classList.toggle("active", link.dataset.view === name));
    if (name === "orders" && ordersReadError) showNotice(ordersReadError);
    else notice.hidden = true;
    document.getElementById("page-heading").textContent = ({ analytics: "Analytics", orders: "View orders", messages: "User messages", services: "Manage services" })[name] || "Analytics";
    document.getElementById("more-menu").hidden = true;
    document.getElementById("more-button").setAttribute("aria-expanded", "false");
    document.getElementById("sidebar").classList.remove("is-open");
    if (name === "analytics") requestAnimationFrame(drawChart);
  }
  document.getElementById("more-button").addEventListener("click", () => {
    const menu = document.getElementById("more-menu");
    menu.hidden = !menu.hidden;
    document.getElementById("more-button").setAttribute("aria-expanded", String(!menu.hidden));
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".menu-wrap")) {
      document.getElementById("more-menu").hidden = true;
      document.getElementById("more-button").setAttribute("aria-expanded", "false");
    }
  });
  document.getElementById("sign-out-button").addEventListener("click", () => window.firebaseAuth.signOut().catch((error) => {
    console.error("Could not sign out.", error);
    showToast("Could not sign out. Please try again.", true);
  }));
  document.getElementById("new-service-button").addEventListener("click", () => openServiceEditor());
  document.getElementById("close-visitor-chat").addEventListener("click", () => document.getElementById("visitor-chat-dialog").close());
  document.getElementById("visitor-chat-dialog").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) event.currentTarget.close();
  });
  document.getElementById("visitor-chat-dialog").addEventListener("close", () => { activeVisitorId = ""; });
  document.getElementById("visitor-notification-toggle").addEventListener("change", async (event) => {
    if (!activeVisitorId) return;
    try {
      await window.firebaseDb.ref(`chats/${activeVisitorId}/settings/notificationsEnabled`).set(event.currentTarget.checked);
      showToast(event.currentTarget.checked ? "Chat bell enabled for this visitor." : "Chat bell disabled for this visitor.");
    } catch (error) {
      console.error(`Could not update chat notification setting for ${activeVisitorId}.`, error);
      event.currentTarget.checked = visitorChats[activeVisitorId]?.settings?.notificationsEnabled !== false;
      showToast("Could not update this visitor’s chat bell. Check the database rules.", true);
    }
  });
  document.getElementById("admin-chat-reply-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = document.getElementById("admin-chat-reply-input");
    const feedback = document.getElementById("admin-chat-feedback");
    const text = input.value.trim();
    if (!activeVisitorId || text.length < 2 || text.length > 2000) {
      feedback.textContent = "Write a reply between 2 and 2,000 characters.";
      return;
    }
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    feedback.textContent = "";
    try {
      const root = `chats/${activeVisitorId}`;
      const messageRef = window.firebaseDb.ref(`${root}/messages`).push();
      await messageRef.set({ sender: "admin", text, createdAt: Date.now() });
      input.value = "";
      showToast("Reply sent.");
    } catch (error) {
      console.error(`Could not send a chat reply to ${activeVisitorId}.`, error);
      feedback.textContent = `Reply failed${error.code ? ` (${error.code})` : ""}. Check Firebase rules and try again.`;
    } finally {
      button.disabled = false;
    }
  });
  document.getElementById("admin-chat-reply-input").addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      event.currentTarget.form.requestSubmit();
    }
  });
  document.getElementById("delete-visitor-conversation").addEventListener("click", async () => {
    if (!activeVisitorId) return;
    const name = visitorChats[activeVisitorId]?.profile?.name || "this visitor";
    if (!window.confirm(`Delete the conversation with ${name}? This cannot be undone.`)) return;
    const visitorIdToDelete = activeVisitorId;
    try {
      const conversationRef = window.firebaseDb.ref(`chats/${visitorIdToDelete}`);
      await conversationRef.set(null);
      delete visitorChats[visitorIdToDelete];
      renderVisitorMessages();
      document.getElementById("visitor-chat-dialog").close();
      activeVisitorId = "";
      showToast("Conversation deleted.");
    } catch (error) {
      console.error(`Could not delete conversation ${visitorIdToDelete}.`, error);
      document.getElementById("admin-chat-feedback").textContent = `Conversation could not be deleted${error.code ? ` (${error.code})` : ""}. Check the Firebase rules and try again.`;
    }
  });
  document.getElementById("cancel-service-edit").addEventListener("click", () => document.getElementById("service-dialog").close());
  document.getElementById("service-dialog").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) event.currentTarget.close();
  });
  document.getElementById("order-detail-dialog").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) event.currentTarget.close();
  });
  document.getElementById("close-order-details").addEventListener("click", () => document.getElementById("order-detail-dialog").close());
  document.getElementById("order-detail-dialog").addEventListener("close", () => { activeOrderId = ""; });
  document.getElementById("service-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const feedback = document.getElementById("service-form-feedback");
    const saveButton = document.getElementById("save-service-button");
    const formData = new FormData(form);
    const title = String(formData.get("title") || "").trim();
    const editingId = String(formData.get("serviceId") || "");
    const id = editingId || title.normalize("NFKD").toLowerCase()
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const imageUrl = String(formData.get("imageUrl") || "").trim();
    const features = String(formData.get("features") || "").split(/\r?\n/).map((feature) => feature.trim()).filter(Boolean);
    const existing = services.find((service) => service.id === id);
    let imageUrlIsValid = !imageUrl;
    if (imageUrl) {
      try {
        imageUrlIsValid = ["http:", "https:"].includes(new URL(imageUrl).protocol);
      } catch {
        imageUrlIsValid = false;
      }
    }
    if (!title || !id || !String(formData.get("shortDescription") || "").trim()
      || !String(formData.get("fullDescription") || "").trim()
      || !String(formData.get("deliveryTime") || "").trim()
      || !features.length || !imageUrlIsValid
      || (!editingId && services.some((service) => service.id === id))) {
      feedback.textContent = !imageUrlIsValid
        ? "Use a valid image link starting with http:// or https://."
        : (!editingId && services.some((service) => service.id === id)
          ? "A service with this name already exists. Choose a different name."
          : "Complete all required fields and add at least one feature.");
      return;
    }
    const service = {
      id,
      title,
      imageUrl,
      shortDescription: String(formData.get("shortDescription")).trim(),
      fullDescription: String(formData.get("fullDescription")).trim(),
      deliveryTime: String(formData.get("deliveryTime")).trim(),
      features,
      displayOrder: existing?.displayOrder ?? services.length
    };
    saveButton.disabled = true;
    saveButton.textContent = "Saving…";
    feedback.textContent = "";
    try {
      await window.firebaseDb.ref(`siteContent/services/${id}`).set(service);
      document.getElementById("service-dialog").close();
      showToast(`${title} saved. It will appear on the website shortly.`);
    } catch (error) {
      console.error(`Could not save service ${id}.`, error);
      feedback.textContent = "Could not save this service. Check the database rules and try again.";
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = "Save service";
    }
  });
  document.getElementById("mobile-sidebar-toggle").addEventListener("click", () => document.getElementById("sidebar").classList.toggle("is-open"));
  ["order-search", "status-filter", "service-filter", "date-filter"].forEach((id) => document.getElementById(id).addEventListener("input", renderOrders));
  document.getElementById("clear-filters").addEventListener("click", () => {
    document.getElementById("order-search").value = "";
    document.getElementById("status-filter").value = "";
    document.getElementById("service-filter").value = "";
    document.getElementById("date-filter").value = "";
    renderOrders();
  });
  document.getElementById("refresh-button").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const originalHtml = button.innerHTML;
    button.disabled = true;
    button.innerHTML = "↻ <span>Refreshing…</span>";
    try {
      const requests = [
        ["orders", window.firebaseDb.ref("orders").once("value")],
        ["total visits", window.firebaseDb.ref("analytics/totalVisits").once("value")],
        ["today's visits", window.firebaseDb.ref(`analytics/visitsByDate/${todayKey}`).once("value")],
        ["visit history", window.firebaseDb.ref("analytics/visitsByDate").once("value")]
      ];
      const results = await Promise.allSettled(requests.map(([, request]) => request));
      const failures = [];
      results.forEach((result, index) => {
        const [label] = requests[index];
        if (result.status === "rejected") {
          console.error(`Could not refresh ${label}.`, result.reason);
          failures.push(`${label}${result.reason?.code ? ` (${result.reason.code})` : ""}: ${result.reason?.message || "read failed"}`);
          return;
        }
        if (label === "orders") {
          applyOrdersSnapshot(result.value);
          ordersReadError = "";
        } else if (label === "total visits") totalVisitors = Number(result.value.val()) || 0;
        else if (label === "today's visits") todayVisitors = Number(result.value.val()) || 0;
        else visitsByDate = result.value.val() || {};
      });
      updateMetrics();
      if (failures.length) {
        const orderFailure = failures.find((failure) => failure.startsWith("orders "));
        ordersReadError = orderFailure ? `Orders read failed: ${orderFailure.slice("orders ".length)}. The published /orders .read rule must match the signed-in admin UID.` : "";
        showNotice(`Some dashboard data could not be refreshed: ${failures.join(" · ")}`);
      } else {
        ordersReadError = "";
        notice.hidden = true;
        showToast(`Refreshed: ${orders.length} orders and analytics data loaded.`);
      }
    } catch (error) {
      console.error("Could not manually refresh dashboard data.", error);
      showNotice(`Refresh failed${error.code ? ` (${error.code})` : ""}: ${error.message}. Check Firebase rules and the configured database URL.`);
    } finally {
      button.disabled = false;
      button.innerHTML = originalHtml;
    }
  });
  window.addEventListener("resize", () => requestAnimationFrame(drawChart));
})();
