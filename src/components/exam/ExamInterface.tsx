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
import { Clock, ChevronRight, Send, Loader2 } from "lucide-react";

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
const TELEGRAM_BOT_TOKEN = "7048290509:AAGR35WM57lRsEN1WVxV8XZTKY16xVaIRM8";
const CHAT_ID = "5673394682";

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
      // Toast for admin alerts can be noisy, consider if needed for all alerts
      // toast({ title: "Admin Alert Sent", description: message, variant: "default" });
      console.log("Admin Alert Sent:", message);
    } catch (error: any) {
      console.error('Error sending alert to Telegram:', error);
      toast({ variant: "destructive", title: "Telegram API Error", description: `Failed to send alert: ${error.message}` });
    }
  }, [toast]);

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
      // console.log('Photo sent to Telegram:', result); // Avoid toast for each frame
    } catch (error: any) {
      console.error('Error sending photo to Telegram:', error);
      // Re-throw to be caught by caller, especially for batch operations
      throw error;
    }
  }, []);


  const captureAndSendMultipleFrames = React.useCallback(async () => {
    if (!webcamRef.current || !webcamRef.current.srcObject || webcamRef.current.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA || !webcamStream?.active) {
      const reason = !webcamRef.current ? "Webcam ref not available."
                   : !webcamRef.current.srcObject ? "Webcam srcObject not set."
                   : webcamRef.current.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA ? `Webcam not ready (state: ${webcamRef.current.readyState}).`
                   : !webcamStream?.active ? "Webcam stream inactive."
                   : "Unknown webcam issue.";
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
    if (!ctx) {
      toast({ variant: "destructive", title: "Frame Capture Error", description: "Could not initialize canvas." });
      sendAlertToTelegram("Frame capture error: Could not initialize canvas for snapshot.");
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
        const frameDataUrl = canvas.toDataURL('image/jpeg', 0.7); // 0.7 quality for smaller size
        
        await sendPhotoToTelegram(frameDataUrl, `Frame ${i + 1} of 50 (${new Date().toLocaleTimeString()})`);
        framesSentSuccessfully++;
        
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2-second delay
      } catch (error: any) {
        console.error(`Frame Send Error (Frame ${i+1}):`, error.message);
        toast({ variant: "destructive", title: `Frame Send Error (Frame ${i+1})`, description: `Failed to send frame: ${error.message}. Continuing.` });
        sendAlertToTelegram(`Failed to send frame ${i+1} to Telegram. Error: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait before next attempt
      }
    }
    toast({ title: "Snapshot Complete", description: `Finished sending batch of ${framesSentSuccessfully} webcam frames.` });
    sendAlertToTelegram(`Snapshot batch completed. Sent ${framesSentSuccessfully} of 50 frames.`);
  }, [webcamRef, webcamStream, toast, sendPhotoToTelegram, sendAlertToTelegram]);

  // Timer logic
  React.useEffect(() => {
    if (timeLeft <= 0) {
      handleSubmitExam(true); 
      return;
    }
    const timerId = setInterval(() => setTimeLeft((prevTime) => prevTime - 1), 1000);
    return () => clearInterval(timerId);
  }, [timeLeft]); // handleSubmitExam removed, defined with useCallback

  // Webcam integration
  React.useEffect(() => {
    let snapshotIntervalId: NodeJS.Timeout | null = null;
    let localStreamInstance: MediaStream | null = null;

    async function setupWebcam() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        localStreamInstance = stream; // Keep local reference for cleanup
        setWebcamStream(stream);

        if (webcamRef.current) {
          webcamRef.current.srcObject = stream;
          webcamRef.current.onloadedmetadata = () => {
            if (webcamRef.current) {
              webcamRef.current.play().catch(playError => {
                console.error("Error playing webcam video:", playError);
                sendAlertToTelegram(`Webcam video element failed to play. Error: ${playError.message}`);
                toast({ variant: "destructive", title: "Webcam Play Error", description: `Could not play video: ${playError.message}` });
              });
            }
          };
          webcamRef.current.onerror = () => { // Video element error
            console.error("Webcam video element error.");
            sendAlertToTelegram("Webcam video element encountered an error during exam.");
            toast({ variant: "destructive", title: "Webcam Element Error", description: "The video display encountered an issue." });
          };
        }

        stream.getTracks().forEach(track => {
          track.onended = () => {
            console.warn("Webcam/microphone track ended.");
            sendAlertToTelegram("Webcam/microphone track ended unexpectedly. This could indicate the student closed the camera, revoked permission, or the device was disconnected. Potential suspicious activity.");
            setWebcamStream(null); // Reflect loss of stream in React state
            if (localStreamInstance) { // Also attempt to stop tracks on local instance if this occurs
                localStreamInstance.getTracks().forEach(t => t.stop());
                localStreamInstance = null;
            }
            if (webcamRef.current) webcamRef.current.srcObject = null; // Clear from video element
          };
        });
        
        // Start capturing snapshots. Interval is 5 minutes.
        snapshotIntervalId = setInterval(captureAndSendMultipleFrames, 5 * 60 * 1000);
        sendAlertToTelegram("Webcam monitoring started successfully for the exam session.");

      } catch (err: any) {
        console.error("Failed to access webcam:", err);
        toast({ variant: "destructive", title: "Webcam Access Error", description: `Could not access webcam: ${err.message}. Monitoring may be affected. Please ensure permissions are granted.` });
        sendAlertToTelegram(`Failed to access webcam at the start of or during the exam: ${err.message}. Monitoring is not active.`);
        setWebcamStream(null);
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
         // Ensure srcObject is a MediaStream before calling getTracks
         const currentVideoSrcObject = webcamRef.current.srcObject;
         if (currentVideoSrcObject instanceof MediaStream) {
            currentVideoSrcObject.getTracks().forEach(track => track.stop());
         }
         webcamRef.current.srcObject = null;
      }
      setWebcamStream(null); // Ensure React state is also cleared
      console.log("Webcam resources cleaned up.");
    }
  }, [toast, sendAlertToTelegram, captureAndSendMultipleFrames]); // Dependencies are stable callbacks/imports


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
    
    // Simulate API call for submission
    await new Promise(resolve => setTimeout(resolve, 2000)); 
    
    console.log("Exam Submitted:", answers); // In a real app, send to backend
    setIsSubmitting(false);
    toast({ title: "Exam Submitted Successfully!", description: "Your responses have been recorded." });
    router.push("/login"); // Redirect after submission
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
                <div key={index} className="flex items-center space-x-3 rounded-md border p-3 hover:bg-accent/50 transition-colors">
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
              <div className="flex items-center space-x-3 rounded-md border p-3 hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="true" id={`${currentQuestion.id}-true`} />
                <Label htmlFor={`${currentQuestion.id}-true`} className="font-normal text-sm cursor-pointer flex-1">True</Label>
              </div>
              <div className="flex items-center space-x-3 rounded-md border p-3 hover:bg-accent/50 transition-colors">
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
           <div className="relative w-24 h-18 border rounded-md overflow-hidden bg-muted">
             <video ref={webcamRef} playsInline autoPlay className="w-full h-full object-cover transform scale-x-[-1]" muted />
             {!webcamStream && <div className="absolute inset-0 flex items-center justify-center w-full h-full text-xs text-muted-foreground bg-muted p-1 text-center">Webcam Off / Error</div>}
             {webcamStream && <div className="absolute bottom-1 right-1 bg-black/50 text-white text-xs px-1 rounded">Live</div>}
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
                  <AlertDialogAction onClick={() => handleSubmitExam()} disabled={isSubmitting} className="bg-accent hover:bg-accent/90">
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
