// Relative Path: src/components/social/commons/StudyPostCard.tsx
"use client";

import React, { useState } from "react";
import { formatPromptHTML } from "@/lib/formatPrompt";

export interface StudyPostItem {
  id: string;
  topic: "QUESTION_HELP" | "EXAM_INTEL" | "MINDSET_VENT" | "STUDY_HACKS";
  title?: string | null;
  content: string;
  hasSpoiler: boolean;
  spoilerContent?: string | null;
  isAnonymous: boolean;
  isPinned: boolean;
  createdAt: string;
  isAuthor: boolean;
  author: {
    id?: string;
    displayName: string;
    avatar: string;
    studyGoal?: string;
    role?: string;
    isAnonymous: boolean;
  };
  reactions: {
    GOT_IT: number;
    SAME_STRUGGLE: number;
    HIGH_YIELD: number;
    KEEP_PUSHING: number;
  };
  userReactions: string[];
  commentsCount: number;
}

interface CommentItem {
  id: string;
  content: string;
  isAnonymous: boolean;
  isAccepted: boolean;
  createdAt: string;
  isAuthor: boolean;
  author: {
    id?: string;
    displayName: string;
    avatar: string;
    studyGoal?: string;
    role?: string;
    isAnonymous: boolean;
  };
}

interface StudyPostCardProps {
  post: StudyPostItem;
  onDelete?: (postId: string) => void;
}

const AVATAR_MAP: Record<string, { emoji: string; bg: string }> = {
  "avatar-owl": { emoji: "🦉", bg: "from-amber-600 to-yellow-500" },
  "avatar-scholar": { emoji: "📚", bg: "from-blue-600 to-indigo-500" },
  "avatar-grad": { emoji: "🧑‍🎓", bg: "from-emerald-600 to-teal-500" },
  "avatar-brain": { emoji: "🧠", bg: "from-purple-600 to-pink-500" },
  "avatar-rocket": { emoji: "🚀", bg: "from-rose-600 to-orange-500" },
  "avatar-target": { emoji: "🎯", bg: "from-cyan-600 to-blue-500" },
  "avatar-fox": { emoji: "🦊", bg: "from-orange-600 to-amber-500" },
  "avatar-star": { emoji: "⭐", bg: "from-yellow-600 to-amber-400" },
};

