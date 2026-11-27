import { useEffect, useMemo, useRef, useState } from 'react';
import './AnalogClock.css';
import { getGlassTheme, getGlassStyleForPart, getLuminance } from '../utils/glassThemeService';
import useReducedMotion from '../hooks/useReducedMotion';
import { useClockPreferences } from '../utils/clockPreferences';

const AnalogClock = () => {
  const containerRef = useRef(null);
  const [diameter, setDiameter] = useState(130);
  const [now, setNow] = useState(() => new Date());
  const [glassTheme, setGlassTheme] = useState(getGlassTheme);
  const reducedMotion = useReducedMotion();
  const options = useClockPreferences();
  const showSeconds = options.seconds && !reducedMotion;
  const formats = useMemo(() => {
    const timeZone = options.zone || undefined;
    return {
      parts: new Intl.DateTimeFormat('en-GB', { timeZone, hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      date: new Intl.DateTimeFormat(undefined, { timeZone, month: 'short', day: 'numeric' }),
      label: new Intl.DateTimeFormat(undefined, { timeZone, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }),
    };
  }, [options.zone]);

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
      const interval = showSeconds ? 1_000 : 60_000;
      timer = setTimeout(tick, interval - Date.now() % interval);
    };
    tick();
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [showSeconds]);

  const widgetTheme = glassTheme?.widgets;
  const parts = Object.fromEntries(formats.parts.formatToParts(now).map(part => [part.type, part.value]));
  const date = formats.date.format(now);
  const timeLabel = formats.label.format(now) + (options.date ? ', ' + date : '');
  return (
    <div ref={containerRef} role="img" title={timeLabel} aria-label={`Current time: ${timeLabel}`} className="w-full h-full flex items-center justify-center overflow-hidden rounded-full">
      <ClockFace {...{ diameter, widgetTheme, options, parts, date, showSeconds }} />
    </div>
  );
};

export function ClockFace({ diameter, widgetTheme, options, parts, date, showSeconds }) {
  const hour = Number(parts.hour);
  const isLightBg = getLuminance(widgetTheme?.color || '#000000') > 0.55;
  const rotation = (degrees) => ({ animation: 'none', rotate: `${degrees - 180}deg` });

  return (
      <div className={`clock face-${options.face} shrink-0`} aria-hidden="true" style={{
        '--clock-diameter': `${diameter}px`, '--clock-size': `${diameter}px`,
        '--clock-face-filter': isLightBg ? 'none' : 'invert(1)',
        '--clock-hand-color': widgetTheme?.textColor || (isLightBg ? '#111827' : '#ffffff'),
        ...getGlassStyleForPart(widgetTheme),
      }}>
        {options.face === 'digital' ? <div className="digital-readout">
          <div className="digital-detail">{options.hour24 ? '24H' : hour < 12 ? 'AM' : 'PM'}{showSeconds && ' · ' + parts.second + 's'}</div>
          <div className="digital-time">{options.hour24 ? parts.hour : hour % 12 || 12}:{parts.minute}</div>
          {options.date && <div className="digital-detail">{date}</div>}
        </div> : <>
        {options.face === 'classic'
          ? <div>{Array.from({ length: 6 }, (_, index) => <div key={index} className="clockDial" />)}</div>
          : <svg viewBox="0 0 100 100" className="clock-indices">
              {Array.from({ length: 60 }, (_, i) => <line key={i} x1="50" x2="50" y1="4" y2={i % 5 ? 6 : 11}
                stroke="currentColor" strokeWidth={i % 5 ? 0.55 : 1.9} transform={`rotate(${i * 6} 50 50)`} />)}
              {options.face === 'roman' && ['XII', 'III', 'VI', 'IX'].map((n, i) =>
                <text key={n} x={[50, 80, 50, 20][i]} y={[21, 51, 82, 51][i]}>{n}</text>)}
            </svg>}
        {options.date && <span className="analog-date">{date}</span>}
        <div>
          <div className="clockHand clock-minute" style={rotation(Number(parts.minute) * 6)} />
          <div className="clockHand clock-hour" style={rotation((hour + Number(parts.minute) / 60) * 30)} />
          {showSeconds && <div className="clockHand clock-second" style={rotation(Number(parts.second) * 6)} />}
        </div>
        </>}
      </div>
  );
}

export default AnalogClock;
