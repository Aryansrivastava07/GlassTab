import { useEffect, useRef } from 'react';

// Sky, horizon, deep water, glints and the position of the light on the water.
const skies = [
  ['Moonlit inlet', '#10192f', '#626e91', '#071827', '#c9dfff', .24],
  ['Copper tide', '#342a4f', '#ee996c', '#162636', '#ffdfaa', .72],
  ['Blue hour', '#152442', '#879bc6', '#101f38', '#d3dfff', .64],
  ['Rosewater', '#473450', '#e8a0a1', '#262239', '#ffe3d6', .28],
  ['Polar sea', '#102d44', '#87c2bf', '#0a222d', '#cffff2', .76],
  ['Amber coast', '#343746', '#d3a570', '#192b32', '#ffedb3', .33],
  ['Violet dusk', '#242243', '#ae92bd', '#182033', '#f3daff', .67],
];

function noise(i) {
  const value = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
}

export default function OceanWallpaper({ day, still }) {
  const ref = useRef(null);
  const scene = skies[day % skies.length];
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const [, sky, horizon, deep, light, sunX] = scene;
    const backdrop = document.createElement('canvas');
    const bg = backdrop.getContext('2d');
    let width, height, coast, frame, previous = 0, time = 0;

    function paintBackdrop() {
      // Cap the drawing buffer on large displays. CSS scales it to the viewport.
      const scale = Math.min(1, 1440 / Math.max(canvas.clientWidth, canvas.clientHeight, 1));
      width = canvas.width = backdrop.width = Math.max(1, Math.round(canvas.clientWidth * scale));
      height = canvas.height = backdrop.height = Math.max(1, Math.round(canvas.clientHeight * scale));
      coast = Math.round(height * .52);
      const wash = bg.createLinearGradient(0, 0, 0, height);
      wash.addColorStop(0, sky);
      wash.addColorStop(.52, horizon);
      wash.addColorStop(.53, sky);
      wash.addColorStop(1, deep);
      bg.fillStyle = wash;
      bg.fillRect(0, 0, width, height);
      const x = width * sunX, y = height * .36, radius = Math.min(width, height) * .04;
      const glow = bg.createRadialGradient(x, y, radius, x, y, radius * 6);
      glow.addColorStop(0, light + '70');
      glow.addColorStop(1, light + '00');
      bg.fillStyle = glow;
      bg.fillRect(0, 0, width, coast);
      bg.fillStyle = light;
      bg.beginPath();
      bg.arc(x, y, radius, 0, Math.PI * 2);
      bg.fill();
      for (let layer = 0; layer < 2; layer++) {
        bg.fillStyle = sky + (layer ? 'cc' : '66');
        bg.beginPath();
        bg.moveTo(0, coast);
        for (let x = 0; x <= width + 2; x += 2) {
          const u = x / width, phase = day + layer * 3;
          const ridge = Math.sin(u * 12 + phase) * .6 + Math.sin(u * 31 + phase) * .24 + Math.sin(u * 73 + phase) * .1;
          bg.lineTo(x, coast - height * (.025 + .021 * ridge) * (2 - layer));
        }
        bg.lineTo(width, coast);
        bg.fill();
      }
    }

    function draw() {
      ctx.drawImage(backdrop, 0, 0);
      // Wave fronts travel toward the viewer. Ripples widen and swell with depth.
      for (let i = 0; i < 46; i++) {
        const z = ((i + time * .85) % 46) / 46;
        const depth = z * z;
        const baseline = coast + depth * (height - coast + 20);
        const amplitude = height * (.0007 + .011 * depth);
        const wavelength = width * (.055 + .19 * depth);
        const phase = noise(i) * 25 - time * (.65 + noise(i + 3));
        const surface = x => baseline + amplitude * (Math.sin(x / wavelength + phase) + .38 * Math.sin(2.8 * x / wavelength - phase));
        ctx.lineWidth = .6 + 2.2 * depth;
        ctx.strokeStyle = light;
        ctx.globalAlpha = (.06 + .15 * noise(i + 4)) * Math.min(1, z * 40);
        ctx.beginPath();
        for (let x = 0; x <= width + 12; x += 12) ctx.lineTo(x, surface(x));
        ctx.stroke();
        // Broken reflections follow each moving crest beneath the sun.
        const center = width * sunX + wavelength * .23 * Math.sin(phase);
        ctx.globalAlpha *= 2.7;
        ctx.beginPath();
        for (let j = 0; j < 5; j++) {
          const x = center + (noise(i * 5 + j) - .5) * width * (.05 + .35 * depth);
          const end = x + width * (.004 + .04 * depth) * (.5 + noise(i + j));
          ctx.moveTo(x, surface(x));
          ctx.lineTo(end, surface(end));
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    function tick(now) {
      if (!previous || now - previous >= 40) {
        if (previous) time += Math.min(now - previous, 100) / 1000;
        previous = now;
        draw();
      }
      frame = requestAnimationFrame(tick);
    }
    function updatePlayback() {
      cancelAnimationFrame(frame);
      previous = 0;
      if (!still && !document.hidden) frame = requestAnimationFrame(tick);
    }
    function resize() { paintBackdrop(); draw(); }
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    updatePlayback();
    document.addEventListener('visibilitychange', updatePlayback);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('visibilitychange', updatePlayback);
    };
  }, [day, scene, still]);
  return <div className="wallpaper-container daily-landscape" aria-hidden="true" data-motion={!still}
    data-scene={scene[0]} style={{ background: 'linear-gradient(' + scene[1] + ', ' + scene[2] + ', ' + scene[3] + ')' }}>
    <canvas ref={ref} className="block h-full w-full" />
  </div>;
}
