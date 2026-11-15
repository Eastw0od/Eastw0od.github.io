(() => {
  const profile = window.PORTFOLIO;
  const setText = (key, value) => {
    document.querySelectorAll(`[data-profile="${key}"]`).forEach((el) => { el.textContent = value; });
  };

  Object.entries(profile).forEach(([key, value]) => {
    if (typeof value === "string") setText(key, value);
  });

  document.querySelectorAll("[data-link]").forEach((el) => {
    const href = profile.links[el.dataset.link];
    if (href) el.href = href;
  });

  const projectGrid = document.querySelector("#project-grid");
  profile.projects.forEach((project, index) => {
    const article = document.createElement("article");
    article.className = "project-card reveal";
    article.style.setProperty("--glow", project.color);
    article.innerHTML = `
      <span class="project-index">${String(index + 1).padStart(2, "0")} / ARCHIVE</span>
      <a class="project-link" href="${project.url}" aria-label="打开 ${project.title}">↗</a>
      <div>
        <h3>${project.title}</h3>
        <p>${project.description}</p>
        <span class="project-tags">${project.tags.join(" · ")}</span>
      </div>`;
    projectGrid.appendChild(article);
  });

  const updateClock = () => {
    const now = new Date();
    document.querySelector("#local-time").textContent = now.toLocaleTimeString("en-GB", { hour12: false });
  };
  updateClock();
  setInterval(updateClock, 1000);
  document.querySelector("#year").textContent = new Date().getFullYear();

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

  const canvas = document.querySelector("#rain");
  const ctx = canvas.getContext("2d");
  let drops = [];
  let raf;
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drops = Array.from({ length: Math.floor(innerWidth / 18) }, () => ({
      x: Math.random() * innerWidth,
      y: Math.random() * innerHeight,
      l: 8 + Math.random() * 22,
      v: 7 + Math.random() * 12,
      a: .06 + Math.random() * .18
    }));
  };
  const draw = () => {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    drops.forEach((d) => {
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - 2, d.y + d.l);
      ctx.strokeStyle = `rgba(137, 207, 255, ${d.a})`;
      ctx.lineWidth = .6;
      ctx.stroke();
      d.y += d.v;
      if (d.y > innerHeight) { d.y = -d.l; d.x = Math.random() * innerWidth; }
    });
    raf = requestAnimationFrame(draw);
  };
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
    resize();
    draw();
    addEventListener("resize", resize, { passive: true });

    const hero = document.querySelector(".hero");
    hero.addEventListener("pointermove", (event) => {
      const rect = hero.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width - .5) * 14;
      const y = ((event.clientY - rect.top) / rect.height - .5) * 10;
      hero.style.setProperty("--px", `${x}px`);
      hero.style.setProperty("--py", `${y}px`);
    }, { passive: true });
    hero.addEventListener("pointerleave", () => {
      hero.style.setProperty("--px", "0px");
      hero.style.setProperty("--py", "0px");
    });
  }
  addEventListener("pagehide", () => cancelAnimationFrame(raf));
})();
