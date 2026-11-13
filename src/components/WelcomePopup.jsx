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
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 2rem;
        }

        .popup {
          background: rgba(24, 28, 38, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 20px;
          max-width: 600px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          position: relative;
          box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
          color: white;
        }

        .closeBtn {
          position: absolute;
          top: 1rem;
          right: 1rem;
          z-index: 10;
        }

        .closeBtn button {
          background: rgba(255, 255, 255, 0.1);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 50%;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .closeBtn button:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        h1 {
          text-align: center;
          color: #ffffff;
          margin: 2rem 2rem 0.5rem;
          font-size: 1.8rem;
          font-weight: 700;
        }

        .popupHeading {
          text-align: center;
          color: #94a3b8;
          margin: 0 2rem 2rem;
          font-size: 1.05rem;
        }

        .textHighlight {
          color: #60a5fa;
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
          color: #f1f5f9;
          margin-bottom: 0.5rem;
          font-size: 1.25rem;
          font-weight: 600;
        }

        .featureContent p {
          color: #94a3b8;
          line-height: 1.6;
          margin-bottom: 1rem;
        }

        .featureDetails {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 1rem;
        }

        .detailItem {
          margin: 0.5rem 0;
          color: #e2e8f0;
          font-size: 0.9rem;
        }

        .kbd {
          background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 6px;
          padding: 0.25rem 0.5rem;
          font-family: monospace;
          font-size: 0.8rem;
          color: #93c5fd;
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
          background: rgba(255, 255, 255, 0.25);
          cursor: pointer;
          transition: all 0.2s;
        }

        .indicatorHighlight {
          background: #3b82f6;
          transform: scale(1.2);
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
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btnClose {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: white;
        }

        .btnClose:hover {
          background: rgba(255, 255, 255, 0.18);
        }

        .btnNext {
          background: #2563eb;
          color: white;
        }

        .btnNext:hover {
          background: #1d4ed8;
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
