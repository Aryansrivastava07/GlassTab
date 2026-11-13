import React, { useEffect, useRef, useState } from "react";
import "./AnalogClock.css";
import { getGlassTheme, getGlassStyleForPart, getLuminance } from "../utils/glassThemeService";

const AnalogClock = () => {
  const containerRef = useRef(null);
  const [diameter, setDiameter] = useState(130);
  const [glassTheme, setGlassTheme] = useState(() => getGlassTheme());

  useEffect(() => {
    const handleUpdate = (e) => {
      if (e.detail) setGlassTheme(e.detail);
    };
    window.addEventListener('glassThemeUpdate', handleUpdate);
    return () => window.removeEventListener('glassThemeUpdate', handleUpdate);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const minDim = Math.min(entry.contentRect.width, entry.contentRect.height);
        if (minDim > 50) {
          setDiameter(Math.round(minDim));
        }
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const setInitialTime = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const seconds = now.getSeconds();

      const hourHand = document.getElementById("hour");
      const minuteHand = document.getElementById("minute");
      const secondHand = document.getElementById("second");

      if (hourHand && minuteHand && secondHand) {
        hourHand.style.setProperty(
          "--hr-deg-start",
          `${(hours + minutes / 60) * 30 - 180}deg`,
        );
        hourHand.style.setProperty(
          "--hr-deg-end",
          `${(hours + minutes / 60) * 30 + 180}deg`,
        );

        minuteHand.style.setProperty(
          "--mn-deg-start",
          `${(minutes + seconds / 60) * 6 - 180}deg`,
        );
        minuteHand.style.setProperty(
          "--mn-deg-end",
          `${(minutes + seconds / 60) * 6 + 180}deg`,
        );

        secondHand.style.setProperty(
          "--sc-deg-start",
          `${seconds * 6 - 180}deg`,
        );
        secondHand.style.setProperty("--sc-deg-end", `${seconds * 6 + 180}deg`);
      }
    };

    setInitialTime();
  }, []);

  const widgetTheme = glassTheme?.widgets;
  const isLightBg = getLuminance(widgetTheme?.color || '#000000') > 0.55;
  const faceFilter = isLightBg ? 'none' : 'invert(1)';
  const handColor = widgetTheme?.textColor || (isLightBg ? '#111827' : '#ffffff');

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center overflow-hidden rounded-full">
      <div
        className="clock shrink-0"
        style={{
          "--clock-diameter": `${diameter}px`,
          "--clock-size": `${diameter}px`,
          "--clock-face-filter": faceFilter,
          "--clock-hand-color": handColor,
          ...getGlassStyleForPart(widgetTheme),
        }}
      >
        <div>
          <div className="clockDial"></div>
          <div className="clockDial"></div>
          <div className="clockDial"></div>
          <div className="clockDial"></div>
          <div className="clockDial"></div>
          <div className="clockDial"></div>
        </div>
        <div>
          <div className="clockHand" id="minute"></div>
          <div className="clockHand" id="hour"></div>
          <div className="clockHand" id="second"></div>
        </div>
      </div>
    </div>
  );
};

export default AnalogClock;
