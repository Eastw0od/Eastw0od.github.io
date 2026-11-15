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

  function drawHaze(width, height) {
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
    context.drawImage(haze, 0, 0, width, height);
  }

  function drawSky() {
    const width = sky.clientWidth;
    const height = sky.clientHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    sky.width = Math.round(width * ratio);
    sky.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawHaze(width, height);

    const count = Math.round(width * height / 1750);
    for (let i = 0; i < count; i++) {
      const x = hash(i + 1, 19) * width;
      const y = hash(i + 1, 207) * height;
      const magnitude = hash(i + 1, 133);
      const radius = 0.35 + Math.pow(magnitude, 5) * 1.15;
      const alpha = 0.17 + Math.pow(magnitude, 3) * 0.58;
      const color = i % 5 === 0 ? "249,205,159" : "191,214,249";

      if (magnitude > 0.986) {
        const glow = context.createRadialGradient(x, y, 0, x, y, 5);
        glow.addColorStop(0, `rgba(${color},0.22)`);
        glow.addColorStop(1, `rgba(${color},0)`);
        context.fillStyle = glow;
        context.fillRect(x - 5, y - 5, 10, 10);
      }
      context.fillStyle = `rgba(${color},${alpha})`;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
  }

  new ResizeObserver(drawSky).observe(sky);
})();
