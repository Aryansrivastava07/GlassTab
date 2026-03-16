import React from 'react';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="social">
        <a
          href="https://www.instagram.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="socialLink"
          aria-label="Instagram"
        >
          <div className="socialMedia instagram"></div>
        </a>
        <a
          href="https://www.facebook.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="socialLink"
          aria-label="Facebook"
        >
          <div className="socialMedia facebook"></div>
        </a>
        <a
          href="https://in.linkedin.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="socialLink"
          aria-label="LinkedIn"
        >
          <div className="socialMedia linkedin"></div>
        </a>
        <a
          href="https://web.whatsapp.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="socialLink"
          aria-label="WhatsApp"
        >
          <div className="socialMedia whatsapp"></div>
        </a>
      </div>
      
      <div className="footerText">
        <p>© 2022-2025</p>
        <p>
          Created by{' '}
          <a
            href="https://aryansrivastava07.github.io/landing-page/html/"
            target="_blank"
            rel="noopener noreferrer"
            className="authorLink"
          >
            Aryan Srivastava
          </a>
        </p>
      </div>

      <style>{`
        .footer {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(10px);
          padding: 1rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 -4px 6px rgba(0, 0, 0, 0.1);
          z-index: 100;
        }

        .social {
          display: flex;
          gap: 1rem;
        }

        .socialLink {
          text-decoration: none;
          display: block;
          transition: transform 0.2s;
        }

        .socialLink:hover {
          transform: scale(1.1);
        }

        .socialMedia {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          transition: box-shadow 0.2s;
        }

        .socialMedia:hover {
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }

        .instagram {
          background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%);
          position: relative;
        }

        .instagram::before {
          content: '📷';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 16px;
        }

        .facebook {
          background: #1877f2;
          position: relative;
        }

        .facebook::before {
          content: 'f';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: white;
          font-weight: bold;
          font-size: 18px;
          font-family: Arial, sans-serif;
        }

        .linkedin {
          background: #0077b5;
          position: relative;
        }

        .linkedin::before {
          content: 'in';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: white;
          font-weight: bold;
          font-size: 12px;
          font-family: Arial, sans-serif;
        }

        .whatsapp {
          background: #25d366;
          position: relative;
        }

        .whatsapp::before {
          content: '💬';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 16px;
        }

        .footerText {
          text-align: center;
          color: #6b7280;
          font-size: 0.875rem;
        }

        .footerText p {
          margin: 0;
          line-height: 1.4;
        }

        .authorLink {
          color: #3b82f6;
          text-decoration: none;
          font-weight: 500;
        }

        .authorLink:hover {
          text-decoration: underline;
        }

        @media (max-width: 768px) {
          .footer {
            flex-direction: column;
            gap: 1rem;
            padding: 1.5rem;
          }

          .footerText {
            order: -1;
          }
        }
      `}</style>
    </footer>
  );
};

export default Footer;
