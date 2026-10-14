import { useEffect, useState } from 'react';

export function useToast(): [string | null, (msg: string) => void] {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2200);
    return () => clearTimeout(t);
  }, [msg]);
  return [msg, setMsg];
}

export default function Toast({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <div className="toast" role="status">{msg}</div>;
}
