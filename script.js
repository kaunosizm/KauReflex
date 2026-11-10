(() => {
"use strict";

/* =========================================
   KAUREFLEX V4
   SUPABASE
========================================= */

const SUPABASE_URL =
"https://vqmwhzrcosxkrcxrzgeh.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
"sb_publishable_RUvdJnlkY45aJhoBymHK_g_6MZamTRt";

if (!window.supabase) {
  console.error("Supabase kütüphanesi yüklenemedi.");
  alert("Bağlantı hatası: Sayfayı yenileyip tekrar dene.");
  return;
}

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const $ = id => document.getElementById(id);
const TOTAL = 5;

/* =========================================
   TEPKİ ÖLÇER DEĞİŞKENLERİ
========================================= */

let round = 0;
let results = [];
let phase = "idle";
let timer = null;
let startedAt = 0;

/* =========================================
   HESAP DEĞİŞKENLERİ
========================================= */

let currentUser = null;
let username = "";
let profileRoleName = "";
const ADMIN_USER_IDS = new Set([
  "b5e7f163-c645-4b69-a330-644c4e0ec81f",
  "852172f9-19ca-4b74-9ba3-f88eb5151d1a"
].map(id => id.trim().toLowerCase()));
const isAdminUser = user => ADMIN_USER_IDS.has(String(user?.id || "").trim().toLowerCase());
let best = null;
let history = [];
let authMode = "login";
let saving = false;
let lastUnsavedResult = null;

// CHAT
let chatRealtimeChannel = null;
let chatActiveType = "global";
let chatActiveConversationId = null;
let chatActiveUsername = "";
let chatLoading = false;

/* =========================================
   AIM LABORATUVARI
========================================= */

const AIM_DURATION = 30;
const AIM_CELLS = 25;

const AIM_LEVELS = {
  easy: {
    name: "Kolay",
    targetInterval: 1250,
    points: 10
  },
  medium: {
    name: "Orta",
    targetInterval: 850,
    points: 15
  },
  hard: {
    name: "Zor",
    targetInterval: 500,
    points: 20
  }
};

let aimDifficulty = "easy";
let aimRunning = false;
let aimScore = 0;
let aimHits = 0;
let aimMisses = 0;
let aimTime = AIM_DURATION;
let aimTimer = null;
let aimSpawnTimer = null;
let aimTarget = -1;
let aimStartedAt = 0;
let aimReactionTimes = [];

/* =========================================
   CPS ÖLÇER
========================================= */

let cpsDuration = 5;
let cpsClicks = 0;
let cpsRunning = false;
let cpsStartedAt = 0;
let cpsTimer = null;
let cpsClickTimes = [];

let cpsBest = Number(
  localStorage.getItem("kaureflex_cps_best") || 0
);

if (!Number.isFinite(cpsBest) || cpsBest < 0) {
  cpsBest = 0;
}

/* =========================================
   ELEMENTLER
========================================= */

const area = $("reaction-area");
const title = $("reaction-title");
const help = $("reaction-help");
const icon = $("reaction-icon");
const status = $("status-message");
const start = $("start-btn");

/* =========================================
   GENEL FONKSİYONLAR
========================================= */

function setText(id, value) {
  const element = $(id);
  if (element) element.textContent = value;
}

function message(text, isError = false) {
  const element = $("dialog-error");
  if (!element) return;

  element.textContent = text;
  element.style.color = isError ? "#ff8585" : "#8fffc7";
}

function formatDate(date) {
  if (!date) return "—";

  return new Date(date).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

function maskEmail(email) {
  if (!email || !email.includes("@")) return "—";

  const parts = email.split("@");
  const name = parts[0];

  const masked = name.length <= 2
    ? name[0]
    : name.slice(0, 2);

  return masked + "***@" + parts[1];
}

/* =========================================
   TEPKİ İSTATİSTİKLERİ
========================================= */

function stats() {
  setText("round-counter", `${round} / ${TOTAL}`);

  setText(
    "average-stat",
    results.length
      ? Math.round(
          results.reduce((a, b) => a + b, 0) /
          results.length
        )
      : "—"
  );

  setText(
    "last-stat",
    results.length
      ? results[results.length - 1]
      : "—"
  );

  setText("best-stat", best ?? "—");
}

/* =========================================
   PROFİL
========================================= */

function renderProfile() {
  if (!currentUser) return;

  const displayName =
    username ||
    currentUser.user_metadata?.username ||
    "Kullanıcı";

  const adminAccount = isAdminUser(currentUser);
  const profileNameElement = $("profile-username");
  if (profileNameElement) {
    profileNameElement.textContent = displayName;
    profileNameElement.classList.toggle("admin-gold-name", adminAccount);
  }
  if (adminAccount) {
    setText("profile-level", "SEVİYE ∞");
    setText("profile-xp", "SINIRSIZ XP");
    const xpFill = $("profile-xp-fill");
    if (xpFill) xpFill.style.width = "100%";
    setText("profile-xp-next", "KAUREFLEX YÖNETİCİSİ");
  }
  setText("profile-email", maskEmail(currentUser.email));
  setText("profile-joined", formatDate(currentUser.created_at));

  const roleElement = $("profile-role");
  if (roleElement) {
    roleElement.textContent = profileRoleName || "";
    roleElement.hidden = !profileRoleName;
  }

  const validHistory = history.filter(item =>
    Number.isFinite(Number(item.average_ms ?? item.average))
  );

  if (!validHistory.length) {
    setText("profile-best-average", "—");
    setText("profile-average", "—");
    setText("profile-fastest", "—");
    setText("profile-test-count", "0");
    setText("profile-note", "Henüz tamamlanmış bir testin yok.");
    return;
  }

  const averages = validHistory.map(item =>
    Number(item.average_ms ?? item.average)
  );

  const fastest = validHistory
    .map(item => Number(item.best_ms))
    .filter(Number.isFinite);

  setText("profile-best-average", Math.min(...averages));

  setText(
    "profile-average",
    Math.round(
      averages.reduce((a, b) => a + b, 0) /
      averages.length
    )
  );

  setText(
    "profile-fastest",
    fastest.length ? Math.min(...fastest) : "—"
  );

  setText("profile-test-count", validHistory.length);

  setText(
    "profile-note",
    "İstatistiklerin tamamlanan testlerine göre hesaplanır."
  );
}

/* =========================================
   PROFİL ARAYÜZÜ
========================================= */

function profileUI() {
  const loggedIn = !!currentUser;
  const mobileNav = $("mobile-bottom-nav");
  if (mobileNav) mobileNav.hidden = !loggedIn;
  const userLabel = $("user-label");

  const displayName = loggedIn
    ? username || currentUser.user_metadata?.username || "Kullanıcı"
    : "";

  if (userLabel) {
    userLabel.textContent = loggedIn
      ? "@" + displayName
      : "";

    userLabel.hidden = !loggedIn;
  }

  if ($("login-btn")) $("login-btn").hidden = loggedIn;
  if ($("register-btn")) $("register-btn").hidden = loggedIn;
  if ($("profile-btn")) $("profile-btn").hidden = !loggedIn;
  if ($("profile-search-nav-btn")) $("profile-search-nav-btn").hidden = !loggedIn;
  if ($("chat-btn")) $("chat-btn").hidden = !loggedIn;
  const isAdmin = !!currentUser && isAdminUser(currentUser);
  if ($("nav-admin")) $("nav-admin").hidden = !isAdmin;

  setText(
    "save-description",
    loggedIn
      ? `Merhaba ${displayName}! Testlerin hesabında saklanabilir.`
      : "Rekorlarını buluta kaydetmek için giriş yap. Üye olmadan da test çözebilirsin."
  );

  const saveButton = $("save-btn");

  if (saveButton) {
    saveButton.disabled = !loggedIn || !lastUnsavedResult;
  }

  if (
    loggedIn &&
    $("profile-page") &&
    !$("profile-page").hidden
  ) {
    renderProfile();
  }
}

/* =========================================
   SAYFA GEÇİŞLERİ
========================================= */

function showHome() {
  stopAim();
  stopCPS();
   $("social-page").hidden = true;
  $("profile-search-page").hidden = true;
  $("chat-page").hidden = true;
  $("admin-page").hidden = true;

  $("home-view").hidden = false;
  $("profile-page").hidden = true;

  showReaction();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openProfile() {
  if (!currentUser) {
    openDialog("login");
    return;
  }

  stopAim();
  stopCPS();
   $("social-page").hidden = true;
  $("profile-search-page").hidden = true;
  $("chat-page").hidden = true;
  $("admin-page").hidden = true;
  closeMenu();

  $("home-view").hidden = true;
  $("profile-page").hidden = false;

  renderProfile();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showReaction() {
  stopAim();
  stopCPS();
  $("chat-page").hidden = true;

  $("home-view").hidden = false;
  $("profile-page").hidden = true;
  $("social-page").hidden = true;
  $("admin-page").hidden = true;

  $("reaction-view").hidden = false;
  $("aim-view").hidden = true;
  $("cps-view").hidden = true;

  setActiveMenu("nav-reaction");
  closeMenu();
}

function showAim() {
  stopAim();
  stopCPS();
  $("chat-page").hidden = true;

  $("home-view").hidden = false;
  $("profile-page").hidden = true;
  $("social-page").hidden = true;
  $("admin-page").hidden = true;

  $("reaction-view").hidden = true;
  $("aim-view").hidden = false;
  $("cps-view").hidden = true;

  setActiveMenu("nav-aim");
  closeMenu();

  renderAimGrid();
  updateAimStats();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showCPS() {
  stopAim();
  stopCPS();
  $("chat-page").hidden = true;

  $("home-view").hidden = false;
  $("profile-page").hidden = true;
  $("social-page").hidden = true;
  $("admin-page").hidden = true;

  $("reaction-view").hidden = true;
  $("aim-view").hidden = true;
  $("cps-view").hidden = false;

  setActiveMenu("nav-cps");
  closeMenu();

  updateCPSStats();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* =========================================
   SOL MENÜ
========================================= */

function openMenu() {
  $("side-menu").classList.add("open");
  $("menu-overlay").hidden = false;

  $("side-menu").setAttribute("aria-hidden", "false");
  $("menu-btn").setAttribute("aria-expanded", "true");
}

function closeMenu() {
  $("side-menu").classList.remove("open");
  $("menu-overlay").hidden = true;

  $("side-menu").setAttribute("aria-hidden", "true");
  $("menu-btn").setAttribute("aria-expanded", "false");
}

function setActiveMenu(id) {
  const mobileMap = {
    "nav-reaction": "mobile-nav-home",
    "nav-friends": "mobile-nav-friends",
    "nav-chat": "mobile-nav-chat",
    "nav-profile": "mobile-nav-profile"
  };
  document.querySelectorAll(".mobile-nav-item").forEach(item => item.classList.remove("active"));
  const mobileActive = mobileMap[id];
  if (mobileActive && $(mobileActive)) $(mobileActive).classList.add("active");
  document.querySelectorAll(".menu-link").forEach(button => {
    button.classList.toggle("active", button.id === id);
  });
}

/* =========================================
   DENEME GEÇMİŞİ
========================================= */

function renderHistory() {
  const list = $("history-list");
  if (!list) return;

  list.replaceChildren();

  if (!history.length) {
    const p = document.createElement("p");
    p.className = "empty-history";
    p.textContent =
      "Henüz tamamlanmış bir testin yok. İlk denemeni yap!";

    list.append(p);
    return;
  }

  history.slice(0, 10).forEach(item => {
    const p = document.createElement("p");
    p.className = "history-row";

    const date = new Date(
      item.created_at || item.date || Date.now()
    ).toLocaleString("tr-TR");

    p.textContent =
      `${date} · Ortalama ${item.average_ms ?? item.average} ms`;

    list.append(p);
  });
}


/* TOP 100 LİDER TABLOLARI */
const LEADERBOARD_CONFIG = {
 reaction:{element:"reaction-leaderboard",rpc:"get_top100_reaction",format:v=>Math.round(Number(v))+" ms"},
 aim:{element:"aim-leaderboard",rpc:"get_top100_aim",format:v=>Math.round(Number(v))+" puan"},
 cps:{element:"cps-leaderboard",rpc:"get_top100_cps",format:v=>Number(v).toFixed(2)+" CPS"}
};
function renderLeaderboard(kind,rows,error){
 const box=$(LEADERBOARD_CONFIG[kind].element); if(!box)return; box.replaceChildren();
 if(error||!rows?.length){const p=document.createElement("p");p.className="leaderboard-empty";p.textContent=error?"Sıralama yüklenemedi.":"Henüz kayıtlı skor yok. İlk 100'e giren sen ol!";box.append(p);if(error)console.warn("Top100:",error);return;}
 rows.forEach((entry,i)=>{const row=document.createElement("div");row.className="leaderboard-row"+(i<3?" podium podium-"+(i+1):"");const rank=document.createElement("span");rank.className="leaderboard-rank";rank.textContent=(entry.rank_no||i+1)+".";const name=document.createElement("strong");name.className="leaderboard-name";if(String(entry.username||"").trim().toLowerCase()==="admin")name.classList.add("admin-gold-name");name.textContent="@"+(entry.username||"Üye");const score=document.createElement("span");score.className="leaderboard-score";score.textContent=LEADERBOARD_CONFIG[kind].format(entry.score);row.append(rank,name,score);box.append(row);});
}
async function loadTop100(kind=null){
 const keys=kind?[kind]:Object.keys(LEADERBOARD_CONFIG);
 await Promise.all(keys.map(async key=>{const {data,error}=await supabase.rpc(LEADERBOARD_CONFIG[key].rpc);renderLeaderboard(key,data||[],error);}));
}

/* =========================================
   TEPKİ TESTİNİ SIFIRLA
========================================= */

function reset() {
  clearTimeout(timer);

  timer = null;
  round = 0;
  results = [];
  phase = "idle";

  area.className = "reaction-area ready";
  icon.textContent = "✦";
  title.textContent = "BAŞLAMAK İÇİN TIKLA";

  help.textContent =
    "Ekran yeşile döndüğünde olabildiğince hızlı tıkla.";

  status.textContent = "Hazır olduğunda teste başla.";

  start.disabled = false;

  stats();
}

/* =========================================
   BULUTA KAYIT
========================================= */

async function saveResult(average, bestRound) {
  if (!currentUser || saving) return false;

  saving = true;

  try {
    const userId = currentUser.id;

    const { error } = await supabase
      .from("reaction_results")
      .insert({
        user_id: userId,
        average_ms: average,
        best_ms: bestRound
      });

    if (error) {
      status.textContent =
        "Buluta kaydedilemedi: " + error.message;
      return false;
    }

    lastUnsavedResult = null;

    status.textContent =
      "Rekorun başarıyla buluta kaydedildi!";

    await loadCloudData();
    await loadTop100("reaction");

    return true;

  } catch (error) {
    status.textContent = "Kayıt hatası: " + error.message;
    return false;

  } finally {
    saving = false;
    profileUI();
  }
}

/* =========================================
   TEST BİTİŞİ
========================================= */

function finish() {
  phase = "finished";

  const average = Math.round(
    results.reduce((a, b) => a + b, 0) / results.length
  );

  const bestRound = Math.min(...results);

  status.textContent =
    `Test tamamlandı! Ortalama tepki süren: ${average} ms.`;

  icon.textContent = "✧";
  title.textContent = `${average} ms`;

  help.textContent =
    "Harika! Yeniden denemek için Teste Başla'ya bas.";

  area.className = "reaction-area ready";
  start.disabled = false;

  if (best === null || average < best) {
    best = average;
  }

  const completedTest = {
    average_ms: average,
    best_ms: bestRound,
    created_at: new Date().toISOString()
  };

  history.unshift(completedTest);
  history = history.slice(0, 20);

  lastUnsavedResult = completedTest;

  stats();
  renderHistory();
  profileUI();

  if (currentUser) {
    saveResult(average, bestRound);
  }
}

/* =========================================
   YENİ TUR
========================================= */

function nextRound() {
  if (round >= TOTAL) {
    finish();
    return;
  }

  round++;
  phase = "waiting";

  stats();

  area.className = "reaction-area waiting";
  icon.textContent = "…";
  title.textContent = "BEKLE…";

  help.textContent = "Yeşil ışık yanmadan dokunma!";

  status.textContent =
    `${round}. tur · Yeşil ışığı bekle…`;

  timer = setTimeout(() => {
    if (phase !== "waiting") return;

    phase = "go";
    startedAt = performance.now();

    area.className = "reaction-area go";
    icon.textContent = "⚡";
    title.textContent = "ŞİMDİ TIKLA!";
    help.textContent = "Hemen dokun!";
    status.textContent = "ŞİMDİ!";

  }, 1300 + Math.random() * 2700);
}

function begin() {
  reset();
  start.disabled = true;
  nextRound();
}

/* =========================================
   TEPKİ ALGILAMA
========================================= */

function react() {
  if (phase === "waiting") {
    clearTimeout(timer);

    phase = "early";
    area.className = "reaction-area early";

    icon.textContent = "!";
    title.textContent = "ÇOK ERKEN!";

    help.textContent =
      "Yeşil ışığı beklemeliydin. Yeniden başla.";

    status.textContent = "Erken dokundun!";
    start.disabled = false;

    return;
  }

  if (phase === "go") {
    const ms = Math.round(performance.now() - startedAt);

    results.push(ms);
    phase = "result";

    area.className = "reaction-area ready";
    icon.textContent = "✓";
    title.textContent = `${ms} ms`;

    help.textContent = `${round}. tur tamamlandı.`;
    status.textContent = `${round}/${TOTAL} tur tamamlandı.`;

    stats();

    timer = setTimeout(nextRound, 750);
    return;
  }

  if (
    phase === "idle" ||
    phase === "finished" ||
    phase === "early"
  ) {
    begin();
  }
}

/* =========================================
   AIM GRID OLUŞTUR
========================================= */

function renderAimGrid() {
  const grid = $("aim-grid");
  if (!grid) return;

  if (grid.children.length === AIM_CELLS) {
    return;
  }

  grid.replaceChildren();

  for (let i = 0; i < AIM_CELLS; i++) {
    const cell = document.createElement("button");

    cell.type = "button";
    cell.className = "aim-cell";
    cell.dataset.index = i;

    cell.setAttribute(
      "aria-label",
      `Hedef alanı ${i + 1}`
    );

    cell.addEventListener("click", () => {
      aimCellClick(i);
    });

    grid.append(cell);
  }
}

/* =========================================
   AIM İSTATİSTİKLERİ
========================================= */

function updateAimStats() {
  setText("aim-score", aimScore);
  setText("aim-time", aimTime);
  setText("aim-hits", aimHits);

  const attempts = aimHits + aimMisses;

  const accuracy = attempts
    ? Math.round((aimHits / attempts) * 100)
    : 0;

  setText("aim-accuracy", `%${accuracy}`);
}

/* =========================================
   AIM ZORLUK SEÇİMİ
========================================= */

function selectDifficulty(level) {
  if (aimRunning || !AIM_LEVELS[level]) return;

  aimDifficulty = level;

  document.querySelectorAll(".difficulty-btn").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.difficulty === level
    );
  });

  setText(
    "aim-status",
    `${AIM_LEVELS[level].name} seviyesi seçildi. Oyuna başlayabilirsin.`
  );
}

/* =========================================
   AIM HEDEF GÖSTER
========================================= */

function spawnAimTarget() {
  if (!aimRunning) return;

  const grid = $("aim-grid");
  if (!grid) return;

  const cells = Array.from(
    grid.querySelectorAll(".aim-cell")
  );

  if (!cells.length) return;

  cells.forEach(cell => {
    cell.classList.remove("target");
    cell.replaceChildren();
    cell.disabled = false;
  });

  let next;

  do {
    next = Math.floor(Math.random() * AIM_CELLS);
  } while (next === aimTarget && AIM_CELLS > 1);

  aimTarget = next;

  const targetCell = cells[next];

  targetCell.classList.add("target");
  targetCell.setAttribute("aria-label", "Mor hedef");

  const dot = document.createElement("span");
  dot.className = "aim-target";
  dot.setAttribute("aria-hidden", "true");

  targetCell.append(dot);

  aimStartedAt = performance.now();

  clearTimeout(aimSpawnTimer);

  aimSpawnTimer = setTimeout(() => {
    if (!aimRunning) return;

    aimMisses++;
    aimTarget = -1;

    updateAimStats();
    spawnAimTarget();

  }, AIM_LEVELS[aimDifficulty].targetInterval);
}

/* =========================================
   AIM HÜCRE TIKLAMASI
========================================= */

function aimCellClick(index) {
  if (!aimRunning) return;

  if (index === aimTarget) {
    clearTimeout(aimSpawnTimer);

    const reactionTime = Math.round(
      performance.now() - aimStartedAt
    );

    aimReactionTimes.push(reactionTime);
    aimHits++;

    aimScore += AIM_LEVELS[aimDifficulty].points;

    aimTarget = -1;

    updateAimStats();
    spawnAimTarget();

  } else {
    aimMisses++;
    updateAimStats();

    const cell = $("aim-grid").children[index];

    if (cell) {
      cell.classList.remove("miss");
      void cell.offsetWidth;
      cell.classList.add("miss");

      setTimeout(() => {
        cell.classList.remove("miss");
      }, 250);
    }
  }
}

/* =========================================
   AIM OYUNUNU BAŞLAT
========================================= */

function startAim() {
  if (aimRunning) return;

  resetAimData();

  aimRunning = true;

  $("aim-start-btn").disabled = true;
  $("aim-start-btn").textContent = "OYUN DEVAM EDİYOR";

  document.querySelectorAll(".difficulty-btn").forEach(button => {
    button.disabled = true;
  });

  setText(
    "aim-status",
    `${AIM_LEVELS[aimDifficulty].name} seviyesi başladı! Hedefleri vur!`
  );

  renderAimGrid();
  spawnAimTarget();

  aimTimer = setInterval(() => {
    if (!aimRunning) return;

    aimTime--;
    updateAimStats();

    if (aimTime <= 0) {
      finishAim();
    }

  }, 1000);
}

function resetAimData() {
  clearInterval(aimTimer);
  clearTimeout(aimSpawnTimer);

  aimScore = 0;
  aimHits = 0;
  aimMisses = 0;
  aimTime = AIM_DURATION;
  aimTarget = -1;
  aimReactionTimes = [];

  updateAimStats();

  const grid = $("aim-grid");

  if (grid) {
    Array.from(grid.children).forEach(cell => {
      cell.classList.remove("target", "miss");
      cell.replaceChildren();
      cell.disabled = false;
    });
  }
}

/* =========================================
   AIM OYUNUNU DURDUR
========================================= */

function stopAim() {
  if (!aimRunning) return;

  aimRunning = false;

  clearInterval(aimTimer);
  clearTimeout(aimSpawnTimer);

  aimTarget = -1;

  const grid = $("aim-grid");

  if (grid) {
    Array.from(grid.children).forEach(cell => {
      cell.classList.remove("target");
      cell.replaceChildren();
    });
  }

  if ($("aim-start-btn")) {
    $("aim-start-btn").disabled = false;
    $("aim-start-btn").textContent = "Yeniden Başlat";
  }

  document.querySelectorAll(".difficulty-btn").forEach(button => {
    button.disabled = false;
  });
}

/* =========================================
   AIM OYUNU BİTİŞİ
========================================= */

function finishAim() {
  if (!aimRunning) return;

  const finalScore = aimScore;
  const finalHits = aimHits;

  const attempts = aimHits + aimMisses;

  const accuracy = attempts
    ? Math.round((aimHits / attempts) * 100)
    : 0;

  const averageReaction = aimReactionTimes.length
    ? Math.round(
        aimReactionTimes.reduce((a, b) => a + b, 0) /
        aimReactionTimes.length
      )
    : 0;

  stopAim();

  aimTime = 0;
  updateAimStats();

  setText(
    "aim-status",
    `Süre bitti! Skorun: ${finalScore} · İsabet: ${finalHits} · Doğruluk: %${accuracy} · Ortalama tepki: ${averageReaction || "—"} ms`
  );

    $("aim-start-btn").textContent = "Tekrar Oyna";

    if (currentUser) {
      (async () => {
        const { error } = await supabase.from("aim_results").insert({user_id:currentUser.id,score:finalScore,difficulty:aimDifficulty,hits:finalHits,accuracy,average_reaction_ms:averageReaction});
        if (error) console.warn("Aim skoru kaydedilemedi:",error); else await loadTop100("aim");
      })();
    }
}

/* =========================================
   CPS İSTATİSTİKLERİ
========================================= */

function updateCPSStats() {
  setText("cps-clicks", cpsClicks);
  setText("cps-time", cpsDuration.toFixed(1));
  setText("cps-current", "0.00");
  setText("cps-result-best", cpsBest.toFixed(2));
}

/* =========================================
   CPS SÜRE SEÇİMİ
========================================= */

function selectCPSDuration(duration) {
  if (cpsRunning) return;

  const value = Number(duration);

  if (![5, 10, 30].includes(value)) return;

  cpsDuration = value;

  document.querySelectorAll(".cps-duration-btn").forEach(button => {
    button.classList.toggle(
      "active",
      Number(button.dataset.duration) === value
    );
  });

  cpsClicks = 0;
  cpsClickTimes = [];

  setText("cps-clicks", "0");
  setText("cps-time", cpsDuration.toFixed(1));
  setText("cps-current", "0.00");
  setText("cps-result-clicks", "—");
  setText("cps-result-average", "—");
  setText("cps-result-best", cpsBest.toFixed(2));

  setText("cps-status", `${cpsDuration} saniyelik test seçildi.`);
  setText("cps-click-title", "BAŞLAMAK İÇİN TIKLA");
  setText("cps-click-help", "Teste başla ve olabildiğince hızlı tıkla!");
}

/* =========================================
   CPS TESTİNİ BAŞLAT
========================================= */

function startCPS() {
  if (cpsRunning) return;

  clearInterval(cpsTimer);

  cpsClicks = 0;
  cpsClickTimes = [];
  cpsStartedAt = performance.now();
  cpsRunning = true;

  const clickArea = $("cps-click-area");

  clickArea.disabled = false;
  clickArea.classList.add("running");

  $("cps-start-btn").disabled = true;
  $("cps-start-btn").textContent = "TEST DEVAM EDİYOR";

  document.querySelectorAll(".cps-duration-btn").forEach(button => {
    button.disabled = true;
  });

  setText("cps-click-title", "HIZLICA TIKLA!");
  setText("cps-click-help", "Her tıklaman sayılır!");
  setText("cps-status", "Test başladı! Hızını göster!");

  setText("cps-clicks", "0");
  setText("cps-time", cpsDuration.toFixed(1));
  setText("cps-current", "0.00");

  setText("cps-result-clicks", "—");
  setText("cps-result-average", "—");

  cpsTimer = setInterval(updateCPSTimer, 40);
}

/* =========================================
   CPS TIKLAMA
========================================= */

function cpsClick() {
  if (!cpsRunning) return;

  const now = performance.now();
  const elapsed = (now - cpsStartedAt) / 1000;

  if (elapsed >= cpsDuration) {
    finishCPS();
    return;
  }

  cpsClicks++;
  cpsClickTimes.push(now);

  setText("cps-clicks", cpsClicks);

  updateCPSLive();
}

/* =========================================
   CPS CANLI GÖSTERGE
========================================= */

function updateCPSLive() {
  const now = performance.now();

  cpsClickTimes = cpsClickTimes.filter(
    time => now - time <= 1000
  );

  const currentCPS = cpsClickTimes.length;

  setText("cps-current", currentCPS.toFixed(2));
}

/* =========================================
   CPS ZAMANLAYICI
========================================= */

function updateCPSTimer() {
  if (!cpsRunning) return;

  const elapsed = (performance.now() - cpsStartedAt) / 1000;
  const remaining = Math.max(0, cpsDuration - elapsed);

  setText("cps-time", remaining.toFixed(1));

  updateCPSLive();

  if (remaining <= 0) {
    finishCPS();
  }
}

/* =========================================
   CPS TESTİNİ BİTİR
========================================= */

function finishCPS() {
  if (!cpsRunning) return;

  const actualDuration = cpsDuration;
  const totalClicks = cpsClicks;
  const averageCPS = totalClicks / actualDuration;

  cpsRunning = false;

  clearInterval(cpsTimer);
  cpsTimer = null;

  const clickArea = $("cps-click-area");

  clickArea.disabled = true;
  clickArea.classList.remove("running");

  $("cps-start-btn").disabled = false;
  $("cps-start-btn").textContent = "Tekrar Dene";

  document.querySelectorAll(".cps-duration-btn").forEach(button => {
    button.disabled = false;
  });

  if (averageCPS > cpsBest) {
    cpsBest = averageCPS;

    try {
      localStorage.setItem(
        "kaureflex_cps_best",
        cpsBest.toFixed(2)
      );
    } catch (error) {
      console.warn("CPS rekoru kaydedilemedi:", error);
    }
  }

  setText("cps-clicks", totalClicks);
  setText("cps-time", "0.0");
  setText("cps-current", averageCPS.toFixed(2));

  setText("cps-result-clicks", totalClicks);
  setText("cps-result-average", averageCPS.toFixed(2));
  setText("cps-result-best", cpsBest.toFixed(2));

  setText("cps-click-title", "TEST TAMAMLANDI!");
  setText(
    "cps-click-help",
    `${totalClicks} tıklama yaptın. Tekrar deneyebilirsin.`
  );

  setText(
    "cps-status",
    `Test bitti! Ortalama hızın: ${averageCPS.toFixed(2)} CPS`
  );

  if (currentUser) {
    (async () => {
      const { error } = await supabase.from("cps_results").insert({user_id:currentUser.id,total_clicks:totalClicks,duration_seconds:actualDuration,cps:Number(averageCPS.toFixed(2))});
      if (error) console.warn("CPS skoru kaydedilemedi:",error); else await loadTop100("cps");
    })();
  }
}

/* =========================================
   CPS TESTİNİ DURDUR
========================================= */

function stopCPS() {
  clearInterval(cpsTimer);
  cpsTimer = null;

  if (!cpsRunning) return;

  cpsRunning = false;

  const clickArea = $("cps-click-area");

  if (clickArea) {
    clickArea.disabled = true;
    clickArea.classList.remove("running");
  }

  if ($("cps-start-btn")) {
    $("cps-start-btn").disabled = false;
    $("cps-start-btn").textContent = "Teste Başla";
  }

  document.querySelectorAll(".cps-duration-btn").forEach(button => {
    button.disabled = false;
  });

  setText("cps-click-title", "BAŞLAMAK İÇİN TIKLA");
  setText("cps-click-help", "Teste başla ve olabildiğince hızlı tıkla!");
  setText("cps-status", "Test durduruldu. Yeniden başlayabilirsin.");
}

/* =========================================
   GİRİŞ PENCERESİ
========================================= */

function openDialog(mode) {
  authMode = mode;

  const dialog = $("account-dialog");

  if (!dialog.open) dialog.showModal();

  message("");

  const registering = mode === "register";
  const resetting = mode === "reset";

  setText(
    "dialog-title",
    resetting
      ? "Şifre yenile"
      : registering
        ? "Hesap oluştur"
        : "Giriş Yap"
  );

  setText(
    "dialog-copy",
    resetting
      ? "E-posta adresine şifre yenileme bağlantısı göndereceğiz."
      : registering
        ? "Kullanıcı adını, e-postanı ve şifreni belirle."
        : "Hesabına giriş yap ve rekorlarını bulutta sakla."
  );

  $("username-label").hidden = !registering;
  $("username-input").hidden = !registering;
  $("password-input").hidden = resetting;
  $("forgot-btn").hidden = registering || resetting;
  $("switch-mode-btn").hidden = resetting;

  $("confirm-account-btn").textContent = resetting
    ? "Sıfırlama bağlantısı gönder"
    : registering
      ? "Kayıt Ol"
      : "Giriş Yap";

  $("switch-mode-btn").textContent = registering
    ? "Zaten hesabın var mı? Giriş yap"
    : "Hesabın yok mu? Kayıt ol";
}

/* =========================================
   BULUT VERİLERİ
========================================= */

async function loadCloudData() {
  if (!currentUser) return;

  const userId = currentUser.id;

  username =
    currentUser.user_metadata?.username ||
    username ||
    "";

  try {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .maybeSingle();

    if (currentUser?.id !== userId) return;

    if (!profileError && profile?.username) {
      username = profile.username;
    } else if (profileError) {
      console.warn("Profil kullanıcı adı okunamadı:", profileError);
    }

    // Rol bilgisini RLS politikalarından bağımsız, yalnızca
    // oturum açmış kullanıcının kendi rolünü döndüren RPC'den al.
    const { data: ownRole, error: roleReadError } = await supabase.rpc(
      "get_my_profile_role"
    );

    if (currentUser?.id !== userId) return;

    if (!roleReadError) {
      profileRoleName = ownRole || "";
    } else {
      console.warn("Profil rolü RPC ile okunamadı:", roleReadError);

      // Eski kurulumlar için güvenli geri dönüş.
      const { data: fallbackProfile, error: fallbackError } = await supabase
        .from("profiles")
        .select("role_name")
        .eq("id", userId)
        .maybeSingle();

      if (currentUser?.id !== userId) return;

      if (!fallbackError && fallbackProfile) {
        profileRoleName = fallbackProfile.role_name || "";
      } else if (fallbackError) {
        console.error("Profil rolü okunamadı:", fallbackError);
        profileRoleName = "";
      }
    }

    const { data, error } = await supabase
      .from("reaction_results")
      .select("average_ms,best_ms,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (currentUser?.id !== userId) return;

    if (error) throw error;

    history = data || [];

    const averages = history
      .map(item => Number(item.average_ms))
      .filter(Number.isFinite);

    best = averages.length
      ? Math.min(...averages)
      : null;

    renderHistory();
    renderProfile();
    profileUI();
    await loadAdminProfileStyle();
    stats();

  } catch (error) {
    console.error("Bulut verileri yüklenemedi:", error);
  }
}

loadTop100();

/* =========================================
   GİRİŞ / KAYIT / ŞİFRE YENİLEME
========================================= */

async function submitAuth() {
  if (saving) return;

  const email = $("email-input").value.trim();
  const password = $("password-input").value;

  const userName = $("username-input").value
    .trim()
    .toLowerCase();

  if (!email) {
    message("E-posta adresini gir.", true);
    return;
  }

  if (authMode !== "reset" && !password) {
    message("Şifreni gir.", true);
    return;
  }

  if (authMode === "register") {
    if (userName.length < 3 || userName.length > 20) {
      message(
        "Kullanıcı adı 3 ile 20 karakter arasında olmalı.",
        true
      );
      return;
    }

    if (!/^[a-z0-9_]+$/.test(userName)) {
      message(
        "Kullanıcı adında yalnızca küçük harf, sayı ve _ kullanabilirsin.",
        true
      );
      return;
    }

    if (password.length < 8) {
      message("Şifren en az 8 karakter olmalı.", true);
      return;
    }
  }

  saving = true;

  const button = $("confirm-account-btn");
  button.disabled = true;

  try {

    if (authMode === "reset") {
      const { error } =
        await supabase.auth.resetPasswordForEmail(
          email,
          {
            redirectTo:
              window.location.origin +
              window.location.pathname
          }
        );

      if (error) throw error;

      message(
        "Şifre yenileme bağlantısı e-posta adresine gönderildi."
      );

      return;
    }

    if (authMode === "register") {

      const { data: existingProfile, error: checkError } =
        await supabase
          .from("profiles")
          .select("id")
          .eq("username", userName)
          .maybeSingle();

      if (checkError) {
        console.warn(
          "Kullanıcı adı ön kontrolü yapılamadı:",
          checkError.message
        );
      }

      if (existingProfile) {
        message(
          "Bu kullanıcı adı zaten alınmış. Başka bir isim dene.",
          true
        );
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,

        options: {
          data: {
            username: userName
          }
        }
      });

      if (error) throw error;

      if (data.user && data.session) {
        currentUser = data.user;
        username = userName;

        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            username: userName
          })
          .eq("id", data.user.id);

        if (updateError) {
          console.error(
            "Profil kullanıcı adı güncellenemedi:",
            updateError
          );
        }

        $("account-dialog").close();

        await loadCloudData();

        profileUI();

        status.textContent =
          "Hesabın oluşturuldu. Hoş geldin!";

      } else {
        message(
          "Kayıt oluşturuldu. E-postana gelen doğrulama bağlantısını kontrol et."
        );
      }

      return;
    }

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password
      });

    if (error) throw error;

    currentUser = data.user;

    $("account-dialog").close();

    await loadCloudData();

    profileUI();

    status.textContent = "Başarıyla giriş yaptın!";

  } catch (error) {

    console.error("Hesap işlemi hatası:", error);

    const errorText = (
      error.message || ""
    ).toLowerCase();

    if (
      errorText.includes("username") ||
      errorText.includes("duplicate") ||
      errorText.includes("already exists") ||
      errorText.includes("zaten alınmış")
    ) {
      message(
        "Bu kullanıcı adı zaten alınmış. Başka bir isim dene.",
        true
      );

    } else if (
      errorText.includes("user already registered")
    ) {
      message(
        "Bu e-posta adresiyle zaten hesap oluşturulmuş.",
        true
      );

    } else if (
      errorText.includes("invalid login credentials")
    ) {
      message(
        "E-posta veya şifre hatalı.",
        true
      );

    } else {
      message(
        error.message || "Bir hata oluştu.",
        true
      );
    }

  } finally {
    saving = false;
    button.disabled = false;
  }
}

