(() => {
  "use strict";
  const API = String(window.DEALRADAR_API_BASE || "https://dealradar-api-vi8j.onrender.com").replace(/\/$/, "");
  // Renseigner l'identifiant AdSense après acceptation du site par Google.
  const ADSENSE_PUBLISHER_ID = "";
  const LOCK_THRESHOLD = 40;
  const STYLE = `
    .dr-ad-slot{display:none;max-width:1100px;margin:24px auto;padding:10px 16px;text-align:center}
    .dr-ad-slot.is-visible{display:block}
    .dr-ad-label{display:block;margin-bottom:6px;color:#8fa1b5;font-size:10px;text-transform:uppercase;letter-spacing:1px}
    .dr-locked-card{position:relative!important;cursor:pointer!important}
    .dr-locked-card .dr-lock-hide{visibility:hidden!important}
    .dr-lock-overlay{position:absolute;inset:0;z-index:4;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:16px;text-align:center;background:linear-gradient(180deg,rgba(8,17,29,.10),rgba(8,17,29,.90));border:1px solid #f4c96b;border-radius:14px;color:#fff}
    .dr-lock-overlay .dr-lock-icon{font-size:28px}
    .dr-lock-overlay strong{font-size:16px}
    .dr-lock-overlay span{font-size:12px;color:#e1e9f2;line-height:1.5}
    .dr-lock-overlay a{display:inline-block;padding:10px 14px;border-radius:9px;background:#f5d77e;color:#24190b;font-weight:900;font-size:12px}
    .dr-lock-note{max-width:1100px;margin:12px auto;padding:12px 16px;border:1px solid #8b6b2e;border-radius:12px;background:#2a2316;color:#f8d778;font-size:12px;line-height:1.6}
    .dr-lock-note a{font-weight:900;text-decoration:underline}
    .dr-ad-slot ins{display:block}
  `;
  const addStyle = () => { if (document.getElementById("dr-monetisation-style")) return; const s=document.createElement("style");s.id="dr-monetisation-style";s.textContent=STYLE;document.head.appendChild(s); };
  const token = () => { try { return sessionStorage.getItem("dealradar_access_token") || ""; } catch (_) { return ""; } };
  const getPlan = async () => {
    if (!token()) return "free";
    try {
      const res=await fetch(API+"/api/auth/me",{headers:{Authorization:"Bearer "+token()},cache:"no-store"});
      if(!res.ok) return "free";
      const data=await res.json();
      const profile=data.user || data.profile || data;
      return String(profile.plan || profile.subscription_plan || profile.subscription?.plan || "free").toLowerCase();
    } catch (_) { return "free"; }
  };
  const money = value => new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR"}).format(value);
  const parsePrice = value => {
    if(typeof value==="number") return Number.isFinite(value)&&value>0?value:null;
    if(typeof value!=="string"||!value.trim()) return null;
    let s=value.trim().replace(/[€\s\u00a0]/g,"");
    if(s.includes(",")) s=s.replace(/\./g,"").replace(",",".");
    else if(/^\d{1,3}(?:\.\d{3})+$/.test(s)) s=s.replace(/\./g,"");
    const n=Number(s);return Number.isFinite(n)&&n>0?n:null;
  };
  const discount = offer => {
    const p=parsePrice(offer.price ?? offer.current_price);
    const r=parsePrice(offer.reference_price ?? offer.original_price ?? offer.list_price);
    // Ne pas enfermer une offre sur une réduction estimée/non vérifiée.
    if(p===null||r===null||r<=p||offer.price_verified!==true||offer.reference_price_verified!==true) return null;
    return (1-p/r)*100;
  };
  const isLocked = offer => { const d=discount(offer); return d!==null && d>LOCK_THRESHOLD; };
  const addAdSlot = (where, id) => {
    if(document.getElementById(id)) return;
    const slot=document.createElement("aside");slot.id=id;slot.className="dr-ad-slot";slot.setAttribute("aria-label","Espace publicitaire");
    slot.innerHTML='<span class="dr-ad-label">Publicité</span><ins class="adsbygoogle" style="display:block" data-ad-client="'+ADSENSE_PUBLISHER_ID+'" data-ad-slot="" data-ad-format="auto" data-full-width-responsive="true"></ins>';
    where.parentNode.insertBefore(slot,where);
  };
  const initAds = isPro => {
    if(isPro || !/^ca-pub-\d+$/.test(ADSENSE_PUBLISHER_ID)) return;
    const main=document.querySelector("main");
    if(!main) return;
    addAdSlot(main,"dr-ad-top");
    const grid=document.querySelector("#deals-grid");
    if(grid) addAdSlot(grid,"dr-ad-inline");
    // Les emplacements restent désactivés tant que l'ID éditeur et les slots réels ne sont pas renseignés.
    if(!document.querySelector('script[data-dr-adsense="loaded"]')){
      const script=document.createElement("script");
      script.async=true;script.crossOrigin="anonymous";script.dataset.drAdsense="loaded";
      script.src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client="+encodeURIComponent(ADSENSE_PUBLISHER_ID);
      document.head.appendChild(script);
    }
    document.querySelectorAll(".dr-ad-slot").forEach(slot=>{
      const ins=slot.querySelector("ins");
      if(ins && ins.dataset.adSlot){slot.classList.add("is-visible");try{(window.adsbygoogle=window.adsbygoogle||[]).push({});}catch(_){}}
    });
  };
  const makeLocked = (card, offer) => {
    if(card.dataset.drLocked==="1") return;
    card.dataset.drLocked="1";card.classList.add("dr-locked-card");card.setAttribute("aria-label","Offre Pro : réduction supérieure à 40 %");
    card.querySelectorAll(".deal-title,.deal-prices,.deal-price,.deal-old-price,.deal-discount,.deal-savings,.deal-meta,.deal-source,.deal-source-badge,.deal-category,.deal-cta,.deal-card-links,.deal-card-open,.featured-title,.featured-price,.featured-old-price,.featured-foot,.featured-label").forEach(el=>{el.classList.add("dr-lock-hide");});
    const imageWrap=card.querySelector(".deal-image-wrap")||card.querySelector(".featured-image")?.parentElement||card;
    const overlay=document.createElement("div");overlay.className="dr-lock-overlay";
    overlay.innerHTML='<div class="dr-lock-icon" aria-hidden="true">🔒</div><strong>Offre Pro · −'+Math.floor(discount(offer))+' %</strong><span>Cette offre exceptionnelle est réservée aux abonnés Pro.</span><a href="./compte.html#pro-plan">Débloquer avec Pro</a>';
    imageWrap.appendChild(overlay);
    card.addEventListener("click",event=>{
      if(event.target.closest(".dr-lock-overlay a")) return;
      event.preventDefault();event.stopPropagation();window.location.href="./compte.html#pro-plan";
    },true);
    card.querySelectorAll("a,button").forEach(el=>{el.addEventListener("click",event=>{if(event.target.closest(".dr-lock-overlay a"))return;event.preventDefault();event.stopImmediatePropagation();window.location.href="./compte.html#pro-plan";},true);});
  };
  const applyLocks = async isPro => {
    if(isPro) return;
    let offers=[];
    try{const res=await fetch("./offers.json",{cache:"no-store"});if(res.ok)offers=await res.json();}catch(_){}
    if(!Array.isArray(offers))return;
    const byUrl=new Map(offers.map(o=>[String(o.url||""),o]));
    document.querySelectorAll("[data-offer-card-url],.featured-card").forEach(card=>{
      const link=card.querySelector(".deal-cta")||card.querySelector("a[href]");
      const url=card.dataset.offerCardUrl||link?.href||"";
      let offer=byUrl.get(url);
      if(!offer){try{const normalized=new URL(url,location.href).href;offer=byUrl.get(normalized)||offers.find(o=>{try{return new URL(o.url,location.href).href===normalized;}catch(_){return false;}});}catch(_){}}
      if(offer&&isLocked(offer))makeLocked(card,offer);
    });
    const note=document.createElement("div");note.className="dr-lock-note";
    note.innerHTML="🔒 Les offres dont la réduction vérifiée dépasse 40 % sont réservées à DealRadar Pro. <a href='./compte.html#pro-plan'>Découvrir Pro</a>";
    const main=document.querySelector("main");if(main&&!document.querySelector(".dr-lock-note"))main.insertBefore(note,main.firstElementChild);
  };
  const boot = async () => {
    addStyle();
    const plan=await getPlan();
    const isPro=["pro","premium","admin"].includes(plan);
    initAds(isPro);
    await applyLocks(isPro);
    // Les catalogues sont rendus après le chargement : réappliquer les règles après leur rendu.
    let runs=0;
    const observer=new MutationObserver(()=>{if(runs++<8)applyLocks(isPro);else observer.disconnect();});
    const root=document.querySelector("#deals-grid")||document.querySelector("main");
    if(root)observer.observe(root,{childList:true,subtree:true});
  };
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();