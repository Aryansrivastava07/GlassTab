import { useEffect, useState } from 'react';
import { getStoredFeatures } from '../utils/featureToggleService';

export default function useReducedMotion() {
  const [reduced, setReduced] = useState(() => getStoredFeatures().reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(getStoredFeatures().reducedMotion || query.matches);
    query.addEventListener('change', update);
    window.addEventListener('landing_features_updated', update);
    return () => {
      query.removeEventListener('change', update);
      window.removeEventListener('landing_features_updated', update);
    };
  }, []);
  return reduced;
}
