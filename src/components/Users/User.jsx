import { NavLink } from 'react-router-dom';

const User = () => {
  const userDetails = JSON.parse(sessionStorage.getItem("karyana-admin"));
  const isCoordinator = userDetails?.role === "coordinator";

  const navItems = [
    ...(!isCoordinator
      ? [{ to: "/Users/Coordinators", label: "Coordinators", icon: "👥" }]
      : []),
    { to: "/Users/WarehouseManagers", label: "Warehouse Managers", icon: "🏭" },
    { to: "/Users/Sales", label: "Sales Person", icon: "💼" },
    { to: "/Users/Retailers", label: "Customer", icon: "🛒" },
  ];

  return (
    <>
      {/* <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');

        .user-nav-wrapper {
          font-family: 'DM Sans', sans-serif;
          padding: 6px;
          background: #ffffff;
          border-radius: 16px;
          display: inline-flex;
          gap: 4px;
          box-shadow:
            0 1px 2px rgba(0,0,0,0.04),
            0 4px 16px rgba(0,0,0,0.06),
            inset 0 1px 0 rgba(255,255,255,0.9);
          border: 1px solid rgba(0,0,0,0.07);
          position: relative;
        }

        .user-nav-wrapper::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 16px;
          background: linear-gradient(135deg, rgba(255,89,52,0.03) 0%, transparent 60%);
          pointer-events: none;
        }

        .nav-item-link {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 9px 18px;
          border-radius: 11px;
          font-size: 13.5px;
          font-weight: 500;
          color: #5a5f6e;
          text-decoration: none;
          white-space: nowrap;
          letter-spacing: -0.01em;
          transition:
            background 0.18s ease,
            color 0.18s ease,
            box-shadow 0.18s ease,
            transform 0.15s ease;
          position: relative;
          cursor: pointer;
        }

        .nav-item-link:hover {
          background: rgba(255, 89, 52, 0.07);
          color: #FF5934;
          transform: translateY(-1px);
        }

        .nav-item-link.active {
          background: linear-gradient(135deg, #FF5934 0%, #ff7a5a 100%);
          color: #ffffff;
          box-shadow:
            0 2px 8px rgba(255, 89, 52, 0.35),
            0 1px 2px rgba(255, 89, 52, 0.2);
          transform: translateY(-1px);
        }

        .nav-item-link.active:hover {
          background: linear-gradient(135deg, #e84e2b 0%, #ff6a47 100%);
          box-shadow:
            0 4px 12px rgba(255, 89, 52, 0.45),
            0 2px 4px rgba(255, 89, 52, 0.25);
        }

        .nav-icon {
          font-size: 14px;
          line-height: 1;
          opacity: 0.85;
          transition: transform 0.2s ease;
        }

        .nav-item-link:hover .nav-icon,
        .nav-item-link.active .nav-icon {
          transform: scale(1.15);
          opacity: 1;
        }

        .nav-divider {
          width: 1px;
          background: rgba(0,0,0,0.07);
          margin: 6px 2px;
          align-self: stretch;
          border-radius: 1px;
        }

        @media (max-width: 640px) {
          .user-nav-wrapper {
            flex-wrap: wrap;
            border-radius: 14px;
          }
          .nav-item-link {
            font-size: 13px;
            padding: 8px 13px;
          }
        }
      `}</style>

      <div className="user-nav-wrapper">
        {navItems.map((item, index) => (
          <div key={item.to} style={{ display: 'contents' }}>
            {index > 0 && <div className="nav-divider" />}
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                `nav-item-link${isActive ? ' active' : ''}`
              }
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          </div>
        ))}
      </div> */}
    </>
  );
};

export default User;