(() => {
  if (new URLSearchParams(window.location.search).get("look") === "mono") {
    document.documentElement.dataset.blackHoleLook = "mono";
  }
  const sky = document.querySelector(".hero-sky");
  const context = sky.getContext("2d");
  const haze = document.createElement("canvas");
  const hazeContext = haze.getContext("2d");
  if (!context || !hazeContext) return;

  function hash(x, y) {
    const bits = Math.imul(x, 0x9e3779b1) ^ Math.imul(y, 0x85ebca6b);
    return (Math.imul(bits ^ (bits >>> 16), 0x7feb352d) >>> 0) / 4294967296;
  }

  function noise(x, y) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const top = hash(ix, iy) * (1 - sx) + hash(ix + 1, iy) * sx;
    const bottom = hash(ix, iy + 1) * (1 - sx) + hash(ix + 1, iy + 1) * sx;
    return top * (1 - sy) + bottom * sy;
  }

  let width = 0;
  let height = 0;
  let ratio = 1;
  let stars = [];
  let pointerX = 0;
  let pointerY = 0;
  let parallaxX = 0;
  let parallaxY = 0;
  let frame = 0;
  let previous = 0;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

  function drawHaze() {
    haze.width = 240;
    haze.height = Math.max(84, Math.min(240, Math.round(240 * height / width)));
    const field = hazeContext.createImageData(haze.width, haze.height);
    for (let y = 0; y < haze.height; y++) {
      for (let x = 0; x < haze.width; x++) {
        const u = x / haze.width;
        const v = y / haze.height;
        const drift = noise(7 * u + 5, 7 * v + 11);
        const rift = v - (0.82 - 0.60 * u + 0.21 * (drift - 0.5));
        const band = Math.exp(-Math.pow(rift / 0.20, 2));
        const clouds = 0.54 * noise(17 * u + 9, 8 * v + 21)
          + 0.29 * noise(36 * u + 2, 20 * v + 6)
          + 0.17 * noise(83 * u + 14, 62 * v);
        const light = 0.85 * band * Math.pow(clouds, 1.7);
        const i = (y * haze.width + x) * 4;
        field.data[i] = 36 + 25 * drift;
        field.data[i + 1] = 54 + 3 * drift;
        field.data[i + 2] = 91 - 19 * drift;
        field.data[i + 3] = 255 * light;
      }
    }
    hazeContext.putImageData(field, 0, 0);
  }

  function resizeSky() {
    width = sky.clientWidth;
    height = sky.clientHeight;
    ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    sky.width = Math.round(width * ratio);
    sky.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const count = Math.round(width * height / 1750);
    stars = Array.from({ length: count }, (_, i) => {
      const magnitude = hash(i + 1, 133);
      return {
        x: hash(i + 1, 19) * width,
        y: hash(i + 1, 207) * height,
        radius: 0.34 + Math.pow(magnitude, 5) * 1.22,
        alpha: 0.13 + Math.pow(magnitude, 3) * 0.64,
        color: i % 5 === 0 ? "249,205,159" : "191,214,249",
        phase: hash(i + 1, 577) * Math.PI * 2,
        frequency: 0.00032 + hash(i + 1, 743) * 0.0011,
        drift: 0.0008 + hash(i + 1, 359) * 0.0028,
        layer: 0.25 + magnitude * 0.75,
        bright: magnitude > 0.972,
      };
    });
    drawHaze();
    drawSky(performance.now());
  }

  function drawSky(time) {
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    parallaxX += (pointerX - parallaxX) * 0.035;
    parallaxY += (pointerY - parallaxY) * 0.035;
    const motion = reduceMotion.matches ? 0 : 1;
    const hazeShift = Math.sin(time * 0.000018) * width * 0.018 * motion + parallaxX * 7;
    context.globalAlpha = 0.88 + Math.sin(time * 0.00007) * 0.05 * motion;
    context.drawImage(haze, hazeShift - width * 0.035, -height * 0.035 + parallaxY * 4, width * 1.07, height * 1.07);
    context.globalAlpha = 1;

    for (const star of stars) {
      const drift = time * star.drift * motion;
      const x = (star.x + drift + parallaxX * 11 * star.layer + width) % width;
      const y = (star.y + Math.sin(time * 0.000025 + star.phase) * 3 * star.layer * motion + parallaxY * 7 * star.layer + height) % height;
      const pulse = reduceMotion.matches ? 0.82 : 0.63
        + 0.24 * Math.sin(time * star.frequency + star.phase)
        + 0.13 * Math.sin(time * star.frequency * 0.37 + star.phase * 2.7);
      const alpha = star.alpha * Math.max(0.25, pulse);

      if (star.bright) {
        const glowRadius = 3.5 + star.layer * 3.5;
        const glow = context.createRadialGradient(x, y, 0, x, y, glowRadius);
        glow.addColorStop(0, `rgba(${star.color},${alpha * 0.36})`);
        glow.addColorStop(1, `rgba(${star.color},0)`);
        context.fillStyle = glow;
        context.fillRect(x - glowRadius, y - glowRadius, glowRadius * 2, glowRadius * 2);
        context.strokeStyle = `rgba(${star.color},${alpha * 0.24})`;
        context.lineWidth = 0.45;
        context.beginPath();
        context.moveTo(x - glowRadius * 0.7, y);
        context.lineTo(x + glowRadius * 0.7, y);
        context.moveTo(x, y - glowRadius * 0.7);
        context.lineTo(x, y + glowRadius * 0.7);
        context.stroke();
      }
      context.fillStyle = `rgba(${star.color},${alpha})`;
      context.beginPath();
      context.arc(x, y, star.radius, 0, Math.PI * 2);
      context.fill();
    }
  }

  function animate(time) {
    if (time - previous > 32) {
      drawSky(time);
      previous = time;
    }
    frame = requestAnimationFrame(animate);
  }

  function updatePointer(event) {
    const bounds = sky.getBoundingClientRect();
    pointerX = (event.clientX - bounds.left) / bounds.width - 0.5;
    pointerY = (event.clientY - bounds.top) / bounds.height - 0.5;
  }

  new ResizeObserver(resizeSky).observe(sky);
  sky.closest(".hero")?.addEventListener("pointermove", updatePointer, { passive: true });
  document.addEventListener("visibilitychange", () => {
    cancelAnimationFrame(frame);
    if (!document.hidden) frame = requestAnimationFrame(animate);
  });
  frame = requestAnimationFrame(animate);
})();
