(() => {
  const profile = window.PORTFOLIO;
  const text = (key, value) => document.querySelectorAll(`[data-profile="${key}"]`).forEach((el) => { el.textContent = value; });
  Object.entries(profile).forEach(([key, value]) => { if (typeof value === "string") text(key, value); });
  document.querySelectorAll("[data-link]").forEach((el) => { const href = profile.links[el.dataset.link]; if (href) el.href = href; });
  document.querySelector("#project-list").innerHTML = profile.projects.map((project) => `<a class="project" href="${project.url}"><span class="year">${project.year}</span><h3>${project.title}</h3><p>${project.note}<br><span class="tags">${project.tags}</span></p><b>↗</b></a>`).join("");
  document.querySelector("#film-wall").innerHTML = profile.films.map((film, i) => `<article class="film" style="--c1:${film.palette[0]};--c2:${film.palette[1]};--x:${25 + (i * 17) % 65}%;--y:${28 + (i * 13) % 52}%"><span class="number">${String(i + 1).padStart(2,"0")} / WATCH LOG</span><div><h3>${film.title}</h3><p class="meta">${film.year} · ${film.director}</p></div></article>`).join("");
  const clock = () => { document.querySelector("#local-time").textContent = new Date().toLocaleTimeString("en-GB", {hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}); };
  clock(); setInterval(clock, 1000); document.querySelector("#year").textContent = new Date().getFullYear();
  const menu = document.querySelector(".menu-button"); const nav = document.querySelector("nav");
  menu.addEventListener("click", () => { const open = nav.classList.toggle("open"); menu.setAttribute("aria-expanded", open); });
  nav.addEventListener("click", () => { nav.classList.remove("open"); menu.setAttribute("aria-expanded", "false"); });

  const canvas = document.querySelector("#singularity"); const ctx = canvas.getContext("2d"); let particles = []; let stars = []; let raf; let width; let height; let dpr;
  const glyphs = [".","·","+","*",":","0","1","◦"];
  const reset = () => {
    dpr = Math.min(devicePixelRatio || 1, 2); width = innerWidth; height = innerHeight; canvas.width = width*dpr; canvas.height = height*dpr; ctx.setTransform(dpr,0,0,dpr,0,0);
    const count = Math.min(1500, Math.floor(width*1.15));
    particles = Array.from({length:count}, (_,i) => ({ angle:Math.random()*Math.PI*2, radius:54+Math.pow(Math.random(),.7)*Math.min(width*.39,520), speed:.00035+Math.random()*.0013, size:Math.random()<.84?1:2, band:(Math.random()-.5)*Math.pow(Math.random(),1.7)*115, alpha:.12+Math.random()*.72, glyph:glyphs[i%glyphs.length] }));
    stars = Array.from({length:Math.floor(width/9)}, () => ({x:Math.random()*width,y:Math.random()*height,a:.08+Math.random()*.3,s:Math.random()<.9?1:2}));
  };
  const draw = (time=0) => {
    ctx.clearRect(0,0,width,height); const cx=width*.56, cy=height*.43, tilt=-.08;
    stars.forEach(s=>{ctx.fillStyle=`rgba(210,218,218,${s.a*(.7+.3*Math.sin(time*.001+s.x))})`;ctx.fillRect(s.x,s.y,s.s,s.s)});
    ctx.save(); ctx.translate(cx,cy); ctx.rotate(tilt);
    const glow=ctx.createRadialGradient(0,0,28,0,0,Math.min(width*.32,380)); glow.addColorStop(0,"rgba(0,0,0,1)");glow.addColorStop(.18,"rgba(0,0,0,1)");glow.addColorStop(.28,"rgba(201,207,204,.12)");glow.addColorStop(1,"rgba(201,207,204,0)");ctx.fillStyle=glow;ctx.beginPath();ctx.ellipse(0,0,Math.min(width*.34,420),Math.min(width*.12,125),0,0,Math.PI*2);ctx.fill();
    particles.forEach((p,i)=>{p.angle+=p.speed; const squeeze=.28+Math.min(p.radius/900,.14); const x=Math.cos(p.angle)*p.radius; const y=Math.sin(p.angle)*p.radius*squeeze+p.band*(.25+Math.abs(Math.cos(p.angle))*.75); const front=Math.sin(p.angle)>.05; const fade=Math.min(1,(p.radius-48)/90); ctx.fillStyle=`rgba(${front?220:150},${front?222:159},${front?216:160},${p.alpha*fade*(front?1:.48)})`; if(i%9===0){ctx.font=`${7+p.size*2}px monospace`;ctx.fillText(p.glyph,x,y)}else ctx.fillRect(Math.round(x),Math.round(y),p.size,p.size);});
    ctx.fillStyle="#07090b";ctx.beginPath();ctx.ellipse(0,0,Math.min(width*.105,128),Math.min(width*.096,117),0,0,Math.PI*2);ctx.fill();ctx.strokeStyle="rgba(224,226,219,.3)";ctx.lineWidth=1;ctx.stroke();ctx.restore();
    raf=requestAnimationFrame(draw);
  };
  reset(); if(!matchMedia("(prefers-reduced-motion: reduce)").matches) draw(); else draw(0), cancelAnimationFrame(raf);
  addEventListener("resize",reset,{passive:true}); addEventListener("pagehide",()=>cancelAnimationFrame(raf));
})();