/* =========================================
   ÇIKIŞ
========================================= */

async function logout() {
  closeChatRealtime();
  const { error } = await supabase.auth.signOut();

  if (error) {
    alert("Çıkış yapılamadı: " + error.message);
    return;
  }

  currentUser = null;
  username = "";
  profileRoleName = "";
  history = [];
  best = null;
  lastUnsavedResult = null;

  profileUI();
  renderHistory();
  stats();

  showHome();

  status.textContent = "Hesabından çıkış yaptın.";
}

/* =========================================
   YÖNETİCİ — KULLANICI ROLÜ YÖNETİMİ
========================================= */

function setAdminRoleMessage(text, isError = false) {
  const element = $("admin-role-message");
  if (!element) return;
  element.textContent = text;
  element.style.color = isError ? "#ff8585" : "#8fffc7";
}

async function saveUserRole(clearRole = false) {
  if (!currentUser || !isAdminUser(currentUser)) {
    setAdminRoleMessage("Bu işlem için yetkin yok.", true);
    return;
  }

  const targetUsername = $("admin-role-username").value.trim();
  const roleName = clearRole ? "" : $("admin-role-name").value.trim();

  if (!targetUsername) {
    setAdminRoleMessage("Önce kullanıcı adını gir.", true);
    return;
  }

  if (!clearRole && !roleName) {
    setAdminRoleMessage("Atanacak rol adını gir.", true);
    return;
  }

  const saveButton = $("admin-role-save-btn");
  const clearButton = $("admin-role-clear-btn");
  if (saveButton) saveButton.disabled = true;
  if (clearButton) clearButton.disabled = true;

  try {
    const { data: matches, error: lookupError } = await supabase.rpc(
      "admin_find_user",
      { p_username: targetUsername }
    );

    if (lookupError) throw lookupError;
    if (!matches || matches.length === 0) {
      throw new Error("Bu kullanıcı adıyla bir profil bulunamadı.");
    }
    if (matches.length > 1) {
      throw new Error("Birden fazla kullanıcı bulundu.");
    }

    const targetProfile = {
      id: matches[0].user_id,
      username: matches[0].username
    };

    const { error: roleError } = await supabase.rpc("set_user_role", {
      p_user_id: targetProfile.id,
      p_role: roleName
    });
    if (roleError) throw roleError;

    setAdminRoleMessage(
      clearRole
        ? `@${targetProfile.username} kullanıcısının rolü kaldırıldı.`
        : `@${targetProfile.username} kullanıcısına "${roleName}" rolü verildi.`
    );

    if (targetProfile.id === currentUser.id) {
      profileRoleName = roleName;
      renderProfile();
    }
    if (!clearRole) $("admin-role-name").value = "";

  } catch (error) {
    console.error("Rol güncelleme hatası:", error);
    setAdminRoleMessage(error.message || "Rol güncellenemedi.", true);
  } finally {
    if (saveButton) saveButton.disabled = false;
    if (clearButton) clearButton.disabled = false;
  }
}