const TOPIC_BADGES: Record<string, { label: string; icon: string; bg: string; text: string }> = {
  QUESTION_HELP: { label: "Question Help", icon: "❓", bg: "bg-blue-50 border-blue-200", text: "text-blue-700" },
  EXAM_INTEL: { label: "Exam Intel", icon: "📢", bg: "bg-amber-50 border-amber-200", text: "text-amber-800" },
  MINDSET_VENT: { label: "Mindset & Vent", icon: "☕", bg: "bg-rose-50 border-rose-200", text: "text-rose-700" },
  STUDY_HACKS: { label: "Study Hacks", icon: "💡", bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-800" },
};

export const StudyPostCard: React.FC<StudyPostCardProps> = ({ post, onDelete }) => {
  const [reactions, setReactions] = useState(post.reactions);
  const [userReactions, setUserReactions] = useState<string[]>(post.userReactions);
  const [showSpoiler, setShowSpoiler] = useState(false);

  // Comments state
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentsCount, setCommentsCount] = useState(post.commentsCount);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState("");
  const [commentAnonymous, setCommentAnonymous] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  const topicInfo = TOPIC_BADGES[post.topic] || TOPIC_BADGES.QUESTION_HELP;

  const avatarInfo = post.author.isAnonymous
    ? { emoji: "🎭", bg: "from-slate-600 to-slate-500" }
    : AVATAR_MAP[post.author.avatar] || { emoji: "🧑‍🎓", bg: "from-blue-600 to-indigo-500" };

  const handleToggleReaction = async (reactionType: string) => {
    // Optimistic update
    const hasReacted = userReactions.includes(reactionType);
    const updatedUserReactions = hasReacted
      ? userReactions.filter((r) => r !== reactionType)
      : [...userReactions, reactionType];

    const updatedReactions = {
      ...reactions,
      [reactionType]: Math.max(0, (reactions[reactionType as keyof typeof reactions] || 0) + (hasReacted ? -1 : 1)),
    };

    setUserReactions(updatedUserReactions);
    setReactions(updatedReactions);

    try {
      const res = await fetch(`/api/social/posts/${post.id}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reactionType }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.reactions) setReactions(data.reactions);
        if (data.userReactions) setUserReactions(data.userReactions);
      }
    } catch (err) {
      console.error("Failed to toggle reaction:", err);
    }
  };

  const handleToggleComments = async () => {
    const nextState = !showComments;
    setShowComments(nextState);

    if (nextState && comments.length === 0) {
      setLoadingComments(true);
      try {
        const res = await fetch(`/api/social/posts/${post.id}/comments`);
        if (res.ok) {
          const data = await res.json();
          if (data.comments) setComments(data.comments);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingComments(false);
      }
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || submittingComment) return;

    setSubmittingComment(true);
    try {
      const res = await fetch(`/api/social/posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newCommentText.trim(),
          isAnonymous: commentAnonymous,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.comment) {
          setComments((prev) => [...prev, data.comment]);
          setCommentsCount((prev) => prev + 1);
          setNewCommentText("");
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeletePost = async () => {
    if (!confirm("Are you sure you want to delete this post?")) return;
    try {
      const res = await fetch(`/api/social/posts/${post.id}`, { method: "DELETE" });
      if (res.ok) {
        if (onDelete) onDelete(post.id);
      } else {
        alert("Failed to delete post.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const timeAgo = formatTimeAgo(new Date(post.createdAt));

  return (
    <div
      className={`bg-white rounded-3xl border transition shadow-xs hover:shadow-md p-4 sm:p-6 space-y-4 ${
        post.isPinned ? "border-amber-300 ring-2 ring-amber-400/20 bg-amber-50/10" : "border-slate-200"
      }`}
    >
      {/* Top Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-2xl bg-gradient-to-tr ${avatarInfo.bg} flex items-center justify-center text-xl shadow-xs shrink-0`}
          >
            {avatarInfo.emoji}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xs sm:text-sm text-slate-900 leading-tight">
                {post.author.displayName}
              </span>
              {post.author.role === "ADMIN" && (
                <span className="text-[9px] font-black uppercase px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded">
                  Admin
                </span>
              )}
              {post.isPinned && (
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-md flex items-center gap-1">
                  📌 Pinned
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
              <span>{timeAgo}</span>
              <span>•</span>
              <span className="truncate max-w-[150px]">{post.author.studyGoal || "CSE Review"}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Topic Badge */}
          <span
            className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border ${topicInfo.bg} ${topicInfo.text} flex items-center gap-1`}
          >
            <span>{topicInfo.icon}</span>
            <span>{topicInfo.label}</span>
          </span>

          {post.isAuthor && (
            <button
              onClick={handleDeletePost}
              className="text-slate-400 hover:text-rose-600 text-xs p-1 rounded-lg transition cursor-pointer"
              title="Delete Post"
            >
              🗑️
            </button>
          )}
        </div>
      </div>

      {/* Title */}
      {post.title && (
        <h3 className="text-sm sm:text-base font-black text-slate-900 leading-snug">
          {post.title}
        </h3>
      )}

      {/* Content */}
      <div
        className="text-xs sm:text-sm text-slate-800 leading-relaxed font-normal whitespace-pre-line"
        dangerouslySetInnerHTML={{ __html: formatPromptHTML(post.content) }}
      />

      {/* 🔒 Spoiler Solution Box */}
      {post.hasSpoiler && post.spoilerContent && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
              <span>🔒</span>
              <span>Hidden Solution & Answer Key</span>
            </span>
            <button
              type="button"
              onClick={() => setShowSpoiler(!showSpoiler)}
              className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] rounded-lg transition shadow-xs cursor-pointer"
            >
              {showSpoiler ? "Hide Solution" : "👁️ Reveal Solution"}
            </button>
          </div>

          {showSpoiler && (
            <div
              className="pt-2 text-xs text-amber-950 font-medium leading-relaxed border-t border-amber-500/20 whitespace-pre-line animate-in fade-in duration-150"
              dangerouslySetInnerHTML={{ __html: formatPromptHTML(post.spoilerContent) }}
            />
          )}
        </div>
      )}

      {/* 🎯 Exam-Centric Reactions & Comments Action Bar */}
      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {/* 💡 Got It */}
          <button
            type="button"
            onClick={() => handleToggleReaction("GOT_IT")}
            className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
              userReactions.includes("GOT_IT")
                ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
            }`}
            title="Mark as understood"
          >
            <span>💡</span>
            <span>Got It</span>
            {reactions.GOT_IT > 0 && <span className="font-mono text-[11px]">({reactions.GOT_IT})</span>}
          </button>

          {/* 🤝 Same Struggle */}
          <button
            type="button"
            onClick={() => handleToggleReaction("SAME_STRUGGLE")}
            className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
              userReactions.includes("SAME_STRUGGLE")
                ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700"
            }`}
            title="I struggle with this too"
          >
            <span>🤝</span>
            <span>Same Struggle</span>
            {reactions.SAME_STRUGGLE > 0 && <span className="font-mono text-[11px]">({reactions.SAME_STRUGGLE})</span>}
          </button>

          {/* 🎯 High Yield */}
          <button
            type="button"
            onClick={() => handleToggleReaction("HIGH_YIELD")}
            className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
              userReactions.includes("HIGH_YIELD")
                ? "bg-amber-500 text-slate-950 border-amber-500 shadow-xs font-extrabold"
                : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-800"
            }`}
            title="Important exam concept"
          >
            <span>🎯</span>
            <span>High Yield</span>
            {reactions.HIGH_YIELD > 0 && <span className="font-mono text-[11px]">({reactions.HIGH_YIELD})</span>}
          </button>

          {/* ☕ Keep Pushing */}
          <button
            type="button"
            onClick={() => handleToggleReaction("KEEP_PUSHING")}
            className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
              userReactions.includes("KEEP_PUSHING")
                ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800"
            }`}
            title="Peer encouragement"
          >
            <span>☕</span>
            <span>Keep Pushing</span>
            {reactions.KEEP_PUSHING > 0 && <span className="font-mono text-[11px]">({reactions.KEEP_PUSHING})</span>}
          </button>
        </div>

        {/* Comments Toggle Button */}
        <button
          type="button"
          onClick={handleToggleComments}
          className="px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-bold text-slate-700 transition flex items-center gap-1.5 cursor-pointer"
        >
          <span>💬</span>
          <span>{commentsCount > 0 ? `${commentsCount} Solutions & Notes` : "Add Solution / Reply"}</span>
        </button>
      </div>

      {/* 💬 Expandable Comments Section */}
      {showComments && (
        <div className="pt-3 border-t border-slate-100 space-y-3 animate-in fade-in duration-150">
          {loadingComments ? (
            <p className="text-xs text-slate-400 py-2">Loading solutions and comments...</p>
          ) : comments.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">No solutions or replies yet. Be the first to help out!</p>
          ) : (
            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {comments.map((c) => (
                <div key={c.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">
                        {c.isAnonymous ? "🎭" : AVATAR_MAP[c.author.avatar]?.emoji || "🧑‍🎓"}
                      </span>
                      <span className="font-extrabold text-xs text-slate-900">
                        {c.author.displayName}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {formatTimeAgo(new Date(c.createdAt))}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium whitespace-pre-line pl-5">
                    {c.content}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Add Solution / Reply Input */}
          <form onSubmit={handleAddComment} className="pt-2 space-y-2">
            <textarea
              rows={2}
              placeholder="Write your step-by-step solution, answer, or supportive reply..."
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
              required
            />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-600 font-semibold">
                <input
                  type="checkbox"
                  checked={commentAnonymous}
                  onChange={(e) => setCommentAnonymous(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-purple-600"
                />
                <span>🎭 Post anonymously</span>
              </label>

              <button
                type="submit"
                disabled={submittingComment || !newCommentText.trim()}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                {submittingComment ? "Posting..." : "Post Solution 🚀"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}
