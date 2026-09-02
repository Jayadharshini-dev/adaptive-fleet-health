import React, { useState } from 'react';
import { ShieldCheck, UserCheck, Lock, Activity, AlertCircle } from 'lucide-react';
import type { UserSession } from '../types/fleet';
import { getApiBaseUrl } from '../services/api';

interface LoginPageProps {
  onLoginSuccess: (user: UserSession) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [selectedOperator, setSelectedOperator] = useState<'operator1' | 'operator2'>('operator1');
  const [username, setUsername] = useState('operator1');
  const [password, setPassword] = useState('demo123');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const selectOperatorCard = (op: 'operator1' | 'operator2') => {
    setSelectedOperator(op);
    setUsername(op);
    setPassword('demo123');
    setErrorMsg(null);
  };

  const handleSubmitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedUser = username.trim();
    const trimmedPass = password.trim();

    if (!trimmedUser || !trimmedPass) {
      setErrorMsg('Please enter both operator username and password.');
      return;
    }

    setIsLoading(true);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);

      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: trimmedUser,
          password: trimmedPass,
          selected_operator: selectedOperator,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const nowIso = new Date().toISOString();
        const userSession: UserSession = {
          username: data.user.username,
          full_name: data.user.full_name,
          role: data.user.role,
          token: data.token,
          login_timestamp: data.login_timestamp || nowIso,
        };
        localStorage.setItem('fleet_operator', JSON.stringify(userSession));
        onLoginSuccess(userSession);
        return;
      } else {
        setErrorMsg('Invalid operator credentials. Please check operator selection, username, and password.');
        setIsLoading(false);
        return;
      }
    } catch (err: any) {
      // Local verification fallback if server is unreachable
      if (
        ((selectedOperator === 'operator1' && trimmedUser === 'operator1') ||
         (selectedOperator === 'operator2' && trimmedUser === 'operator2')) &&
        trimmedPass === 'demo123'
      ) {
        const nowIso = new Date().toISOString();
        const fallbackUser: UserSession = trimmedUser === 'operator2'
          ? { username: 'operator2', full_name: 'Operator 02', role: 'Control Room B', token: 'bearer-operator2', login_timestamp: nowIso }
          : { username: 'operator1', full_name: 'Operator 01', role: 'Control Room A', token: 'bearer-operator1', login_timestamp: nowIso };

        localStorage.setItem('fleet_operator', JSON.stringify(fallbackUser));
        onLoginSuccess(fallbackUser);
        return;
      } else {
        setErrorMsg('Invalid operator credentials. Demo passwords: operator1 / demo123 or operator2 / demo123');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F6F2] flex items-center justify-center p-4 font-mono text-[#17191C]">
      <div className="w-full max-w-md bg-white border border-[#E2E0D8] rounded p-6 shadow-sm space-y-6">
        <div className="border-b border-[#E2E0D8] pb-4 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded bg-[#17191C] text-white mb-3">
            <Activity size={24} />
          </div>
          <h1 className="text-base font-bold tracking-widest uppercase text-[#17191C]">
            ADAPTIVE FLEET HEALTH
          </h1>
          <p className="text-xs text-[#59616A] font-sans mt-1">
            Concurrent Session Coordination & Telemetry Command Center
          </p>
        </div>

        <div>
          <span className="text-[11px] text-[#59616A] font-bold uppercase tracking-wider block mb-2">
            1. Select Operator Console
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => selectOperatorCard('operator1')}
              className={`flex flex-col items-center justify-center p-3 rounded border transition-all cursor-pointer text-center ${
                selectedOperator === 'operator1'
                  ? 'border-[#c2410c] bg-[#FFF7ED] text-[#c2410c] font-bold ring-1 ring-[#c2410c]'
                  : 'border-[#E2E0D8] bg-[#F7F6F2] text-[#17191C] hover:bg-[#F0EEE6]'
              }`}
            >
              <UserCheck size={18} className="text-[#c2410c] mb-1" />
              <span className="text-xs font-bold">OPERATOR A</span>
              <span className="text-[10px] text-[#59616A] font-sans">Control Room A</span>
            </button>

            <button
              type="button"
              onClick={() => selectOperatorCard('operator2')}
              className={`flex flex-col items-center justify-center p-3 rounded border transition-all cursor-pointer text-center ${
                selectedOperator === 'operator2'
                  ? 'border-[#16a34a] bg-[#F0FDF4] text-[#16a34a] font-bold ring-1 ring-[#16a34a]'
                  : 'border-[#E2E0D8] bg-[#F7F6F2] text-[#17191C] hover:bg-[#F0EEE6]'
              }`}
            >
              <UserCheck size={18} className="text-[#16a34a] mb-1" />
              <span className="text-xs font-bold">OPERATOR B</span>
              <span className="text-[10px] text-[#59616A] font-sans">Control Room B</span>
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="rounded border border-[#fca5a5] bg-[#fee2e2] p-3 text-xs text-[#dc2626] flex items-center gap-2 font-sans">
            <AlertCircle size={15} className="shrink-0 text-[#dc2626]" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmitLogin} className="space-y-4 pt-2 border-t border-[#E2E0D8]">
          <span className="text-[11px] text-[#59616A] font-bold uppercase tracking-wider block">
            2. Enter Operator Credentials
          </span>

          <div>
            <label className="text-[10px] uppercase text-[#59616A] font-bold block mb-1">
              Operator Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. operator1 or operator2"
              className="w-full rounded border border-[#E2E0D8] bg-[#F7F6F2] px-3 py-2 text-xs text-[#17191C] font-bold focus:border-[#17191C] focus:outline-hidden"
              required
            />
          </div>

          <div>
            <label className="text-[10px] uppercase text-[#59616A] font-bold block mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="e.g. demo123"
              className="w-full rounded border border-[#E2E0D8] bg-[#F7F6F2] px-3 py-2 text-xs text-[#17191C] font-bold focus:border-[#17191C] focus:outline-hidden"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 rounded bg-[#17191C] px-5 py-3 font-mono text-xs font-bold uppercase tracking-widest text-white hover:bg-[#c2410c] transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
          >
            <Lock size={14} />
            <span>AUTHENTICATE OPERATOR SESSION</span>
          </button>
        </form>

        <div className="pt-2 border-t border-[#E2E0D8] text-center text-[10px] text-[#7A838C] font-sans flex items-center justify-center gap-1">
          <ShieldCheck size={12} className="text-[#16a34a]" />
          <span>Authoritative Session Manager · SQLite Security Log</span>
        </div>
      </div>
    </div>
  );
};
