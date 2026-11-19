(() => {
"use strict";
const CFG = window.LEARNHUB_CONFIG;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const day = 864e5;
const fmtDate = d => new Date(d).toLocaleDateString(undefined, {weekday:"short", day:"numeric", month:"short", year:"numeric"});
const iso = d => new Date(d).toISOString().slice(0, 10);

/* ---------- Storage (demo mode: this browser only) ---------- */
const KEY = "learnhub_db_v1";
let db = {users: [], session: null, progress: {}, slots: [], bookings: [], overrides: {}, maOverrides: {}};
try { db = {...db, ...JSON.parse(localStorage.getItem(KEY) || "{}")}; } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} };
const me = () => db.users.find(u => u.id === db.session) || null;
const prog = u => (db.progress[u.id] ||= {lessons: {}, assignments: {}, start: null, cefr: []});
if (!db.slots.length) { // default availability: next 14 days, Mon–Sat
  for (let i = 1; i <= 14; i++) { const d = new Date(Date.now() + i * day); if (d.getDay() === 0) continue;
    ["10:00", "11:00", "15:00"].forEach(t => db.slots.push({id: uid(), date: iso(d), time: t})); }
  save();
}

/* ---------- Auth ---------- */
async function hash(pw, salt) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({name: "PBKDF2", salt: new TextEncoder().encode(salt), iterations: 150000, hash: "SHA-256"}, k, 256);
  return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, "0")).join("");
}
async function register(name, email, pw) {
  email = email.trim().toLowerCase();
  if (db.users.some(u => u.email === email)) throw new Error("An account with this email already exists.");
  const salt = uid() + uid();
  const u = {id: uid(), name: name.trim(), email, salt, hash: await hash(pw, salt), role: db.users.length ? "student" : "admin", created: Date.now()};
  db.users.push(u); db.session = u.id; save(); return u;
}
async function login(email, pw) {
  const u = db.users.find(x => x.email === email.trim().toLowerCase());
  if (!u || u.hash !== await hash(pw, u.salt)) throw new Error("Incorrect email or password.");
  db.session = u.id; save();
}
const logout = () => { db.session = null; save(); go("/"); };

/* ---------- Curriculum helpers ---------- */
const ALL_IELTS = IELTS_MODULES.flatMap(m => m.topics);
const ALL_MA = MA_AREAS.flatMap(a => a.topics);
const withOv = t => ({...t, ...(db.overrides[t.id] || {})});
const findTopic = id => [...GRAMMAR_TOPICS, ...ALL_IELTS, ...ALL_MA].find(t => t.id === id);
function percent(u) {
  const p = prog(u).lessons, c = ids => ids.filter(i => p[i]).length;
  const g = c(GRAMMAR_TOPICS.map(t => t.id)), i = c(ALL_IELTS.map(t => t.id)), m = c(ALL_MA.map(t => t.id));
  const gp = Math.round(100 * g / GRAMMAR_TOPICS.length), ip = Math.round(100 * i / ALL_IELTS.length), mp = Math.round(100 * m / ALL_MA.length);
  const cp = prog(u).cefr.length ? 100 : 0;
  return {g, i, m, gp, ip, mp, cp, overall: Math.round((gp + ip + mp + cp) / 4)};
}
function lessonDate(u, t) {
  const s = prog(u).start; if (!s) return null;
  const idxInWeek = (t.day - 1) % 6;
  return new Date(new Date(s).getTime() + ((t.week - 1) * 7 + idxInWeek) * day);
}
function status(u, t) {
  if (prog(u).lessons[t.id]) return "done";
  const d = lessonDate(u, t); if (!d) return "upcoming";
  const today = iso(Date.now()), ld = iso(d);
  return ld < today ? "overdue" : ld === today ? "today" : "upcoming";
}
const tagFor = s => ({done: '<span class="tag ok">Completed</span>', today: '<span class="tag now">Today</span>', overdue: '<span class="tag warn">Overdue</span>', upcoming: '<span class="tag">Upcoming</span>'}[s]);
const bar = p => `<div class="bar-p" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100"><i style="width:${p}%"></i></div>`;

