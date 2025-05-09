import { ExamInterface } from '@/components/exam/ExamInterface';
import { AlertTriangle } from 'lucide-react';

export default function ExamPage() {
  // In a real app, you might fetch exam details here or protect the route
  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-4 sm:p-6 md:p-8 bg-background">
      <div className="w-full max-w-4xl">
        <header className="mb-6 flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0">
          <h1 className="text-3xl font-bold text-primary">CybExam Active Session</h1>
          {/* Placeholder for a small user avatar or name */}
        </header>
        <ExamInterface />
      </div>
       <footer className="mt-12 text-center text-sm text-muted-foreground">
         <p className="flex items-center justify-center"><AlertTriangle size={14} className="mr-1 text-destructive" /> Please maintain exam integrity.</p>
        <p>&copy; {new Date().getFullYear()} Cybknow. All rights reserved.</p>
      </footer>
    </main>
  );
}