/* =========================================
   BUTON BAĞLANTILARI
========================================= */

$("menu-btn").addEventListener("click", openMenu);

$("close-menu-btn").addEventListener(
  "click",
  closeMenu
);

$("menu-overlay").addEventListener(
  "click",
  closeMenu
);

$("nav-reaction").addEventListener(
  "click",
  showReaction
);

$("nav-aim").addEventListener(
  "click",
  showAim
);

$("nav-cps").addEventListener(
  "click",
  showCPS
);

$("nav-profile").addEventListener(
  "click",
  openProfile
);

area.addEventListener("click", react);

start.addEventListener("click", begin);

$("login-btn").addEventListener("click", () => {
  openDialog("login");
});

$("register-btn").addEventListener("click", () => {
  openDialog("register");
});

$("profile-btn").addEventListener(
  "click",
  openProfile
);

function openLogoutConfirmation() {
  $("logout-confirm-overlay").hidden = false;
  $("logout-cancel-btn").focus();
}

function closeLogoutConfirmation() {
  $("logout-confirm-overlay").hidden = true;
}

$("profile-logout-btn").addEventListener("click", openLogoutConfirmation);
$("logout-cancel-btn").addEventListener("click", closeLogoutConfirmation);
$("logout-confirm-overlay").addEventListener("click", event => {
  if (event.target === $("logout-confirm-overlay")) closeLogoutConfirmation();
});
$("logout-confirm-btn").addEventListener("click", async () => {
  $("logout-confirm-btn").disabled = true;
  await logout();
  $("logout-confirm-btn").disabled = false;
  closeLogoutConfirmation();
});

