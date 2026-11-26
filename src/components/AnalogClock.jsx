import { useEffect, useRef, useState } from 'react';
import './AnalogClock.css';
import { getGlassTheme, getGlassStyleForPart, getLuminance } from '../utils/glassThemeService';
import useReducedMotion from '../hooks/useReducedMotion';

const AnalogClock = () => {
  const containerRef = useRef(null);
  const [diameter, setDiameter] = useState(130);
  const [now, setNow] = useState(() => new Date());
  const [glassTheme, setGlassTheme] = useState(getGlassTheme);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const update = (event) => { if (event.detail) setGlassTheme(event.detail); };
    window.addEventListener('glassThemeUpdate', update);
    return () => window.removeEventListener('glassThemeUpdate', update);
  }, []);

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const size = Math.min(entry.contentRect.width, entry.contentRect.height);
      if (size > 50) setDiameter(Math.round(size));
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let timer;
    const tick = () => {
      clearTimeout(timer);
      if (document.hidden) return;
      setNow(new Date());
      const interval = reducedMotion ? 60_000 : 1_000;
      timer = setTimeout(tick, interval - Date.now() % interval);
    };
    tick();
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [reducedMotion]);

  const widgetTheme = glassTheme?.widgets;
  const isLightBg = getLuminance(widgetTheme?.color || '#000000') > 0.55;
  const timeLabel = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const rotation = (degrees) => ({ animation: 'none', rotate: `${degrees - 180}deg` });

  return (
    <div ref={containerRef} role="img" aria-label={`Current time: ${timeLabel}`} className="w-full h-full flex items-center justify-center overflow-hidden rounded-full">
      <div className="clock shrink-0" aria-hidden="true" style={{
        '--clock-diameter': `${diameter}px`, '--clock-size': `${diameter}px`,
        '--clock-face-filter': isLightBg ? 'none' : 'invert(1)',
        '--clock-hand-color': widgetTheme?.textColor || (isLightBg ? '#111827' : '#ffffff'),
        ...getGlassStyleForPart(widgetTheme),
      }}>
        <div>{Array.from({ length: 6 }, (_, index) => <div key={index} className="clockDial" />)}</div>
        <div>
          <div className="clockHand" id="minute" style={rotation(now.getMinutes() * 6)} />
          <div className="clockHand" id="hour" style={rotation((now.getHours() + now.getMinutes() / 60) * 30)} />
          {!reducedMotion && <div className="clockHand" id="second" style={rotation(now.getSeconds() * 6)} />}
        </div>
      </div>
    </div>
  );
};

export default AnalogClock;
