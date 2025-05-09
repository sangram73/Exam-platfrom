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
import { Clock, ChevronRight, Send, Loader2, Flag } from "lucide-react";

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

  // Timer logic
  React.useEffect(() => {
    if (timeLeft <= 0) {
      handleSubmitExam(true); // Auto-submit when time is up
      return;
    }
    const timerId = setInterval(() => setTimeLeft((prevTime) => prevTime - 1), 1000);
    return () => clearInterval(timerId);
  }, [timeLeft]);

  // Webcam integration placeholder
  React.useEffect(() => {
    async function setupWebcam() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setWebcamStream(stream);
        if (webcamRef.current) {
          webcamRef.current.srcObject = stream;
        }
        // Start capturing snapshots every 5 minutes (mocked)
        const snapshotInterval = setInterval(() => {
          // console.log("Capturing webcam snapshot...");
          // captureAndSendSnapshot(); // Implement this function
        }, 5 * 60 * 1000); // 5 minutes
        return () => {
          clearInterval(snapshotInterval);
          stream.getTracks().forEach(track => track.stop());
        }
      } catch (err) {
        console.error("Failed to access webcam:", err);
        toast({ variant: "destructive", title: "Webcam Error", description: "Could not access webcam. Monitoring may be affected." });
      }
    }
    setupWebcam();
  }, [toast]);

  const currentQuestion = mockExam.questions[currentQuestionIndex];

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < mockExam.questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };

  const handleSubmitExam = async (autoSubmit: boolean = false) => {
    setIsSubmitting(true);
    if (!autoSubmit) {
      toast({ title: "Submitting Exam...", description: "Please wait while we process your answers." });
    } else {
      toast({ title: "Time's Up!", description: "Auto-submitting your exam." });
    }
    
    // Simulate submission to Firebase
    await new Promise(resolve => setTimeout(resolve, 2000)); 
    
    // In a real app, you'd send answers to Firestore and navigate to a results page.
    console.log("Exam Submitted:", answers);
    setIsSubmitting(false);
    toast({ title: "Exam Submitted Successfully!", description: "Your responses have been recorded." });
    router.push("/login"); // Or a results/thank you page
  };

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
             {webcamStream && <video ref={webcamRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />}
             {!webcamStream && <div className="flex items-center justify-center w-full h-full text-xs text-muted-foreground">Webcam</div>}
             <div className="absolute bottom-1 right-1 bg-black/50 text-white text-xs px-1 rounded">Live</div>
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
