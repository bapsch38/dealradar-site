(() => {
  "use strict";
  const KEY = {
    favorites: "dealradar:favorites:v1",
    targets: "dealradar:targets:v1",
    preferences: "dealradar:preferences:v1",
    feedback: "dealradar:feedback:v1"
  };
  const categories = [
    "High-tech", "Gaming", "Maison", "Électroménager", "Bricolage",
    "Bébé & enfants", "Animaux", "Mode", "Sport & loisirs",
    "Beauté & santé", "Auto & moto", "Bureau & papeterie",
    "Alimentation & boissons", "Autre"
  ];
  const filterByCategory = {
    "High-tech":"tech", "Gaming":"gaming", "Maison":"maison",
    "Électroménager":"electromenager", "Bricolage":"bricolage",
    "Bébé & enfants":"famille", "Animaux":"animaux", "Mode":"mode",
    "Sport & loisirs":"sport", "Beauté & santé":"beaute",
    "Auto & moto":"auto", "Bureau & papeterie":"papeterie",
    "Alimentation & boissons":"alimentation", "Autre":"autre"
  };
  const read = (key, fallback) => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value == null ? fallback : value;
    } catch (_) { return fallback; }
  };
  const write = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (_) { alert("Le navigateur ne permet pas d’enregistrer ce réglage. Vérifie les paramètres de stockage."); return false; }
  };
  const favorites = () => read(KEY.favorites, []);
  const targets = () => read(KEY.targets, {});
  const preferences = () => read(KEY.preferences, { categories: [], personalized: true });
  const cleanUrl = value => typeof value === "string" && /^https:\/\//i.test(value) ? value : "";
  const priceOf = offer => {
    const raw = offer.price ?? offer.current_price;
    if (typeof raw === "number") return raw > 0 ? raw : null;
    if (typeof raw !== "string" || !raw.trim()) return null;
    const normalized = raw.trim().replace(/[€\s\u00a0]/g, "").includes(",") ? raw.trim().replace(/[€\s\u00a0]/g, "").replace(/\./g, "").replace(",", ".") : raw.trim().replace(/[€\s\u00a0]/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };
  const referenceOf = offer => {
    const raw = offer.reference_price ?? offer.original_price ?? offer.list_price;
    if (typeof raw === "number") return raw > 0 ? raw : null;
    if (typeof raw !== "string" || !raw.trim()) return null;
    const normalized = raw.trim().replace(/[€\s\u00a0]/g, "").replace(/\./g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };
  const money = value => value == null ? "Prix non disponible" : new Intl.NumberFormat("fr-FR", {style:"currency",currency:"EUR"}).format(value);
  const discountOf = offer => {
    const p = priceOf(offer), r = referenceOf(offer);
    return p != null && r != null && r > p ? (1 - p / r) * 100 : null;
  };
  const categoryOf = offer => typeof inferCategory === "function" ? inferCategory(offer) : (offer.category || "Autre");
  const findOffer = url => Array.isArray(offers) ? offers.find(item => cleanUrl(item.url) === url) : null;
  const safeText = value => String(value ?? "").replace(/[<>]/g, "");
  const issueUrl = (offer, kind) => {
    const labels = {
      ok: "Retour communauté — prix vérifié",
      wrong: "Signalement communauté — prix douteux ou offre expirée",
      category: "Signalement communauté — catégorie incorrecte",
      link: "Signalement communauté — lien ou image incorrect"
    };
    const body = [
      "## Retour communauté DealRadar",
      "",
      "**Type de retour :** " + labels[kind],
      "**Produit :** " + (offer.title || "Offre sans titre"),
      "**Prix affiché :** " + money(priceOf(offer)),
      "**Prix de référence affiché :** " + money(referenceOf(offer)),
      "**Réduction calculée :** " + (discountOf(offer) == null ? "non calculable" : Math.round(discountOf(offer)) + " %"),
      "**Catégorie :** " + categoryOf(offer),
      "**Source :** " + (offer.source || "non précisée"),
      "**Lien produit :** " + (offer.url || ""),
      "",
      "### Détails / preuve facultative",
      "Indique le prix constaté, la date de vérification, le marchand et, si possible, une capture ou un lien fiable.",
      "",
      "Merci : les retours sont publics et pourront être vérifiés avant correction."
    ].join("\n");
    const params = new URLSearchParams({template:"deal-feedback.md", title: "[Communauté] " + labels[kind] + " : " + (offer.title || "offre DealRadar").slice(0, 90), body});
    return "https://github.com/bapsch38/dealradar-site/issues/new?" + params.toString();
  };
  const trust = offer => {
    let score = 0;
    const reasons = [];
    const url = cleanUrl(offer.url);
    if (url) { score += 15; reasons.push("lien HTTPS"); }
    if (offer.price_verified === true) { score += 30; reasons.push("prix marqué comme vérifié par le flux"); }
    const p = priceOf(offer), r = referenceOf(offer);
    if (p != null && r != null && r > p) { score += 20; reasons.push("prix actuel inférieur au prix de référence"); }
    const history = Array.isArray(offer.price_history) ? offer.price_history.filter(x => x && Number(x.price) > 0) : [];
    if (history.length >= 2) { score += 15; reasons.push("historique avec plusieurs observations"); }
    const date = new Date(offer.detected_at || offer.published_at || "");
    if (!Number.isNaN(date.getTime())) {
      const age = Date.now() - date.getTime();
      if (age <= 48 * 60 * 60 * 1000 && age >= -60 * 60 * 1000) { score += 10; reasons.push("détection récente"); }
      else if (age > 7 * 24 * 60 * 60 * 1000) reasons.push("offre ancienne à recontrôler");
    }
    if (/amazon|dealabs|camelcamelcamel/i.test(String(offer.source || "") + " " + url)) { score += 10; reasons.push("source identifiable"); }
    return {score: Math.min(100, score), reasons};
  };
  const announce = (title, body) => {
    if ("Notification" in window && Notification.permission === "granted") {
      try { new Notification(title, {body, icon:"./favicon.ico"}); } catch (_) {}
    }
  };
  const checkTargets = () => {
    const all = targets();
    let changed = false;
    Object.entries(all).forEach(([url, target]) => {
      const offer = findOffer(url);
      if (!offer) return;
      const current = priceOf(offer);
      if (current == null) return;
      if (current <= Number(target.price)) {
        if (!target.triggered) {
          announce("DealRadar — objectif atteint", (offer.title || "Une offre suivie") + " est à " + money(current) + " (objectif : " + money(Number(target.price)) + ").");
          target.triggered = true;
          target.lastSeenPrice = current;
          changed = true;
        }
      } else if (target.triggered) {
        target.triggered = false;
        changed = true;
      }
    });
    if (changed) write(KEY.targets, all);
  };
  const renderPreferences = () => {
    const root = document.getElementById("dr-category-preferences");
    if (!root) return;
    const prefs = preferences();
    root.innerHTML = categories.map(category =>
      '<label class="dr-pref-option"><input type="checkbox" value="' + category.replace(/"/g, "&quot;") + '"' +
      (prefs.categories.includes(category) ? " checked" : "") + '> ' + category + '</label>'
    ).join("");
    const toggle = document.getElementById("dr-personalized-toggle");
    if (toggle) toggle.checked = prefs.personalized !== false;
  };
  const renderPersonalized = () => {
    const root = document.getElementById("dr-personalized-grid");
    if (!root || !Array.isArray(offers)) return;
    const prefs = preferences();
    const chosen = Array.isArray(prefs.categories) ? prefs.categories : [];
    const candidates = offers.filter(offer => cleanUrl(offer.url) && (chosen.length === 0 || chosen.includes(categoryOf(offer))))
      .map(offer => ({offer, discount:discountOf(offer), trust:trust(offer).score}))
      .sort((a,b) => (b.trust - a.trust) || ((b.discount ?? -1) - (a.discount ?? -1)))
      .slice(0, 6);
    if (prefs.personalized === false) {
      root.innerHTML = '<div class="dr-empty">La sélection personnalisée est désactivée. Active-la ou choisis tes univers ci-dessus.</div>';
      return;
    }
    if (!candidates.length) {
      root.innerHTML = '<div class="dr-empty">Aucune offre ne correspond encore à tes univers. Choisis plus de catégories ou laisse la sélection ouverte.</div>';
      return;
    }
    root.innerHTML = candidates.map(({offer, discount, trust:score}) => {
      const url = cleanUrl(offer.url);
      const image = typeof productImageCandidates === "function" ? productImageCandidates(offer, url)[0] : (offer.image_url || "");
      return '<article class="dr-mini-card">' +
        (image ? '<img src="' + image.replace(/"/g, "&quot;") + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '') +
        '<div class="dr-mini-body"><div class="dr-mini-meta">' + safeText(categoryOf(offer)) + ' · confiance indicative ' + score + '/100</div>' +
        '<a class="dr-mini-title" href="' + url.replace(/"/g, "&quot;") + '" target="_blank" rel="noopener noreferrer sponsored">' + safeText(offer.title || "Offre sans titre") + '</a>' +
        '<div class="dr-mini-price">' + money(priceOf(offer)) + (discount == null ? "" : ' <span>-' + Math.round(discount) + ' %</span>') + '</div>' +
        '<button type="button" class="dr-action dr-fav" data-offer-url="' + url.replace(/"/g, "&quot;") + '">' +
        (favorites().includes(url) ? "★ Retirer des favoris" : "☆ Ajouter aux favoris") + '</button></div></article>';
    }).join("");
  };
  const renderWatchlist = () => {
    const root = document.getElementById("dr-watchlist");
    const count = document.getElementById("dr-fav-count");
    const favs = favorites();
    if (count) count.textContent = String(favs.length);
    if (!root) return;
    const items = favs.map(findOffer).filter(Boolean);
    root.innerHTML = items.length ? items.map(offer => {
      const url = cleanUrl(offer.url);
      return '<div class="dr-list-row"><div><strong>' + safeText(offer.title || "Offre sans titre") + '</strong><small>' +
        money(priceOf(offer)) + ' · ' + safeText(categoryOf(offer)) + '</small></div><button type="button" class="dr-action dr-fav" data-offer-url="' +
        url.replace(/"/g, "&quot;") + '">Retirer</button><a href="' + url.replace(/"/g, "&quot;") +
        '" target="_blank" rel="noopener noreferrer">Voir ↗</a></div>';
    }).join("") : '<div class="dr-empty">Aucun favori pour le moment. Appuie sur ☆ sur une offre pour la garder ici.</div>';
  };
  const renderTargets = () => {
    const root = document.getElementById("dr-target-list");
    const all = targets();
    if (!root) return;
    const entries = Object.entries(all);
    root.innerHTML = entries.length ? entries.map(([url, target]) => {
      const offer = findOffer(url);
      return '<div class="dr-list-row"><div><strong>' + safeText(offer?.title || "Produit suivi") + '</strong><small>Objectif : ' +
        money(Number(target.price)) + (target.triggered ? ' · <span class="dr-reached">Objectif atteint</span>' : '') +
        '</small></div><button type="button" class="dr-action dr-target-remove" data-offer-url="' + url.replace(/"/g, "&quot;") +
        '">Supprimer</button></div>';
    }).join("") : '<div class="dr-empty">Aucun objectif de prix. Sur une offre, choisis « Alerte de prix » et saisis le prix que tu veux atteindre.</div>';
  };
  const decorateCards = () => {
    document.querySelectorAll("#deals-grid .deal-card").forEach(card => {
      if (card.querySelector(".dr-card-actions")) return;
      const link = card.querySelector(".deal-cta");
      const url = cleanUrl(link?.href);
      const offer = findOffer(url);
      if (!offer) return;
      const score = trust(offer);
      const action = document.createElement("div");
      action.className = "dr-card-actions";
      action.innerHTML = '<div class="dr-trust" title="' + score.reasons.join(" · ").replace(/"/g, "&quot;") +
        '"><span>Indice de confiance indicatif</span><strong>' + score.score + '/100</strong><small>' +
        score.reasons.join(" · ") + (score.reasons.length ? " — " : "") +
        'Ce score est une estimation automatique, pas une garantie du marchand.</small></div>' +
        '<div class="dr-button-row"><button type="button" class="dr-action dr-fav" data-offer-url="' + url.replace(/"/g, "&quot;") + '">' +
        (favorites().includes(url) ? "★ Favori" : "☆ Favoris") + '</button><button type="button" class="dr-action dr-target" data-offer-url="' +
        url.replace(/"/g, "&quot;") + '">🔔 Alerte de prix</button></div>' +
        '<div class="dr-community"><span>La communauté peut aider à contrôler cette offre :</span>' +
        '<a href="' + issueUrl(offer, "ok") + '" target="_blank" rel="noopener noreferrer">Prix correct</a>' +
        '<a href="' + issueUrl(offer, "wrong") + '" target="_blank" rel="noopener noreferrer">Prix douteux / expiré</a>' +
        '<a href="' + issueUrl(offer, "category") + '" target="_blank" rel="noopener noreferrer">Catégorie</a>' +
        '<a href="' + issueUrl(offer, "link") + '" target="_blank" rel="noopener noreferrer">Lien / image</a></div>';
      const body = card.querySelector(".deal-body");
      if (body) body.appendChild(action);
    });
  };
  const renderAll = () => {
    decorateCards();
    renderPersonalized();
    renderWatchlist();
    renderTargets();
    checkTargets();
  };
  const savePreferences = () => {
    const selected = [...document.querySelectorAll("#dr-category-preferences input:checked")].map(input => input.value);
    write(KEY.preferences, {categories:selected, personalized:document.getElementById("dr-personalized-toggle")?.checked !== false});
    renderPersonalized();
    const status = document.getElementById("dr-preferences-status");
    if (status) status.textContent = "Préférences enregistrées sur cet appareil.";
  };
  const applyPreferences = () => {
    const prefs = preferences();
    const chosen = Array.isArray(prefs.categories) ? prefs.categories : [];
    if (!chosen.length) {
      activeFilter = "all";
      filters.forEach(item => item.classList.toggle("active", item.dataset.filter === "all"));
    } else {
      const target = filterByCategory[chosen[0]] || "all";
      activeFilter = target;
      filters.forEach(item => item.classList.toggle("active", item.dataset.filter === target));
    }
    currentPage = 1;
    if (typeof renderOffers === "function") renderOffers();
    document.getElementById("dernieres-offres")?.scrollIntoView({behavior:"smooth"});
  };
  document.addEventListener("click", async event => {
    const favButton = event.target.closest(".dr-fav");
    if (favButton) {
      const url = cleanUrl(favButton.dataset.offerUrl);
      if (!url) return;
      const list = favorites();
      write(KEY.favorites, list.includes(url) ? list.filter(item => item !== url) : [...list, url]);
      document.querySelectorAll(".dr-fav[data-offer-url]").forEach(button => {
        if (button.dataset.offerUrl === url) button.textContent = favorites().includes(url) ?
          (button.closest(".dr-mini-card") ? "★ Retirer des favoris" : (button.closest(".dr-list-row") ? "Retirer" : "★ Favori")) :
          (button.closest(".dr-mini-card") ? "☆ Ajouter aux favoris" : (button.closest(".dr-list-row") ? "☆ Favori" : "☆ Favoris"));
      });
      renderWatchlist();
      return;
    }
    const targetButton = event.target.closest(".dr-target");
    if (targetButton) {
      const url = cleanUrl(targetButton.dataset.offerUrl);
      const offer = findOffer(url);
      if (!offer) return;
      const current = priceOf(offer);
      const answer = prompt("À quel prix veux-tu être averti ? (en euros)" + (current == null ? "" : "\nPrix actuel : " + money(current)), current == null ? "" : String(current.toFixed(2)).replace(".", ","));
      if (answer == null) return;
      const value = Number(answer.trim().replace(/\s/g, "").replace(",", "."));
      if (!Number.isFinite(value) || value <= 0 || value > 1000000) { alert("Entre un prix positif valide, en euros."); return; }
      const all = targets();
      all[url] = {price:value, triggered:false, createdAt:new Date().toISOString()};
      if (!write(KEY.targets, all)) return;
      if ("Notification" in window && Notification.permission === "default") {
        try { await Notification.requestPermission(); } catch (_) {}
      }
      renderTargets();
      checkTargets();
      alert("Objectif enregistré sur cet appareil. L’alerte fonctionne lorsque DealRadar est ouvert dans ce navigateur.");
      return;
    }
    const removeTarget = event.target.closest(".dr-target-remove");
    if (removeTarget) {
      const all = targets(); delete all[removeTarget.dataset.offerUrl]; write(KEY.targets, all); renderTargets(); return;
    }
    if (event.target.closest("#dr-save-preferences")) savePreferences();
    if (event.target.closest("#dr-apply-preferences")) applyPreferences();
    if (event.target.closest("#dr-clear-favorites")) {
      if (confirm("Supprimer tous les favoris enregistrés sur cet appareil ?")) { write(KEY.favorites, []); renderAll(); }
    }
    if (event.target.closest("#dr-notification-permission")) {
      if (!("Notification" in window)) { alert("Les notifications navigateur ne sont pas prises en charge ici."); return; }
      try {
        const permission = await Notification.requestPermission();
        alert(permission === "granted" ? "Notifications autorisées. Garde DealRadar ouvert pour surveiller tes objectifs." : "Notifications non autorisées. Tu peux modifier ce choix dans les réglages du navigateur.");
      } catch (_) { alert("Impossible de demander l’autorisation de notification dans ce navigateur."); }
    }
  });
  document.addEventListener("change", event => {
    if (event.target.matches("#dr-category-preferences input, #dr-personalized-toggle")) {
      const status = document.getElementById("dr-preferences-status");
      if (status) status.textContent = "Modifications en attente — clique sur Enregistrer.";
    }
  });
  const originalRenderOffers = typeof renderOffers === "function" ? renderOffers : null;
  if (originalRenderOffers) {
    renderOffers = function() { originalRenderOffers(); renderAll(); };
  }
  const originalLoadOffers = typeof loadOffers === "function" ? loadOffers : null;
  if (originalLoadOffers) {
    loadOffers = async function() { await originalLoadOffers(); renderAll(); };
  }
  const init = () => {
    renderPreferences();
    renderAll();
    window.setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("./offers.json?refresh=" + Date.now(), {cache:"no-store"});
        if (!response.ok) return;
        const data = await response.json();
        if (Array.isArray(data)) {
          offers = data.filter(item => item && typeof item.title === "string");
          if (typeof renderOffers === "function") renderOffers();
          renderAll();
        }
      } catch (_) {}
    }, 5 * 60 * 1000);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true});
  else init();
})();