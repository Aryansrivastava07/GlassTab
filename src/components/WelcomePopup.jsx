import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

const WelcomePopup = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentFeature, setCurrentFeature] = useState(0);

  useEffect(() => {
    // Show popup on first visit
    const hasVisited = localStorage.getItem('hasVisited');
    if (!hasVisited) {
      setIsOpen(true);
      localStorage.setItem('hasVisited', 'true');
    }
  }, []);

  const features = [
    {
      id: 1,
      title: 'Customize your favourite and Speed Dials.',
      description: 'Click on the + icon to add your favourite websites and speed dials.',
      icon: '➕',
      details: null
    },
    {
      id: 2,
      title: 'Search on any search engine',
      description: 'Add Special characters before your search keyterm to search on your preferred engine',
      icon: '🔍',
      details: [
        '"g " - Google',
        '"b " - Bing',
        '"y " - Youtube'
      ]
    },
    {
      id: 3,
      title: 'Use Shortcuts to be faster than others!',
      description: 'Boost your productivity with these shortcuts!',
      icon: '⌨️',
      details: [
        'Ctrl + Z - Undo your search query',
        'Ctrl + V - Paste last copied text in search box',
        'Shift + Backspace - Delete entire search query'
      ]
    },
    {
      id: 4,
      title: 'Real Time Weather and clock',
      description: 'Stay updated with the latest weather and time information directly on your landing page.',
      icon: '🌤️',
      details: null
    }
  ];

  const nextFeature = () => {
    setCurrentFeature((prev) => (prev + 1) % features.length);
  };

  const prevFeature = () => {
    setCurrentFeature((prev) => (prev - 1 + features.length) % features.length);
  };

  const goToFeature = (index) => {
    setCurrentFeature(index);
  };

  const closePopup = () => {
    setIsOpen(false);
  };

  if (!isOpen) return null;

  const current = features[currentFeature];

  return (
    <div className="popupOverlay">
      <div className="popup">
        <div className="closeBtn">
          <button type="button" onClick={closePopup}>
            <X size={24} />
          </button>
        </div>

        <h1>Welcome to Your Own Landing Page</h1>
        
        <div className="popupHeading">
          Let's Know about our <span className="textHighlight">USP</span> features!
        </div>

        <div className="features">
          <div className={`feature feature${current.id}`}>
            <div className="featureIcon">{current.icon}</div>
            <div className="featureContent">
              <h2>{current.title}</h2>
              <p>{current.description}</p>
              
              {current.details && (
                <div className="featureDetails">
                  {current.details.map((detail, index) => (
                    <p key={index} className="detailItem">
                      {detail.includes('Ctrl') || detail.includes('Shift') ? (
                        <span className="kbd">
                          {detail.split(' - ')[0]}
                        </span>
                      ) : (
                        detail
                      )}
                      {detail.includes(' - ') && (
                        <span> - {detail.split(' - ')[1]}</span>
                      )}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="carouselIndicators">
          {features.map((_, index) => (
            <li
              key={index}
              className={`indicator ${index === currentFeature ? 'indicatorHighlight' : ''}`}
              onClick={() => goToFeature(index)}
            />
          ))}
        </div>

        <div className="buttons">
          <button type="button" onClick={closePopup} className="btnClose">
            Close
          </button>
          <button type="button" onClick={nextFeature} className="btnNext">
            {currentFeature === features.length - 1 ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>

      <style>{`
        .popupOverlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 2rem;
        }

        .popup {
          background: white;
          border-radius: 20px;
          max-width: 600px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          position: relative;
          box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
        }

        .closeBtn {
          position: absolute;
          top: 1rem;
          right: 1rem;
          z-index: 10;
        }

        .closeBtn button {
          background: #f3f4f6;
          border: none;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.2s;
        }

        .closeBtn button:hover {
          background: #e5e7eb;
        }

        h1 {
          text-align: center;
          color: #1f2937;
          margin: 2rem 2rem 1rem;
          font-size: 2rem;
        }

        .popupHeading {
          text-align: center;
          color: #6b7280;
          margin: 0 2rem 2rem;
          font-size: 1.1rem;
        }

        .textHighlight {
          color: #3b82f6;
          font-weight: 600;
        }

        .features {
          padding: 0 2rem;
        }

        .feature {
          display: flex;
          align-items: flex-start;
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .featureIcon {
          font-size: 3rem;
          flex-shrink: 0;
        }

        .featureContent h2 {
          color: #1f2937;
          margin-bottom: 0.5rem;
          font-size: 1.25rem;
        }

        .featureContent p {
          color: #6b7280;
          line-height: 1.6;
          margin-bottom: 1rem;
        }

        .featureDetails {
          background: #f9fafb;
          border-radius: 8px;
          padding: 1rem;
        }

        .detailItem {
          margin: 0.5rem 0;
          color: #4b5563;
          font-size: 0.9rem;
        }

        .kbd {
          background: #e5e7eb;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          padding: 0.25rem 0.5rem;
          font-family: monospace;
          font-size: 0.8rem;
          margin-right: 0.5rem;
        }

        .carouselIndicators {
          display: flex;
          justify-content: center;
          gap: 0.5rem;
          padding: 1rem 2rem;
          list-style: none;
          margin: 0;
        }

        .indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #d1d5db;
          cursor: pointer;
          transition: background 0.2s;
        }

        .indicatorHighlight {
          background: #3b82f6;
        }

        .buttons {
          display: flex;
          gap: 1rem;
          padding: 1rem 2rem 2rem;
        }

        .btnClose, .btnNext {
          flex: 1;
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btnClose {
          background: #6b7280;
          color: white;
        }

        .btnClose:hover {
          background: #4b5563;
        }

        .btnNext {
          background: #3b82f6;
          color: white;
        }

        .btnNext:hover {
          background: #2563eb;
        }

        @media (max-width: 640px) {
          .feature {
            flex-direction: column;
            text-align: center;
          }

          .featureIcon {
            margin: 0 auto;
          }

          h1 {
            font-size: 1.5rem;
          }

          .popupHeading {
            font-size: 1rem;
          }
        }
      `}</style>
    </div>
  );
};

export default WelcomePopup;
