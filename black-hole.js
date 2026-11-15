// Browser integration adapted from the MIT-licensed glsl-black-hole viewer.
// Shader sources and the copyright notice are in vendor/glsl-black-hole.
(() => {
  const canvas = document.querySelector("#singularity");
  const scriptUrl = new URL(document.currentScript.src);
  const shaderNames = ["geometry", "emission", "blur", "composite"];
  const camera = { center: [0.5, 0.48], tilt: 0.09, scale: 27.5, inclination: 0.087, inner: 1.51 };
  const playbackRate = 0.4;
  const impactBreaks = [0, 2.4, 2.82, 22];
  const samplesPerBand = 1024;
  const impactSamples = 3 * samplesPerBand + 1;
  const angleSamples = 1025;
  const maxAngle = 10;
  let rayTable;

  function traceRayTable() {
    const table = new Float32Array(impactSamples * angleSamples);
    const angleStep = maxAngle / (angleSamples - 1);
    // Each ray stays in its starting plane. Schwarzschild symmetry lets the
    // camera reuse these paths and intersect the disk from any viewing angle.
    table.fill(1);
    for (let column = 1; column < impactSamples; column++) {
      const band = Math.min(2, Math.floor(column / samplesPerBand));
      const fraction = column / samplesPerBand - band;
      const impact = impactBreaks[band] + fraction * (impactBreaks[band + 1] - impactBreaks[band]);
      const force = -1.5 * impact * impact;
      let x = 80;
      let y = impact;
      let vx = -1;
      let vy = 0;
      let radius = Math.hypot(x, y);
      let angle = Math.atan2(y, x);
      let row = 0;

      while (row * angleStep < angle) table[row++ * impactSamples + column] = 1 / 96;
      for (let step = 0; step < 540 && row < angleSamples; step++) {
        if (radius < 1.015 || (radius > 85 && x * vx + y * vy > 0)) break;
        const dt = Math.max(0.012, Math.min(3, radius * 0.052));
        const startKick = force * dt * 0.5 / Math.pow(radius, 5);
        const halfVx = vx + x * startKick;
        const halfVy = vy + y * startKick;
        const nextX = x + halfVx * dt;
        const nextY = y + halfVy * dt;
        const nextRadius = Math.hypot(nextX, nextY);
        const nextAngle = angle + Math.atan2(x * nextY - y * nextX, x * nextX + y * nextY);
        while (row < angleSamples && row * angleStep <= nextAngle) {
          const t = (row * angleStep - angle) / (nextAngle - angle);
          table[row++ * impactSamples + column] = 1 / (radius + (nextRadius - radius) * t);
        }
        const endKick = force * dt * 0.5 / Math.pow(nextRadius, 5);
        vx = halfVx + nextX * endKick;
        vy = halfVy + nextY * endKick;
        x = nextX;
        y = nextY;
        radius = nextRadius;
        angle = nextAngle;
      }
      const beyondRay = radius < 1.015 ? 1 : 1 / 96;
      while (row < angleSamples) table[row++ * impactSamples + column] = beyondRay;
    }
    return table;
  }

  async function startBlackHole(signal) {
    const gl = canvas.getContext("webgl2", {
      alpha: true, antialias: false, depth: false, stencil: false,
    });
    if (!gl?.getExtension("EXT_color_buffer_float")) return;

    const shaders = await Promise.all(shaderNames.map(async (name) => {
      const url = new URL(`./vendor/glsl-black-hole/shaders/${name}.frag`, scriptUrl);
      url.search = scriptUrl.search;
      const response = await fetch(url, { signal });
      if (!response.ok) throw new Error(`Could not load ${name} shader (${response.status})`);
      return response.text();
    }));
    if (signal.aborted || gl.isContextLost()) return;

    function compile(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader));
      }
      return shader;
    }

    const vertex = compile(gl.VERTEX_SHADER, `#version 300 es
      void main() {
        vec2 point = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
        gl_Position = vec4(point * 2.0 - 1.0, 0.0, 1.0);
      }`);

    function link(source) {
      const fragment = compile(gl.FRAGMENT_SHADER, source.replace(
        "#version 330", "#version 300 es\nprecision highp float;\nprecision highp int;\nprecision highp sampler2D;",
      ));
      const program = gl.createProgram();
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      gl.deleteShader(fragment);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program));
      }
      const uniforms = {};
      for (let i = 0; i < gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS); i++) {
        const { name } = gl.getActiveUniform(program, i);
        uniforms[name] = gl.getUniformLocation(program, name);
      }
      return { program, uniforms };
    }

    const [geometry, emission, blur, composite] = shaders.map(link);
    gl.deleteShader(vertex);
    const rayTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, rayTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, impactSamples, angleSamples, 0, gl.RED, gl.FLOAT, rayTable ??= traceRayTable());
    let size = 0;
    let maps;
    let hdr;
    let bloom;
    let viewX = 0;
    let viewY = 0;
    let targetX = 0;
    let targetY = 0;
    let viewDirty = true;

    function makeTarget(side, count = 1, geometryMap = false) {
      const framebuffer = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      const textures = [];
      const attachments = [];
      for (let i = 0; i < count; i++) {
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        const filter = geometryMap ? gl.NEAREST : gl.LINEAR;
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texStorage2D(gl.TEXTURE_2D, 1, geometryMap ? gl.RGBA32F : gl.RGBA16F, side, side);
        const attachment = gl.COLOR_ATTACHMENT0 + i;
        gl.framebufferTexture2D(gl.FRAMEBUFFER, attachment, gl.TEXTURE_2D, texture, 0);
        textures.push(texture);
        attachments.push(attachment);
      }
      gl.drawBuffers(attachments);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error("Black hole framebuffer is incomplete");
      }
      return { framebuffer, textures, side };
    }

    function use(pass, target, time = 0) {
      gl.useProgram(pass.program);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target?.framebuffer ?? null);
      const side = target?.side ?? size;
      gl.viewport(0, 0, side, side);
      const { uResolution, uCenter, uTilt, uTime } = pass.uniforms;
      gl.uniform2f(uResolution ?? null, side, side);
      gl.uniform2f(uCenter ?? null, ...camera.center);
      gl.uniform1f(uTilt ?? null, camera.tilt + viewX * 0.06);
      gl.uniform1f(uTime ?? null, time);
    }

    function sample(pass, name, unit, texture) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(pass.uniforms[name], unit);
    }

    const draw = () => gl.drawArrays(gl.TRIANGLES, 0, 3);

    function resizeTargets() {
      const isNarrow = window.innerWidth <= 760;
      const pixelRatio = Math.max(isNarrow ? 1.3 : 1.6, (window.devicePixelRatio || 1) * 1.12);
      const cap = isNarrow ? 1280 : 1920;
      const nextSize = Math.min(cap, Math.max(320, Math.round(canvas.clientWidth * pixelRatio)));
      if (nextSize === size) return false;

      if (maps) {
        for (const target of [maps, hdr, ...bloom.flat()]) {
          gl.deleteFramebuffer(target.framebuffer);
          target.textures.forEach((texture) => gl.deleteTexture(texture));
        }
      }
      size = nextSize;
      canvas.width = canvas.height = size;
      maps = makeTarget(size, 3, true);
      hdr = makeTarget(size);
      bloom = [2, 4, 12, 24].map((divisor) => {
        const side = Math.floor(size / divisor);
        return [makeTarget(side), makeTarget(side)];
      });

      viewDirty = true;
      return true;
    }

    function updateOpticalMap() {
      use(geometry, maps);
      gl.uniform1f(geometry.uniforms.uScale, camera.scale);
      gl.uniform1f(geometry.uniforms.uInclination, camera.inclination + viewY * 0.073);
      gl.uniform1f(geometry.uniforms.uAzimuth, viewX * 0.24);
      gl.uniform1f(geometry.uniforms.uInner, camera.inner);
      gl.uniform4f(geometry.uniforms.uImpactBreaks, ...impactBreaks);
      gl.uniform1f(geometry.uniforms.uMaxAngle, maxAngle);
      sample(geometry, "uRays", 0, rayTexture);
      draw();
      viewDirty = false;
    }

    function render(time) {
      if (viewDirty) updateOpticalMap();
      use(emission, hdr, time);
      maps.textures.forEach((texture, i) => sample(emission, `uMap${i}`, i, texture));
      draw();

      let source = hdr.textures[0];
      for (const [horizontal, vertical] of bloom) {
        use(blur, horizontal);
        gl.uniform2f(blur.uniforms.uDirection, 1 / horizontal.side, 0);
        sample(blur, "uSource", 0, source);
        draw();
        use(blur, vertical);
        gl.uniform2f(blur.uniforms.uDirection, 0, 1 / vertical.side);
        sample(blur, "uSource", 0, horizontal.textures[0]);
        draw();
        source = vertical.textures[0];
      }

      use(composite, null, time);
      sample(composite, "uEmission", 0, hdr.textures[0]);
      bloom.forEach(([, target], i) => sample(composite, `uBloom${i}`, i + 1, target.textures[0]));
      draw();
    }

    resizeTargets();
    render(0);
    if (gl.getError() !== gl.NO_ERROR) throw new Error("Black hole render failed");
    canvas.classList.add("is-rendered");

    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    const hero = canvas.closest(".hero");
    let visible = true;
    let frame = 0;
    let lastFrame = 0;
    let time = 0;
    let resizeTimer;

    function animate(now) {
      if (gl.isContextLost()) return;
      if (now - lastFrame >= 1000 / 30) {
        const dt = Math.min((now - lastFrame) / 1000, 0.07);
        const ease = 1 - Math.exp(-8 * dt);
        if (Math.abs(targetX - viewX) > 0.0005 || Math.abs(targetY - viewY) > 0.0005) {
          viewX += (targetX - viewX) * ease;
          viewY += (targetY - viewY) * ease;
          viewDirty = true;
        }
        time = (time + dt * playbackRate) % 8;
        render(time);
        lastFrame = now;
      }
      frame = requestAnimationFrame(animate);
    }

    function syncAnimation() {
      cancelAnimationFrame(frame);
      if (visible && !document.hidden && !motion.matches && !gl.isContextLost()) {
        lastFrame = performance.now();
        frame = requestAnimationFrame(animate);
      }
    }

    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      syncAnimation();
    });
    visibilityObserver.observe(canvas);
    document.addEventListener("visibilitychange", syncAnimation, { signal });
    const resetView = () => { targetX = targetY = 0; };
    pointer.addEventListener("change", resetView, { signal });
    hero.addEventListener("pointerleave", resetView, { signal });
    hero.addEventListener("pointermove", (event) => {
      if (!pointer.matches || event.pointerType === "touch") return;
      const bounds = hero.getBoundingClientRect();
      targetX = 2 * (event.clientX - bounds.left) / bounds.width - 1;
      targetY = 1 - 2 * (event.clientY - bounds.top) / bounds.height;
    }, { passive: true, signal });
    motion.addEventListener("change", () => {
      if (motion.matches && !gl.isContextLost()) {
        resetView();
        viewX = viewY = 0;
        viewDirty = true;
        render(time);
      }
      syncAnimation();
    }, { signal });
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (!gl.isContextLost() && resizeTargets()) render(time);
      }, 180);
    }, { signal });
    signal.addEventListener("abort", () => {
      cancelAnimationFrame(frame);
      clearTimeout(resizeTimer);
      visibilityObserver.disconnect();
    }, { once: true });
    syncAnimation();
  }

  let session;
  function startSession() {
    session = new AbortController();
    const { signal } = session;
    startBlackHole(signal).catch((error) => {
      if (!signal.aborted) console.error("Black hole could not render:", error);
    });
  }

  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    session.abort();
    canvas.classList.remove("is-rendered");
  });
  canvas.addEventListener("webglcontextrestored", startSession);
  startSession();
})();
