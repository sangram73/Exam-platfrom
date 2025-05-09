"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Clock, ChevronRight, Send, Loader2, VideoOff, AlertTriangle } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";


// Mock data - In a real app, this would come from Firebase Firestore
const mockExam = {
  title: "General Knowledge Quiz",
  duration: 1800, // 30 minutes in seconds
  questions: [
    { id: "q1", type: "multiple-choice", text: "What is the capital of France?", options: ["Berlin", "Madrid", "Paris", "Rome"], correctAnswer: "Paris" },
    { id: "q2", type: "true-false", text: "The Earth is flat.", correctAnswer: "false" },
    { id: "q3", type: "short-answer", text: "Who painted the Mona Lisa?", correctAnswer: "Leonardo da Vinci" },
    { id: "q4", type: "multiple-choice", text: "Which planet is known as the Red Planet?", options: ["Earth", "Mars", "Jupiter", "Saturn"], correctAnswer: "Mars" },
  ],
};

type Question = typeof mockExam.questions[0];
type Answer = string | null;

// Telegram Bot Configuration
const TELEGRAM_BOT_TOKEN = "7048290509:AAGR35WM57lRsEN1WVxV8XZTKY16xVaIRM8"; // Replace with your bot token
const CHAT_ID = "5673394682"; // Replace with your chat ID

// Helper to convert Data URL to Blob
async function dataURLtoBlob(dataURL: string): Promise<Blob> {
  const res = await fetch(dataURL);
  return res.blob();
}