/* ---------- Router ---------- */
const go = p => { location.hash = "#" + p; };
let timerId = null;
function route() {
  clearInterval(timerId); window.speechSynthesis && speechSynthesis.cancel();
  const parts = (location.hash.slice(1) || "/").split("/").filter(Boolean).map(decodeURIComponent);
  const [a, b, c] = parts, u = me();
  const guard = fn => u ? fn() : (go("/login"), "");
  let html;
  try {
    if (!a) html = home();
    else if (a === "grammar") html = b ? topicPage(b) : grammarIndex();
    else if (a === "ielts") html = b === "topic" ? topicPage(c) : b ? ieltsModule(b) : ieltsIndex();
    else if (a === "ma") html = b === "topic" ? topicPage(c) : maIndex();
    else if (a === "cefr") html = b === "test" ? guard(cefrTest) : b === "result" ? guard(cefrResult) : cefrIntro();
    else if (a === "speaking") html = guard(speaking);
    else if (a === "dashboard") html = guard(dashboard);
    else if (a === "admin") html = guard(admin);
    else if (a === "login") html = authPage("login");
    else if (a === "register") html = authPage("register");
    else if (a === "contact") html = contact();
    else if (a === "privacy") html = privacy();
    else html = `<h1>Page not found</h1><p><a href="#/">Back to home</a></p>`;
  } catch (e) { console.error(e); html = `<div class="notice bad"><b>Something went wrong.</b> ${esc(e.message)}</div>`; }
  $("#main").innerHTML = html || "";
  renderNav(a); bind(); window.scrollTo(0, 0); $("#main").focus({preventScroll: true});
}
function renderNav(active) {
  const u = me(), l = (h, t, k) => `<a href="#/${h}" class="${active === (k || h) ? "on" : ""}">${t}</a>`;
  $("#nav").innerHTML = l("grammar", "Grammar") + l("ielts", "IELTS") + l("ma", "MA English") + l("cefr", "CEFR Test") + l("contact", "Contact") +
    (u ? l("dashboard", "Dashboard") + (u.role === "admin" ? l("admin", "Admin") : "") + `<a href="#" id="logoutLink">Log out</a>` : l("login", "Log in") + `<a class="btn sm" href="#/register">Sign up</a>`);
  $("#banner").innerHTML = `<div class="notice info"><b>Demo mode:</b> accounts and progress are stored only in this browser. Connect Supabase (see README) for real, secure, multi-device accounts.</div>`;
  const out = $("#logoutLink"); if (out) out.onclick = e => { e.preventDefault(); logout(); };
}
$("#menuBtn").onclick = () => { const n = $("#nav"); const o = n.classList.toggle("open"); $("#menuBtn").setAttribute("aria-expanded", o); };
$("#nav").addEventListener("click", e => { if (e.target.closest("a")) $("#nav").classList.remove("open"); });

/* ---------- Pages ---------- */
function home() {
  const u = me();
  return `<section class="hero"><h1>Learn English with structure, practice and real feedback</h1>
  <p>A 3-month Grammar programme, four IELTS modules, MA in English study and a CEFR placement test — with progress tracking and human speaking assessment.</p>
  ${u ? '<a class="btn" href="#/dashboard">Go to dashboard</a>' : '<a class="btn" href="#/register">Create free account</a><a class="btn alt" href="#/cefr">Check my level</a>'}</section>
  <div class="grid">
   <a class="card" href="#/grammar"><h3>📘 Grammar</h3><p class="muted">${GRAMMAR_TOPICS.length} daily 40-minute lessons over 12 weeks, each with video + reference.</p></a>
   <a class="card" href="#/ielts"><h3>🎓 IELTS</h3><p class="muted">Listening, Reading, Writing and Speaking — ${ALL_IELTS.length} topic pages.</p></a>
   <a class="card" href="#/ma"><h3>🏛️ MA in English</h3><p class="muted">Study framework for the National University of Bangladesh MA. Syllabus verification pending.</p></a>
   <a class="card" href="#/cefr"><h3>🧭 CEFR placement</h3><p class="muted">Take the test first; your level is estimated from your results. Then book a human speaking assessment.</p></a>
  </div>
  <h2>How a Grammar lesson works (40 minutes)</h2>${lessonPlan()}`;
}
const lessonPlan = () => `<div class="card plan"><b>10 min</b><span>Explanation of the topic (video lecture)</span><b>10 min</b><span>Examples and practical usage (reference book)</span><b>10 min</b><span>Interactive exercises</span><b>10 min</b><span>Speaking or writing practice</span></div>`;

function grammarIndex() {
  const u = me(); let out = `<h1>Grammar — 3-month programme</h1><p class="muted">One topic a day, Monday–Saturday, about 40 minutes each. ${u ? "" : "<a href='#/login'>Log in</a> to track your progress and see your lesson calendar."}</p>`;
  if (u && !prog(u).start) out += `<div class="card"><b>Start the programme</b><p class="small muted">Choose the date of Day 1 to generate your lesson calendar.</p><form id="startForm"><input type="date" id="startDate" value="${iso(Date.now())}" aria-label="Start date"> <button class="btn">Start</button></form></div>`;
  if (u) out += `<p>Progress: ${percent(u).g}/${GRAMMAR_TOPICS.length} lessons ${bar(percent(u).gp)}</p>`;
  for (let w = 1; w <= 12; w++) {
    out += `<h2>Week ${w}</h2><ul class="list">` + GRAMMAR_TOPICS.filter(t => t.week === w).map(t => {
      const d = u && lessonDate(u, t);
      return `<li><span><a href="#/grammar/${t.id}">Day ${t.day}: ${esc(t.title)}</a>${d ? `<br><span class="small muted">${fmtDate(d)}</span>` : ""}</span>${u ? tagFor(status(u, t)) : ""}</li>`;
    }).join("") + `</ul>`;
    const a = GRAMMAR_ASSIGNMENTS[w - 1];
    if (u) out += `<p class="small">📝 <a href="#/grammar/${a.id}">${a.title}</a> ${prog(u).assignments[a.id] ? '<span class="tag ok">Submitted</span>' : '<span class="tag warn">Pending</span>'}</p>`;
  }
  return out;
}

