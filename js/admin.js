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
  let orders = [];
  let visitsByDate = {};
  let totalVisitors = 0;
  let todayVisitors = 0;
  const todayKey = new Date().toISOString().slice(0, 10);

  document.getElementById("today-label").textContent = new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date());
  if (!window.firebaseReady || !window.firebaseAuth || !window.firebaseDb) {
    loginError.textContent = "Firebase is not configured. Add your Firebase web app settings in assets/assets.js.";
    loginButton.disabled = true;
    return;
  }
  if (!config.adminUid) {
    loginError.textContent = "Admin access is not configured. Add your Firebase admin user UID in assets/assets.js.";
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
    if (error.code === "auth/unauthorized-domain") return "Add this website domain to the Firebase Authentication authorized domains.";
    return "Sign-in failed. Check your connection and Firebase Authentication setup.";
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
      loginError.textContent = "This Firebase account is not authorized to access the admin panel.";
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
    orders = [];
    previousOrderIds = new Set();
    initialOrdersLoaded = false;
  }

  function listen(ref, event, callback) {
    ref.on(event, callback, (error) => {
      console.error(`Firebase listener failed at ${ref.toString()}.`, error);
      showNotice(`Could not load dashboard data: ${error.message}`);
    });
    databaseListeners.push({ ref, event, callback });
  }

  function startListeners() {
    stopListeners();
    const ordersRef = window.firebaseDb.ref("orders").orderByChild("createdAt");
    listen(ordersRef, "value", (snapshot) => {
      const nextOrders = [];
      snapshot.forEach((child) => {
        const order = child.val();
        if (order && typeof order === "object") {
          order.orderId = order.orderId || child.key;
          nextOrders.push(order);
        }
      });
      nextOrders.reverse();
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
      updateMetrics();
    });
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
    document.getElementById("service-filter").replaceChildren(new Option("All services", ""));
    config.services.forEach((service) => document.getElementById("service-filter").add(new Option(service.title, service.id)));
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
    const activeOrders = orders.filter((order) => order.status !== "Cancelled");
    const sales = activeOrders.reduce((sum, order) => sum + (Number(order.price) || 0), 0);
    const salesToday = todayOrders.filter((order) => order.status !== "Cancelled").reduce((sum, order) => sum + (Number(order.price) || 0), 0);
    setMetric("orders", orders.length);
    setMetric("ordersToday", todayOrders.length);
    setMetric("sales", money(sales));
    setMetric("salesToday", money(salesToday));
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
      cells[0].querySelector("strong").textContent = order.orderId;
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
      cells[3].textContent = money(order.price);
      cells[4].textContent = order.message || "—";
      const date = new Date(Number(order.createdAt) || 0);
      cells[5].textContent = Number(order.createdAt) ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date) : "—";
      const select = row.querySelector(".status-select");
      select.value = ["Pending", "In Progress", "Completed", "Cancelled"].includes(order.status) ? order.status : "Pending";
      setStatusClass(select);
      select.addEventListener("change", () => changeStatus(order.orderId, select.value, select));
      row.querySelector(".delete-order").addEventListener("click", () => deleteOrder(order.orderId, order.name));
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
    const sales = dates.map((date) => orders.filter((order) => order.dateKey === date && order.status !== "Cancelled").reduce((sum, order) => sum + (Number(order.price) || 0), 0));
    const maxVisits = Math.max(...visits, 1);
    const maxSales = Math.max(...sales, 1);
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
    const points = [];
    dates.forEach((date, index) => {
      const center = pad.left + step * (index + .5);
      const barH = (visits[index] / maxVisits) * chartH;
      ctx.fillStyle = "rgba(242,120,86,.78)";
      ctx.beginPath();
      ctx.roundRect(center - barW / 2, pad.top + chartH - barH, barW, Math.max(2, barH), 3);
      ctx.fill();
      const x = center;
      const y = pad.top + chartH - (sales[index] / maxSales) * chartH;
      points.push({ x, y });
      ctx.fillStyle = "#85878d";
      ctx.textAlign = "center";
      ctx.fillText(new Intl.DateTimeFormat("en", { weekday: "short" }).format(new Date(`${date}T12:00:00`)), x, height - 10);
    });
    ctx.beginPath();
    points.forEach(({ x, y }, index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.strokeStyle = "#64cc98";
    ctx.lineWidth = 2;
    ctx.stroke();
    points.forEach(({ x, y }) => {
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#64cc98";
      ctx.fill();
    });
  }

  document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));
  function switchView(name) {
    document.querySelectorAll(".admin-view").forEach((view) => view.classList.toggle("active", view.id === `${name}-view`));
    document.querySelectorAll(".side-link").forEach((link) => link.classList.toggle("active", link.dataset.view === name));
    document.getElementById("page-heading").textContent = name === "orders" ? "View orders" : "Analytics";
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
  document.getElementById("mobile-sidebar-toggle").addEventListener("click", () => document.getElementById("sidebar").classList.toggle("is-open"));
  ["order-search", "status-filter", "service-filter", "date-filter"].forEach((id) => document.getElementById(id).addEventListener("input", renderOrders));
  document.getElementById("clear-filters").addEventListener("click", () => {
    document.getElementById("order-search").value = "";
    document.getElementById("status-filter").value = "";
    document.getElementById("service-filter").value = "";
    document.getElementById("date-filter").value = "";
    renderOrders();
  });
  document.getElementById("refresh-button").addEventListener("click", () => {
    renderOrders();
    updateMetrics();
    showToast("Dashboard data refreshed.");
  });
  window.addEventListener("resize", () => requestAnimationFrame(drawChart));
})();