$("admin-role-save-btn").addEventListener("click", () => {
  saveUserRole(false);
});

$("admin-role-clear-btn").addEventListener("click", () => {
  saveUserRole(true);
});

$("back-home-btn").addEventListener(
  "click",
  showHome
);

$("confirm-account-btn").addEventListener(
  "click",
  submitAuth
);

$("switch-mode-btn").addEventListener("click", () => {
  openDialog(
    authMode === "register"
      ? "login"
      : "register"
  );
});

$("forgot-btn").addEventListener("click", () => {
  openDialog("reset");
});

/* =========================================
   AIM ZORLUK BUTONLARI
========================================= */

document.querySelectorAll(".difficulty-btn").forEach(button => {
  button.addEventListener("click", () => {
    selectDifficulty(button.dataset.difficulty);
  });
});

$("aim-start-btn").addEventListener(
  "click",
  startAim
);

/* =========================================
   CPS BUTONLARI
========================================= */

document.querySelectorAll(".cps-duration-btn").forEach(button => {
  button.addEventListener("click", () => {
    selectCPSDuration(button.dataset.duration);
  });
});

$("cps-start-btn").addEventListener(
  "click",
  startCPS
);

$("cps-click-area").addEventListener(
  "click",
  cpsClick
);

/* =========================================
   GEÇMİŞİ TEMİZLE
========================================= */