function resourceBlock(t) {
  t = withOv(t);
  const ver = t.verified ? '<span class="tag ok">Verified by admin</span>' : '<span class="tag warn">Link not yet verified — search link</span>';
  if (t.id.startsWith("g")) return `<div class="grid"><div class="card"><h3>🎥 Video lecture</h3><p><a href="${esc(t.video)}" target="_blank" rel="noopener">${esc(t.verified ? "Watch the lecture" : t.videoLabel)}</a></p>${ver}</div>
   <div class="card"><h3>📄 Reference</h3><p class="small">${esc(t.ref)}</p><p><a href="${esc(t.refUrl)}" target="_blank" rel="noopener">${esc(t.refLabel)}</a></p><p class="small muted">Buy or borrow the books legitimately; LearnHub does not host copies.</p></div></div>`;
  if (t.id.startsWith("i-")) return `<div class="grid"><div class="card"><h3>🎥 Video lecture</h3><p><a href="${esc(t.video)}" target="_blank" rel="noopener">${esc(t.verified ? "Watch the lecture" : t.videoLabel)}</a></p>${ver}</div>
   <div class="card"><h3>📄 Reading resource</h3><p><a href="${esc(t.reading)}" target="_blank" rel="noopener">${esc(t.readingLabel)}</a></p><p><a href="${esc(t.alt)}" target="_blank" rel="noopener">${esc(t.altLabel)}</a></p></div></div>`;
  return "";
}
function topicPage(id) {
  const u = me();
  const ga = GRAMMAR_ASSIGNMENTS.find(a => a.id === id);
  if (ga) return assignmentPage(ga);
  const t = findTopic(id); if (!t) return `<h1>Topic not found</h1>`;
  const back = id.startsWith("g") ? "#/grammar" : id.startsWith("i-") ? "#/ielts/" + t.module : "#/ma";
  const done = u && prog(u).lessons[id];
  let body;
  if (id.startsWith("g")) {
    body = `<p class="small">Day ${t.day} · Week ${t.week}</p>${resourceBlock(t)}<h2>Lesson plan</h2>${lessonPlan()}
    <h2>Practice</h2><div class="card"><b>Writing / speaking task</b><p>Write or say five original sentences using “${esc(t.title)}”. Then explain to a partner (or record yourself) when this form is used and one common mistake to avoid.</p></div>`;
  } else if (id.startsWith("i-")) {
    body = `${resourceBlock(t)}<h2>How to study this topic</h2><ol><li>Watch the lecture and note the strategy steps.</li><li>Read the official guidance.</li><li>Do one timed practice task and check it against the official sample answers.</li><li>Record your mistakes in a notebook.</li></ol>`;
  } else {
    body = `<div class="notice">Draft study area — not yet matched to the official National University syllabus. Admin: update after verifying the syllabus.</div>
    <h2>Study guide</h2><ol><li>Identify the prescribed text/author for this unit in your NU syllabus.</li><li>Write a short summary of context and themes.</li><li>Prepare two important questions and model answers.</li><li>Revise using past papers from your institution.</li></ol>`;
  }
  return `<p class="crumbs"><a href="${back}">← Back</a></p><h1>${esc(t.title)}</h1>${body}
  <p style="margin-top:20px">${u ? `<button class="btn" data-complete="${id}">${done ? "✓ Completed — click to undo" : "Mark lesson complete"}</button>` : `<a class="btn" href="#/login">Log in to track progress</a>`}</p>`;
}
function assignmentPage(a) {
  const u = me(), s = u && prog(u).assignments[a.id];
  return `<p class="crumbs"><a href="#/grammar">← Back</a></p><h1>${a.title}</h1><p>${esc(a.prompt)}</p>
  ${u ? `<form id="assignForm" data-id="${a.id}"><label for="at">Your answer</label><textarea id="at">${esc(s ? s.text : "")}</textarea><p><button class="btn">${s ? "Update submission" : "Submit"}</button></p></form>${s ? `<p class="small muted">Submitted ${fmtDate(s.ts)}. Feedback is given by a teacher.${s.feedback ? `</p><div class="card"><b>Teacher feedback</b><p>${esc(s.feedback)}</p></div>` : "</p>"}` : ""}` : `<a class="btn" href="#/login">Log in to submit</a>`}`;
}

