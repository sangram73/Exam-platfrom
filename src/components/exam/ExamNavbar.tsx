'use client';

import * as React from 'react';
import { UserCircle2, Fingerprint, Video, CameraOff, Loader2 } from 'lucide-react';

interface ExamNavbarProps {
  studentName: string;
  studentId: string;
  stream: MediaStream | null;
  hasPermission: boolean | null;
  isWebcamReady: boolean;
}

export function ExamNavbar({ studentName, studentId, stream, hasPermission, isWebcamReady }: ExamNavbarProps) {
  const videoRefNavbar = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    if (videoRefNavbar.current && stream) {
      videoRefNavbar.current.srcObject = stream;
      videoRefNavbar.current.play().catch(error => console.error("Navbar video play error:", error));
    } else if (videoRefNavbar.current) {
      videoRefNavbar.current.srcObject = null;
    }
  }, [stream]);

  const getStatusIndicator = () => {
    if (hasPermission === null && !isWebcamReady) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/80">
          <Loader2 size={20} className="animate-spin text-yellow-400" />
        </div>
      );
    }
    if (hasPermission === false) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/80 text-destructive-foreground p-1">
          <CameraOff size={20} className="text-red-500" />
          <span className="text-xs text-red-500 mt-1 text-center">Cam Error</span>
        </div>
      );
    }
    if (hasPermission === true && !isWebcamReady && !stream) {
         return (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/80">
          <Loader2 size={20} className="animate-spin text-yellow-400" />
        </div>
      );
    }
    if (hasPermission === true && isWebcamReady && stream?.active) {
      return (
         <div className="absolute bottom-1 right-1 bg-black/50 text-white text-xs px-1 py-0.5 rounded flex items-center gap-1">
            <Video size={10} className="text-green-400" /> <span className="text-green-400">Live</span>
        </div>
      );
    }
     if (hasPermission === true && isWebcamReady && (!stream || !stream?.active)) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/80 text-orange-400 p-1">
          <CameraOff size={20} />
          <span className="text-xs mt-1 text-center">Cam Inactive</span>
        </div>
      );
    }
    return null;
  };


  return (
    <nav className="w-full bg-card shadow-md sticky top-0 z-50 border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <h1 className="text-xl font-bold text-primary">CybExam</h1>
            </div>
            <div className="hidden md:block ml-6">
              <div className="flex items-baseline space-x-4">
                <span className="flex items-center text-sm text-foreground">
                  <UserCircle2 size={18} className="mr-1.5 text-muted-foreground" />
                  {studentName}
                </span>
                <span className="flex items-center text-sm text-foreground">
                  <Fingerprint size={18} className="mr-1.5 text-muted-foreground" />
                  {studentId}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center">
            <div className="relative w-32 h-20 sm:w-36 sm:h-24 bg-muted rounded-md overflow-hidden border shadow-inner">
              <video
                ref={videoRefNavbar}
                className="w-full h-full object-cover"
                autoPlay
                muted
                playsInline
                data-testid="navbar-webcam-feed"
              />
              {getStatusIndicator()}
            </div>
          </div>
        </div>
         {/* Mobile view for student info */}
        <div className="md:hidden flex items-center justify-start space-x-4 py-2 border-t">
            <span className="flex items-center text-xs text-foreground">
                <UserCircle2 size={16} className="mr-1 text-muted-foreground" />
                {studentName}
            </span>
            <span className="flex items-center text-xs text-foreground">
                <Fingerprint size={16} className="mr-1 text-muted-foreground" />
                {studentId}
            </span>
        </div>
      </div>
    </nav>
  );
}
