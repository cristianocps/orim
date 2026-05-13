import { ArrowLeft, Share2, Play, MessageSquare, Sparkles, Settings, Eye, EyeOff } from 'lucide-react';
import type { OnlineUser } from '../hooks/useSocket.js';
import './BoardHeader.css';

interface BoardHeaderProps {
  boardName: string;
  onBack: () => void;
  onPresent: () => void;
  onlineUsers: OnlineUser[];
  followingUserId: string | null;
  onFollowUser: (userId: string) => void;
  onStopFollowing: () => void;
}

export function BoardHeader({
  boardName,
  onBack,
  onPresent,
  onlineUsers,
  followingUserId,
  onFollowUser,
  onStopFollowing,
}: BoardHeaderProps) {
  return (
    <header className="board-header">
      <div className="header-left">
        <button className="header-icon-btn" onClick={onBack} title="Voltar">
          <ArrowLeft size={18} />
        </button>

        <div className="header-board-info">
          <div className="board-breadcrumb">
            <span>Workspace</span>
            <span className="breadcrumb-sep">/</span>
            <span>Projeto</span>
            <span className="breadcrumb-sep">/</span>
          </div>
          <div className="board-name-row">
            <h1 className="board-name">{boardName}</h1>
          </div>
        </div>
      </div>

      <div className="header-center">
        <div className="online-users">
          {onlineUsers.map((user) => (
            <button
              key={user.userId}
              className={`user-avatar ${followingUserId === user.userId ? 'following' : ''}`}
              style={{ background: user.color }}
              title={user.name}
              onClick={() =>
                followingUserId === user.userId
                  ? onStopFollowing()
                  : onFollowUser(user.userId)
              }
            >
              {user.name.charAt(0).toUpperCase()}
              {followingUserId === user.userId && (
                <span className="follow-indicator">
                  <Eye size={10} />
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="header-right">
        <button className="header-action-btn secondary">
          <MessageSquare size={16} />
          <span>Comentários</span>
        </button>
        <button className="header-action-btn secondary">
          <Sparkles size={16} />
          <span>IA</span>
        </button>
        <button className="header-action-btn primary" onClick={onPresent}>
          <Play size={16} />
          <span>Apresentar</span>
        </button>
        <button className="header-action-btn share">
          <Share2 size={16} />
          <span>Compartilhar</span>
        </button>
        <button className="header-icon-btn">
          <Settings size={18} />
        </button>
      </div>
    </header>
  );
}
