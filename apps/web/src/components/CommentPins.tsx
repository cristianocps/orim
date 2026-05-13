import { useState } from 'react';
import { MessageSquare, X, Send } from 'lucide-react';
import './CommentPins.css';

interface Comment {
  id: string;
  x: number;
  y: number;
  text: string;
  author: string;
  resolved: boolean;
  replies: { text: string; author: string }[];
}

interface CommentPinsProps {
  comments: Comment[];
  onAddComment: (x: number, y: number, text: string) => void;
  onResolve: (id: string) => void;
}

export function CommentPins({ comments, onAddComment, onResolve }: CommentPinsProps) {
  const [activeComment, setActiveComment] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState('');

  return (
    <div className="comment-pins-layer">
      {comments.map((comment) => (
        <div
          key={comment.id}
          className={`comment-pin ${comment.resolved ? 'resolved' : ''} ${activeComment === comment.id ? 'active' : ''}`}
          style={{ left: comment.x, top: comment.y }}
        >
          <button
            className="pin-button"
            onClick={() => setActiveComment(activeComment === comment.id ? null : comment.id)}
          >
            <MessageSquare size={14} />
            {comment.replies.length > 0 && (
              <span className="pin-count">{comment.replies.length + 1}</span>
            )}
          </button>

          {activeComment === comment.id && (
            <div className="comment-popover">
              <div className="comment-header">
                <span className="comment-author">{comment.author}</span>
                <button className="comment-close" onClick={() => setActiveComment(null)}>
                  <X size={14} />
                </button>
              </div>
              <div className="comment-text">{comment.text}</div>
              {comment.replies.map((reply, i) => (
                <div key={i} className="comment-reply">
                  <span className="reply-author">{reply.author}</span>
                  <span className="reply-text">{reply.text}</span>
                </div>
              ))}
              <div className="comment-actions">
                <input
                  type="text"
                  placeholder="Responder..."
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newCommentText.trim()) {
                      onAddComment(comment.x, comment.y, newCommentText);
                      setNewCommentText('');
                    }
                  }}
                />
                <button
                  className="comment-resolve"
                  onClick={() => onResolve(comment.id)}
                >
                  {comment.resolved ? 'Reabrir' : 'Resolver'}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
