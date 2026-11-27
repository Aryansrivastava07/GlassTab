import { Check } from 'lucide-react';
import { ClockFace } from './AnalogClock';
import { getGlassTheme } from '../utils/glassThemeService';
import { faces, setClockPreference, useClockPreferences } from '../utils/clockPreferences';

const zones = [...new Set(['UTC', ...(Intl.supportedValuesOf?.('timeZone') ||
  ['America/New_York', 'Europe/London', 'Asia/Kolkata', 'Asia/Tokyo', 'Australia/Sydney'])])];

export default function ClockSettings() {
  const options = useClockPreferences();
  const widgetTheme = getGlassTheme().widgets;
  const selectClass = 'mt-1 w-full rounded-lg border border-white/20 bg-slate-900 p-2 text-white';
  return <fieldset className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white space-y-3">
    <legend className="px-1 font-semibold">Clock</legend>
    <fieldset>
      <legend className="mb-2 font-medium">Clock face</legend>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(faces).map(([id, name]) => (
          <label key={id} className="relative cursor-pointer">
            <input className="peer sr-only" type="radio" name="clock-face" value={id}
              checked={options.face === id} onChange={() => setClockPreference('face', id)} />
            <span className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-3 transition-colors hover:bg-white/10 peer-checked:border-sky-400 peer-checked:bg-sky-400/10 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sky-300">
              <ClockFace diameter={60} widgetTheme={widgetTheme} options={{ ...options, face: id, date: false }}
                parts={{ hour: '10', minute: '10', second: '30' }} showSeconds={options.seconds} />
              <span className="text-xs font-medium">{name}</span>
            </span>
            {options.face === id && <Check aria-hidden="true" size={14} className="absolute right-2 top-2 text-sky-300" />}
          </label>
        ))}
      </div>
    </fieldset>
    <label className="block">Time zone
      <select className={selectClass} value={options.zone} onChange={e => setClockPreference('zone', e.target.value)}>
        <option value="">Device time zone</option>
        {zones.map(zone => <option key={zone} value={zone}>{zone.replaceAll('_', ' ')}</option>)}
      </select>
    </label>
    {Object.entries({ seconds: 'Show seconds', date: 'Show date', ...(options.face === 'digital' && { hour24: '24-hour time' }) }).map(([key, label]) =>
      <label key={key} className="flex items-center gap-2">
        <input type="checkbox" checked={options[key]} onChange={e => setClockPreference(key, e.target.checked)} />{label}
      </label>)}
  </fieldset>;
}
