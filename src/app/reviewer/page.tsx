import Link from "next/link";

export default function ReviewerPage() {
  const subjects = [
    { title: "Verbal Ability", category: "Professional & Sub-Pro", count: "24 Lessons", color: "bg-blue-50 border-blue-200 text-blue-700" },
    { title: "Numerical Ability", category: "Professional & Sub-Pro", count: "30 Lessons", color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
    { title: "Analytical Ability", category: "Professional Only", count: "18 Lessons", color: "bg-purple-50 border-purple-200 text-purple-700" },
    { title: "General Information", category: "Professional & Sub-Pro", count: "15 Lessons", color: "bg-amber-50 border-amber-200 text-amber-700" },
    { title: "Clerical Operations", category: "Sub-Pro Only", count: "12 Lessons", color: "bg-rose-50 border-rose-200 text-rose-700" },
  ];

  return (
    
      
        Reviewer Module
        Select a subject to start reviewing its lessons and practice quizzes.
      

      
        {subjects.map((subject, index) => (
          
            
              {subject.category}
              {subject.title}
            
            
              {subject.count}
              Start →
            
          
        ))}
      
    
  );
}