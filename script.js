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

  const canvas = document.querySelector("#singularity");
  const gl = canvas.getContext("webgl", { alpha: false, antialias: false, powerPreference: "high-performance" });
  if (!gl) { canvas.style.background = "radial-gradient(circle at 72% 45%, #07090c 0 11%, #6f466c 11.5%, #10222c 15%, #030405 38%)"; return; }
  const vertex = `attribute vec2 p; void main(){gl_Position=vec4(p,0.,1.);}`;
  const fragment = `
    precision highp float;
    uniform vec2 resolution;
    uniform vec2 pointer;
    uniform float time;
    float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
    float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+13.1;a*=.5;}return v;}
    void main(){
      vec2 uv=(gl_FragCoord.xy*2.-resolution)/min(resolution.x,resolution.y);
      float desktop=step(1.15,resolution.x/resolution.y);
      vec2 center=vec2(mix(0.,.48,desktop),.04)+pointer*vec2(.025,.018);
      vec2 q=uv-center;
      float cs=cos(-.10),sn=sin(-.10);q=mat2(cs,-sn,sn,cs)*q;
      float stars=step(.9965,hash(floor((uv+4.)*180.)))*(.25+.75*hash(floor((uv+1.)*97.)));
      vec3 col=vec3(stars)*vec3(.55,.72,.78);
      float hole=length(q);
      float er=length(vec2(q.x,q.y/0.27));
      float angle=atan(q.y/.27,q.x);
      float flow=fbm(vec2(angle*2.4-time*.18,log(er+0.08)*8.0));
      flow+=.42*fbm(vec2(angle*7.0+time*.09,er*22.0));
      float disk=smoothstep(1.18,.18,er)*smoothstep(.165,.245,er);
      disk*=smoothstep(.18,.62,flow+.26);
      float streak=.42+.58*pow(max(0.,sin(angle*22.-time*1.4+flow*7.)),6.);
      disk*=mix(.38,1.,streak);
      vec3 cyan=vec3(.18,.78,.92),pink=vec3(1.,.28,.67),violet=vec3(.42,.23,.92);
      vec3 diskColor=mix(cyan,pink,smoothstep(-.6,.75,q.x));
      diskColor=mix(diskColor,violet,smoothstep(.34,1.05,er)*.55);
      float front=smoothstep(-.04,.13,q.y);
      col+=diskColor*disk*(.42+1.35*front);
      float lens=exp(-abs(hole-.205)*78.)*(.45+1.35*smoothstep(-.3,.25,q.y));
      col+=mix(cyan,pink,.55)*lens*.72;
      float upperArc=exp(-abs(length(vec2(q.x,q.y-.145))-.255)*92.)*smoothstep(-.12,.2,q.y);
      col+=mix(cyan,pink,smoothstep(-.25,.38,q.x))*upperArc*.58;
      float halo=exp(-hole*7.5)*.16+exp(-hole*18.)*.12;
      col+=mix(cyan,pink,.52)*halo*smoothstep(.17,.24,hole);
      float shadow=1.-smoothstep(.17,.188,hole);col*=1.-shadow;
      col*=.94+.12*hash(gl_FragCoord.xy*.71);
      col=1.-exp(-col*1.65);
      gl_FragColor=vec4(col,1.);
    }`;
  const compile = (type, source) => { const shader=gl.createShader(type); gl.shaderSource(shader,source); gl.compileShader(shader); if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader)); return shader; };
  let program;
  try { program=gl.createProgram(); gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex)); gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment)); gl.linkProgram(program); if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program)); } catch (error) { console.error("Black hole shader failed",error); return; }
  gl.useProgram(program);
  const buffer=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buffer); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  const position=gl.getAttribLocation(program,"p"); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
  const uResolution=gl.getUniformLocation(program,"resolution"),uPointer=gl.getUniformLocation(program,"pointer"),uTime=gl.getUniformLocation(program,"time");
  let targetX=0,targetY=0,mouseX=0,mouseY=0,raf;
  const resize=()=>{const dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(innerWidth*dpr);canvas.height=Math.round(innerHeight*dpr);gl.viewport(0,0,canvas.width,canvas.height);gl.uniform2f(uResolution,canvas.width,canvas.height);};
  const render=(now)=>{mouseX+=(targetX-mouseX)*.045;mouseY+=(targetY-mouseY)*.045;gl.uniform2f(uPointer,mouseX,mouseY);gl.uniform1f(uTime,now*.001);gl.drawArrays(gl.TRIANGLES,0,3);raf=requestAnimationFrame(render);};
  addEventListener("pointermove",(event)=>{targetX=event.clientX/innerWidth*2-1;targetY=1-event.clientY/innerHeight*2;},{passive:true});
  addEventListener("resize",resize,{passive:true});addEventListener("pagehide",()=>cancelAnimationFrame(raf));resize();
  if(matchMedia("(prefers-reduced-motion: reduce)").matches){render(8000);cancelAnimationFrame(raf);}else{raf=requestAnimationFrame(render);}
})();
