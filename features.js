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
    "Alimentation & boissons", "Jouets & jeux", "Jardin & extérieur",
    "Culture & sorties", "Autre"
  ];
  const filterByCategory = {
    "High-tech":"tech", "Gaming":"gaming", "Maison":"maison",
    "Électroménager":"electromenager", "Bricolage":"bricolage",
    "Bébé & enfants":"famille", "Animaux":"animaux", "Mode":"mode",
    "Sport & loisirs":"sport", "Beauté & santé":"beaute",
    "Auto & moto":"auto", "Bureau & papeterie":"papeterie",
    "Alimentation & boissons":"alimentation", "Jouets & jeux":"jouets",
    "Jardin & extérieur":"jardin", "Culture & sorties":"culture", "Autre":"autre"
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
  // Interprète les formats français (79,99 € / 1.299 €) et décimaux (79.99)
  // sans transformer par erreur un prix de référence de 79.99 € en 7 999 €.
  const parseMoney = raw => {
    if (typeof raw === "number") return Number.isFinite(raw) && raw > 0 ? raw : null;
    if (typeof raw !== "string" || !raw.trim()) return null;
    let normalized = raw.trim().replace(/[€\s\u00a0]/g, "");
    if (normalized.includes(",")) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else if (/^\d{1,3}(?:\.\d{3})+$/.test(normalized)) {
      normalized = normalized.replace(/\./g, "");
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };
  const priceOf = offer => parseMoney(offer.price ?? offer.current_price);
  const referenceOf = offer => parseMoney(offer.reference_price ?? offer.original_price ?? offer.list_price);
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
    return "./signaler.html?type=" + encodeURIComponent(kind) + "&title=" + encodeURIComponent(offer.title || "Offre DealRadar") + "&url=" + encodeURIComponent(offer.url || "") + "&category=" + encodeURIComponent(categoryOf(offer)) + "&price=" + encodeURIComponent(String(priceOf(offer) ?? "")) + "&reference=" + encodeURIComponent(String(referenceOf(offer) ?? "")) + "&details=" + encodeURIComponent(body);
  };
  // Score fondé sur les preuves de prix. Image, catégorie et taille de remise ne prouvent pas la fiabilité.
  const trust = offer => {
    let score = 0;
    const reasons = [], warnings = [];
    const price = priceOf(offer), reference = referenceOf(offer), discount = discountOf(offer);
    const sourceText = String(offer.source || "") + " " + String(offer.url || "");
    const knownSource = /amazon|dealabs|camelcamelcamel|cdiscount|fnac|darty|boulanger|ldlc|materiel\.net|rakuten|ebay/i.test(sourceText);

    if (price != null && offer.price_verified === true) {
      score += 35;
      reasons.push("prix actuel confirmé sur une fiche marchand");
    } else if (price != null) {
      score += 8;
    } else {
      warnings.push("prix actuel absent : impossible d'évaluer l'offre");
    }

    if (reference != null && price != null && reference > price && offer.reference_price_verified === true) {
      score += 25;
      reasons.push("prix de référence vérifié indépendamment");
    } else if (reference != null && price != null && reference > price) {
      score += 5;
      warnings.push("prix de référence présent, mais pas vérifié indépendamment");
    } else {
      warnings.push("pas de prix de référence exploitable : la réduction ne peut pas être validée");
    }

    const history = Array.isArray(offer.price_history)
      ? offer.price_history.filter(item => item && Number.isFinite(Number(item.price)) && Number(item.price) > 0)
      : [];
    const datedHistory = history.map(item => ({
      price: Number(item.price),
      date: Date.parse(item.observed_at || item.date || "")
    })).filter(item => Number.isFinite(item.date));
    const span = datedHistory.length >= 2
      ? Math.max(...datedHistory.map(item => item.date)) - Math.min(...datedHistory.map(item => item.date))
      : 0;
    const distinctPrices = new Set(datedHistory.map(item => item.price.toFixed(2))).size;
    if (datedHistory.length >= 10 && span >= 7 * 86400000) {
      score += 20;
      reasons.push("historique réel sur au moins 7 jours");
    } else if (datedHistory.length >= 4 && span >= 24 * 3600000) {
      score += 14;
      reasons.push("plusieurs relevés datés sur au moins 24 h");
    } else if (datedHistory.length >= 2 && span >= 3600000) {
      score += 7;
      reasons.push("plusieurs relevés de prix datés");
    } else {
      warnings.push("historique insuffisant pour juger l'évolution du prix");
    }
    if (datedHistory.length >= 3 && distinctPrices >= 2) reasons.push("variation de prix observée dans les relevés");

    const checkedAt = offer.price_checked_at ? Date.parse(String(offer.price_checked_at).replace(" ", "T")) : NaN;
    if (offer.price_verified === true && Number.isFinite(checkedAt)) {
      const age = Date.now() - checkedAt;
      if (age >= 0 && age <= 3600000) {
        score += 15;
        reasons.push("prix vérifié il y a moins d'une heure");
      } else if (age <= 6 * 3600000 && age >= 0) {
        score += 10;
        reasons.push("prix vérifié il y a moins de 6 h");
      } else if (age <= 24 * 3600000 && age >= 0) {
        score += 5;
        reasons.push("prix vérifié il y a moins de 24 h");
      } else if (age > 24 * 3600000) {
        score -= 15;
        warnings.push("dernière vérification du prix vieille de plus de 24 h");
      } else {
        warnings.push("date de vérification incohérente");
      }
    } else {
      warnings.push("aucune date de vérification directe du prix");
    }

    if (knownSource) {
      score += 5;
      reasons.push("source identifiable");
    } else {
      warnings.push("source à identifier ou à recouper");
    }
    if (discount != null && discount >= 60 && offer.reference_price_verified !== true) {
      score -= 10;
      warnings.push("réduction annoncée très forte : vérifier soigneusement le prix de référence");
    }

    score = Math.max(0, Math.min(100, Math.round(score)));
    const level = score >= 75 ? "Élevée" : score >= 45 ? "Moyenne" : "Faible";
    return {score, level, reasons, warnings};
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
        '<div class="dr-mini-body"><div class="dr-mini-meta">' + safeText(categoryOf(offer)) + ' · ' + (offer.price_verified === true ? 'prix confirmé' : 'prix à vérifier') + '</div>' +
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
        '"><strong>' + (offer.price_verified === true ? 'Prix actuel confirmé' : 'Prix non confirmé') + '</strong><small>' +
        (score.reasons.length ? 'Points positifs : ' + score.reasons.join(" · ") + '. ' : '') +
        (score.warnings.length ? 'À vérifier : ' + score.warnings.join(" · ") + '. ' : '') +
        'Le prix final et la disponibilité restent à confirmer chez le marchand.</small></div>' +
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

/* Garde-fou navigation : aucun retour communauté ne doit quitter DealRadar. */
(function(){
  function localReportFromLink(link){
    try{
      const source=new URL(link.href,location.href);
      const title=source.searchParams.get("title")||"Retour communauté DealRadar";
      const body=source.searchParams.get("body")||"";
      let type="wrong";
      if(/catégorie incorrecte/i.test(title)) type="category";
      else if(/prix confirmé|prix vérifié/i.test(title)) type="ok";
      else if(/lien ou image incorrect/i.test(title)) type="link";
      const product=(body.match(/(?:Produit|Lien de l'offre|Lien produit)\s*:\s*([^\n]+)/i)||[])[1]||"";
      const url=(body.match(/(?:Lien de l'offre|Lien produit)\s*:\s*(https?:\/\/[^\s]+)/i)||[])[1]||"";
      const params=new URLSearchParams({type,title:title.replace(/^\[[^\]]+\]\s*/,""),url,details:body});
      return "./signaler.html?"+params.toString();
    }catch(_){return "./signaler.html";}
  }
  document.addEventListener("click",function(event){
    const link=event.target&&event.target.closest?event.target.closest('a[href*="github.com/"][href*="/issues/new"]'):null;
    if(!link)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    location.href=localReportFromLink(link);
  },true);
  const originalOpen=window.open;
  window.open=function(url,...args){
    try{
      const parsed=new URL(String(url),location.href);
      if(/github\.com$/i.test(parsed.hostname)&&parsed.pathname.includes("/issues/new")){
        location.href=localReportFromLink({href:parsed.href});
        return null;
      }
    }catch(_){}
    return originalOpen.call(window,url,...args);
  };
})();
