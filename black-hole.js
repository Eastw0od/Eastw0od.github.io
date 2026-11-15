// Browser integration adapted from the MIT-licensed glsl-black-hole viewer.
// Shader sources and the copyright notice are in vendor/glsl-black-hole.
(() => {
  const canvas = document.querySelector("#singularity");
  const scriptUrl = document.currentScript.src;
  const shaderNames = ["geometry", "emission", "blur", "composite"];
  const camera = { center: [0.5, 0.48], tilt: 0.09, scale: 27.5, inclination: 0.072, inner: 1.51 };
  const playbackRate = 0.4;

  async function startBlackHole() {
    const gl = canvas.getContext("webgl2", {
      alpha: true, antialias: false, depth: false, stencil: false,
    });
    if (!gl?.getExtension("EXT_color_buffer_float")) return;

    const shaders = await Promise.all(shaderNames.map(async (name) => {
      const response = await fetch(new URL(`./vendor/glsl-black-hole/shaders/${name}.frag`, scriptUrl));
      if (!response.ok) throw new Error(`Could not load ${name} shader (${response.status})`);
      return response.text();
    }));
    if (gl.isContextLost()) return;

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
    let size = 0;
    let maps;
    let hdr;
    let bloom;

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
      gl.uniform1f(uTilt ?? null, camera.tilt);
      gl.uniform1f(uTime ?? null, time);
    }

    function sample(pass, name, unit, texture) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(pass.uniforms[name], unit);
    }

    const draw = () => gl.drawArrays(gl.TRIANGLES, 0, 3);

    function resizeTargets() {
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      const cap = window.innerWidth <= 760 ? 840 : 1280;
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

      // The optical map is shared by every frame at this resolution.
      use(geometry, maps);
      gl.uniform1f(geometry.uniforms.uScale, camera.scale);
      gl.uniform1f(geometry.uniforms.uInclination, camera.inclination);
      gl.uniform1f(geometry.uniforms.uInner, camera.inner);
      draw();
      return true;
    }

    function render(time) {
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
    let visible = true;
    let frame = 0;
    let lastFrame = 0;
    let time = 0;
    let resizeTimer;

    function animate(now) {
      if (now - lastFrame >= 1000 / 30) {
        time = (time + Math.min((now - lastFrame) / 1000, 0.07) * playbackRate) % 8;
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

    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      syncAnimation();
    }).observe(canvas);
    document.addEventListener("visibilitychange", syncAnimation);
    motion.addEventListener("change", syncAnimation);
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (!gl.isContextLost() && resizeTargets()) render(time);
      }, 180);
    });
    canvas.addEventListener("webglcontextlost", () => {
      cancelAnimationFrame(frame);
      clearTimeout(resizeTimer);
      canvas.classList.remove("is-rendered");
    });
    syncAnimation();
  }

  startBlackHole().catch((error) => console.error("Black hole could not render:", error));
})();