function ieltsIndex() {
  return `<h1>IELTS preparation</h1><p class="muted">Four modules. Each topic page pairs a video lecture with an official reading resource.</p>
  <div class="grid">${IELTS_MODULES.map(m => `<a class="card" href="#/ielts/${m.id}"><h3>${m.icon} ${m.name}</h3><p class="muted">${m.topics.length} topics · preferred video source: ${esc(m.source)}</p></a>`).join("")}</div>
  <div class="notice">Video links are search links until an administrator inspects a specific video and saves it as verified. Official reading sources: British Council, Cambridge English, IDP IELTS.</div>`;
}
function ieltsModule(id) {
  const m = IELTS_MODULES.find(x => x.id === id); if (!m) return "<h1>Not found</h1>"; const u = me();
  return `<p class="crumbs"><a href="#/ielts">← IELTS</a></p><h1>${m.icon} ${m.name}</h1><ul class="list">${m.topics.map(t => `<li><a href="#/ielts/topic/${t.id}">${esc(t.title)}</a>${u ? tagFor(prog(u).lessons[t.id] ? "done" : "upcoming") : ""}</li>`).join("")}</ul>`;
}
function maIndex() {
  return `<h1>MA in English — National University, Bangladesh</h1>
  <div class="notice"><b>Syllabus verification pending.</b> The official NU programme structure, syllabus version and applicable session have not yet been confirmed in this build, so the units below are a <em>draft study framework</em>, not the NU papers. Please share the official NU syllabus PDF (or confirm your session) and the content will be reorganised paper-by-paper with source links. Check <a href="https://www.nu.ac.bd" target="_blank" rel="noopener">nu.ac.bd</a> for official notices.</div>
  ${MA_AREAS.map(a => `<h2>${esc(a.name)}</h2><ul class="list">${a.topics.map(t => `<li><a href="#/ma/topic/${t.id}">${esc(t.title)}</a><span class="tag">Draft</span></li>`).join("")}</ul>`).join("")}`;
}

/* ---------- CEFR ---------- */
function cefrIntro() {
  const u = me(), last = u && prog(u).cefr.slice(-1)[0];
  return `<h1>CEFR placement assessment</h1><p>You don’t choose a level — you take the test and we estimate it.</p>
  <div class="grid"><div class="card"><h3>Part A — written & comprehension (40 min)</h3><p class="small muted">Grammar, Listening, Reading (multiple choice, auto-marked) and a short written response.</p>
   ${u ? `<a class="btn" href="#/cefr/test">Start Part A</a>` : `<a class="btn" href="#/login">Log in to start</a>`} ${last ? `<a class="btn alt" href="#/cefr/result">View last result</a>` : ""}</div>
   <div class="card"><h3>Part B — human speaking (20 min)</h3><p class="small muted">Request a slot. A real examiner will confirm by email. Not confirmed until you receive that email.</p><a class="btn alt" href="#/speaking">Request a speaking slot</a></div></div>
  <div class="notice info">Results are an independent, CEFR-aligned placement <b>estimate</b>, not an official Cambridge or other examination result or certificate.</div>`;
}
let cefrState = null;
function cefrTest() {
  const secs = ["Grammar", "Listening", "Reading"];
  cefrState = {end: Date.now() + 40 * 60 * 1000};
  timerId = setInterval(() => {
    const left = Math.max(0, cefrState.end - Date.now()), t = $("#timer");
    if (t) t.textContent = "⏱ " + Math.floor(left / 60000) + ":" + String(Math.floor(left % 60000 / 1000)).padStart(2, "0");
    if (!left) { clearInterval(timerId); finishCefr(true); }
  }, 1000);
  let html = `<h1>CEFR placement — Part A</h1><div class="timer" id="timer">⏱ 40:00</div><form id="cefrForm" novalidate>`;
  let lastPassage = "";
  secs.forEach(s => {
    html += `<h2>${s}</h2>` + (s === "Listening" ? `<p class="small muted">Press play to hear each recording (uses your browser’s speech voice; you may replay). If audio doesn’t work, use “Show transcript”.</p>` : "");
    CEFR_QUESTIONS.filter(q => q.sec === s).forEach((q, i) => {
      let pre = "";
      if (q.passage && q.passage !== lastPassage) { pre = `<p class="passage">${esc(q.passage)}</p>`; lastPassage = q.passage; } else if (q.passage) pre = `<p class="small muted">(Refer to the passage above.)</p>`;
      if (q.audio) pre = `<p><button type="button" class="btn sm" data-play="${q.id}">▶ Play</button> <button type="button" class="btn sm alt" data-trans="${q.id}">Show transcript</button></p><p class="passage" id="tr-${q.id}" hidden>${esc(q.audio)}</p>`;
      html += `<fieldset class="q" style="border:1px solid var(--line)"><legend><b>${esc(q.q)}</b></legend>${pre}` + q.o.map((o, k) => `<label><input type="radio" name="${q.id}" value="${k}"> ${esc(o)}</label>`).join("") + `</fieldset>`;
    });
  });
  html += `<h2>Writing</h2><div class="q"><p>${esc(CEFR_WRITING.prompt)}</p><textarea id="cw" aria-label="Written response"></textarea><p class="small muted" id="wc">0 words</p></div>
  <p class="err" id="cerr"></p><button class="btn">Submit Part A</button></form>`;
  return html;
}
function finishCefr(auto) {
  const u = me(), f = $("#cefrForm"); if (!u || !f) return;
  const ans = {}; CEFR_QUESTIONS.forEach(q => { const c = f.querySelector(`input[name="${q.id}"]:checked`); ans[q.id] = c ? +c.value : null; });
  const unanswered = Object.values(ans).filter(v => v === null).length;
  if (!auto && unanswered && !confirm(unanswered + " question(s) unanswered. Submit anyway?")) return;
  const text = $("#cw").value.trim();
  if (!auto && !text && !confirm("You haven’t written the writing response. Submit anyway?")) return;
  clearInterval(timerId);
  const res = scoreCefr(ans, text); res.ts = Date.now(); res.id = uid(); res.name = u.name;
  prog(u).cefr.push(res); save(); go("/cefr/result");
}
function scoreCefr(ans, text) {
  const secs = {}; let earned = 0, total = 0;
  CEFR_QUESTIONS.forEach(q => { const s = secs[q.sec] ||= {earned: 0, total: 0, right: 0, n: 0};
    s.total += q.lv; s.n++; total += q.lv; if (ans[q.id] === q.a) { s.earned += q.lv; s.right++; earned += q.lv; } });
  const objPct = Math.round(100 * earned / total);
  const w = text ? text.split(/\s+/).filter(Boolean) : [], sents = (text.match(/[.!?]+/g) || []).length || (w.length ? 1 : 0);
  const uniq = new Set(w.map(x => x.toLowerCase().replace(/\W/g, ""))).size;
  const links = (text.match(/\b(because|however|although|therefore|moreover|while|which|who|since|but|so|also|firstly|finally|for example)\b/gi) || []).length;
  const wr = {
    task: Math.min(4, Math.round(4 * Math.min(1, w.length / CEFR_WRITING.minWords))),
    range: Math.min(4, Math.round(4 * Math.min(1, (w.length ? uniq / w.length : 0) / 0.6))),
    cohesion: Math.min(4, links),
    control: sents ? Math.min(4, Math.round(Math.min(4, (w.length / sents) / 5))) : 0
  };
  const wPct = Math.round(100 * (wr.task + wr.range + wr.cohesion + wr.control) / 16);
  const combined = Math.round(0.8 * objPct + 0.2 * wPct);
  const level = combined < 20 ? "A1" : combined < 38 ? "A2" : combined < 58 ? "B1" : combined < 78 ? "B2" : "C1";
  return {secs, objPct, wPct, wr, words: w.length, text, combined, level, humanLevel: null, writingFeedback: ""};
}
const LEVEL_DESC = {A1: "Can use very basic everyday expressions and simple phrases.", A2: "Can communicate in simple, routine tasks and describe immediate matters.", B1: "Can handle most travel situations and produce simple connected text on familiar topics.", B2: "Can interact with fluency and spontaneity and produce clear, detailed text on many subjects.", C1: "Can use language flexibly and effectively for social, academic and professional purposes."};
function cefrResult() {
  const u = me(), r = prog(u).cefr.slice(-1)[0]; if (!r) return `<h1>No result yet</h1><a class="btn" href="#/cefr">Take the test</a>`;
  return `<h1>Your CEFR placement estimate: ${r.humanLevel || r.level}</h1><p>${LEVEL_DESC[r.humanLevel || r.level]}</p>
  <div class="notice info">This is an independent, CEFR-aligned <b>estimate</b>, not an official exam result. ${r.humanLevel ? "Level adjusted after human review." : "Your writing is scored automatically as a rough indicator only; a teacher can review it. Book Part B (human speaking) for a fuller picture."}</div>
  <div class="stats">${Object.entries(r.secs).map(([k, s]) => `<div class="card stat"><b>${s.right}/${s.n}</b>${k}</div>`).join("")}<div class="card stat"><b>${r.wPct}%</b>Writing (auto indicator)</div></div>
  <h2>How this was calculated</h2><p class="small">Each objective question is weighted by difficulty (A1=1 … C1=5 points). Objective score: <b>${r.objPct}%</b>. Writing indicator (task length, vocabulary range, linking words, sentence control; ${r.words} words): <b>${r.wPct}%</b>. Combined = 80% objective + 20% writing = <b>${r.combined}%</b>. Bands: &lt;20 A1 · &lt;38 A2 · &lt;58 B1 · &lt;78 B2 · 78+ C1. C2 cannot be estimated reliably by this short test.</p>
  ${r.writingFeedback ? `<div class="card"><b>Teacher feedback on writing</b><p>${esc(r.writingFeedback)}</p></div>` : ""}
  <p><a class="btn" href="#/speaking">Request speaking assessment</a> <a class="btn alt" href="#/dashboard">Dashboard</a></p>`;
}

