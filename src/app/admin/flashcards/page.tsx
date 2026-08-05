import FlashcardBulkUploader from '@/components/admin/FlashcardBulkUploader';
import SingleFlashcardForm from '@/components/admin/SingleFlashcardForm';

export default function AdminFlashcardsPage() {
  return (
    <main className="p-8 max-w-7xl mx-auto space-y-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">CSC Flashcard Management</h1>
      <SingleFlashcardForm />
      <FlashcardBulkUploader />
    </main>
  );
}