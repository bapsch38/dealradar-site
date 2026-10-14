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
  // Le score mesure la qualité des preuves disponibles, jamais la taille de la remise.
  const trust = offer => {
    let score = 0;
    const reasons = [], warnings = [];
    const url = cleanUrl(offer.url), price = priceOf(offer), reference = referenceOf(offer), discount = discountOf(offer);
    const sourceText = String(offer.source || "") + " " + String(offer.url || "");
    const offerHost = (() => { try { return new URL(offer.url || "").hostname.toLowerCase(); } catch (_) { return ""; } })();
    const directMerchantLink = Boolean(offer.merchant_url && /^https:\/\//i.test(offer.merchant_url)) ||
      Boolean(offerHost && !/dealabs|camelcamelcamel/.test(offerHost));
    const image = typeof offer.image_url === "string" && /^https:\/\//i.test(offer.image_url);
    const knownSource = /amazon|dealabs|camelcamelcamel|cdiscount|fnac|darty|boulanger|ldlc|materiel\.net|rakuten|ebay/i.test(sourceText);
    const validCategory = categories.includes(categoryOf(offer));
    if (url) {
      score += directMerchantLink ? 12 : 4;
      reasons.push(directMerchantLink ? "lien direct vers le marchand" : "lien vers la publication source");
    } else warnings.push("lien HTTPS absent ou invalide");
    if (knownSource) { score += 8; reasons.push("source identifiable"); } else warnings.push("source peu identifiable");
    if (price != null) { score += offer.price_verified === true ? 22 : 10; reasons.push(offer.price_verified === true ? "prix lu sur une fiche marchand" : "prix annoncé par la source, non recoupé directement"); }
    else { warnings.push("prix de vente introuvable"); score -= 18; }
    if (reference != null && price != null && reference > price) {
      score += offer.reference_price_verified === true ? 18 : 8;
      reasons.push(offer.reference_price_verified === true ? "prix de référence vérifié" : "prix de comparaison présent sans preuve indépendante");
    } else { warnings.push("prix de référence absent ou incohérent"); if (price != null) score -= 8; }
    if (image) { score += 5; reasons.push("image produit disponible"); } else warnings.push("image produit absente");
    if (validCategory) score += 4;
    if (offer.price_verified === true) reasons.push("prix actuel recoupé avec le marchand");
    else warnings.push("prix actuel non confirmé par une lecture directe du marchand");
    if (offer.reference_price_verified === true) reasons.push("prix de référence confirmé par une source distincte");
    const history = Array.isArray(offer.price_history) ? offer.price_history.filter(item => item && Number.isFinite(Number(item.price)) && Number(item.price) > 0) : [];
    const distinctPrices = new Set(history.map(item => Number(item.price).toFixed(2))).size;
    const validDates = history.map(item => Date.parse(item.observed_at || item.date || "")).filter(Number.isFinite);
    if (history.length >= 3 && distinctPrices >= 2) { score += 12; reasons.push("historique avec plusieurs observations et variation"); }
    else if (history.length >= 2) { score += 5; reasons.push("plusieurs observations conservées"); if (distinctPrices < 2) warnings.push("aucune variation de prix constatée pour l'instant"); }
    else warnings.push("historique trop court pour juger une tendance");
    if (validDates.length >= 2 && Math.max(...validDates) - Math.min(...validDates) >= 6 * 60 * 60 * 1000) { score += 4; reasons.push("observations espacées dans le temps"); }
    const rawDate = offer.price_checked_at || offer.detected_at || offer.published_at;
    const date = rawDate ? new Date(String(rawDate).replace(" ", "T") + (/[zZ]|[+-]\d{2}:?\d{2}$/.test(String(rawDate)) ? "" : "Z")) : null;
    if (date && !Number.isNaN(date.getTime())) {
      const age = Date.now() - date.getTime();
      if (age >= 0 && age <= 3600000) { score += 18; reasons.push("contrôle de moins d'une heure"); }
      else if (age <= 21600000 && age >= 0) { score += 11; score -= 3; reasons.push("donnée de moins de 6 h"); }
      else if (age <= 86400000 && age >= 0) { score += 5; score -= 7; reasons.push("donnée de moins de 24 h"); }
      else if (age > 86400000) { score -= 18; warnings.push("données anciennes : le prix peut avoir changé"); }
      else warnings.push("date de contrôle incohérente");
    } else warnings.push("date de contrôle absente");
    if (discount != null && discount >= 70) { score -= 12; warnings.push("réduction exceptionnelle : prix de référence à contrôler"); }
    else if (discount != null && discount >= 50) { score -= 7; warnings.push("réduction très forte : contrôle renforcé conseillé"); }
    else if (discount != null && discount >= 30) { score -= 3; warnings.push("réduction importante : comparer le prix de référence"); }
    if (offer.price_verified !== true) score -= 8;
    if (reference != null && offer.reference_price_verified !== true) score -= 3;
    score = Math.max(0, Math.min(100, Math.round(score)));
    return {score, level:score >= 72 ? "Élevée" : score >= 40 ? "Moyenne" : "Faible", reasons, warnings};
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
      .map(offer => ({offer, discount:discountOf(offer), trust:trust(offer)}))
      .sort((a,b) => (b.trust.score - a.trust.score) || ((b.discount ?? -1) - (a.discount ?? -1)))
      .slice(0, 6);
    if (prefs.personalized === false) {
      root.innerHTML = '<div class="dr-empty">La sélection personnalisée est désactivée. Active-la ou choisis tes univers ci-dessus.</div>';
      return;
    }
    if (!candidates.length) {
      root.innerHTML = '<div class="dr-empty">Aucune offre ne correspond encore à tes univers. Choisis plus de catégories ou laisse la sélection ouverte.</div>';
      return;
    }
    root.innerHTML = candidates.map(({offer, discount, trust:confidence}) => {
      const url = cleanUrl(offer.url);
      const image = typeof productImageCandidates === "function" ? productImageCandidates(offer, url)[0] : (offer.image_url || "");
      return '<article class="dr-mini-card">' +
        (image ? '<img src="' + image.replace(/"/g, "&quot;") + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '') +
        '<div class="dr-mini-body"><div class="dr-mini-meta">' + safeText(categoryOf(offer)) + ' · confiance ' + confidence.level.toLowerCase() + ' · ' + confidence.score + '/100</div>' +
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
      const explanation = [...score.reasons, ...score.warnings];
      action.innerHTML = '<div class="dr-trust" title="' + explanation.join(" · ").replace(/"/g, "&quot;") +
        '"><span>Indice de confiance · ' + score.level + '</span><strong>' + score.score + '/100</strong><small>' +
        (score.reasons.length ? 'Points positifs : ' + score.reasons.join(" · ") + '. ' : '') +
        (score.warnings.length ? 'À vérifier : ' + score.warnings.join(" · ") + '. ' : '') +
        'Estimation indicative, pas une garantie du marchand.</small></div>' +
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
  window.DealRadarTrust = trust;
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