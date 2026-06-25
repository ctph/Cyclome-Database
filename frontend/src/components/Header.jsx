// components/Header.jsx
import React, { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAccount } from "../account/AccountProvider";

const navItems = [
  { to: "/", label: "Cyclome search", end: true },
  { to: "/cyclic-sequence-similarity", label: "Sequence similarity" },
  { to: "/criticl", label: "CritiCL" },
  { to: "/stop2melt", label: "STop2Melt" },
  { to: "/history", label: "History" },
];

const paperUrl =
  "https://www.biorxiv.org/content/biorxiv/early/2026/04/12/2026.04.08.717280.full.pdf";

const Header = () => {
  const [openDropdown, setOpenDropdown] = useState(null);
  const { session, loading, loginHref, logout } = useAccount();
  const visibleNavItems =
    session.mode === "user"
      ? navItems
      : navItems.filter((item) => item.to !== "/history");

  const accountLabel =
    session.mode === "user"
      ? session.user?.email || session.user?.displayName || "Signed in"
      : session.mode === "offline"
        ? "Account offline"
        : loading
          ? "Checking account"
          : "Guest";

  return (
    <header className="cyclome-header">
      <div className="brand">
        <div className="brand-copy">
          <Link className="brand-home" to="/">
            <h1>Cyclome</h1>
          </Link>
          <span>Cyclic peptide workbench within StructF.studio</span>
        </div>
      </div>

      <nav aria-label="Cyclome navigation">
        {visibleNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => (isActive ? "pill active" : "pill")}
          >
            {item.label}
          </NavLink>
        ))}

        <details
          className="nav-dropdown"
          open={openDropdown === "guide"}
          onToggle={(event) => {
            if (event.currentTarget.open) {
              setOpenDropdown("guide");
            }
          }}
        >
          <summary>Guide</summary>
          <div className="nav-panel">
            <strong>Use Cyclome</strong>
            <ol>
              <li>Search by PDB ID or peptide sequence to open a structure record.</li>
              <li>Inspect the 3D structure, metadata, melting profile, and cyclization state.</li>
              <li>Run sequence similarity, CritiCL, or STop2Melt jobs from the tool pages.</li>
            </ol>
            <p>Expensive model jobs use Turnstile verification before submission.</p>
          </div>
        </details>

        <a
          className="link"
          href="https://chowdhurylab.github.io/"
          target="_blank"
          rel="noopener noreferrer"
        >
          ChowdhuryLab
        </a>

        <a
          className="link"
          href={paperUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Paper
        </a>

        <div className="account-chip" aria-label="StructF account state">
          <span>{accountLabel}</span>
          {session.mode === "user" ? (
            <button type="button" onClick={logout} disabled={loading}>
              Sign out
            </button>
          ) : (
            <a href={loginHref}>Sign in</a>
          )}
        </div>
      </nav>
    </header>
  );
};

export default Header;
