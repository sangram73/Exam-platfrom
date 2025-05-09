
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
      toast({ title: "Admin Alert Sent", description: message, variant: "default" });
    } catch (error: any) {
      console.error('Error sending alert to Telegram:', error);
      toast({ variant: "destructive", title: "Telegram API Error", description: `Failed to send alert: ${error.message}` });
    }
  }, [toast]);

  const sendPhotoToTelegram = React.useCallback(async (imageDataUrl: string, caption?: string) => {
    if (!TELEGRAM_BOT_TOKEN || !CHAT_ID) {
      console.warn("Telegram bot token or chat ID is not configured.");
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
      // console.log('Photo sent to Telegram:', result); // Avoid toast for each frame to prevent flooding
    } catch (error: any) {
      console.error('Error sending photo to Telegram:', error);
      // Avoid toast for each frame error during batch send, handled in captureAndSendMultipleFrames
      throw error; // Re-throw to be caught by caller
    }
  }, []);


  const captureAndSendMultipleFrames = React.useCallback(async () => {
    if (!webcamRef.current || webcamRef.current.readyState < webcamRef.current.HAVE_CURRENT_DATA || !webcamStream?.active) {
      if (!webcamStream?.active && webcamStream !== null) { // Stream was active but now isn't
        sendAlertToTelegram("Attempted to capture frames, but webcam stream became inactive. Potential suspicious activity.");
      }
      return;
    }

    toast({ title: "Periodic Snapshot", description: "Capturing and sending 50 webcam frames to admin. This may take some time and network resources." });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      toast({ variant: "destructive", title: "Frame Capture Error", description: "Could not initialize canvas." });
      return;
    }
    
    canvas.width = webcamRef.current.videoWidth;
    canvas.height = webcamRef.current.videoHeight;

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
        
        // IMPORTANT: Delay to avoid overwhelming the browser and Telegram API.
        // Sending 50 frames rapidly is resource-intensive.
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2-second delay between frames
      } catch (error) {
        toast({ variant: "destructive", title: `Frame Send Error (Frame ${i+1})`, description: "Could not send a frame to Telegram. Continuing with next." });
        // Wait before retrying or moving to next to prevent rapid-fire failures
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    toast({ title: "Snapshot Complete", description: `Finished sending batch of ${framesSentSuccessfully} webcam frames.` });
  }, [webcamRef, webcamStream, toast, sendPhotoToTelegram, sendAlertToTelegram]);

  // Timer logic
  React.useEffect(() => {
    if (timeLeft <= 0) {
      handleSubmitExam(true); // Auto-submit when time is up
      return;
    }
    const timerId = setInterval(() => setTimeLeft((prevTime) => prevTime - 1), 1000);
    return () => clearInterval(timerId);
  }, [timeLeft]); // Removed handleSubmitExam from deps, it will use the latest state due to useCallback or instance definition

  // Webcam integration
  React.useEffect(() => {
    let snapshotIntervalId: NodeJS.Timeout | null = null;
    let currentStream: MediaStream | null = null;

    async function setupWebcam() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }); // Audio not strictly needed for frames
        currentStream = stream;
        setWebcamStream(stream);
        if (webcamRef.current) {
          webcamRef.current.srcObject = stream;
          webcamRef.current.onloadedmetadata = () => {
            if (webcamRef.current) webcamRef.current.play();
          };
          webcamRef.current.onerror = () => {
            sendAlertToTelegram("Webcam video element encountered an error during exam.");
          };
        }

        stream.getTracks().forEach(track => {
          track.onended = () => {
            sendAlertToTelegram("Webcam/microphone track ended unexpectedly. This could indicate the student closed the camera, revoked permission, or the device was disconnected. Potential suspicious activity.");
            setWebcamStream(null); // Reflect loss of stream
          };
        });
        
        // Start capturing snapshots every 5 minutes
        // WARNING: Sending 50 frames every 5 minutes is extremely resource-intensive.
        // This will significantly impact browser performance and network usage.
        // Consider reducing the number of frames or increasing the interval.
        snapshotIntervalId = setInterval(captureAndSendMultipleFrames, 5 * 60 * 1000); // 5 minutes

      } catch (err) {
        console.error("Failed to access webcam:", err);
        toast({ variant: "destructive", title: "Webcam Error", description: "Could not access webcam. Monitoring may be affected. Please ensure permissions are granted." });
        sendAlertToTelegram("Failed to access webcam at the start of or during the exam. Monitoring is not active.");
      }
    }
    setupWebcam();

    return () => {
      if (snapshotIntervalId) clearInterval(snapshotIntervalId);
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }
      if (webcamRef.current && webcamRef.current.srcObject) {
         // @ts-ignore
         webcamRef.current.srcObject.getTracks().forEach(track => track.stop());
         webcamRef.current.srcObject = null;
      }
    }
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
             {/* Ensure video tag is always rendered to attach ref, then control visibility or content */}
             <video ref={webcamRef} playsInline className="w-full h-full object-cover transform scale-x-[-1]" muted />
             {!webcamStream && <div className="absolute inset-0 flex items-center justify-center w-full h-full text-xs text-muted-foreground bg-muted">Webcam Off</div>}
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
                    Confirm & Submit
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
