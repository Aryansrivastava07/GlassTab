import React from 'react';
import PropTypes from 'prop-types';
import { Globe, Sparkles } from 'lucide-react';

/**
 * Interactive suggestion pills for URL auto-completion
 */
export const UrlSuggestions = ({ suggestions = [], onSelect, currentUrl = '' }) => {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-2 animate-fadeIn">
      <span className="text-[11px] text-white/50 flex items-center gap-1 font-medium select-none">
        <Sparkles size={11} className="text-amber-400/90" />
        Suggested:
      </span>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((item) => {
          const isSelected = currentUrl.trim().toLowerCase() === item.url.toLowerCase();
          return (
            <button
              key={item.url}
              type="button"
              onClick={() => onSelect(item.url)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] transition-all cursor-pointer font-mono ${
                isSelected
                  ? 'bg-blue-600/35 text-blue-200 border border-blue-400/60 shadow-sm'
                  : 'bg-white/10 hover:bg-white/20 text-white/80 hover:text-white border border-white/10'
              }`}
              title={`Click to set URL to ${item.url}`}
            >
              <Globe size={10} className={isSelected ? 'text-blue-300' : 'opacity-60'} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

UrlSuggestions.propTypes = {
  suggestions: PropTypes.arrayOf(
    PropTypes.shape({
      url: PropTypes.string.isRequired,
      label: PropTypes.string,
      name: PropTypes.string,
    })
  ),
  onSelect: PropTypes.func.isRequired,
  currentUrl: PropTypes.string,
};

export default UrlSuggestions;