$("clear-history-btn").addEventListener(
  "click",
  async () => {
    if (!history.length) return;

    if (
      !confirm(
        "Deneme geçmişini silmek istediğine emin misin?"
      )
    ) {
      return;
    }

    if (currentUser) {
      const { error } = await supabase
        .from("reaction_results")
        .delete()
        .eq("user_id", currentUser.id);

      if (error) {
        alert(
          "Geçmiş silinemedi: " + error.message
        );
        return;
      }
    }

    history = [];
    best = null;
    lastUnsavedResult = null;

    renderHistory();
    renderProfile();
    profileUI();
    stats();

    status.textContent =
      "Deneme geçmişin temizlendi.";
  }
);

/* =========================================
   MANUEL KAYIT
========================================= */

$("save-btn").addEventListener(
  "click",
  async () => {
    if (!currentUser || !lastUnsavedResult) {
      return;
    }

    await saveResult(
      lastUnsavedResult.average_ms,
      lastUnsavedResult.best_ms
    );
  }
);

/* =========================================
   KLAVYE KONTROLÜ
========================================= */

document.addEventListener("keydown", event => {
  if (event.code === "Escape") {
    closeMenu();
    return;
  }

  if (event.code !== "Space") return;

  if ($("account-dialog").open) return;
  if (!$("profile-page").hidden) return;
  if (!$("admin-page").hidden) return;
  if ($("reaction-view").hidden) return;
  if (!$("aim-view").hidden) return;
  if (!$("cps-view").hidden) return;

  const active = document.activeElement;

  if (
    active &&
    ["INPUT", "TEXTAREA", "BUTTON"].includes(
      active.tagName
    )
  ) {
    return;
  }

  event.preventDefault();

  react();
});

