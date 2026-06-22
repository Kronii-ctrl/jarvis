/* =============================================================================
 * Bangkok Rail — UI logic
 * Pure vanilla JS, no dependencies. Reads the global NETWORK object from data.js.
 * ===========================================================================*/
(function () {
  "use strict";

  const lines = NETWORK.lines;
  const byId = NETWORK.byId;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* helper: small coloured tag for a line */
  function xtag(lineId) {
    const l = byId[lineId];
    if (!l) return "";
    return `<span class="xtag" style="--xc:${l.color};--xt:${l.textOn}">${esc(l.short)}</span>`;
  }

  /* =====================================================================
   * TABS
   * ===================================================================*/
  $$(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$(".tab").forEach((t) => t.classList.remove("active"));
      $$(".panel").forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      $("#tab-" + tab.dataset.tab).classList.add("active");
    });
  });

  /* =====================================================================
   * NETWORK — line filter chips + expandable line diagrams
   * ===================================================================*/
  const visible = new Set(lines.map((l) => l.id));

  function renderChips() {
    $("#lineChips").innerHTML = lines
      .map(
        (l) =>
          `<button class="chip" data-line="${l.id}" aria-pressed="true" style="--c:${l.color}">
             <span class="dot"></span>${esc(l.short)}
           </button>`
      )
      .join("");
    $$("#lineChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const id = chip.dataset.line;
        if (visible.has(id)) visible.delete(id);
        else visible.add(id);
        chip.setAttribute("aria-pressed", visible.has(id));
        applyVisibility();
      });
    });
  }

  function applyVisibility() {
    $$(".line-card").forEach((card) => {
      card.style.display = visible.has(card.dataset.line) ? "" : "none";
    });
  }

  function stationRow(st) {
    const isX = st.x && st.x.length;
    const tags = isX ? `<span class="xtags">${st.x.map(xtag).join("")}</span>` : "";
    return `<div class="station ${isX ? "interchange" : ""}" data-station="${esc(st.name)}">
      <span class="node"></span>
      <span class="scode">${esc(st.code)}</span>
      <span class="sname">${esc(st.name)}${tags}</span>
    </div>`;
  }

  function renderDiagrams() {
    $("#lineDiagrams").innerHTML = lines
      .map((l) => {
        const term = `${l.stations[0].name} ↔ ${l.stations[l.stations.length - 1].name}`;
        const fare = l.fare.flat ? `${l.fare.min} ${NETWORK.meta.currency} flat` : `${l.fare.min}–${l.fare.max} ${NETWORK.meta.currency}`;
        return `<div class="line-card" data-line="${l.id}" style="--c:${l.color};--t:${l.textOn}">
          <div class="line-head">
            <span class="badge">${esc(l.short)}</span>
            <h3>${esc(l.name)}</h3>
            <span class="meta">${l.stations.length} stations · ${esc(term)}<br>${esc(l.hours)} · ${fare}</span>
            <button class="line-toggle" aria-expanded="false">Show stations</button>
          </div>
          <div class="stations">${l.stations.map(stationRow).join("")}</div>
        </div>`;
      })
      .join("");

    $$(".line-toggle").forEach((btn) => {
      btn.addEventListener("click", () => {
        const strip = btn.closest(".line-card").querySelector(".stations");
        const open = strip.classList.toggle("open");
        btn.setAttribute("aria-expanded", open);
        btn.textContent = open ? "Hide stations" : "Show stations";
      });
    });
  }

  /* =====================================================================
   * INTERCHANGES — auto-derived from stations that link to other lines
   * ===================================================================*/
  // stations sometimes carry a "(junction)" suffix etc. — loose compare
  function sameStation(a, b) {
    const norm = (s) => s.toLowerCase().replace(/\s*\(.*?\)\s*/g, "").trim();
    return norm(a) === norm(b);
  }

  function renderInterchanges() {
    // group by normalised station name; collect the set of lines meeting there
    const groups = {};
    lines.forEach((l) => {
      l.stations.forEach((st) => {
        if (!st.x || !st.x.length) return;
        const key = st.name.toLowerCase().replace(/\s*\(.*?\)\s*/g, "").trim();
        if (!groups[key]) groups[key] = { name: st.name.replace(/\s*\(.*?\)\s*/g, "").trim(), lines: {} };
        groups[key].lines[l.id] = st.code;
        st.x.forEach((other) => {
          if (!(other in groups[key].lines)) groups[key].lines[other] = null; // fill code below
        });
      });
    });

    // backfill codes for lines we know the station appears on
    Object.values(groups).forEach((g) => {
      Object.keys(g.lines).forEach((lid) => {
        if (g.lines[lid] === null) {
          const l = byId[lid];
          const match = l && l.stations.find((s) => sameStation(s.name, g.name));
          if (match) g.lines[lid] = match.code;
        }
      });
    });

    const items = Object.values(groups)
      .filter((g) => Object.keys(g.lines).length > 1)
      .sort((a, b) => Object.keys(b.lines).length - Object.keys(a.lines).length || a.name.localeCompare(b.name));

    $("#interchangeList").innerHTML = items
      .map((g) => {
        const pills = Object.entries(g.lines)
          .map(([lid, code]) => {
            const l = byId[lid];
            if (!l) return "";
            return `<span class="pill" style="--c:${l.color};--t:${l.textOn}">
              ${esc(l.short)}${code ? `<span class="pcode">${esc(code)}</span>` : ""}
            </span>`;
          })
          .join("");
        return `<div class="ix"><h4>${esc(g.name)}</h4><div class="lines">${pills}</div></div>`;
      })
      .join("");
  }

  /* =====================================================================
   * FARE & TIME PLANNER (single line)
   * ===================================================================*/
  function fillStationSelect(sel, line) {
    sel.innerHTML = line.stations
      .map((s, i) => `<option value="${i}">${esc(s.code)} · ${esc(s.name)}</option>`)
      .join("");
  }

  function initPlanner() {
    const lineSel = $("#planLine");
    lineSel.innerHTML = lines.map((l) => `<option value="${l.id}">${esc(l.name)}</option>`).join("");

    function refreshStations() {
      const line = byId[lineSel.value];
      fillStationSelect($("#planFrom"), line);
      fillStationSelect($("#planTo"), line);
      $("#planTo").value = Math.min(line.stations.length - 1, 5);
      compute();
    }

    function compute() {
      const line = byId[lineSel.value];
      const fromI = +$("#planFrom").value;
      const toI = +$("#planTo").value;
      const box = $("#planResult");

      if (fromI === toI) {
        box.hidden = false;
        box.innerHTML = `<p class="plan-note">Pick two different stations.</p>`;
        return;
      }
      const from = line.stations[fromI];
      const to = line.stations[toI];
      const hops = Math.abs(toI - fromI);

      // fare estimate: flat, or linear interpolation between min and max across the line
      let fare;
      if (line.fare.flat) {
        fare = line.fare.min;
      } else {
        const span = line.stations.length - 1;
        const frac = hops / span;
        fare = Math.round(line.fare.min + (line.fare.max - line.fare.min) * frac);
        fare = Math.max(line.fare.min, Math.min(line.fare.max, fare));
      }

      // time estimate: ~2 min per hop running + ~0.7 min dwell, +3 min buffer
      const mins = Math.round(hops * 2 + hops * 0.7 + 3);

      // interchanges along the segment (inclusive)
      const lo = Math.min(fromI, toI),
        hi = Math.max(fromI, toI);
      const ixSet = {};
      for (let i = lo; i <= hi; i++) {
        const st = line.stations[i];
        if (st.x && st.x.length) st.x.forEach((o) => (ixSet[o] = ixSet[o] || st));
      }
      const ixHtml = Object.keys(ixSet).length
        ? `<div class="plan-ix"><span class="k" style="color:var(--muted);font-size:.8rem">Change along the way for: </span>${Object.entries(
            ixSet
          )
            .map(([lid, st]) => `${xtag(lid)} <small style="color:var(--muted)">@ ${esc(st.name)}</small>`)
            .join(" &nbsp; ")}</div>`
        : "";

      box.hidden = false;
      box.innerHTML = `
        <div class="plan-route">
          <strong>${esc(from.name)}</strong>
          <span class="arrow">→</span>
          <strong>${esc(to.name)}</strong>
        </div>
        <div class="stat-grid">
          <div class="stat"><div class="k">Estimated fare</div><div class="v">${fare} <small>${NETWORK.meta.currency}</small></div></div>
          <div class="stat"><div class="k">Stations</div><div class="v">${hops} <small>stops</small></div></div>
          <div class="stat"><div class="k">In-train time</div><div class="v">~${mins} <small>min</small></div></div>
        </div>
        ${ixHtml}
        <p class="plan-note">${esc(line.fareNote)} ${line.fare.flat ? "" : "Fare is interpolated across the line and rounded — treat it as a guide, not the exact tariff."}</p>`;
    }

    lineSel.addEventListener("change", refreshStations);
    $("#planFrom").addEventListener("change", compute);
    $("#planTo").addEventListener("change", compute);
    refreshStations();
  }

  /* =====================================================================
   * INFO — per-line cards (hours, headway, fares, operator)
   * ===================================================================*/
  function renderInfo() {
    $("#infoCards").innerHTML = lines
      .map((l) => {
        const fare = l.fare.flat ? `${l.fare.min} ${NETWORK.meta.currency} (flat)` : `${l.fare.min}–${l.fare.max} ${NETWORK.meta.currency}`;
        return `<div class="info-card" style="--c:${l.color}">
          <div class="ic-head">
            <h3>${esc(l.name)}</h3>
            <div class="op">${esc(l.operator)}</div>
          </div>
          <dl>
            <div class="row"><dt>Type</dt><dd>${esc(l.type)}</dd></div>
            <div class="row"><dt>Stations</dt><dd>${l.stations.length}</dd></div>
            <div class="row"><dt>Operating hours</dt><dd>${esc(l.hours)}</dd></div>
            <div class="row"><dt>Frequency</dt><dd>${esc(l.headway)}</dd></div>
            <div class="row"><dt>Single fare</dt><dd>${fare}</dd></div>
          </dl>
          <div class="ic-foot"><a href="${esc(l.url)}" target="_blank" rel="noopener">Official site →</a></div>
        </div>`;
      })
      .join("");
  }

  /* =====================================================================
   * SEARCH — find a station, jump to its line in the Network tab
   * ===================================================================*/
  const stationIndex = [];
  lines.forEach((l) => l.stations.forEach((s) => stationIndex.push({ line: l, st: s })));

  function initSearch() {
    const input = $("#search");
    const out = $("#searchResults");

    function close() {
      out.hidden = true;
      out.innerHTML = "";
    }

    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      if (!q) return close();
      const hits = stationIndex
        .filter(({ st }) => st.name.toLowerCase().includes(q) || st.code.toLowerCase().includes(q))
        .slice(0, 12);
      if (!hits.length) {
        out.hidden = false;
        out.innerHTML = `<div class="res-empty">No station found.</div>`;
        return;
      }
      out.hidden = false;
      out.innerHTML = hits
        .map(
          ({ line, st }) =>
            `<div class="res" data-line="${line.id}">
               <span class="xtag" style="--xc:${line.color};--xt:${line.textOn}">${esc(line.short)}</span>
               <span class="scode" style="min-width:42px">${esc(st.code)}</span>
               <span>${esc(st.name)}</span>
             </div>`
        )
        .join("");
      $$(".res", out).forEach((res) => {
        res.addEventListener("click", () => {
          jumpToLine(res.dataset.line);
          input.value = "";
          close();
        });
      });
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest(".search-wrap")) close();
    });
  }

  function jumpToLine(lineId) {
    // switch to Network tab
    $$(".tab").forEach((t) => t.classList.remove("active"));
    $$(".panel").forEach((p) => p.classList.remove("active"));
    $('.tab[data-tab="network"]').classList.add("active");
    $("#tab-network").classList.add("active");
    // ensure visible + expanded
    visible.add(lineId);
    $(`#lineChips .chip[data-line="${lineId}"]`).setAttribute("aria-pressed", "true");
    applyVisibility();
    const card = $(`.line-card[data-line="${lineId}"]`);
    const strip = card.querySelector(".stations");
    const btn = card.querySelector(".line-toggle");
    if (!strip.classList.contains("open")) {
      strip.classList.add("open");
      btn.setAttribute("aria-expanded", "true");
      btn.textContent = "Hide stations";
    }
    card.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* =====================================================================
   * BOOT
   * ===================================================================*/
  renderChips();
  renderDiagrams();
  renderInterchanges();
  initPlanner();
  renderInfo();
  initSearch();
  $("#footerNote").textContent = `${lines.length} lines · ${stationIndex.length} station stops · data reviewed ${NETWORK.meta.reviewed}.`;
})();
