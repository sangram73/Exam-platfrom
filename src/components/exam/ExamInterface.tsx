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
  const [hasCameraPermission, setHasCameraPermission] = React.useState<boolean | null>(null); 

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
      console.error('Error sending alert to Telegram:', error.message);
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
      console.error('Error sending photo to Telegram:', error.message);
      throw error; 
    }
  }, []);

  const captureAndSendMultipleFrames = React.useCallback(async () => {
    if (!webcamRef.current || !webcamStream?.active || webcamRef.current.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
      const reason = !webcamRef.current ? "Webcam ref not available."
                   : !webcamStream?.active ? "Webcam stream inactive."
                   : `Webcam not ready (state: ${webcamRef.current.readyState}). Need HAVE_ENOUGH_DATA (>=3).`;
      console.warn("Skipping frame capture:", reason);
      if (webcamStream !== null && !webcamStream?.active) { 
        sendAlertToTelegram(`Attempted to capture frames, but webcam stream became inactive. ${reason} Potential suspicious activity.`);
      }
      return;
    }

    toast({ title: "Periodic Snapshot", description: "Capturing and sending 50 webcam frames to admin..." });
    console.log("Starting periodic snapshot of 50 frames...");

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx || !webcamRef.current) { 
      toast({ variant: "destructive", title: "Frame Capture Error", description: "Could not initialize canvas or webcam not ready." });
      sendAlertToTelegram("Frame capture error: Could not initialize canvas or webcam not ready for snapshot.");
      return;
    }
    
    canvas.width = webcamRef.current.videoWidth;
    canvas.height = webcamRef.current.videoHeight;

    if (canvas.width === 0 || canvas.height === 0) {
        toast({ variant: "destructive", title: "Frame Capture Error", description: "Webcam dimensions are zero at capture time. Cannot capture frame."});
        sendAlertToTelegram("Frame capture error: Webcam dimensions are zero at capture time.");
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
        const frameDataUrl = canvas.toDataURL('image/jpeg', 0.3); // Reduced quality to 0.3 for better compression
        
        await sendPhotoToTelegram(frameDataUrl, `Frame ${i + 1} of 50 (${new Date().toLocaleTimeString()})`);
        framesSentSuccessfully++;
        // If not sending sequentially, remove this delay. For now, keep a small delay to avoid overwhelming the API.
        await new Promise(resolve => setTimeout(resolve, 200)); // Small delay between sends
      } catch (error: any) {
        console.error(`Frame Send Error (Frame ${i+1}):`, error.message);
        toast({ variant: "destructive", title: `Frame Send Error (Frame ${i+1})`, description: `Failed to send frame: ${error.message}. Continuing.` });
        sendAlertToTelegram(`Failed to send frame ${i+1} to Telegram. Error: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Longer delay on error
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]); 

  // Webcam Setup Effect
  React.useEffect(() => {
    let localStreamInstance: MediaStream | null = null;
    let metadataTimeoutId: NodeJS.Timeout | null = null;
    let playTimeoutId: NodeJS.Timeout | null = null;
    const videoElement = webcamRef.current;

    async function setupWebcam() {
      if (!videoElement) {
        console.error("Webcam ref (videoElement) not available at the time of setup.");
        sendAlertToTelegram("Webcam ref not available during setup. Critical error.");
        setHasCameraPermission(false);
        return;
      }
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast({ variant: "destructive", title: "Media Devices Error", description: "getUserMedia not supported on this browser." });
        sendAlertToTelegram("getUserMedia not supported on student's browser.");
        setHasCameraPermission(false);
        return;
      }

      try {
        console.log("Requesting camera permission...");
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        localStreamInstance = stream;
        console.log("Camera permission granted, stream obtained.");

        videoElement.srcObject = stream;
        console.log("Stream assigned to video element. Waiting for metadata...");

        // Promise for metadata
        await new Promise<void>((resolveMetadata, rejectMetadata) => {
          metadataTimeoutId = setTimeout(() => {
            videoElement.onloadedmetadata = null; // Cleanup
            videoElement.onerror = null; // Cleanup specific error handler
            console.error("Timeout: Webcam metadata did not load within 30 seconds.");
            rejectMetadata(new Error("Timeout: Webcam metadata did not load within 30 seconds. Check camera connection and permissions."));
          }, 30000); // Increased timeout to 30 seconds

          videoElement.onloadedmetadata = () => {
            if (metadataTimeoutId) clearTimeout(metadataTimeoutId);
            metadataTimeoutId = null;
            videoElement.onerror = null; // Clean up specific error handler for this stage

            console.log("Webcam onloadedmetadata fired. Video dimensions:", videoElement.videoWidth, "x", videoElement.videoHeight);
            if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
              rejectMetadata(new Error("Webcam metadata loaded, but video dimensions are zero. Camera might be covered or not providing a valid feed."));
              return;
            }
            resolveMetadata();
          };

          // Error during srcObject assignment or initial loading
          videoElement.onerror = (e) => { // This onerror is for the metadata loading phase
            if (metadataTimeoutId) clearTimeout(metadataTimeoutId);
            metadataTimeoutId = null;
            videoElement.onloadedmetadata = null; // Clean up
            console.error("Webcam video element error during metadata loading phase:", e);
            rejectMetadata(new Error("Webcam hardware error or stream issue during metadata loading."));
          };
        });

        console.log("Metadata loaded successfully. Attempting to play video...");
        // Promise for play
        await new Promise<void>((resolvePlay, rejectPlay) => {
            playTimeoutId = setTimeout(() => {
                console.error("Timeout: Video playback did not start within 10 seconds after metadata load.");
                rejectPlay(new Error("Timeout: Video playback did not start within 10 seconds after metadata load."));
            }, 10000);

            videoElement.play()
              .then(() => {
                if (playTimeoutId) clearTimeout(playTimeoutId);
                playTimeoutId = null;
                console.log("Video playback started successfully.");
                resolvePlay();
              })
              .catch(err => {
                if (playTimeoutId) clearTimeout(playTimeoutId);
                playTimeoutId = null;
                console.error("Error attempting to play video:", err);
                rejectPlay(err);
              });
        });
        
        console.log("Webcam video playing successfully.");
        setHasCameraPermission(true);
        setWebcamStream(stream);

        // Setup track ended listener
        stream.getTracks().forEach(track => {
          track.onended = () => {
            console.warn(`Webcam track (${track.kind}) ended.`);
            toast({ variant: "warning", title: "Webcam Disconnected", description: "Your webcam stream has ended. Proctoring may be affected." });
            sendAlertToTelegram("Webcam track ended unexpectedly. Potential suspicious activity or device issue.");
            setHasCameraPermission(false);
            setWebcamStream(null);
            if (webcamRef.current) webcamRef.current.srcObject = null;
          };
        });

        // Set up general runtime error handler for the video element
        videoElement.onerror = (e) => {
            console.error("Webcam video element runtime error (after successful setup):", e);
            toast({ variant: "destructive", title: "Webcam Runtime Error", description: "The video display encountered an issue during the exam." });
            sendAlertToTelegram("Webcam video element encountered a runtime error post-setup.");
            setHasCameraPermission(false); 
            setWebcamStream(null); 
            stream.getTracks().forEach(t => t.stop()); 
            if (videoElement) videoElement.srcObject = null;
        };

      } catch (setupError: any) {
        console.error("Error in webcam setup (metadata or play):", setupError);
        toast({ variant: "destructive", title: "Webcam Setup Error", description: `${setupError.message}. Please check camera and permissions, then refresh.` });
        sendAlertToTelegram(`Webcam setup failed: ${setupError.message}`);
        setHasCameraPermission(false);
        setWebcamStream(null);
        localStreamInstance?.getTracks().forEach(track => track.stop());
        if (videoElement) {
          videoElement.srcObject = null; 
          videoElement.onloadedmetadata = null; 
          videoElement.onerror = null; // Clear any attached error handlers
        }
      }
    }

    setupWebcam();

    return () => {
      console.log("Cleaning up webcam resources (setup effect)...");
      if (metadataTimeoutId) clearTimeout(metadataTimeoutId);
      if (playTimeoutId) clearTimeout(playTimeoutId);

      if (videoElement) {
          videoElement.onloadedmetadata = null;
          videoElement.onerror = null; // Clear runtime error handler
          if (videoElement.srcObject && videoElement.srcObject === localStreamInstance) {
            // Stop tracks only if this effect instance created them
            (videoElement.srcObject as MediaStream).getTracks().forEach(track => track.stop());
            videoElement.srcObject = null;
            console.log("Video element srcObject cleared and tracks stopped.");
          }
      } else if (localStreamInstance) { // If videoElement somehow became null but stream exists
        localStreamInstance.getTracks().forEach(track => track.stop());
        console.log("Local stream tracks stopped (videoElement was null).");
      }
      // Note: webcamStream from state is managed by its own effect for snapshots
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast, sendAlertToTelegram]); 

  // Snapshot Management Effect
  React.useEffect(() => {
    let snapshotIntervalId: NodeJS.Timeout | null = null;
    let initialSnapshotTimeoutId: NodeJS.Timeout | null = null;

    if (webcamStream && hasCameraPermission === true) {
      sendAlertToTelegram("Webcam monitoring started successfully for snapshots.");
      initialSnapshotTimeoutId = setTimeout(() => captureAndSendMultipleFrames(), 5000); 
      snapshotIntervalId = setInterval(captureAndSendMultipleFrames, 5 * 60 * 1000); 
    } else {
      if (snapshotIntervalId) clearInterval(snapshotIntervalId);
      if (initialSnapshotTimeoutId) clearTimeout(initialSnapshotTimeoutId);
    }

    return () => {
      console.log("Cleaning up snapshot resources (snapshot effect)...");
      if (snapshotIntervalId) clearInterval(snapshotIntervalId);
      if (initialSnapshotTimeoutId) clearTimeout(initialSnapshotTimeoutId);
    };
  }, [webcamStream, hasCameraPermission, captureAndSendMultipleFrames, sendAlertToTelegram]);


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
    
    if (hasCameraPermission && webcamStream?.active) {
      toast({ title: "Final Snapshot", description: "Capturing final webcam frames before submission." });
      try {
        await captureAndSendMultipleFrames(); 
      } catch (e) {
        console.error("Error during final snapshot:", e);
        sendAlertToTelegram("Error during final snapshot on submission.");
      }
    } else {
      sendAlertToTelegram("Could not capture final snapshot on submission: No camera permission or inactive stream.");
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000)); 
    
    console.log("Exam Submitted:", answers);
    setIsSubmitting(false);
    toast({ title: "Exam Submitted Successfully!", description: "Your responses have been recorded." });
    router.push("/login"); 
  }, [answers, router, toast, sendAlertToTelegram, hasCameraPermission, webcamStream, captureAndSendMultipleFrames]);

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
        <Alert variant="destructive" className="mt-4">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle>Webcam Issue Detected</AlertTitle>
          <AlertDescription>
            There was a problem with your webcam. Proctoring may be affected. Please ensure your camera is connected, permissions are granted, and it's not in use by other applications. You may need to refresh or check browser settings.
          </AlertDescription>
        </Alert>
      )}

      <Card className="shadow-lg">
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-2">
          <div>
            <CardTitle className="text-2xl font-semibold text-primary">{mockExam.title}</CardTitle>
            <CardDescription>
              Question {currentQuestionIndex + 1} of {mockExam.questions.length}
            </CardDescription>
          </div>
          <div className="mt-2 sm:mt-0 flex items-center gap-2 text-lg font-medium text-accent">
            <Clock size={20} />
            <span>{formatTime(timeLeft)}</span>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={progressPercentage} className="mb-6 h-2" />
          <div className="space-y-4">
            <h3 className="text-xl font-medium">
              Question {currentQuestionIndex + 1}:
            </h3>
            <p className="text-lg">{currentQuestion.text}</p>
            {currentQuestion.type === "multiple-choice" && currentQuestion.options && (
              <RadioGroup
                onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                value={answers[currentQuestion.id] || ""}
                className="space-y-2"
              >
                {currentQuestion.options.map((option, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <RadioGroupItem value={option} id={`${currentQuestion.id}-option-${index}`} />
                    <Label htmlFor={`${currentQuestion.id}-option-${index}`} className="text-base font-normal">{option}</Label>
                  </div>
                ))}
              </RadioGroup>
            )}
            {currentQuestion.type === "true-false" && (
               <RadioGroup
                onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                value={answers[currentQuestion.id] || ""}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="true" id={`${currentQuestion.id}-true`} />
                  <Label htmlFor={`${currentQuestion.id}-true`} className="text-base font-normal">True</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="false" id={`${currentQuestion.id}-false`} />
                  <Label htmlFor={`${currentQuestion.id}-false`} className="text-base font-normal">False</Label>
                </div>
              </RadioGroup>
            )}
            {currentQuestion.type === "short-answer" && (
              <Textarea
                placeholder="Type your answer here..."
                value={answers[currentQuestion.id] || ""}
                onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                className="text-base"
              />
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4">
           <div className="w-full sm:w-48 h-auto aspect-video bg-muted rounded-md overflow-hidden relative border">
             <video ref={webcamRef} className="w-full h-full object-cover" autoPlay muted playsInline />
             <div className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-1 py-0.5 rounded">
               {hasCameraPermission === null && <span className="text-yellow-400">Initializing Cam...</span>}
               {hasCameraPermission === false && <span className="text-red-400">Cam Error</span>}
               {hasCameraPermission === true && webcamStream?.active && ( 
                <span className="text-green-400">Live</span>
              )}
              {hasCameraPermission === true && !(webcamStream?.active) && ( // Handle case where stream exists but is not active
                <span className="text-orange-400">Cam Inactive</span>
              )}
             </div>
           </div>
          {currentQuestionIndex < mockExam.questions.length - 1 ? (
            <Button onClick={handleNextQuestion} size="lg" className="w-full sm:w-auto">
              Next Question <ChevronRight size={18} className="ml-1" />
            </Button>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="default" size="lg" className="w-full sm:w-auto" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="animate-spin" /> : <Send size={18} className="mr-1" />}
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
                  <AlertDialogAction onClick={() => handleSubmitExam(false)} disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : null}
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

