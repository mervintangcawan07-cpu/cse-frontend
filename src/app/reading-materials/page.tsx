import Link from "next/link";

export default function ReadingMaterialsPage() {
  const categories = [
    { title: "English Grammar", topics: "Subject-Verb Agreement, Tenses, Modals", color: "bg-indigo-50 text-indigo-700" },
    { title: "Philippine Constitution", topics: "Preamble, Bill of Rights, Citizenship", color: "bg-blue-50 text-blue-700" },
    { title: "Mathematics Review", topics: "Algebra, Geometry, Word Problems", color: "bg-emerald-50 text-emerald-700" },
    { title: "Current Events", topics: "National Issues, Environmental Updates", color: "bg-amber-50 text-amber-700" },
  ];

  return (
    
      
        
          Reading Materials
          Comprehensive study guides to replace heavy PDF reviewers.
        
      

      
        {categories.map((cat, index) => (
          
            
              📚
            
            
              {cat.title}
              {cat.topics}
              
                Browse Lessons →
              
            
          
        ))}
      
    
  );
}