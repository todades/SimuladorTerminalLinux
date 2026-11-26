// ============================================================
// 📬 INBOX — Mensajes recibidos del docente
// ============================================================

import { useState, useEffect, useMemo } from 'react';
import { getInbox, markAllRead, deleteMessage, Message } from '../engine/authEngine';
import { playSound } from '../utils/soundSynth';

interface InboxViewProps {
  email: string;
  onChanged?: () => void;
}

export default function InboxView({ email, onChanged }: InboxViewProps) {
  const [version, setVersion] = useState(0);
  const [open, setOpen] = useState<string | null>(null);

  const messages = useMemo(() => getInbox(email), [email, version]);

  // Marcar todo como leído al entrar
  useEffect(() => {
    markAllRead(email);
    onChanged?.();
  }, [email, onChanged]);

  const handleDelete = (id: string) => {
    deleteMessage(id);
    playSound('click');
    setVersion((v) => v + 1);
    onChanged?.();
  };

  return (
    <div className="flex-1 overflow-y-auto halo-both">
      <div className="max-w-3xl mx-auto p-6 space-y-5">

        <div className="bg-[#13161f] rounded-3xl border border-[#1f2430] p-6 fade-up">
          <div className="flex items-center gap-3 mb-1.5">
            <span className="text-2xl">📬</span>
            <h2 className="text-xl font-extrabold text-white font-editorial">
              Mensajes de tu Docente
            </h2>
          </div>
          <p className="text-sm text-[#94a3b8] font-body">
            Retroalimentación, sugerencias y avisos enviados por tu profesor.
          </p>
        </div>

        {messages.length === 0 ? (
          <div className="bg-[#13161f] rounded-2xl border border-[#1f2430] py-16 text-center">
            <span className="text-3xl opacity-40">📭</span>
            <p className="text-sm text-[#94a3b8] font-body mt-3">
              No tienes mensajes todavía.
            </p>
            <p className="text-xs text-[#64748b] font-body mt-1">
              Cuando tu docente te escriba, aparecerá aquí.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m: Message) => (
              <div
                key={m.id}
                className="bg-[#13161f] rounded-2xl border border-[#1f2430] overflow-hidden hover:border-[#22c55e]/30 smooth-transition"
              >
                <button
                  onClick={() => { setOpen(open === m.id ? null : m.id); playSound('click'); }}
                  className="w-full text-left px-5 py-4 flex items-start gap-3"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#22c55e]/15 flex items-center justify-center text-sm shrink-0">
                    👨‍🏫
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-bold text-white font-ui truncate">{m.subject}</p>
                      {!m.read && (
                        <span className="w-2 h-2 rounded-full bg-[#22c55e] shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-[#64748b] font-body">
                      De: <strong className="text-[#94a3b8]">{m.fromName}</strong> ·{' '}
                      {new Date(m.sentAt).toLocaleString('es-VE', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {open !== m.id && (
                      <p className="text-xs text-[#94a3b8] font-body mt-1.5 line-clamp-1">
                        {m.body}
                      </p>
                    )}
                  </div>
                  <span className={`text-[10px] text-[#7c3aed] smooth-transition shrink-0 mt-1 ${
                    open === m.id ? 'rotate-90' : ''
                  }`}>▶</span>
                </button>

                {open === m.id && (
                  <div className="px-5 pb-4 fade-up">
                    <div className="bg-[#0e111a] rounded-xl p-4 border border-[#1f2430]">
                      <p className="text-sm text-[#cbd5e1] font-body leading-relaxed whitespace-pre-wrap">
                        {m.body}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="mt-2.5 px-3 py-1.5 rounded-lg text-[10px] font-ui bg-[#0e111a] border border-[#1f2430] text-[#64748b] hover:text-[#f87171] hover:border-[#f87171]/40 smooth-transition"
                    >
                      🗑️ Eliminar mensaje
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
