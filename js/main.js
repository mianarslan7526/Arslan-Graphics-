(function () {
  "use strict";
  const config = window.SITE_CONFIG;
  if (!config) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const safeExternalUrl = (value) => {
    try {
      const url = new URL(value);
      return ["https:", "http:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  };

  function configureBrand() {
    const logoUrl = String(config.logoUrl || "").trim();
    document.querySelectorAll("[data-logo]").forEach((logo) => {
      if (!logoUrl) return;
      logo.src = logoUrl;
      logo.hidden = false;
      const mark = logo.parentElement.querySelector(".brand-mark");
      if (mark) mark.hidden = true;
    });
    if (logoUrl) {
      const introLogo = document.getElementById("intro-logo");
      introLogo.addEventListener("load", () => introLogo.classList.add("is-loaded"), { once: true });
      introLogo.addEventListener("error", () => {
        console.error(`Could not load the intro logo: ${logoUrl}`);
        introLogo.hidden = true;
      }, { once: true });
      introLogo.src = logoUrl;
      introLogo.hidden = false;
      if (introLogo.complete && introLogo.naturalWidth > 0) introLogo.classList.add("is-loaded");
    }
    if (config.faviconUrl) document.getElementById("favicon").href = config.faviconUrl;
    document.querySelectorAll(".brand-name").forEach((name) => {
      name.innerHTML = `${escapeHtml(config.brandName.split(" ")[0])} <b>${escapeHtml(config.brandName.split(" ").slice(1).join(" "))}</b>`;
    });
    document.getElementById("year").textContent = new Date().getFullYear();
    document.getElementById("contact-email").href = `mailto:${config.contact.email}`;
    document.getElementById("contact-phone").href = `tel:+${config.contact.whatsappNumber}`;
    document.getElementById("contact-phone").textContent = config.contact.phoneDisplay;
    const contactLink = whatsappLink("Hello Arslan Graphics, I want to know about your services.");
    document.getElementById("contact-whatsapp").href = contactLink;
    document.getElementById("whatsapp-float").href = contactLink;
    if (config.heroImageUrl) {
      const frontCard = document.querySelector(".art-card-front");
      const imageUrl = String(config.heroImageUrl).trim().replaceAll('"', "%22");
      frontCard.style.backgroundImage = `url("${imageUrl}")`;
      frontCard.classList.add("has-image");
    }
    if (config.aboutImageUrl) {
      const photo = document.getElementById("about-photo");
      photo.style.backgroundImage = `url("${config.aboutImageUrl.replaceAll('"', "%22")}")`;
      photo.classList.add("has-image");
      photo.setAttribute("aria-label", `${config.brandName} designer portrait`);
    }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }

  function whatsappLink(message) {
    return `https://wa.me/${encodeURIComponent(config.contact.whatsappNumber)}?text=${encodeURIComponent(message)}`;
  }

  function renderServices() {
    const grid = document.getElementById("services-grid");
    grid.replaceChildren();
    config.services.forEach((service, index) => {
      const link = document.createElement("a");
      link.className = "service-card reveal";
      link.href = `service.html?id=${encodeURIComponent(service.id)}`;
      link.setAttribute("aria-label", `${service.title}: ${service.shortDescription}`);
      const image = document.createElement("div");
      image.className = "service-image";
      if (service.imageUrl) {
        const img = document.createElement("img");
        img.src = service.imageUrl;
        img.alt = `${service.title} design sample`;
        img.loading = "lazy";
        image.append(img);
      }
      const body = document.createElement("div");
      body.className = "service-card-body";
      body.innerHTML = `<span class="service-number">0${index + 1} / SERVICE</span><h3>${escapeHtml(service.title)}</h3><p>${escapeHtml(service.shortDescription)}</p><div class="service-card-footer"><span>${escapeHtml(service.priceLabel)}</span><span class="service-arrow">View details&nbsp; →</span></div>`;
      link.append(image, body);
      link.addEventListener("pointermove", (event) => {
        if (reducedMotion || event.pointerType !== "mouse") return;
        const rect = link.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        link.style.setProperty("--pointer-x", `${x}px`);
        link.style.setProperty("--pointer-y", `${y}px`);
        link.style.transform = `perspective(900px) rotateX(${((y / rect.height) - .5) * -5}deg) rotateY(${((x / rect.width) - .5) * 5}deg) translateY(-5px)`;
      });
      link.addEventListener("pointerleave", () => { link.style.transform = ""; });
      grid.append(link);
    });
    observeReveals(grid);
  }

  function iconMarkup(type) {
    const paths = {
      instagram: '<rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="6" r="1.2"/>',
      facebook: '<path d="M13.5 21v-8h2.7l.4-3.1h-3.1v-2c0-.9.3-1.5 1.6-1.5h1.7V3.6c-.3 0-1.3-.1-2.4-.1-2.4 0-4.1 1.5-4.1 4.2v2.3H7.5V13h2.8v8z"/>',
      tiktok: '<path d="M19.6 7.4a6 6 0 0 1-3.7-1.3v8.1a5.7 5.7 0 1 1-5-5.7v3.1a2.7 2.7 0 1 0 2 2.6V2h3a6 6 0 0 0 3.7 5.4z"/>',
      youtube: '<path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6z"/>',
      linkedin: '<path d="M5.2 7.7a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM3.5 9.2h3.4V21H3.5zM9 9.2h3.3v1.6h.1a3.6 3.6 0 0 1 3.3-1.8c3.5 0 4.1 2.3 4.1 5.3V21h-3.5v-5.9c0-1.4 0-3.1-1.9-3.1s-2.1 1.5-2.1 3V21H9z"/>',
      behance: '<path d="M8.3 11.1c1.4 0 2.2-.5 2.2-1.7 0-1.1-.8-1.5-2.2-1.5H4.8v3.2zM4.8 17.9h3.8c1.4 0 2.4-.6 2.4-2 0-1.3-1-1.9-2.4-1.9H4.8zm9.5-9.8h6V6h-6zm6.8 8.1h-7.1c.1 1.5 1 2.3 2.5 2.3 1 0 1.8-.5 2-1.1h2.4c-.7 2.2-2.4 3.3-4.5 3.3-3.1 0-5-2.1-5-5.1 0-2.9 2-5.2 5-5.2 3.3 0 4.9 2.8 4.7 5.8Zm-19-9H9c2.6 0 4.3 1.1 4.3 3.4 0 1.3-.6 2.2-1.8 2.8 1.8.5 2.6 1.8 2.6 3.5 0 2.7-2.3 4.1-5 4.1H2.1z"/>'
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[type] || ""}</svg>`;
  }

  function renderSocials() {
    ["social-links", "footer-social"].forEach((id) => {
      const target = document.getElementById(id);
      config.socialLinks.filter((social) => safeExternalUrl(social.url)).forEach((social) => {
        const anchor = document.createElement("a");
        anchor.className = "social-link";
        anchor.href = safeExternalUrl(social.url);
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        anchor.setAttribute("aria-label", social.name);
        anchor.title = social.name;
        if (social.iconUrl) {
          const image = document.createElement("img");
          image.src = social.iconUrl;
          image.alt = "";
          anchor.append(image);
        } else anchor.innerHTML = iconMarkup(social.icon);
        target.append(anchor);
      });
    });
  }

  function renderAbout() {
    document.getElementById("about-title").textContent = config.aboutTitle;
    document.getElementById("about-text").textContent = config.aboutText;
    const skills = document.getElementById("skills-list");
    config.skills.forEach((skill) => {
      const badge = document.createElement("span");
      badge.className = "skill-badge";
      badge.textContent = skill;
      skills.append(badge);
    });
    const stats = document.getElementById("stats-grid");
    config.stats.forEach((item) => {
      const stat = document.createElement("div");
      stat.className = "stat";
      stat.innerHTML = `<div class="stat-value" data-count="${Number(item.value) || 0}" data-suffix="${escapeHtml(item.suffix || "")}">0</div><div class="stat-label">${escapeHtml(item.label)}</div>`;
      stats.append(stat);
    });
  }

  function observeReveals(root = document) {
    const elements = root.querySelectorAll(".reveal:not([data-observed])");
    if (!("IntersectionObserver" in window)) {
      elements.forEach((element) => {
        element.classList.add("is-visible");
        element.querySelectorAll("[data-count]").forEach(animateCounter);
      });
      return;
    }
    const observer = new IntersectionObserver((entries, currentObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        const counters = entry.target.matches("[data-count]")
          ? [entry.target]
          : [...entry.target.querySelectorAll("[data-count]")];
        counters.forEach(animateCounter);
        currentObserver.unobserve(entry.target);
      });
    }, { threshold: .12 });
    elements.forEach((element) => {
      element.dataset.observed = "true";
      observer.observe(element);
    });
  }

  function animateCounter(node) {
    if (node.dataset.counted) return;
    node.dataset.counted = "true";
    const target = Number(node.dataset.count) || 0;
    const suffix = node.dataset.suffix || "";
    const format = (value) => `${new Intl.NumberFormat().format(value)}${suffix}`;
    if (reducedMotion) {
      node.textContent = format(target);
      return;
    }
    const start = performance.now();
    const duration = 1100;
    const frame = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      node.textContent = format(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  function initIntro() {
    const intro = document.getElementById("intro");
    const forceIntro = new URLSearchParams(window.location.search).get("intro") === "1";
    const skip = () => {
      intro.classList.add("is-leaving");
      try { sessionStorage.setItem("ag-intro-seen", "1"); } catch (error) { console.warn("Intro preference could not be saved for this session.", error); }
      window.setTimeout(() => intro.remove(), 750);
    };
    const seen = (() => {
      try { return sessionStorage.getItem("ag-intro-seen"); } catch (error) { console.warn("Session storage is unavailable; showing the intro.", error); return ""; }
    })();
    if ((seen && !forceIntro) || reducedMotion) {
      intro.remove();
      return;
    }
    const name = document.getElementById("intro-name");
    name.textContent = "";
    [...config.brandName].forEach((letter, index) => {
      const span = document.createElement("span");
      span.textContent = letter === " " ? "\u00a0" : letter;
      span.style.animationDelay = `${.28 + index * .045}s`;
      name.append(span);
    });
    document.getElementById("intro-skip").addEventListener("click", skip);
    const logo = document.getElementById("intro-logo");
    let timerStarted = false;
    const startTimer = () => {
      if (timerStarted) return;
      timerStarted = true;
      window.setTimeout(skip, 5000);
    };
    if (logo && !logo.hidden && !logo.complete) {
      logo.addEventListener("load", startTimer, { once: true });
      logo.addEventListener("error", startTimer, { once: true });
      window.setTimeout(startTimer, 2000);
    } else {
      startTimer();
    }
  }

  function initNavigation() {
    const header = document.querySelector(".site-header");
    const links = [...document.querySelectorAll(".nav-link")];
    const menu = document.getElementById("nav-links");
    const toggle = document.getElementById("menu-toggle");
    const updateScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 30);
    window.addEventListener("scroll", updateScroll, { passive: true });
    updateScroll();
    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close navigation menu" : "Open navigation menu");
      menu.classList.toggle("is-open", open);
      document.body.classList.toggle("menu-open", open);
    });
    links.forEach((link) => link.addEventListener("click", () => {
      toggle.setAttribute("aria-expanded", "false");
      menu.classList.remove("is-open");
      document.body.classList.remove("menu-open");
    }));
    if ("IntersectionObserver" in window) {
      const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          links.forEach((link) => link.classList.toggle("active", link.hash === `#${entry.target.id}`));
        });
      }, { rootMargin: "-35% 0px -55% 0px" });
      document.querySelectorAll("main section[id]").forEach((section) => sectionObserver.observe(section));
    }
  }

  function initHeroTilt() {
    const hero = document.querySelector(".hero-art");
    if (!hero || reducedMotion || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    hero.addEventListener("pointermove", (event) => {
      if (!hero.classList.contains("is-visible")) return;
      const bounds = hero.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - .5;
      const y = (event.clientY - bounds.top) / bounds.height - .5;
      hero.style.setProperty("--hero-tilt-x", `${(y * -10).toFixed(2)}deg`);
      hero.style.setProperty("--hero-tilt-y", `${(x * 10).toFixed(2)}deg`);
      hero.classList.add("is-tilting");
    });
    hero.addEventListener("pointerleave", () => {
      hero.classList.remove("is-tilting");
      hero.style.removeProperty("--hero-tilt-x");
      hero.style.removeProperty("--hero-tilt-y");
    });
  }

  configureBrand();
  renderServices();
  renderAbout();
  renderSocials();
  observeReveals();
  initNavigation();
  initHeroTilt();
  initIntro();
})();