/* ---------- Speaking ---------- */
function mailtoFor(b) {
  if (!CFG.CONTACT_EMAIL) return null;
  const body = `Speaking assessment request\nName: ${b.name}\nStudent email: ${b.email}\nRequested: ${b.date} ${b.time}\nNote: ${b.note || "-"}`;
  return `mailto:${CFG.CONTACT_EMAIL}?subject=${encodeURIComponent("LearnHub speaking request")}&body=${encodeURIComponent(body)}`;
}
function speaking() {
  const u = me(), taken = new Set(db.bookings.filter(b => b.status !== "declined").map(b => b.slotId));
  const free = db.slots.filter(s => !taken.has(s.id) && s.date >= iso(Date.now())).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const mine = db.bookings.filter(b => b.userId === u.id);
  return `<h1>Speaking assessment (20 minutes)</h1><p>A human examiner conducts the assessment. Submitting a request does <b>not</b> confirm an appointment — you’re confirmed only when a person replies.</p>
  ${CFG.CONTACT_EMAIL ? "" : `<div class="notice">The administrator has not yet configured a contact email, so requests are saved in the system for the admin but no email is sent.</div>`}
  <form id="bookForm"><label for="slot">Available slots</label><select id="slot" required><option value="">Choose a slot…</option>${free.map(s => `<option value="${s.id}">${fmtDate(s.date)} at ${s.time}</option>`).join("")}</select>
  <label for="bnote">Note (optional)</label><input id="bnote" maxlength="200"><p class="err" id="berr"></p><button class="btn">Submit request</button></form>
  <h2>Your requests</h2>${mine.length ? `<ul class="list">${mine.map(b => `<li><span>${fmtDate(b.date)} ${b.time}</span><span><span class="tag ${b.status === "confirmed" ? "ok" : b.status === "declined" ? "warn" : ""}">${b.status}</span> ${b.adminNote ? `<span class="small muted"> ${esc(b.adminNote)}</span>` : ""}</span></li>`).join("")}</ul>` : "<p class='muted'>No requests yet.</p>"}`;
}

