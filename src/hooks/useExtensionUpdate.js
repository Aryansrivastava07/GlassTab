import { useEffect, useState } from 'react';

const UPDATE_URL = 'https://aryansrivastava07.github.io/GlassTab/update.json';
const BUILD_ID = import.meta.env.VITE_BUILD_ID;

export default function useExtensionUpdate() {
  const [update, setUpdate] = useState(null);

  useEffect(() => {
    if (!globalThis.chrome?.runtime?.id || !/^[a-f0-9]{40}$/.test(BUILD_ID || '')) return;
    let cancelled = false;
    const check = async () => {
      try {
        const response = await fetch(UPDATE_URL, { cache: 'no-store' });
        if (!response.ok) return;
        const release = await response.json();
        if (!cancelled && /^[a-f0-9]{40}$/.test(release.buildId) && release.buildId !== BUILD_ID) {
          setUpdate({ buildId: release.buildId, version: release.version });
        }
      } catch {
        // Updates are optional while offline.
      }
    };
    check();
    const timer = setInterval(check, 60 * 60 * 1000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  return update;
}
