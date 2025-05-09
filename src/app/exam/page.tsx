'use client';

import * as React from 'react';
import { ExamInterface } from '@/components/exam/ExamInterface';
import { CurrentYear } from '@/components/utility/CurrentYear';
import { AlertTriangle } from 'lucide-react';
import { ExamNavbar } from '@/components/exam/ExamNavbar';

export default function ExamPage() {
  const [sharedWebcamStream, setSharedWebcamStream] = React.useState<MediaStream | null>(null);
  const [cameraPermissionStatus, setCameraPermissionStatus] = React.useState<boolean | null>(null);
  const [isWebcamReady, setIsWebcamReady] = React.useState(false);


  // Mock student data - in a real app, this would come from auth/session
  const studentInfo = {
    name: "Alex Student",
    id: "CYBEX001",
  };

  const handleStreamStateChange = (stream: MediaStream | null, permission: boolean | null, ready: boolean) => {
    setSharedWebcamStream(stream);
    setCameraPermissionStatus(permission);
    setIsWebcamReady(ready);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-0 sm:p-2 md:p-4 bg-background">
      <ExamNavbar
        studentName={studentInfo.name}
        studentId={studentInfo.id}
        stream={sharedWebcamStream}
        hasPermission={cameraPermissionStatus}
        isWebcamReady={isWebcamReady}
      />
      <div className="w-full max-w-4xl p-4 sm:p-6 md:p-8 pt-0 sm:pt-2 md:pt-4">
        <ExamInterface onStreamStateChange={handleStreamStateChange} />
      </div>
      <footer className="mt-12 text-center text-sm text-muted-foreground">
        <p className="flex items-center justify-center">
          <AlertTriangle size={14} className="mr-1 text-destructive" /> Please maintain exam integrity.
        </p>
        <p>&copy; <CurrentYear /> Cybknow. All rights reserved.</p>
      </footer>
    </main>
  );
}
