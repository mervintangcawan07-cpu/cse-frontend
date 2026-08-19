// Relative Path: src/components/social/commons/StudyCommonsSection.tsx
"use client";

import React, { useState, useEffect } from "react";
import { StudyPostCard, StudyPostItem } from "./StudyPostCard";
import { PostComposerModal, PostTopic } from "./PostComposerModal";

const FILTER_TABS: { id: "ALL" | PostTopic; label: string; icon: string }[] = [
  { id: "ALL", label: "All Streams", icon: "🌐" },
  { id: "QUESTION_HELP", label: "Question Help", icon: "❓" },
  { id: "EXAM_INTEL", label: "Exam Intel", icon: "📢" },
  { id: "MINDSET_VENT", label: "Mindset & Vent", icon: "☕" },
  { id: "STUDY_HACKS", label: "Study Hacks", icon: "💡" },
];

export const StudyCommonsSection: React.FC = () => {
  const [posts, setPosts] = useState<StudyPostItem[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<"ALL" | PostTopic>("ALL");
  const [loading, setLoading] = useState(true);
  const [showComposer, setShowComposer] = useState(false);

  const fetchPosts = async (topic: "ALL" | PostTopic = selectedTopic) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/social/posts?topic=${topic}`);
      if (res.ok) {
        const data = await res.json();
        if (data.posts) {
          setPosts(data.posts);
        }
      }
    } catch (err) {
      console.error("Failed to load study commons posts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts(selectedTopic);
  }, [selectedTopic]);

  const handlePostCreated = (newPost: StudyPostItem) => {
    setPosts((prev) => [newPost, ...prev]);
  };

  const handlePostDeleted = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 📢 PINNED DAILY FOCUS & EXAM COMMONS BULLETIN */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-4 sm:p-6 border border-slate-800 shadow-md relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30">
                ⭐ Community Commons
              </span>
              <span className="text-xs text-slate-400 font-bold">Civil Service Examinee Exchange</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white">
              Peer Discussion, Question Solutions & Exam Intel
            </h2>
            <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
              Ask tough exam questions with hidden spoiler solutions, post verified test center intel, and support peers through study fatigue.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowComposer(true)}
            className="w-full sm:w-auto px-5 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs rounded-2xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <span>✏️</span>
            <span>New Post / Question</span>
          </button>
        </div>
      </div>

      {/* QUICK COMPOSER BAR (Click to open modal) */}
      <div
        onClick={() => setShowComposer(true)}
        className="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-4 border border-slate-200 shadow-xs hover:border-purple-300 hover:shadow-md transition flex items-center gap-3 cursor-pointer group"
      >
        <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center text-lg group-hover:scale-105 transition shrink-0">
          💬
        </div>
        <div className="flex-1 text-xs text-slate-500 font-medium truncate">
          Ask for question help, share CSC intel, or post a study thought...
        </div>
        <span className="hidden sm:inline-block px-3 py-1.5 bg-purple-100 text-purple-700 text-xs font-bold rounded-xl">
          Create Post 🚀
        </span>
      </div>

      {/* 🏷️ STREAM FILTER PILLS */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {FILTER_TABS.map((tab) => {
          const isSelected = selectedTopic === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedTopic(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                isSelected
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 📜 FEED POSTS STREAM */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3">
            <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs font-bold text-slate-500">Loading Study Commons posts...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-white p-10 rounded-3xl border border-slate-200 text-center space-y-3">
            <span className="text-3xl">📝</span>
            <h3 className="text-sm sm:text-base font-black text-slate-900">
              No posts in this stream yet
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Be the first examinee to post a question, share testing intel, or encourage your peers!
            </p>
            <button
              type="button"
              onClick={() => setShowComposer(true)}
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-xs transition inline-block mt-2 cursor-pointer"
            >
              Create the First Post 🚀
            </button>
          </div>
        ) : (
          posts.map((post) => (
            <StudyPostCard
              key={post.id}
              post={post}
              onDelete={handlePostDeleted}
            />
          ))
        )}
      </div>

      {/* Post Composer Modal */}
      <PostComposerModal
        isOpen={showComposer}
        onClose={() => setShowComposer(false)}
        onPostCreated={handlePostCreated}
      />
    </div>
  );
};
