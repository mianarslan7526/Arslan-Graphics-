(async function () {
  "use strict";
  const config = window.SITE_CONFIG;
  if (window.siteServicesReady) await window.siteServicesReady;
  const params = new URLSearchParams(window.location.search);
  let service = config.services.find((item) => item.id === params.get("id"));
  if (!service) {
    window.location.replace("index.html#services");
    return;
  }

  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const whatsapp = (message) => `https://wa.me/${encodeURIComponent(config.contact.whatsappNumber)}?text=${encodeURIComponent(message)}`;
  const detailArt = document.getElementById("detail-art");
  const featureList = document.getElementById("service-features");
  function updateServiceDetails() {
    document.title = `${service.title} — ${config.brandName}`;
    document.querySelector('meta[name="description"]').content = `${service.shortDescription} View details and request ${service.title} from ${config.brandName}.`;
    document.querySelector('meta[property="og:title"]').content = `${service.title} — ${config.brandName}`;
    document.getElementById("service-title").textContent = service.title;
    document.getElementById("service-description").textContent = service.fullDescription;
    const formattedPrice = new Intl.NumberFormat("en-PK").format(Number(service.price) || 0);
    document.getElementById("service-price").textContent = `Starting from Rs. ${formattedPrice}`;
    document.getElementById("service-delivery").textContent = service.deliveryTime || "";
    detailArt.replaceChildren();
    if (service.imageUrl) {
      detailArt.classList.add("has-image");
      const image = document.createElement("img");
      image.src = service.imageUrl;
      image.alt = `${service.title} design example`;
      image.fetchPriority = "high";
      image.addEventListener("error", () => {
        console.error(`Could not load the service detail image for ${service.title}: ${service.imageUrl}`);
        detailArt.classList.remove("has-image");
        image.remove();
        detailArt.innerHTML = `<div class="detail-art-shape"><span>${escapeHtml(service.title.slice(0, 1))}</span><b>AG / 0${config.services.indexOf(service) + 1}</b></div>`;
      }, { once: true });
      detailArt.append(image);
    } else {
      detailArt.classList.remove("has-image");
      detailArt.innerHTML = `<div class="detail-art-shape"><span>${escapeHtml(service.title.slice(0, 1))}</span><b>AG / 0${config.services.indexOf(service) + 1}</b></div>`;
    }
    featureList.replaceChildren();
    service.features.forEach((feature) => {
      const item = document.createElement("li");
      item.textContent = feature;
      featureList.append(item);
    });
    const serviceSelect = document.getElementById("order-service");
    if (serviceSelect) {
      const selectedId = service.id;
      serviceSelect.replaceChildren();
      config.services.forEach((item) => {
        const option = new Option(item.title, item.id, false, item.id === selectedId);
        serviceSelect.add(option);
      });
    }
    const greeting = `Hello, I want to order ${service.title}.`;
    ["service-whatsapp", "order-whatsapp", "whatsapp-float"].forEach((id) => {
      const link = document.getElementById(id);
      if (link) link.href = whatsapp(id === "whatsapp-float" ? `Hello Arslan Graphics, I want to know about ${service.title}.` : greeting);
    });
  }
  document.querySelectorAll(".brand-name").forEach((brandName) => {
    brandName.innerHTML = `${escapeHtml(config.brandName.split(" ")[0])} <b>${escapeHtml(config.brandName.split(" ").slice(1).join(" "))}</b>`;
  });
  const logoUrl = String(config.logoUrl || "").trim();
  document.querySelectorAll("[data-logo]").forEach((logo) => {
    if (!logoUrl) return;
    logo.src = logoUrl;
    logo.hidden = false;
    logo.parentElement.querySelector(".brand-mark").hidden = true;
  });
  if (config.faviconUrl) document.getElementById("favicon").href = config.faviconUrl;
  document.getElementById("year").textContent = new Date().getFullYear();
  const socialPaths = {
    instagram: '<rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="6" r="1.2"/>',
    facebook: '<path d="M13.5 21v-8h2.7l.4-3.1h-3.1v-2c0-.9.3-1.5 1.6-1.5h1.7V3.6c-.3 0-1.3-.1-2.4-.1-2.4 0-4.1 1.5-4.1 4.2v2.3H7.5V13h2.8v8z"/>',
    tiktok: '<path d="M19.6 7.4a6 6 0 0 1-3.7-1.3v8.1a5.7 5.7 0 1 1-5-5.7v3.1a2.7 2.7 0 1 0 2 2.6V2h3a6 6 0 0 0 3.7 5.4z"/>',
    youtube: '<path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6z"/>',
    linkedin: '<path d="M5.2 7.7a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM3.5 9.2h3.4V21H3.5zM9 9.2h3.3v1.6h.1a3.6 3.6 0 0 1 3.3-1.8c3.5 0 4.1 2.3 4.1 5.3V21h-3.5v-5.9c0-1.4 0-3.1-1.9-3.1s-2.1 1.5-2.1 3V21H9z"/>',
    behance: '<path d="M8.3 11.1c1.4 0 2.2-.5 2.2-1.7 0-1.1-.8-1.5-2.2-1.5H4.8v3.2zM4.8 17.9h3.8c1.4 0 2.4-.6 2.4-2 0-1.3-1-1.9-2.4-1.9H4.8zm9.5-9.8h6V6h-6zm6.8 8.1h-7.1c.1 1.5 1 2.3 2.5 2.3 1 0 1.8-.5 2-1.1h2.4c-.7 2.2-2.4 3.3-4.5 3.3-3.1 0-5-2.1-5-5.1 0-2.9 2-5.2 5-5.2 3.3 0 4.9 2.8 4.7 5.8Zm-19-9H9c2.6 0 4.3 1.1 4.3 3.4 0 1.3-.6 2.2-1.8 2.8 1.8.5 2.6 1.8 2.6 3.5 0 2.7-2.3 4.1-5 4.1H2.1z"/>'
  };
  config.socialLinks.filter((social) => {
    try { return ["http:", "https:"].includes(new URL(social.url).protocol); } catch { return false; }
  }).forEach((social) => {
    const link = document.createElement("a");
    link.className = "social-link";
    link.href = social.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.title = social.name;
    link.setAttribute("aria-label", social.name);
    if (social.iconUrl) {
      const image = document.createElement("img");
      image.src = social.iconUrl;
      image.alt = "";
      link.append(image);
    } else link.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${socialPaths[social.icon] || ""}</svg>`;
    document.getElementById("footer-social").append(link);
  });
  updateServiceDetails();

  const navMenu = document.getElementById("nav-links");
  const navToggle = document.getElementById("menu-toggle");
  navToggle.addEventListener("click", () => {
    const open = navToggle.getAttribute("aria-expanded") !== "true";
    navToggle.setAttribute("aria-expanded", String(open));
    navToggle.setAttribute("aria-label", open ? "Close navigation menu" : "Open navigation menu");
    navMenu.classList.toggle("is-open", open);
    document.body.classList.toggle("menu-open", open);
  });
  navMenu.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
    navToggle.setAttribute("aria-expanded", "false");
    navMenu.classList.remove("is-open");
    document.body.classList.remove("menu-open");
  }));

  const revealItems = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const observer = new IntersectionObserver((entries, current) => entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      current.unobserve(entry.target);
    }), { threshold: .12 });
    revealItems.forEach((item) => observer.observe(item));
  } else revealItems.forEach((item) => item.classList.add("is-visible"));

  const form = document.getElementById("order-form");
  const feedback = document.getElementById("form-feedback");
  const success = document.getElementById("order-success");
  const submit = document.getElementById("submit-order");
  const sampleImageInput = document.getElementById("order-sample-image");
  const sampleUpload = document.getElementById("sample-upload");
  const sampleImagePreview = document.getElementById("sample-upload-preview");
  const sampleImagePrompt = document.getElementById("sample-upload-prompt");
  const sampleImageStatus = document.getElementById("sample-upload-status");
  const sampleImageError = document.getElementById("sample-image-error");
  const removeSampleImage = document.getElementById("remove-sample-image");
  let sampleImageObjectUrl = "";
  let selectedSampleImage = null;
  const fields = ["name", "phone", "email", "serviceId", "message"];
  function setSampleImage(file) {
    sampleImageError.textContent = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      sampleImageError.textContent = "Choose a JPG, PNG, WebP, or GIF image.";
      sampleImageInput.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      sampleImageError.textContent = "Image must be 10 MB or smaller.";
      sampleImageInput.value = "";
      return;
    }
    if (sampleImageObjectUrl) URL.revokeObjectURL(sampleImageObjectUrl);
    selectedSampleImage = file;
    sampleImageObjectUrl = URL.createObjectURL(file);
    sampleImagePreview.src = sampleImageObjectUrl;
    sampleImagePreview.hidden = false;
    sampleImagePrompt.hidden = true;
    sampleUpload.classList.add("has-preview");
    sampleImageStatus.textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB · ready to upload`;
    removeSampleImage.hidden = false;
  }
  function clearSampleImage() {
    selectedSampleImage = null;
    sampleImageInput.value = "";
    sampleImagePreview.removeAttribute("src");
    sampleImagePreview.hidden = true;
    sampleImagePrompt.hidden = false;
    sampleUpload.classList.remove("has-preview", "is-dragging");
    sampleImageStatus.textContent = "Optional · JPG, PNG, WebP, or GIF up to 10 MB.";
    sampleImageError.textContent = "";
    removeSampleImage.hidden = true;
    if (sampleImageObjectUrl) URL.revokeObjectURL(sampleImageObjectUrl);
    sampleImageObjectUrl = "";
  }
  sampleImageInput.addEventListener("change", () => setSampleImage(sampleImageInput.files[0]));
  removeSampleImage.addEventListener("click", clearSampleImage);
  ["dragenter", "dragover"].forEach((eventName) => sampleUpload.addEventListener(eventName, (event) => {
    event.preventDefault();
    sampleUpload.classList.add("is-dragging");
  }));
  ["dragleave", "drop"].forEach((eventName) => sampleUpload.addEventListener(eventName, (event) => {
    event.preventDefault();
    sampleUpload.classList.remove("is-dragging");
  }));
  sampleUpload.addEventListener("drop", (event) => setSampleImage(event.dataTransfer.files[0]));
  async function uploadSampleImage(file) {
    const apiKey = String(config.imgbbApiKey || "").trim();
    if (!apiKey) throw new Error("ImgBB upload is not configured. Add your ImgBB API key in assets/assets.js.");
    const payload = new FormData();
    payload.append("key", apiKey);
    payload.append("image", file, file.name);
    sampleImageStatus.textContent = "Uploading sample image…";
    const response = await fetch("https://api.imgbb.com/1/upload", { method: "POST", body: payload });
    if (!response.ok) throw new Error(`ImgBB upload failed (HTTP ${response.status}).`);
    const result = await response.json();
    const imageUrl = result?.data?.display_url;
    if (!result?.success || typeof imageUrl !== "string" || !imageUrl.startsWith("https://")) {
      throw new Error(result?.error?.message || "ImgBB did not return a valid image link.");
    }
    return imageUrl;
  }
  function setError(name, message) {
    const field = form.elements[name];
    const error = form.querySelector(`[data-error="${name}"]`);
    field.setAttribute("aria-invalid", message ? "true" : "false");
    error.textContent = message;
  }
  function validate() {
    const values = Object.fromEntries(new FormData(form));
    let valid = true;
    fields.forEach((name) => setError(name, ""));
    if (values.name.trim().length < 2) { setError("name", "Please enter your name."); valid = false; }
    if (!/^[+\d][\d\s().-]{6,28}$/.test(values.phone.trim())) { setError("phone", "Enter a valid phone or WhatsApp number."); valid = false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) { setError("email", "Enter a valid email address."); valid = false; }
    if (!config.services.some((item) => item.id === values.serviceId)) { setError("serviceId", "Please choose a service."); valid = false; }
    if (values.message.trim().length < 10) { setError("message", "Please add a little more detail (at least 10 characters)."); valid = false; }
    const budget = form.elements.budget.value;
    if (budget && (!Number.isFinite(Number(budget)) || Number(budget) < 0 || Number(budget) > 100000000)) {
      feedback.textContent = "Please enter a valid budget.";
      valid = false;
    } else feedback.textContent = "";
    return { valid, values };
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    sampleImageError.textContent = "";
    const { valid, values } = validate();
    if (!valid) {
      form.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }
    if (!window.firebaseReady || !window.firebaseDb) {
      feedback.textContent = "Online ordering is not available yet. Please contact us on WhatsApp or email.";
      feedback.classList.add("is-error");
      return;
    }
    const selectedService = config.services.find((item) => item.id === values.serviceId);
    submit.disabled = true;
    submit.textContent = selectedSampleImage ? "Uploading sample…" : "Sending request…";
    feedback.textContent = "";
    feedback.classList.remove("is-error");
    try {
      const sampleImageUrl = selectedSampleImage ? await uploadSampleImage(selectedSampleImage) : "";
      if (selectedSampleImage) sampleImageStatus.textContent = "Sample uploaded. Saving your request…";
      const orderRef = window.firebaseDb.ref("orders").push();
      const now = Date.now();
      const order = {
        orderId: orderRef.key,
        name: values.name.trim(),
        phone: values.phone.trim(),
        email: values.email.trim(),
        service: selectedService.title,
        serviceId: selectedService.id,
        price: Number(selectedService.price) || 0,
        message: values.message.trim(),
        status: "Pending",
        createdAt: now,
        dateKey: new Date(now).toISOString().slice(0, 10)
      };
      if (form.elements.budget.value) order.budget = Number(form.elements.budget.value);
      if (sampleImageUrl) order.sampleImageUrl = sampleImageUrl;
      await orderRef.set(order);
      document.getElementById("success-order-id").textContent = order.orderId;
      form.hidden = true;
      success.hidden = false;
      success.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (error) {
      console.error("Could not save the order to Firebase.", error);
      if (selectedSampleImage && !config.imgbbApiKey) {
        sampleImageError.textContent = "Add your ImgBB API key in assets/assets.js, or remove the sample image to send the request without it.";
      } else if (selectedSampleImage && !error.message.includes("ImgBB upload failed")) {
        sampleImageError.textContent = error.message;
      } else if (selectedSampleImage) {
        sampleImageError.textContent = `${error.message} Please try again or remove the sample image.`;
      } else if (error.code === "PERMISSION_DENIED") {
        feedback.textContent = "Firebase denied this order. Ask the site owner to publish the latest Realtime Database rules, then try again.";
      } else {
        feedback.textContent = "Your request could not be saved. Please try again or contact us on WhatsApp.";
      }
      feedback.classList.add("is-error");
      submit.disabled = false;
      submit.innerHTML = 'Send project request <span aria-hidden="true">↗</span>';
    }
  });
  window.addEventListener("site-services-updated", () => {
    const updatedService = config.services.find((item) => item.id === params.get("id"));
    if (!updatedService) {
      window.location.replace("index.html#services");
      return;
    }
    service = updatedService;
    updateServiceDetails();
  });
})();
