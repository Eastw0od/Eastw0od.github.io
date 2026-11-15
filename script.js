(() => {
  const profile = window.PORTFOLIO;
  const setText = (key, value) => document.querySelectorAll(`[data-profile="${key}"]`).forEach((el) => { el.textContent = value; });
  Object.entries(profile).forEach(([key, value]) => { if (typeof value === "string") setText(key, value); });
  document.querySelectorAll("[data-link]").forEach((el) => { const href = profile.links[el.dataset.link]; if (href) el.href = href; });
  document.querySelector("#project-list").innerHTML = profile.projects.map((project) => `<a class="project" href="${project.url}" target="_blank" rel="noreferrer"><span class="year">${project.year}</span><h3>${project.title}</h3><p>${project.note}<br><span class="tags">${project.tags}</span></p><b>↗</b></a>`).join("");
  document.querySelector("#service-grid").innerHTML = profile.services.map((service) => `<a class="service-card" href="${service.url}" target="_blank" rel="noreferrer"><span class="service-number">${service.number} / SERVICE</span><h3>${service.title}</h3><p>${service.description}</p><b><span>${service.label}</span><span>↗</span></b></a>`).join("");
  document.querySelector("#film-wall").innerHTML = profile.films.map((film, i) => `<article class="film" style="--c1:${film.palette[0]};--c2:${film.palette[1]};--x:${25 + (i * 17) % 65}%;--y:${28 + (i * 13) % 52}%"><span class="number">${String(i + 1).padStart(2,"0")} / WATCH LOG</span><div><h3>${film.title}</h3><p class="meta">${film.year} · ${film.director}</p></div></article>`).join("");
  document.querySelector("#year").textContent = new Date().getFullYear();
  const menu = document.querySelector(".menu-button"); const nav = document.querySelector("nav");
  menu.addEventListener("click", () => { const open = nav.classList.toggle("open"); menu.setAttribute("aria-expanded", open); });
  nav.addEventListener("click", () => { nav.classList.remove("open"); menu.setAttribute("aria-expanded", "false"); });
})();
