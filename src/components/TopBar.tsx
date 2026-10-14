import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

export default function TopBar({ back, right }: { back?: string | true; right?: ReactNode }) {
  const nav = useNavigate();
  return (
    <div className="topbar">
      {back && (
        <button className="back" onClick={() => (back === true ? nav(-1) : nav(back))}>
          ‹ Back
        </button>
      )}
      <div className="grow" />
      {right}
    </div>
  );
}
