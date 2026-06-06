export const Loader = () => {
  return (
    <div className="loader-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@500;700&display=swap');

        .loader-root {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: #FAFAFA;
          font-family: 'DM Sans', sans-serif;
        }

        /* ── Backdrop noise texture ── */
        .loader-root::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image:
            radial-gradient(circle at 20% 20%, rgba(255,89,52,0.06) 0%, transparent 50%),
            radial-gradient(circle at 80% 80%, rgba(255,89,52,0.04) 0%, transparent 50%);
          pointer-events: none;
        }

        /* ── Logo mark ── */
        .loader-logo {
          width: 52px;
          height: 52px;
          border-radius: 16px;
          background: #FF5934;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 28px;
          box-shadow: 0 8px 24px rgba(255,89,52,0.30);
          animation: loader-logo-pulse 2s ease-in-out infinite;
          position: relative;
          z-index: 1;
        }

        .loader-logo span {
          color: #fff;
          font-size: 22px;
          font-weight: 700;
          letter-spacing: -0.5px;
          line-height: 1;
          font-family: 'DM Sans', sans-serif;
        }

        @keyframes loader-logo-pulse {
          0%, 100% { box-shadow: 0 8px 24px rgba(255,89,52,0.30); transform: scale(1); }
          50%       { box-shadow: 0 12px 32px rgba(255,89,52,0.45); transform: scale(1.04); }
        }

        /* ── Track + animated bar ── */
        .loader-track-wrap {
          position: relative;
          z-index: 1;
          width: 180px;
          margin-bottom: 18px;
        }

        .loader-track {
          width: 100%;
          height: 3px;
          background: rgba(255,89,52,0.12);
          border-radius: 99px;
          overflow: hidden;
        }

        .loader-bar {
          height: 100%;
          width: 45%;
          background: linear-gradient(90deg, transparent, #FF5934, #ff8c6b, transparent);
          border-radius: 99px;
          animation: loader-slide 1.4s ease-in-out infinite;
        }

        @keyframes loader-slide {
          0%   { transform: translateX(-120%); }
          100% { transform: translateX(370%); }
        }

        /* ── Dots ── */
        .loader-dots {
          display: flex;
          align-items: center;
          gap: 6px;
          position: relative;
          z-index: 1;
          margin-bottom: 16px;
        }

        .loader-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #FF5934;
          animation: loader-dot-bounce 1.2s ease-in-out infinite;
        }

        .loader-dot:nth-child(1) { animation-delay: 0s;    opacity: 1;    }
        .loader-dot:nth-child(2) { animation-delay: 0.15s; opacity: 0.65; }
        .loader-dot:nth-child(3) { animation-delay: 0.3s;  opacity: 0.35; }

        @keyframes loader-dot-bounce {
          0%, 80%, 100% { transform: scale(1);    opacity: 0.35; }
          40%            { transform: scale(1.35); opacity: 1;    }
        }

        /* ── Label ── */
        .loader-label {
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #B0B7C3;
          position: relative;
          z-index: 1;
          animation: loader-fade-in 0.6s ease both;
        }

        @keyframes loader-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Logo mark */}
      <div className="loader-logo">
        <span>K</span>
      </div>

      {/* Sliding progress bar */}
      <div className="loader-track-wrap">
        <div className="loader-track">
          <div className="loader-bar" />
        </div>
      </div>

      {/* Bouncing dots */}
      <div className="loader-dots">
        <div className="loader-dot" />
        <div className="loader-dot" />
        <div className="loader-dot" />
      </div>

      {/* Label */}
      <p className="loader-label">Loading</p>
    </div>
  );
};