import { Check, Loader2, AlertCircle, WifiOff } from 'lucide-react';
import type { SaveState } from '../hooks/useBoardSync.js';
import './SaveStatus.css';

interface SaveStatusProps {
  state: SaveState;
}

export function SaveStatus({ state }: SaveStatusProps) {
  let label: string;
  let Icon: typeof Check;
  let className = 'save-status';

  switch (state) {
    case 'idle':
      label = 'Salvo';
      Icon = Check;
      className += ' idle';
      break;
    case 'pending':
      label = 'Pendente';
      Icon = Loader2;
      className += ' pending';
      break;
    case 'syncing':
      label = 'Sincronizando…';
      Icon = Loader2;
      className += ' syncing';
      break;
    case 'error':
      label = 'Erro ao salvar';
      Icon = AlertCircle;
      className += ' error';
      break;
    case 'offline':
      label = 'Sem conexão';
      Icon = WifiOff;
      className += ' offline';
      break;
  }

  return (
    <div className={className}>
      <Icon size={12} className={state === 'syncing' || state === 'pending' ? 'spin' : ''} />
      <span>{label}</span>
    </div>
  );
}