/* =========================================
   SUPABASE OTURUMU
========================================= */

supabase.auth.onAuthStateChange(
  (event, session) => {

    currentUser = session?.user || null;

    if (currentUser) {

      Promise.resolve().then(() => {
        if (currentUser) {
          return loadCloudData();
        }
      });

    } else {
      closeChatRealtime();
      if ($("chat-page") && !$("chat-page").hidden) showHome();
      username = "";
      history = [];
      best = null;
      lastUnsavedResult = null;

      renderHistory();
      stats();
    }

    profileUI();
  }
);

/* =========================================
   İLK AÇILIŞ
========================================= */

async function initialize() {
  renderAimGrid();
  renderHistory();
  stats();
  updateAimStats();
  updateCPSStats();
  profileUI();

  try {
    const { data, error } =
      await supabase.auth.getSession();

    if (error) throw error;

    currentUser = data.session?.user || null;

    if (currentUser) {
      await loadCloudData();
    }

    profileUI();

  } catch (error) {
    console.error(
      "Oturum kontrolü başarısız:",
      error
    );

    status.textContent =
      "Hesap bağlantısı kontrol edilemedi.";
  }
}

/* =========================================
   KAUREFLEX V5 — ARKADAŞLIK SİSTEMİ
========================================= */

function showAdminPage() {
  if (!currentUser || !isAdminUser(currentUser)) {
    alert("Bu sayfaya erişim yetkin yok.");
    return;
  }

  stopAim();
  stopCPS();

  $("home-view").hidden = true;
  $("profile-page").hidden = true;
  $("social-page").hidden = true;
  $("profile-search-page").hidden = true;
  $("admin-page").hidden = false;
  $("chat-page").hidden = true;
  const adminPanel = $("admin-role-panel");
  if (adminPanel) adminPanel.hidden = false;

  setActiveMenu("nav-admin");
  closeMenu();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function showFriends() {
  if (!currentUser) {
    openDialog("login");
    return;
  }

  stopAim();
  stopCPS();

  $("home-view").hidden = true;
  $("profile-page").hidden = true;
  $("admin-page").hidden = true;
  $("social-page").hidden = false;
  $("profile-search-page").hidden = true;
  $("chat-page").hidden = true;

  setActiveMenu("nav-friends");
  closeMenu();

  await loadFriendships();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function socialMessage(text, isError = false) {
  const el = $("social-status-message");
  if (!el) return;

  el.textContent = text;
  el.style.color = isError ? "#ff8585" : "#b9a0d8";
}

function makeSocialElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

/* KULLANICI ARA */

async function searchFriends() {
  if (!currentUser) {
    openDialog("login");
    return;
  }

  const query = $("friend-search-input").value.trim();
  const results = $("friend-search-results");

  if (query.length < 3) {
    results.replaceChildren(
      makeSocialElement(
        "p",
        "social-empty",
        "En az 3 karakter gir."
      )
    );
    return;
  }

  results.textContent = "Aranıyor...";

  const { data, error } = await supabase.rpc(
    "search_profiles",
    { p_query: query }
  );

  if (error) {
    console.error(error);
    results.textContent = "Arama yapılamadı: " + error.message;
    return;
  }

  results.replaceChildren();

  if (!data || !data.length) {
    results.append(
      makeSocialElement(
        "p",
        "social-empty",
        "Kullanıcı bulunamadı."
      )
    );
    return;
  }

  data.forEach(profile => {
    const row = makeSocialElement("div", "social-user-row");

    const name = makeSocialElement(
      "strong",
      "social-username",
      "@" + profile.username
    );

    const button = makeSocialElement("button", "button button-primary", "Arkadaş Ekle");

    button.type = "button";

    button.addEventListener("click", async () => {
      button.disabled = true;

      const { error: requestError } = await supabase.rpc(
        "send_friend_request",
        { p_username: profile.username }
      );

      if (requestError) {
        socialMessage(requestError.message, true);
        button.disabled = false;
        return;
      }

      button.textContent = "İstek Gönderildi";
      socialMessage("Arkadaşlık isteği gönderildi!");
      await loadFriendships();
    });

    row.append(name, button);
    results.append(row);
  });
}

function showProfileSearchPage() {
  if (!currentUser) { openDialog("login"); return; }
  stopAim(); stopCPS();
  $("home-view").hidden = true;
  $("profile-page").hidden = true;
  $("social-page").hidden = true;
  $("admin-page").hidden = true;
  $("profile-search-page").hidden = false;
  $("chat-page").hidden = true;
  $("public-profile-card").hidden = true;
  closeMenu();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function searchPublicProfiles() {
  if (!currentUser) { openDialog("login"); return; }
  const query = $("profile-search-input").value.trim();
  const results = $("profile-search-results");
  if (query.length < 3) { results.textContent = "En az 3 karakter gir."; return; }
  results.textContent = "Profiller aranıyor...";
  const { data, error } = await supabase.rpc("search_profiles", { p_query: query });
  if (error) {
    console.error("Profil arama hatası:", error);
    results.textContent = "Arama yapılamadı: " + error.message;
    return;
  }
  results.replaceChildren();
  if (!data || !data.length) { results.textContent = "Kullanıcı bulunamadı."; return; }
  data.forEach(profile => {
    const row = makeSocialElement("div", "social-user-row");
    const name = makeSocialElement("strong", "social-username", "@" + profile.username);
    const button = makeSocialElement("button", "button button-outline", "Profili Gör");
    button.type = "button";
    button.addEventListener("click", () => viewPublicProfile(profile.username));
    row.append(name, button);
    results.append(row);
  });
}

const DEFAULT_ADMIN_PROFILE_STYLE = {
  name_color: "#ffd36b",
  card_color: "#1b142c",
  accent_color: "#d99a25",
  avatar_color: "#075c32"
};
let adminProfileStyle = { ...DEFAULT_ADMIN_PROFILE_STYLE };

function normalizeHexColor(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? value : fallback;
}

function applyAdminProfileStyle(container, style = adminProfileStyle) {
  if (!container) return;
  const name = container.querySelector("#profile-username, #public-profile-username");
  const avatar = container.querySelector(".profile-avatar, .public-profile-avatar");
  container.style.setProperty("--admin-card-color", normalizeHexColor(style.card_color, DEFAULT_ADMIN_PROFILE_STYLE.card_color));
  container.style.setProperty("--admin-accent-color", normalizeHexColor(style.accent_color, DEFAULT_ADMIN_PROFILE_STYLE.accent_color));
  if (name) {
    name.style.color = normalizeHexColor(style.name_color, DEFAULT_ADMIN_PROFILE_STYLE.name_color);
    name.style.background = "none";
    name.style.webkitTextFillColor = "currentColor";
    name.style.textShadow = "0 0 18px " + normalizeHexColor(style.name_color, DEFAULT_ADMIN_PROFILE_STYLE.name_color) + "55";
  }
  if (avatar) {
    avatar.style.background = normalizeHexColor(style.avatar_color, DEFAULT_ADMIN_PROFILE_STYLE.avatar_color);
    avatar.style.borderColor = normalizeHexColor(style.accent_color, DEFAULT_ADMIN_PROFILE_STYLE.accent_color);
  }
}

async function loadAdminProfileStyle() {
  if (!currentUser || !isAdminUser(currentUser)) return;
  const { data, error } = await supabase.from("admin_profile_styles")
    .select("name_color,card_color,accent_color,avatar_color")
    .eq("user_id", currentUser.id).maybeSingle();
  if (error) {
    console.warn("Admin profil tasarımı yüklenemedi:", error.message);
    return;
  }
  adminProfileStyle = { ...DEFAULT_ADMIN_PROFILE_STYLE, ...(data || {}) };
  applyAdminProfileStyle(document.querySelector(".profile-card"));
  syncAdminStyleControls();
}

function syncAdminStyleControls() {
  const map = {
    "admin-style-name": "name_color",
    "admin-style-card": "card_color",
    "admin-style-accent": "accent_color",
    "admin-style-avatar": "avatar_color"
  };
  Object.entries(map).forEach(([id, key]) => {
    const input = $(id);
    if (input) input.value = normalizeHexColor(adminProfileStyle[key], DEFAULT_ADMIN_PROFILE_STYLE[key]);
  });
  updateAdminStylePreview();
}

function updateAdminStylePreview() {
  const style = {
    name_color: $("admin-style-name")?.value || DEFAULT_ADMIN_PROFILE_STYLE.name_color,
    card_color: $("admin-style-card")?.value || DEFAULT_ADMIN_PROFILE_STYLE.card_color,
    accent_color: $("admin-style-accent")?.value || DEFAULT_ADMIN_PROFILE_STYLE.accent_color,
    avatar_color: $("admin-style-avatar")?.value || DEFAULT_ADMIN_PROFILE_STYLE.avatar_color
  };
  const preview = $("admin-style-preview");
  const previewName = $("admin-style-preview-name");
  const previewAvatar = $("admin-style-preview-avatar");
  if (preview) {
    preview.style.background = style.card_color;
    preview.style.borderColor = style.accent_color;
  }
  if (previewName) previewName.style.color = style.name_color;
  if (previewAvatar) {
    previewAvatar.style.background = style.avatar_color;
    previewAvatar.style.borderColor = style.accent_color;
  }
}

async function saveAdminProfileStyle(reset = false) {
  if (!currentUser || !isAdminUser(currentUser)) return;
  const style = reset ? { ...DEFAULT_ADMIN_PROFILE_STYLE } : {
    name_color: $("admin-style-name").value,
    card_color: $("admin-style-card").value,
    accent_color: $("admin-style-accent").value,
    avatar_color: $("admin-style-avatar").value
  };
  const button = $("admin-style-save-btn");
  if (button) button.disabled = true;
  setText("admin-style-message", "Kaydediliyor...");
  try {
    const { error } = await supabase.from("admin_profile_styles").upsert({
      user_id: currentUser.id,
      username: username || currentUser.user_metadata?.username || "admin",
      ...style,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id" });
    if (error) throw error;
    adminProfileStyle = style;
    applyAdminProfileStyle(document.querySelector(".profile-card"));
    setText("admin-style-message", "Profil renklerin kaydedildi ve herkese açıklandı.");
    syncAdminStyleControls();
  } catch (error) {
    console.error("Admin profil tasarımı kaydedilemedi:", error);
    setText("admin-style-message", "Kaydetme hatası: " + error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

async function viewPublicProfile(targetUsername) {
  const card = $("public-profile-card");
  const usernameElement = $("public-profile-username");
  const roleElement = $("public-profile-role");
  card.hidden = false;
  usernameElement.textContent = "@" + targetUsername;
  roleElement.hidden = true;
  roleElement.textContent = "";
  const { data, error } = await supabase.rpc("get_public_profile", { p_username: targetUsername });
  if (error) {
    console.error("Profil görüntüleme hatası:", error);
    usernameElement.textContent = "Profil yüklenemedi";
    return;
  }
  const profile = Array.isArray(data) ? data[0] : data;
  if (!profile) { usernameElement.textContent = "Kullanıcı bulunamadı"; return; }
  usernameElement.textContent = "@" + profile.username;
  const { data: publicStyle, error: publicStyleError } = await supabase
    .from("admin_profile_styles")
    .select("name_color,card_color,accent_color,avatar_color")
    .eq("username", profile.username)
    .maybeSingle();
  if (!publicStyleError && publicStyle) {
    applyAdminProfileStyle(card, { ...DEFAULT_ADMIN_PROFILE_STYLE, ...publicStyle });
  } else {
    applyAdminProfileStyle(card, DEFAULT_ADMIN_PROFILE_STYLE);
  }
  usernameElement.classList.toggle(
    "admin-gold-name",
    String(profile.username || "").trim().toLowerCase() === "admin"
  );
  const avatar = card.querySelector(".public-profile-avatar");
  if (avatar) avatar.textContent = (profile.username || "K").charAt(0).toUpperCase();
  if (profile.role_name) {
    roleElement.textContent = profile.role_name;
    roleElement.hidden = false;
  }
  const friendButton = $("public-profile-friend-btn");
  friendButton.hidden = profile.username === username;
  friendButton.disabled = true;
  friendButton.textContent = "Durum kontrol ediliyor...";
  $("public-profile-friend-status").textContent = "";
  await configurePublicProfileFriendButton(profile.username);
  card.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function configurePublicProfileFriendButton(targetUsername) {
  const button = $("public-profile-friend-btn");
  const status = $("public-profile-friend-status");
  if (!currentUser || !targetUsername || targetUsername === username) {
    button.hidden = true;
    return;
  }

  const { data, error } = await supabase.rpc("list_friendships");
  if (error) {
    console.warn("Arkadaşlık durumu alınamadı:", error.message);
    button.disabled = false;
    button.textContent = "Arkadaş Ekle";
    return;
  }

  const relation = (data || []).find(item =>
    String(item.username || "").toLowerCase() === targetUsername.toLowerCase()
  );

  button.disabled = false;
  button.onclick = null;

  if (relation?.friendship_status === "accepted") {
    button.textContent = "Arkadaşsınız";
    button.disabled = true;
    return;
  }

  if (relation?.friendship_status === "pending" && relation.direction === "outgoing") {
    button.textContent = "İstek Gönderildi";
    button.disabled = true;
    return;
  }

  if (relation?.friendship_status === "pending" && relation.direction === "incoming") {
    button.textContent = "İsteği Kabul Et";
    button.onclick = async () => {
      button.disabled = true;
      const { error: acceptError } = await supabase.rpc("respond_friend_request", {
        p_request_id: relation.request_id,
        p_accept: true
      });
      if (acceptError) {
        status.textContent = acceptError.message;
        button.disabled = false;
        return;
      }
      button.textContent = "Arkadaşsınız";
      status.textContent = "Arkadaşlık isteği kabul edildi!";
      await loadFriendships();
    };
    return;
  }

  button.textContent = "Arkadaş Ekle";
  button.onclick = async () => {
    button.disabled = true;
    const { error: requestError } = await supabase.rpc("send_friend_request", {
      p_username: targetUsername
    });
    if (requestError) {
      status.textContent = requestError.message;
      button.disabled = false;
      return;
    }
    button.textContent = "İstek Gönderildi";
    status.textContent = "Arkadaşlık isteği gönderildi!";
    await loadFriendships();
  };
}

$("close-public-profile-btn").addEventListener("click", () => {
  $("public-profile-card").hidden = true;
});

/* ARKADAŞLARI VE İSTEKLERİ YÜKLE */

async function loadFriendships() {
  if (!currentUser) return;

  const requestsBox = $("friend-requests");
  const friendsBox = $("friends-list");

  const { data, error } = await supabase.rpc(
    "list_friendships"
  );

  if (error) {
    console.error("Arkadaşlar yüklenemedi:", error);
    socialMessage(error.message, true);
    return;
  }

  requestsBox.replaceChildren();
  friendsBox.replaceChildren();

  const incoming = (data || []).filter(item =>
    item.friendship_status === "pending" &&
    item.direction === "incoming"
  );

  const outgoing = (data || []).filter(item =>
    item.friendship_status === "pending" &&
    item.direction === "outgoing"
  );

  const accepted = (data || []).filter(item =>
    item.friendship_status === "accepted"
  );

  if (!incoming.length && !outgoing.length) {
    requestsBox.append(
      makeSocialElement(
        "p",
        "social-empty",
        "Bekleyen arkadaşlık isteği yok."
      )
    );
  }

  incoming.forEach(item => {
    const row = makeSocialElement("div", "social-user-row");

    row.append(
      makeSocialElement(
        "strong",
        "",
        "@" + item.username
      )
    );

    const accept = makeSocialElement(
      "button",
      "button button-primary",
      "Kabul Et"
    );

    accept.type = "button";

    accept.addEventListener("click", async () => {
      accept.disabled = true;

      const { error } = await supabase.rpc(
        "respond_friend_request",
        {
          p_request_id: item.request_id,
          p_accept: true
        }
      );

      if (error) {
        socialMessage(error.message, true);
        accept.disabled = false;
        return;
      }

      socialMessage("Arkadaşlık isteği kabul edildi!");
      await loadFriendships();
    });

    row.append(accept);
    requestsBox.append(row);
  });

  outgoing.forEach(item => {
    requestsBox.append(
      makeSocialElement(
        "p",
        "social-empty",
        "@" + item.username + " — İstek gönderildi"
      )
    );
  });

  if (!accepted.length) {
    friendsBox.append(
      makeSocialElement(
        "p",
        "social-empty",
        "Henüz arkadaşın yok."
      )
    );
  }

  accepted.forEach(item => {
    friendsBox.append(
      makeSocialElement(
        "div",
        "social-user-row",
        "@" + item.username
      )
    );
  });
}


/* =========================================
   KAUREFLEX CHAT — GENEL + ÖZEL MESAJLAR
========================================= */

function chatStatus(text, isError = false) {
  const el = $("chat-status-message");
  if (!el) return;
  el.textContent = text || "";
  el.style.color = isError ? "#ff8585" : "#b9a0d8";
}

function closeChatRealtime() {
  if (chatRealtimeChannel) {
    supabase.removeChannel(chatRealtimeChannel);
    chatRealtimeChannel = null;
  }
}

function chatRoomFilter() {
  return chatActiveType === "global"
    ? { event: "*", schema: "public", table: "chat_messages", filter: "room_type=eq.global" }
    : { event: "*", schema: "public", table: "chat_messages", filter: "conversation_id=eq." + chatActiveConversationId };
}

function subscribeChatRealtime() {
  closeChatRealtime();
  const filter = chatRoomFilter();
  chatRealtimeChannel = supabase
    .channel("kaureflex-chat-" + chatActiveType + "-" + (chatActiveConversationId || "global"))
    .on("postgres_changes", filter, payload => {
      if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
        loadChatMessages();
      }
    })
    .subscribe(status => {
      const label = $("chat-connection-status");
      if (!label) return;
      label.textContent = status === "SUBSCRIBED" ? "● Canlı bağlantı" :
        status === "CHANNEL_ERROR" ? "Bağlantı hatası" :
        status === "TIMED_OUT" ? "Bağlantı zaman aşımı" : "Bağlanıyor...";
      label.classList.toggle("connected", status === "SUBSCRIBED");
      label.classList.toggle("disconnected", status === "CHANNEL_ERROR" || status === "TIMED_OUT");
    });
}

async function loadChatMessages() {
  if (!currentUser || chatLoading) return;
  chatLoading = true;
  const box = $("chat-messages");
  try {
    let query = supabase
      .from("chat_messages")
      .select("id, conversation_id, room_type, sender_id, body, created_at")
      .order("created_at", { ascending: true })
      .limit(100);

    if (chatActiveType === "global") {
      query = query.eq("room_type", "global");
    } else {
      query = query.eq("room_type", "private").eq("conversation_id", chatActiveConversationId);
    }

    const { data, error } = await query;
    if (error) throw error;
    box.replaceChildren();

    if (!data || !data.length) {
      box.append(makeSocialElement("p", "chat-empty", "Henüz mesaj yok. İlk mesajı sen gönder!"));
      return;
    }

    const senderIds = [...new Set(data.map(item => item.sender_id))];
    const { data: profiles, error: profilesError } = await supabase.rpc(
      "chat_get_usernames",
      { p_user_ids: senderIds }
    );
    if (profilesError) console.warn("Sohbet kullanıcı adları alınamadı:", profilesError.message);
    const names = new Map((profiles || []).map(item => [item.id, item.username]));

    data.forEach(item => {
      const own = item.sender_id === currentUser.id;
      const row = makeSocialElement("article", "chat-message" + (own ? " own" : ""));
      const meta = makeSocialElement("div", "chat-message-meta");
      meta.append(
        makeSocialElement("strong", "", own ? "Sen" : "@" + (names.get(item.sender_id) || "Üye")),
        makeSocialElement("time", "", new Date(item.created_at).toLocaleString("tr-TR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" }))
      );
      const body = makeSocialElement("p", "chat-message-body", item.body);
      row.append(meta, body);
      box.append(row);
    });

    box.scrollTop = box.scrollHeight;
  } catch (error) {
    console.error("Sohbet mesajları yüklenemedi:", error);
    box.replaceChildren(makeSocialElement("p", "chat-empty", "Mesajlar yüklenemedi: " + error.message));
    chatStatus("Sohbet tablosu hazır değil veya erişim izni yok. SQL kurulumunu tamamla.", true);
  } finally {
    chatLoading = false;
  }
}

async function loadChatConversations() {
  if (!currentUser) return;
  const box = $("chat-conversation-list");
  const { data, error } = await supabase.rpc("chat_list_conversations");
  if (error) {
    console.error("Özel sohbetler yüklenemedi:", error);
    box.replaceChildren(makeSocialElement("p", "social-empty", "Özel sohbet listesi yüklenemedi."));
    return;
  }
  box.replaceChildren();
  if (!data || !data.length) {
    box.append(makeSocialElement("p", "social-empty", "Henüz özel sohbetin yok."));
    return;
  }
  data.forEach(item => {
    const button = makeSocialElement("button", "chat-conversation-button" +
      (chatActiveType === "private" && chatActiveConversationId === item.conversation_id ? " active" : ""));
    button.type = "button";
    button.append(
      makeSocialElement("strong", "", "@" + item.other_username),
      makeSocialElement("small", "", item.last_message || "Sohbete başla")
    );
    button.addEventListener("click", () => openPrivateChat(item.conversation_id, item.other_username));
    box.append(button);
  });
}

async function selectChatRoom(type, conversationId = null, otherUsername = "") {
  chatActiveType = type;
  chatActiveConversationId = conversationId;
  chatActiveUsername = otherUsername;
  $("chat-global-btn").classList.toggle("active", type === "global");
  $("chat-room-title").textContent = type === "global" ? "🌐 Genel Sohbet" : "@" + otherUsername;
  $("chat-room-subtitle").textContent = type === "global" ? "KauReflex üyeleriyle konuş" : "Özel mesajlaşma";
  $("chat-message-input").placeholder = type === "global" ? "Herkese mesaj yaz..." : "@" + otherUsername + " kullanıcısına mesaj yaz...";
  await loadChatMessages();
  subscribeChatRealtime();
  await loadChatConversations();
}

async function openPrivateChat(conversationId, otherUsername) {
  await selectChatRoom("private", conversationId, otherUsername);
}

async function startPrivateChat() {
  if (!currentUser) { openDialog("login"); return; }
  const target = $("chat-username-input").value.trim();
  if (target.length < 3) {
    chatStatus("En az 3 karakterlik bir kullanıcı adı gir.", true);
    return;
  }
  const button = $("chat-open-dm-btn");
  button.disabled = true;
  const { data, error } = await supabase.rpc("chat_get_or_create_dm", { p_username: target });
  button.disabled = false;
  if (error) {
    console.error("Özel sohbet açılamadı:", error);
    chatStatus(error.message || "Özel sohbet açılamadı.", true);
    return;
  }
  const result = Array.isArray(data) ? data[0] : data;
  if (!result || !result.conversation_id) {
    chatStatus("Kullanıcı bulunamadı.", true);
    return;
  }
  $("chat-username-input").value = "";
  chatStatus("Özel sohbet hazır.");
  await openPrivateChat(result.conversation_id, result.other_username || target);
}

async function sendChatMessage(event) {
  event.preventDefault();
  if (!currentUser) { openDialog("login"); return; }
  const input = $("chat-message-input");
  const body = input.value.trim();
  if (!body) return;
  const payload = {
    room_type: chatActiveType,
    conversation_id: chatActiveType === "private" ? chatActiveConversationId : null,
    sender_id: currentUser.id,
    body
  };
  const button = $("chat-send-btn");
  button.disabled = true;
  const { error } = await supabase.from("chat_messages").insert(payload);
  button.disabled = false;
  if (error) {
    console.error("Mesaj gönderilemedi:", error);
    chatStatus("Mesaj gönderilemedi: " + error.message, true);
    return;
  }
  input.value = "";
  chatStatus("Mesaj gönderildi.");
  await loadChatMessages();
  if (chatActiveType === "private") await loadChatConversations();
}

async function showChatPage() {
  if (!currentUser) { openDialog("login"); return; }
  stopAim();
  stopCPS();
  $("home-view").hidden = true;
  $("profile-page").hidden = true;
  $("social-page").hidden = true;
  $("profile-search-page").hidden = true;
  $("admin-page").hidden = true;
  $("chat-page").hidden = false;
  setActiveMenu("nav-chat");
  closeMenu();
  chatStatus("");
  await selectChatRoom("global");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* V5 BUTONLARI */

$("nav-friends").addEventListener(
  "click",
  showFriends
);

$("nav-chat").addEventListener("click", showChatPage);
$("chat-btn").addEventListener("click", showChatPage);
$("mobile-nav-home").addEventListener("click", showHome);
$("mobile-nav-friends").addEventListener("click", showFriends);
$("mobile-nav-chat").addEventListener("click", showChatPage);
$("mobile-nav-profile").addEventListener("click", openProfile);
$("chat-back-btn").addEventListener("click", showHome);
$("chat-global-btn").addEventListener("click", () => selectChatRoom("global"));
$("chat-open-dm-btn").addEventListener("click", startPrivateChat);
$("chat-username-input").addEventListener("keydown", event => {
  if (event.key === "Enter") startPrivateChat();
});
$("chat-send-form").addEventListener("submit", sendChatMessage);

$("nav-admin").addEventListener("click", showAdminPage);
$("admin-back-btn").addEventListener("click", showHome);

$("friends-btn").addEventListener(
  "click",
  showFriends
);

$("profile-search-nav-btn").addEventListener("click", showProfileSearchPage);
$("profile-search-back-btn").addEventListener("click", showHome);
$("profile-search-btn").addEventListener("click", searchPublicProfiles);
$("profile-search-input").addEventListener("keydown", event => {
  if (event.key === "Enter") searchPublicProfiles();
});


$("social-back-btn").addEventListener(
  "click",
  showHome
);

$("friend-search-btn").addEventListener(
  "click",
  searchFriends
);

$("friend-search-input").addEventListener(
  "keydown",
  event => {
    if (event.key === "Enter") {
      searchFriends();
    }
  }
);

["admin-style-name","admin-style-card","admin-style-accent","admin-style-avatar"].forEach(id => {
  $(id)?.addEventListener("input", updateAdminStylePreview);
});
$("admin-style-save-btn")?.addEventListener("click", () => saveAdminProfileStyle(false));
$("admin-style-reset-btn")?.addEventListener("click", () => saveAdminProfileStyle(true));

initialize();

})();
