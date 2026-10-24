"use strict";
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const themeButton = document.querySelector(".theme-toggle");
try {
  if (localStorage.getItem("moon-key-theme") === "dark")
    document.documentElement.dataset.theme = "dark";
} catch {}
function syncThemeButton() {
  if (!themeButton) return;
  const dark = document.documentElement.dataset.theme === "dark";
  themeButton.setAttribute("aria-pressed", String(dark));
  themeButton.setAttribute(
    "aria-label",
    dark ? "밝은 테마로 전환" : "어두운 테마로 전환",
  );
  themeButton.replaceChildren(
    document.createTextNode(dark ? "Light " : "Dark "),
  );
  const icon = document.createElement("span");
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "◐";
  themeButton.append(icon);
}
syncThemeButton();
themeButton?.addEventListener("click", () => {
  const next =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem("moon-key-theme", next);
  } catch {}
  syncThemeButton();
  document.dispatchEvent(new Event("themechange"));
});
function safeURL(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
async function initIndex() {
  const grid = document.getElementById("projectsGrid");
  if (!grid) return;
  try {
    const response = await fetch("projects.json");
    if (!response.ok) throw new Error("Project data unavailable");
    const data = await response.json();
    if (
      !Array.isArray(data) ||
      !data.length ||
      data.some(
        (p) =>
          !p ||
          typeof p.title !== "string" ||
          typeof p.description !== "string" ||
          !["PROJECT", "TECHNICAL", "ARCHIVE", "RESEARCH"].includes(p.tag) ||
          !safeURL(p.url),
      )
    )
      throw new Error("Invalid project data");
    const search = document.getElementById("projectSearch"),
      buttons = [...document.querySelectorAll("[data-filter]")],
      count = document.getElementById("resultCount"),
      empty = document.getElementById("projectEmpty");
    let filter = "all";
    const labels = {
      PROJECT: "PROJECT",
      TECHNICAL: "WRITING",
      ARCHIVE: "ARCHIVE",
      RESEARCH: "RESEARCH",
    };
    function render() {
      const query = search.value.trim().toLocaleLowerCase("ko");
      const matches = data.filter(
        (p) =>
          (filter === "all" || p.tag === filter) &&
          `${p.title} ${p.description}`.toLocaleLowerCase("ko").includes(query),
      );
      const fragment = document.createDocumentFragment();
      for (const p of matches) {
        const link = document.createElement("a");
        link.className = "index-card";
        link.href = safeURL(p.url);
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = labels[p.tag];
        const title = document.createElement("h2");
        title.textContent = p.title;
        const description = document.createElement("p");
        description.textContent = p.description;
        const arrow = document.createElement("span");
        arrow.className = "card-arrow";
        arrow.textContent = "↗";
        arrow.setAttribute("aria-hidden", "true");
        link.append(tag, title, description, arrow);
        fragment.append(link);
      }
      grid.replaceChildren(fragment);
      empty.hidden = matches.length !== 0;
      count.textContent = `${matches.length} / ${data.length} WORKS`;
      buttons.forEach((b) => {
        const active = b.dataset.filter === filter;
        b.classList.toggle("active", active);
        b.setAttribute("aria-pressed", String(active));
      });
    }
    buttons.forEach((b) =>
      b.addEventListener("click", () => {
        filter = b.dataset.filter;
        render();
      }),
    );
    search.addEventListener("input", render);
    document.getElementById("resetFilters").addEventListener("click", () => {
      filter = "all";
      search.value = "";
      render();
      search.focus();
    });
    document.getElementById("indexToolbar").hidden = false;
    render();
  } catch {
    document.getElementById("projectError").hidden = false;
  }
}
initIndex();
// (2,3) torus knot: a tube around a parametric curve, projected in perspective.
(function initGeometry() {
  const canvas = document.getElementById("geometry");
  if (!canvas) return;
  const ctx = canvas.getContext("2d"),
    motion = document.getElementById("motionToggle");
  if (!ctx) {
    motion.disabled = true;
    canvas.setAttribute(
      "aria-label",
      "3차원 토러스 매듭 — 현재 브라우저에서 시각화를 지원하지 않습니다.",
    );
    return;
  }
  const points = [],
    rows = 180,
    cols = 14;
  function center(t) {
    return [
      (2 + Math.cos(3 * t)) * Math.cos(2 * t),
      (2 + Math.cos(3 * t)) * Math.sin(2 * t),
      Math.sin(3 * t),
    ];
  }
  for (let i = 0; i < rows; i++) {
    const t = (i / rows) * Math.PI * 2,
      c = center(t),
      n = center(t + 0.001),
      tangent = n.map((v, j) => v - c[j]),
      len = Math.hypot(...tangent);
    tangent.forEach((_, j) => (tangent[j] /= len));
    const normal = [-tangent[1], tangent[0], 0],
      nl = Math.hypot(...normal);
    normal.forEach((_, j) => (normal[j] /= nl));
    const binormal = [
      tangent[1] * normal[2] - tangent[2] * normal[1],
      tangent[2] * normal[0] - tangent[0] * normal[2],
      tangent[0] * normal[1] - tangent[1] * normal[0],
    ];
    for (let j = 0; j < cols; j++) {
      const a = (j / cols) * Math.PI * 2;
      points.push(
        c.map(
          (v, k) =>
            v + 0.21 * (normal[k] * Math.cos(a) + binormal[k] * Math.sin(a)),
        ),
      );
    }
  }
  let angle = 0.48,
    tilt = 0.85,
    width = 0,
    height = 0,
    frame = 0,
    last = 0,
    paused = reducedMotion.matches,
    visible = true,
    mode = "points",
    drag = null,
    ink = "",
    accent = "";
  function colors() {
    const style = getComputedStyle(document.documentElement);
    ink = style.getPropertyValue("--ink").trim();
    accent = style.getPropertyValue("--accent").trim();
  }
  function project(p) {
    const [x, y, z] = p,
      ca = Math.cos(angle),
      sa = Math.sin(angle),
      ct = Math.cos(tilt),
      st = Math.sin(tilt),
      rx = x * ca - z * sa,
      rz = x * sa + z * ca,
      ry = y * ct - rz * st,
      depth = y * st + rz * ct,
      s = (Math.min(width / 7.8, height / 6.6) * 8.5) / (8.5 + depth);
    return [width / 2 + rx * s, height / 2 + ry * s, depth];
  }
  function draw() {
    ctx.clearRect(0, 0, width, height);
    const projected = points.map(project);
    ctx.lineWidth = 0.6;
    if (mode === "lines") {
      ctx.strokeStyle = ink;
      for (let i = 0; i < rows; i += 3) {
        ctx.globalAlpha = 0.17;
        ctx.beginPath();
        for (let j = 0; j <= cols; j++) {
          const p = projected[i * cols + (j % cols)];
          if (j === 0) ctx.moveTo(p[0], p[1]);
          else ctx.lineTo(p[0], p[1]);
        }
        ctx.stroke();
      }
      for (let j = 0; j < cols; j += 2) {
        ctx.globalAlpha = 0.38;
        ctx.beginPath();
        for (let i = 0; i <= rows; i++) {
          const p = projected[(i % rows) * cols + j];
          if (i === 0) ctx.moveTo(p[0], p[1]);
          else ctx.lineTo(p[0], p[1]);
        }
        ctx.stroke();
      }
    } else {
      projected.sort((a, b) => b[2] - a[2]);
      for (const [x, y, z] of projected) {
        ctx.globalAlpha = Math.max(0.15, Math.min(0.88, 0.56 - z * 0.12));
        ctx.fillStyle = ink;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.6, 1.1 - z * 0.1), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    const origin = project([0, 0, 0]);
    [
      [1.15, 0, 0],
      [0, 1.15, 0],
      [0, 0, 1.15],
    ].forEach((axis, i) => {
      const end = project(axis);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 0.7;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(origin[0], origin[1]);
      ctx.lineTo(end[0], end[1]);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = accent;
      ctx.font = "9px monospace";
      ctx.fillText(["x", "y", "z"][i], end[0] + 5, end[1] - 4);
    });
    ctx.globalAlpha = 0.15;
    ctx.strokeStyle = ink;
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }
  function animate(time) {
    frame = 0;
    if (paused || !visible || document.hidden) {
      last = 0;
      return;
    }
    if (last) angle += Math.min(time - last, 50) * 0.00009;
    last = time;
    draw();
    frame = requestAnimationFrame(animate);
  }
  function schedule() {
    if (!frame && !paused && visible && !document.hidden)
      frame = requestAnimationFrame(animate);
  }
  function stop() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
  }
  function syncMotion() {
    motion.setAttribute("aria-pressed", String(paused));
    motion.textContent = paused ? "회전 재생 ▷" : "회전 멈추기 Ⅱ";
  }
  function resize() {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw();
  }
  colors();
  resize();
  syncMotion();
  schedule();
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    if (visible) schedule();
    else stop();
  }).observe(canvas);
  motion.addEventListener("click", () => {
    paused = !paused;
    syncMotion();
    if (paused) stop();
    else schedule();
  });
  reducedMotion.addEventListener("change", (e) => {
    if (e.matches) {
      paused = true;
      syncMotion();
      stop();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else schedule();
  });
  document.addEventListener("themechange", () => {
    colors();
    draw();
  });
  document.querySelectorAll("[data-view]").forEach((b) =>
    b.addEventListener("click", () => {
      mode = b.dataset.view;
      document.querySelectorAll("[data-view]").forEach((other) => {
        const active = other === b;
        other.classList.toggle("active", active);
        other.setAttribute("aria-pressed", String(active));
      });
      draw();
    }),
  );
  canvas.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch") return;
    drag = [e.clientX, e.clientY];
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag) return;
    angle += (e.clientX - drag[0]) * 0.008;
    tilt += (e.clientY - drag[1]) * 0.006;
    drag = [e.clientX, e.clientY];
    draw();
  });
  const endDrag = () => {
    drag = null;
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("lostpointercapture", endDrag);
})();