/* ---------- Dashboard ---------- */
function dashboard() {
  const u = me(), p = percent(u), pr = prog(u), r = pr.cefr.slice(-1)[0];
  const subs = Object.entries(pr.assignments), pending = GRAMMAR_ASSIGNMENTS.filter(a => !pr.assignments[a.id]);
  const today = GRAMMAR_TOPICS.filter(t => status(u, t) === "today"), overdue = GRAMMAR_TOPICS.filter(t => status(u, t) === "overdue");
  const next = GRAMMAR_TOPICS.find(t => !pr.lessons[t.id]);
  const mine = db.bookings.filter(b => b.userId === u.id);
  return `<h1>Welcome, ${esc(u.name)}</h1>
  <div class="card"><b>Overall progress: ${p.overall}%</b>${bar(p.overall)}<p class="small muted">Overall = average of four programme percentages: Grammar, IELTS, MA (each = completed lessons ÷ total lessons) and CEFR (100% once you’ve taken the placement test).</p></div>
  <h2>Programmes</h2><div class="grid">
   <a class="card" href="#/grammar"><b>Grammar</b> ${p.g}/${GRAMMAR_TOPICS.length}${bar(p.gp)}</a>
   <a class="card" href="#/ielts"><b>IELTS</b> ${p.i}/${ALL_IELTS.length}${bar(p.ip)}</a>
   <a class="card" href="#/ma"><b>MA English (draft)</b> ${p.m}/${ALL_MA.length}${bar(p.mp)}</a>
   <a class="card" href="#/cefr"><b>CEFR</b> ${r ? "Level " + (r.humanLevel || r.level) : "Not taken yet"}${bar(p.cp)}</a></div>
  <h2>Today</h2>${!pr.start ? `<div class="card">Start your Grammar calendar on the <a href="#/grammar">Grammar page</a>.</div>` : today.length ? `<ul class="list">${today.map(t => `<li><a href="#/grammar/${t.id}">${esc(t.title)}</a>${tagFor("today")}</li>`).join("")}</ul>` : `<p class="muted">No Grammar lesson scheduled today.</p>`}
  ${overdue.length ? `<p><span class="tag warn">${overdue.length} overdue</span> — <a href="#/grammar/${overdue[0].id}">catch up: ${esc(overdue[0].title)}</a></p>` : ""}
  ${next ? `<p>Next to complete: <a href="#/grammar/${next.id}">${esc(next.title)}</a></p>` : ""}
  <h2>Assignments</h2><p>${subs.length} submitted · ${pending.length} pending</p>
  ${pending.slice(0, 3).map(a => `<p class="small"><a href="#/grammar/${a.id}">${a.title}</a> <span class="tag warn">Pending</span></p>`).join("")}
  <h2>Assessment results</h2>${pr.cefr.length ? `<div class="tbl"><table><tr><th>Date</th><th>Level</th><th>Grammar</th><th>Listening</th><th>Reading</th><th>Writing</th></tr>${pr.cefr.map(x => `<tr><td>${fmtDate(x.ts)}</td><td>${x.humanLevel || x.level}</td>${["Grammar", "Listening", "Reading"].map(k => `<td>${x.secs[k].right}/${x.secs[k].n}</td>`).join("")}<td>${x.wPct}%</td></tr>`).join("")}</table></div>` : `<p class="muted">No assessments yet. <a href="#/cefr">Take the CEFR test</a>.</p>`}
  <h2>Speaking appointments</h2>${mine.length ? `<ul class="list">${mine.map(b => `<li><span>${fmtDate(b.date)} ${b.time}</span><span><span class="tag ${b.status === "confirmed" ? "ok" : ""}">${b.status}</span></span>${b.result ? `<div class="small" style="width:100%"><b>Examiner result:</b> ${esc(b.result)}${b.feedback ? " — " + esc(b.feedback) : ""}</div>` : ""}</li>`).join("")}</ul>` : `<p class="muted">None yet. <a href="#/speaking">Request a slot</a>.</p>`}`;
}

