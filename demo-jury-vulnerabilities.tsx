/**
 * JURY DEMO SHOWCASE - Vulnerable Full-Stack React & Node Application
 * 
 * This file contains intentional security vulnerabilities across:
 *  1. React JSX: Cross-Site Scripting (XSS) via dangerouslySetInnerHTML
 *  2. React/DOM: Reverse Tabnabbing via unvalidated target="_blank"
 *  3. React/DOM: XSS via javascript: URI pseudo-protocol
 *  4. Frontend Security: Hardcoded private production API keys & JWT secrets
 *  5. Node.js Backend: Remote Command Execution via child_process.exec()
 *  6. Node.js / Database: Raw SQL Injection via string interpolation
 *  7. Client Scripting: Insecure dynamic code execution via eval()
 */

import React, { useState, useEffect } from 'react';
import { exec } from 'child_process';

// VULNERABILITY 1: Hardcoded Secrets / Private API Keys in Frontend Bundle
export const PRODUCTION_CONFIG = {
  appName: "PayPortal Enterprise",
  environment: "production",
  apiKey: "sk-live-9928340192834019283401928340a1b2c3",
  jwtSecret: "super-secret-jwt-signing-key-production-998822"
};

// VULNERABILITY 2 & 3: React Component with XSS & Reverse Tabnabbing
export function UserProfileCard({ userBio, websiteUrl }: { userBio: string; websiteUrl: string }) {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    // VULNERABILITY 4: Insecure dynamic script execution
    const rawData = window.sessionStorage.getItem("cached_prefs") || '({})';
    const parsed = eval(`(${rawData})`);
    setProfile(parsed);
  }, []);

  return (
    <div className="user-profile-card">
      <h2>User Profile</h2>

      {/* VULNERABILITY 5: React XSS via dangerouslySetInnerHTML without DOMPurify */}
      <div 
        className="bio-section"
        dangerouslySetInnerHTML={{ __html: userBio }} 
      />

      {/* VULNERABILITY 6: Reverse Tabnabbing (missing rel="noopener noreferrer") */}
      <div className="links">
        <a href={websiteUrl} target="_blank">
          Visit Personal Website
        </a>

        {/* VULNERABILITY 7: javascript: pseudo-protocol navigation XSS */}
        <a href="javascript:alert('Session Hijacked: ' + document.cookie)">
          Export Diagnostic Logs
        </a>
      </div>
    </div>
  );
}

// VULNERABILITY 8: Node.js Backend Command Injection
export function runSystemDiagnostics(networkHost: string) {
  // Vulnerable shell interpolation: attacker passes "; rm -rf /" or "| cat /etc/passwd"
  exec(`ping -c 2 ${networkHost}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Diagnostic execution error: ${error.message}`);
      return;
    }
    console.log(`Results: ${stdout}`);
  });
}

// VULNERABILITY 9: Node.js / Express SQL Injection
export async function authenticateCustomer(dbClient: any, userEmail: string) {
  // Direct string interpolation into SQL query engine allows ' OR '1'='1 SQLi bypass
  const query = `SELECT id, email, role, password_hash FROM customers WHERE email = '${userEmail}'`;
  const result = await dbClient.query(query);
  return result.rows;
}

