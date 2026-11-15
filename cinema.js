(() => {
  const filmWall = document.querySelector("#film-wall");
  if (!filmWall) return;
  const preview = filmWall.dataset.mode === "preview";
  const filmSearch = document.querySelector("#film-search");
  const filmRating = document.querySelector("#film-rating");
  const filmOrder = document.querySelector("#film-order");
  const filmStatus = document.querySelector("#film-status");
  const filmMore = document.querySelector("#film-more");
  let cinemaFilms = [];
  let visibleFilms = preview ? 6 : 36;

  const filmCard = (film, index) => {
    const card = document.createElement("a");
    card.className = "film film-poster";
    card.href = film.url || "#";
    card.target = "_blank";
    card.rel = "noreferrer";
    card.setAttribute("aria-label", `${film.title}${film.year ? `，${film.year}` : ""}${film.rating ? `，个人评分 ${film.rating} 星` : ""}`);

    const image = document.createElement("img");
    image.src = film.poster || film.posterSource || "";
    image.alt = `${film.title} 海报`;
    image.loading = "lazy";
    image.decoding = "async";
    image.width = 420;
    image.height = 630;
    image.addEventListener("error", () => {
      if (film.posterSource && image.src !== film.posterSource) image.src = film.posterSource;
      else card.classList.add("poster-missing");
    }, { once: true });

    const info = document.createElement("div");
    info.className = "film-info";
    const number = document.createElement("span");
    number.className = "number";
    number.textContent = `${String(index + 1).padStart(3, "0")} / WATCHED`;
    const copy = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = film.title;
    const meta = document.createElement("p");
    meta.className = "meta";
    meta.textContent = [film.year, film.rating ? `${"★".repeat(film.rating)}${"☆".repeat(5 - film.rating)}` : "未评分", film.watchedAt].filter(Boolean).join(" · ");
    copy.append(title, meta);
    if (film.comment) {
      const comment = document.createElement("p");
      comment.className = "film-comment";
      comment.textContent = film.comment;
      copy.append(comment);
    }
    info.append(number, copy);
    card.append(image, info);
    return card;
  };

  const filteredFilms = () => {
    if (preview) return cinemaFilms;
    const query = filmSearch.value.trim().toLocaleLowerCase("zh-CN");
    const rating = filmRating.value;
    const films = cinemaFilms.filter((film) => {
      const haystack = `${film.title} ${film.fullTitle || ""} ${film.year || ""} ${film.comment || ""}`.toLocaleLowerCase("zh-CN");
      return (!query || haystack.includes(query))
        && (rating === "all" || (rating === "unrated" ? !film.rating : Number(film.rating || 0) >= Number(rating)));
    });
    const dateValue = (film) => Number(String(film.watchedAt || "").replaceAll("/", "")) || 0;
    films.sort((a, b) => {
      if (filmOrder.value === "oldest") return dateValue(a) - dateValue(b);
      if (filmOrder.value === "rating") return Number(b.rating || 0) - Number(a.rating || 0) || dateValue(b) - dateValue(a);
      if (filmOrder.value === "year") return Number(b.year || 0) - Number(a.year || 0) || dateValue(b) - dateValue(a);
      return dateValue(b) - dateValue(a);
    });
    return films;
  };

  const renderCinema = () => {
    const films = filteredFilms();
    const shown = films.slice(0, visibleFilms);
    const fragment = document.createDocumentFragment();
    shown.forEach((film, index) => fragment.append(filmCard(film, index)));
    filmWall.replaceChildren(fragment);
    if (filmStatus) filmStatus.textContent = `显示 ${shown.length} / ${films.length} 部 · 档案共 ${cinemaFilms.length} 部`;
    if (filmMore && !preview) filmMore.hidden = shown.length >= films.length;
  };

  if (!preview) {
    [filmSearch, filmRating, filmOrder].forEach((control) => control.addEventListener("input", () => {
      visibleFilms = 36;
      renderCinema();
    }));
    filmMore.addEventListener("click", () => { visibleFilms += 36; renderCinema(); });
  }

  fetch("./data/films.json?v=20261115")
    .then((response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); })
    .then((archive) => { cinemaFilms = archive.films; renderCinema(); })
    .catch(() => {
      filmWall.innerHTML = '<p class="cinema-error">观影档案暂时未能载入。</p>';
      if (filmStatus) filmStatus.textContent = "完整片单暂时未载入";
    });
})();