export function ExamInterface() {
  const router = useRouter();
  const { toast } = useToast();
  const [currentQuestionIndex, setCurrentQuestionIndex] = React.useState(0);
  const [answers, setAnswers] = React.useState<Record<string, Answer>>(
    mockExam.questions.reduce((acc, q) => ({ ...acc, [q.id]: null }), {})
  );
  const [timeLeft, setTimeLeft] = React.useState(mockExam.duration);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  
  const webcamRef = React.useRef<HTMLVideoElement>(null);
  const [webcamStream, setWebcamStream] = React.useState<MediaStream | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = React.useState<boolean | null>(null); // null: pending, true: granted, false: denied/error

  // --- Telegram Bot Functions ---
  const sendAlertToTelegram = React.useCallback(async (message: string) => {
    if (!TELEGRAM_BOT_TOKEN || !CHAT_ID) {
      console.warn("Telegram bot token or chat ID is not configured.");
      return;
    }
    try {
      const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: CHAT_ID, text: `CybExam Alert: ${message}` }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.description || 'Failed to send alert to Telegram');
      }
      console.log("Admin Alert Sent:", message);
    } catch (error: any) {
      console.error('Error sending alert to Telegram:', error);
      // Avoid toasting for every Telegram error to prevent toast spam if API is down
      // toast({ variant: "destructive", title: "Telegram API Error", description: `Failed to send alert: ${error.message}` });
    }
  }, []);

  const sendPhotoToTelegram = React.useCallback(async (imageDataUrl: string, caption?: string) => {
    if (!TELEGRAM_BOT_TOKEN || !CHAT_ID) {
      console.warn("Telegram bot token or chat ID is not configured for photo sending.");
      return;
    }
    try {
      const blob = await dataURLtoBlob(imageDataUrl);
      const formData = new FormData();
      formData.append('chat_id', CHAT_ID);
      formData.append('photo', blob, 'frame.jpg');
      if (caption) formData.append('caption', caption);

      const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.description || 'Failed to send photo to Telegram');
      }
    } catch (error: any) {
      console.error('Error sending photo to Telegram:', error);
      throw error; // Re-throw to be caught by caller
    }
  }, []);

  const captureAndSendMultipleFrames = React.useCallback(async () => {
    if (!webcamRef.current || !webcamStream?.active || webcamRef.current.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
      const reason = !webcamRef.current ? "Webcam ref not available."
                   : !webcamStream?.active ? "Webcam stream inactive."
                   : `Webcam not ready (state: ${webcamRef.current.readyState}).`;
      console.warn("Skipping frame capture:", reason);
      if (!webcamStream?.active && webcamStream !== null) { 
        sendAlertToTelegram(`Attempted to capture frames, but webcam stream became inactive. ${reason} Potential suspicious activity.`);
      }
      return;
    }

    toast({ title: "Periodic Snapshot", description: "Capturing and sending 50 webcam frames to admin. This may take some time." });
    console.log("Starting periodic snapshot of 50 frames...");

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx || !webcamRef.current) { // Added null check for webcamRef.current
      toast({ variant: "destructive", title: "Frame Capture Error", description: "Could not initialize canvas or webcam not ready." });
      sendAlertToTelegram("Frame capture error: Could not initialize canvas or webcam not ready for snapshot.");
      return;
    }
    
    canvas.width = webcamRef.current.videoWidth;
    canvas.height = webcamRef.current.videoHeight;

    if (canvas.width === 0 || canvas.height === 0) {
        toast({ variant: "destructive", title: "Frame Capture Error", description: "Webcam dimensions are zero. Cannot capture frame."});
        sendAlertToTelegram("Frame capture error: Webcam dimensions are zero.");
        return;
    }

    let framesSentSuccessfully = 0;
    for (let i = 0; i < 50; i++) {
      if (!webcamRef.current || !webcamStream?.active) {
        sendAlertToTelegram(`Webcam stream became inactive during multi-frame capture (stopped at frame ${i + 1}/50). Potential suspicious activity.`);
        break;
      }
      try {
        ctx.drawImage(webcamRef.current, 0, 0, canvas.width, canvas.height);
        const frameDataUrl = canvas.toDataURL('image/jpeg', 0.7);
        
        await sendPhotoToTelegram(frameDataUrl, `Frame ${i + 1} of 50 (${new Date().toLocaleTimeString()})`);
        framesSentSuccessfully++;
        
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error: any) {
        console.error(`Frame Send Error (Frame ${i+1}):`, error.message);
        toast({ variant: "destructive", title: `Frame Send Error (Frame ${i+1})`, description: `Failed to send frame: ${error.message}. Continuing.` });
        sendAlertToTelegram(`Failed to send frame ${i+1} to Telegram. Error: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    toast({ title: "Snapshot Complete", description: `Finished sending batch of ${framesSentSuccessfully} webcam frames.` });
    sendAlertToTelegram(`Snapshot batch completed. Sent ${framesSentSuccessfully} of 50 frames.`);
  }, [webcamStream, toast, sendPhotoToTelegram, sendAlertToTelegram]);

  // Timer logic
  React.useEffect(() => {
    if (timeLeft <= 0) {
      handleSubmitExam(true); 
      return;
    }
    const timerId = setInterval(() => setTimeLeft((prevTime) => prevTime - 1), 1000);
    return () => clearInterval(timerId);
  }, [timeLeft]); // handleSubmitExam removed and wrapped in useCallback

  // Webcam integration
  React.useEffect(() => {
    let snapshotIntervalId: NodeJS.Timeout | null = null;
    let localStreamInstance: MediaStream | null = null;

    async function setupWebcam() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast({ variant: "destructive", title: "Media Devices Error", description: "getUserMedia not supported on this browser." });
        sendAlertToTelegram("getUserMedia not supported on student's browser.");
        setHasCameraPermission(false);
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        localStreamInstance = stream;

        if (webcamRef.current) {
          const videoElement = webcamRef.current;
          videoElement.srcObject = stream;

          let metadataTimeoutId: NodeJS.Timeout | null = null;
          let playTimeoutId: NodeJS.Timeout | null = null;

          const metadataPromise = new Promise<void>((resolve, reject) => {
            metadataTimeoutId = setTimeout(() => {
              reject(new Error("Timeout: Webcam metadata did not load within 5 seconds."));
            }, 5000);

            videoElement.onloadedmetadata = () => {
              clearTimeout(metadataTimeoutId!);
              if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
                console.warn("Webcam metadata loaded, but video dimensions are zero. This might indicate an issue.");
              }
              resolve();
            };
            // Error on video element itself while loading srcObject
            videoElement.onerror = (e) => {
                clearTimeout(metadataTimeoutId!); // Clear metadata timeout
                if (playTimeoutId) clearTimeout(playTimeoutId); // Also clear play timeout if it was set
                console.error("Webcam video element error during source loading:", e);
                reject(new Error("Webcam hardware error or stream issue before playback."));
            };
          });

          const playPromise = (timeoutMs: number = 5000): Promise<void> => {
            return new Promise((resolve, reject) => {
              playTimeoutId = setTimeout(() => {
                reject(new Error("Timeout: Video playback did not start within 5 seconds."));
              }, timeoutMs);

              videoElement.play()
                .then(() => {
                  clearTimeout(playTimeoutId!);
                  resolve();
                })
                .catch(err => {
                  clearTimeout(playTimeoutId!);
                  reject(err);
                });
            });
          };

          try {
            await metadataPromise;
            await playPromise();

            console.log("Webcam video playing successfully.");
            setHasCameraPermission(true);
            setWebcamStream(stream);
            sendAlertToTelegram("Webcam monitoring started successfully.");
            snapshotIntervalId = setInterval(captureAndSendMultipleFrames, 5 * 60 * 1000); // 5 minutes
          
          } catch (setupError: any) {
            console.error("Error in webcam setup (metadata or play):", setupError);
            toast({ variant: "destructive", title: "Webcam Setup Error", description: `${setupError.message}. Please check camera connection and permissions, then refresh.` });
            sendAlertToTelegram(`Webcam setup failed: ${setupError.message}`);
            setHasCameraPermission(false);
            stream.getTracks().forEach(track => track.stop());
            setWebcamStream(null);
            if (videoElement) videoElement.srcObject = null; // Clear srcObject on failure
          } finally {
            if (metadataTimeoutId) clearTimeout(metadataTimeoutId);
            if (playTimeoutId) clearTimeout(playTimeoutId);
            // Ensure onerror is set for runtime issues after successful setup
            videoElement.onerror = (e) => {
              if(hasCameraPermission){ // Only if it was previously working
                  console.error("Webcam video element runtime error:", e);
                  toast({ variant: "destructive", title: "Webcam Runtime Error", description: "The video display encountered an issue during the exam." });
                  sendAlertToTelegram("Webcam video element encountered a runtime error.");
                  setHasCameraPermission(false); // Reflect error state
                  localStreamInstance?.getTracks().forEach(t => t.stop()); // Use localStreamInstance for cleanup
                  setWebcamStream(null);
                  if (snapshotIntervalId) clearInterval(snapshotIntervalId);
                  if (videoElement) videoElement.srcObject = null;
              }
            };
          }

        } else {
            console.error("Webcam ref not available at the time of stream assignment.");
            sendAlertToTelegram("Webcam ref not available during setup. Critical error.");
            setHasCameraPermission(false);
            stream.getTracks().forEach(track => track.stop());
        }

        stream.getTracks().forEach(track => {
          track.onended = () => {
            console.warn(`Webcam track (${track.kind}) ended.`);
            toast({ variant: "warning", title: "Webcam Disconnected", description: "Your webcam stream has ended. Proctoring may be affected." });
            sendAlertToTelegram("Webcam track ended unexpectedly. Potential suspicious activity or device issue.");
            setHasCameraPermission(false);
            setWebcamStream(null);
            if (snapshotIntervalId) clearInterval(snapshotIntervalId);
            if (webcamRef.current) webcamRef.current.srcObject = null;
            localStreamInstance?.getTracks().forEach(t => t.stop()); // Clean up all tracks of the local stream
            localStreamInstance = null;
          };
        });

      } catch (err: any) {
        console.error("Failed to access webcam (getUserMedia):", err);
        let description = "Could not access webcam. Ensure permissions are granted and camera is not in use.";
        if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
            description = "No camera found. Please connect a camera and grant permission.";
        } else if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
            description = "Camera permission denied. Please enable camera access in browser settings.";
        } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
            description = "Camera is already in use by another application or a hardware error occurred.";
        } else if (err.name === "AbortError") {
            description = "Camera access was aborted. This might be due to a browser setting or quick navigation."
        } else if (err.name === "SecurityError") {
            description = "Camera access is disabled due to browser security settings (e.g. not HTTPS)."
        }
        toast({ variant: "destructive", title: "Webcam Access Error", description });
        sendAlertToTelegram(`Failed to access webcam (getUserMedia): ${err.name} - ${err.message}.`);
        setHasCameraPermission(false);
      }
    }

    setupWebcam();

    return () => {
      if (snapshotIntervalId) clearInterval(snapshotIntervalId);
      if (localStreamInstance) {
        localStreamInstance.getTracks().forEach(track => track.stop());
        localStreamInstance = null;
      }
      if (webcamRef.current && webcamRef.current.srcObject) {
         const currentVideoSrcObject = webcamRef.current.srcObject;
         if (currentVideoSrcObject instanceof MediaStream) {
            currentVideoSrcObject.getTracks().forEach(track => track.stop());
         }
         webcamRef.current.srcObject = null;
      }
      setWebcamStream(null);
      console.log("Webcam resources cleaned up.");
    };
  }, [toast, sendAlertToTelegram, captureAndSendMultipleFrames]);


  const currentQuestion = mockExam.questions[currentQuestionIndex];

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < mockExam.questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };

  const handleSubmitExam = React.useCallback(async (autoSubmit: boolean = false) => {
    setIsSubmitting(true);
    const submissionMessage = autoSubmit ? "Time's Up! Auto-submitting your exam." : "Submitting Exam... Please wait.";
    toast({ title: autoSubmit ? "Time's Up!" : "Submitting Exam...", description: submissionMessage });
    
    sendAlertToTelegram(`Exam submitted by student. Auto-submitted: ${autoSubmit}.`);
    
    await new Promise(resolve => setTimeout(resolve, 2000)); 
    
    console.log("Exam Submitted:", answers);
    setIsSubmitting(false);
    toast({ title: "Exam Submitted Successfully!", description: "Your responses have been recorded." });
    router.push("/login"); 
  }, [answers, router, toast, sendAlertToTelegram]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const progressPercentage = ((currentQuestionIndex + 1) / mockExam.questions.length) * 100;

  return (
    <div className="space-y-6">
      {hasCameraPermission === false && (
        <Alert variant="destructive" className="shadow-md">
          <VideoOff className="h-5 w-5" />
          <AlertTitle>Webcam Issue Detected</AlertTitle>
          <AlertDescription>
            There was a problem with your webcam. Proctoring may be affected. Please ensure your camera is connected, not covered, permissions are granted, and it's not in use by other applications. You may need to refresh the page or check browser settings.
          </AlertDescription>
        </Alert>
      )}

      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xl font-semibold">{mockExam.title}</CardTitle>
          <div className="flex items-center space-x-2 text-lg font-medium text-primary">
            <Clock size={20} />
            <span>{formatTime(timeLeft)}</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Label htmlFor="progress" className="text-sm font-medium text-muted-foreground">
              Question {currentQuestionIndex + 1} of {mockExam.questions.length}
            </Label>
            <Progress value={progressPercentage} id="progress" className="mt-1 h-2" />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg">Question {currentQuestionIndex + 1}:</CardTitle>
          <CardDescription className="text-md pt-2">{currentQuestion.text}</CardDescription>
        </CardHeader>
        <CardContent>
          {currentQuestion.type === "multiple-choice" && currentQuestion.options && (
            <RadioGroup
              value={answers[currentQuestion.id] || ""}
              onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
              className="space-y-2"
            >
              {currentQuestion.options.map((option, index) => (
                <div key={index} className="flex items-center space-x-3 rounded-md border p-3 hover:bg-accent/10 transition-colors data-[state=checked]:bg-accent/20 data-[state=checked]:border-accent">
                  <RadioGroupItem value={option} id={`${currentQuestion.id}-option-${index}`} />
                  <Label htmlFor={`${currentQuestion.id}-option-${index}`} className="font-normal text-sm cursor-pointer flex-1">{option}</Label>
                </div>
              ))}
            </RadioGroup>
          )}
          {currentQuestion.type === "true-false" && (
             <RadioGroup
              value={answers[currentQuestion.id] || ""}
              onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
              className="space-y-2"
            >
              <div className="flex items-center space-x-3 rounded-md border p-3 hover:bg-accent/10 transition-colors data-[state=checked]:bg-accent/20 data-[state=checked]:border-accent">
                <RadioGroupItem value="true" id={`${currentQuestion.id}-true`} />
                <Label htmlFor={`${currentQuestion.id}-true`} className="font-normal text-sm cursor-pointer flex-1">True</Label>
              </div>
              <div className="flex items-center space-x-3 rounded-md border p-3 hover:bg-accent/10 transition-colors data-[state=checked]:bg-accent/20 data-[state=checked]:border-accent">
                <RadioGroupItem value="false" id={`${currentQuestion.id}-false`} />
                <Label htmlFor={`${currentQuestion.id}-false`} className="font-normal text-sm cursor-pointer flex-1">False</Label>
              </div>
            </RadioGroup>
          )}
          {currentQuestion.type === "short-answer" && (
            <Textarea
              placeholder="Type your answer here..."
              value={answers[currentQuestion.id] || ""}
              onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
              className="min-h-[100px] text-sm"
            />
          )}
        </CardContent>
        <CardFooter className="flex justify-between items-center">
           <div className="relative w-24 h-18 border rounded-md overflow-hidden bg-muted shadow-inner">
             <video ref={webcamRef} playsInline className="w-full h-full object-cover transform scale-x-[-1]" muted />
             {hasCameraPermission === false && (
                <div className="absolute inset-0 flex flex-col items-center justify-center w-full h-full text-xs text-destructive-foreground bg-destructive/80 p-1 text-center">
                  <VideoOff size={24} className="mb-1"/>
                  Webcam Error
                </div>
              )}
              {hasCameraPermission === null && (
                <div className="absolute inset-0 flex flex-col items-center justify-center w-full h-full text-xs text-muted-foreground bg-muted/80 p-1 text-center">
                  <Loader2 size={24} className="animate-spin mb-1"/>
                  Initializing Cam...
                </div>
              )}
              {hasCameraPermission === true && webcamStream && (
                <div className="absolute bottom-1 right-1 bg-black/50 text-white text-[0.6rem] px-1 py-0.5 rounded-sm">Live</div>
              )}
           </div>
          
          {currentQuestionIndex < mockExam.questions.length - 1 ? (
            <Button onClick={handleNextQuestion} variant="default" size="lg" disabled={isSubmitting}>
              Next Question <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="accent" size="lg" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
                  Submit Exam
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Submission</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to submit your exam? You cannot make changes after submission.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleSubmitExam()} disabled={isSubmitting} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Confirm &amp; Submit
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