/* ---------- Admin ---------- */
function admin() {
  const u = me(); if (u.role !== "admin") return `<h1>Not authorised</h1><p>This area is for administrators.</p>`;
  const students = db.users;
  return `<h1>Admin dashboard</h1><div class="notice">Demo mode: admin rights apply only in this browser. Real role enforcement requires Supabase RLS (see README).</div>
  <h2>Speaking requests</h2>${db.bookings.length ? `<div class="tbl"><table><tr><th>Student</th><th>Slot</th><th>Status</th><th>Actions</th></tr>${db.bookings.map(b => `<tr><td>${esc(b.name)}<br><span class="small muted">${esc(b.email)}</span></td><td>${fmtDate(b.date)} ${b.time}</td><td>${b.status}</td><td>
   <button class="btn sm" data-bk="${b.id}" data-act="confirmed">Confirm</button> <button class="btn sm bad" data-bk="${b.id}" data-act="declined">Decline</button>
   <form data-result="${b.id}" style="margin-top:6px"><input placeholder="Result (e.g. B2)" value="${esc(b.result || "")}" aria-label="Result"><input placeholder="Feedback" value="${esc(b.feedback || "")}" aria-label="Feedback" style="margin-top:4px"><button class="btn sm alt" style="margin-top:4px">Save result</button></form>
   ${mailtoFor(b) ? `<a class="small" href="${mailtoFor(b)}">Email notification</a>` : ""}</td></tr>`).join("")}</table></div>` : `<p class="muted">No requests.</p>`}
  <h2>Availability</h2><form id="slotForm"><input type="date" id="sd" required aria-label="Date"> <input type="time" id="st" required aria-label="Time" style="max-width:140px"> <button class="btn sm">Add slot</button></form><p class="small muted">${db.slots.length} slots defined.</p>
  <h2>Students</h2><div class="tbl"><table><tr><th>Name</th><th>Email</th><th>Role</th><th>Progress</th><th>CEFR</th></tr>${students.map(s => { const pc = percent(s), c = prog(s).cefr.slice(-1)[0]; return `<tr><td>${esc(s.name)}</td><td>${esc(s.email)}</td><td><select data-role="${s.id}" aria-label="Role" style="max-width:120px"><option ${s.role === "student" ? "selected" : ""}>student</option><option ${s.role === "admin" ? "selected" : ""}>admin</option></select></td><td>${pc.overall}%</td><td>${c ? `${c.humanLevel || c.level} <form data-lvl="${c.id}" data-user="${s.id}"><input placeholder="Set level" style="max-width:100px" aria-label="Human level"><input placeholder="Writing feedback" aria-label="Writing feedback"><button class="btn sm alt">Save</button></form>` : "—"}</td></tr>`; }).join("")}</table></div>
  <h2>Resource links (verified)</h2><p class="small muted">After watching a video and confirming it teaches the exact topic, paste its YouTube URL here.</p>
  <form id="resForm"><label for="rt">Topic</label><select id="rt">${[...GRAMMAR_TOPICS, ...ALL_IELTS].map(t => `<option value="${t.id}">${esc(t.title)} (${t.id})</option>`).join("")}</select><label for="rv">Verified video URL</label><input id="rv" type="url" placeholder="https://www.youtube.com/watch?v=…"><button class="btn sm" style="margin-top:8px">Save as verified</button></form>`;
}

/* ---------- Static pages ---------- */
function contact() {
  return `<h1>Contact</h1>${CFG.CONTACT_EMAIL ? `<p>Email: <a href="mailto:${esc(CFG.CONTACT_EMAIL)}">${esc(CFG.CONTACT_EMAIL)}</a></p>` : `<div class="notice">No contact email has been configured yet. The site owner must set <code>CONTACT_EMAIL</code> in <code>js/config.js</code>.</div>`}<p>We reply to speaking-assessment requests by email. An appointment is only confirmed when a real person confirms it.</p>`;
}
function privacy() {
  return `<h1>Privacy</h1><p>LearnHub collects your name, email, learning progress, test answers and speaking requests to provide your account and show your progress. In this demo version this data stays in your own browser. In the live Supabase version it is stored in a protected database where each student can read only their own records; administrators can view student progress to run the service. Passwords are never stored in plain text. Contact the site owner to request access to, or deletion of, your data.</p>`;
}
function authPage(mode) {
  const reg = mode === "register";
  return `<h1>${reg ? "Create your account" : "Log in"}</h1><form id="authForm" data-mode="${mode}" novalidate>${reg ? `<label for="nm">Full name</label><input id="nm" autocomplete="name">` : ""}
  <label for="em">Email</label><input id="em" type="email" autocomplete="email"><label for="pw">Password ${reg ? "(8+ characters)" : ""}</label><input id="pw" type="password" autocomplete="${reg ? "new-password" : "current-password"}">
  ${reg ? `<label style="font-weight:400"><input type="checkbox" id="consent" style="width:auto"> I agree to the <a href="#/privacy">privacy information</a>.</label>` : ""}
  <p class="err" id="aerr" role="alert"></p><button class="btn">${reg ? "Sign up" : "Log in"}</button></form>
  <p>${reg ? `Have an account? <a href="#/login">Log in</a>` : `New here? <a href="#/register">Sign up</a>`}</p>${reg && !db.users.length ? `<p class="small muted">Demo mode: the first account created in this browser becomes the administrator.</p>` : ""}`;
}

