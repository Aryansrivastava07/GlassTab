import { faces, setClockPreference, useClockPreferences } from '../utils/clockPreferences';

const zones = [...new Set(['UTC', ...(Intl.supportedValuesOf?.('timeZone') ||
  ['America/New_York', 'Europe/London', 'Asia/Kolkata', 'Asia/Tokyo', 'Australia/Sydney'])])];

export default function ClockSettings() {
  const options = useClockPreferences();
  const selectClass = 'mt-1 w-full rounded-lg border border-white/20 bg-slate-900 p-2 text-white';
  return <fieldset className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white space-y-3">
    <legend className="px-1 font-semibold">Clock</legend>
    <label className="block">Clock face
      <select className={selectClass} value={options.face} onChange={e => setClockPreference('face', e.target.value)}>
        {Object.entries(faces).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select>
    </label>
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
