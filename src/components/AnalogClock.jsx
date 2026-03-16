import React, { useEffect } from "react";
import "./AnalogClock.css";

const AnalogClock = () => {
  useEffect(() => {
    // Set the initial time when component mounts
    const setInitialTime = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const seconds = now.getSeconds();

      const hourHand = document.getElementById("hour");
      const minuteHand = document.getElementById("minute");
      const secondHand = document.getElementById("second");

      if (hourHand && minuteHand && secondHand) {
        // Set CSS custom properties for animations
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

    // Set initial time immediately
    setInitialTime();

    // Update every second to keep animations in sync
    // const interval = setInterval(setInitialTime, 1000);

    // return () => clearInterval(interval);
  }, []);

  return (
    <div className="clock ">
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
  );
};

export default AnalogClock;