/* ---------- Event binding ---------- */
function bind() {
  const m = $("#main"), u = me();
  m.querySelectorAll("[data-complete]").forEach(b => b.onclick = () => { const l = prog(u).lessons, id = b.dataset.complete; if (l[id]) delete l[id]; else l[id] = Date.now(); save(); route(); });
  const sf = $("#startForm"); if (sf) sf.onsubmit = e => { e.preventDefault(); prog(u).start = $("#startDate").value || iso(Date.now()); save(); route(); };
  const af = $("#assignForm"); if (af) af.onsubmit = e => { e.preventDefault(); const t = $("#at").value.trim(); if (t.split(/\s+/).length < 20) return alert("Please write at least 20 words."); prog(u).assignments[af.dataset.id] = {...(prog(u).assignments[af.dataset.id] || {}), text: t, ts: Date.now()}; save(); route(); };
  const au = $("#authForm"); if (au) au.onsubmit = async e => {
    e.preventDefault(); const err = $("#aerr"), reg = au.dataset.mode === "register", em = $("#em").value, pw = $("#pw").value;
    try {
      if (!/^\S+@\S+\.\S+$/.test(em)) throw new Error("Enter a valid email address.");
      if (reg) { if (!$("#nm").value.trim()) throw new Error("Enter your name."); if (pw.length < 8) throw new Error("Password must be at least 8 characters."); if (!$("#consent").checked) throw new Error("Please accept the privacy information."); await register($("#nm").value, em, pw); }
      else await login(em, pw);
      go("/dashboard");
    } catch (x) { err.textContent = x.message; }
  };
  const cf = $("#cefrForm"); if (cf) {
    const cw = $("#cw"); cw.oninput = () => $("#wc").textContent = (cw.value.trim() ? cw.value.trim().split(/\s+/).length : 0) + " words (aim for " + CEFR_WRITING.minWords + "+)";
    cf.onsubmit = e => { e.preventDefault(); finishCefr(false); };
    cf.querySelectorAll("[data-play]").forEach(b => b.onclick = () => { const q = CEFR_QUESTIONS.find(x => x.id === b.dataset.play); if (!window.speechSynthesis) return alert("Audio isn’t supported here — use “Show transcript”."); speechSynthesis.cancel(); const s = new SpeechSynthesisUtterance(q.audio); s.lang = "en-GB"; s.rate = .9; speechSynthesis.speak(s); });
    cf.querySelectorAll("[data-trans]").forEach(b => b.onclick = () => { const t = $("#tr-" + b.dataset.trans); t.hidden = !t.hidden; });
  }
  const bf = $("#bookForm"); if (bf) bf.onsubmit = e => { e.preventDefault(); const sid = $("#slot").value; if (!sid) return $("#berr").textContent = "Please choose a slot.";
    const s = db.slots.find(x => x.id === sid); if (db.bookings.some(b => b.slotId === sid && b.status !== "declined")) return $("#berr").textContent = "That slot was just taken.";
    const b = {id: uid(), slotId: sid, userId: u.id, name: u.name, email: u.email, date: s.date, time: s.time, note: $("#bnote").value, status: "requested", ts: Date.now()};
    db.bookings.push(b); save(); const mt = mailtoFor(b); route();
    if (mt && confirm("Request saved. Open your email app to send the notification to the examiner?")) location.href = mt; };
  m.querySelectorAll("[data-bk]").forEach(b => b.onclick = () => { const bk = db.bookings.find(x => x.id === b.dataset.bk); bk.status = b.dataset.act; if (b.dataset.act === "declined") bk.adminNote = "Please choose another slot."; save(); route(); });
  m.querySelectorAll("[data-result]").forEach(f => f.onsubmit = e => { e.preventDefault(); const bk = db.bookings.find(x => x.id === f.dataset.result), i = f.querySelectorAll("input"); bk.result = i[0].value; bk.feedback = i[1].value; save(); route(); });
  const sl = $("#slotForm"); if (sl) sl.onsubmit = e => { e.preventDefault(); db.slots.push({id: uid(), date: $("#sd").value, time: $("#st").value}); save(); route(); };
  m.querySelectorAll("[data-role]").forEach(s => s.onchange = () => { const t = db.users.find(x => x.id === s.dataset.role); if (t.id === u.id && s.value !== "admin" && db.users.filter(x => x.role === "admin").length < 2) { alert("You are the only admin."); return route(); } t.role = s.value; save(); });
  m.querySelectorAll("[data-lvl]").forEach(f => f.onsubmit = e => { e.preventDefault(); const r = prog(db.users.find(x => x.id === f.dataset.user)).cefr.find(x => x.id === f.dataset.lvl), i = f.querySelectorAll("input"); if (i[0].value) r.humanLevel = i[0].value.toUpperCase(); r.writingFeedback = i[1].value; save(); route(); });
  const rf = $("#resForm"); if (rf) rf.onsubmit = e => { e.preventDefault(); const v = $("#rv").value.trim(); if (!/^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(v)) return alert("Enter a YouTube URL."); db.overrides[$("#rt").value] = {video: v, verified: true}; save(); alert("Saved."); };
}
window.addEventListener("hashchange", route);
route();
})();
