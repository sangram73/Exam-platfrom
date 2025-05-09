import { PermissionsGuide } from '@/components/exam/PermissionsGuide';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck } from 'lucide-react';

export default function PreExamPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6 md:p-8 bg-background">
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader className="text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start space-x-3 mb-4">
            <ShieldCheck className="h-10 w-10 text-primary" />
            <div>
              <CardTitle className="text-2xl sm:text-3xl font-bold">Pre-Exam Checklist</CardTitle>
              <CardDescription className="text-md">Instructions & Device Permissions</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <PermissionsGuide />
        </CardContent>
      </Card>
       <footer className="mt-8 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Cybknow. All rights reserved.</p>
      </footer>
    </main>
  );
}
