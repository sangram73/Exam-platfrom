"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, Camera, Mic, MapPin, AlertTriangle, Loader2, PlayCircle } from "lucide-react";

interface PermissionStatus {
  camera: boolean | null;
  microphone: boolean | null;
  location: boolean | null;
}

const dosAndDonts = {
  dos: [
    "Ensure a stable internet connection.",
    "Use a quiet room with good lighting.",
    "Keep your face clearly visible to the camera.",
    "Close all other applications and browser tabs.",
    "Follow all instructions provided by the exam system.",
  ],
  donts: [
    "Do not use any external help or resources.",
    "Do not leave the exam window or camera view.",
    "Do not communicate with anyone during the exam.",
    "Do not cover or obstruct the webcam.",
    "Do not attempt to record or copy exam content.",
  ],
};

export function PermissionsGuide() {
  const router = useRouter();
  const { toast } = useToast();
  const [permissions, setPermissions] = React.useState<PermissionStatus>({
    camera: null,
    microphone: null,
    location: null,
  });
  const [isLoading, setIsLoading] = React.useState< Partial<Record<keyof PermissionStatus, boolean>>>({});
  const [isStartingExam, setIsStartingExam] = React.useState(false);

  const requestPermission = async (type: keyof PermissionStatus) => {
    setIsLoading(prev => ({ ...prev, [type]: true }));
    try {
      if (type === "camera") {
        await navigator.mediaDevices.getUserMedia({ video: true });
        setPermissions((prev) => ({ ...prev, camera: true }));
        toast({ title: "Camera Access Granted", description: "Camera permission successfully obtained." });
      } else if (type === "microphone") {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        setPermissions((prev) => ({ ...prev, microphone: true }));
        toast({ title: "Microphone Access Granted", description: "Microphone permission successfully obtained." });
      } else if (type === "location") {
        await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject)
        );
        setPermissions((prev) => ({ ...prev, location: true }));
        toast({ title: "Location Access Granted", description: "Location permission successfully obtained." });
      }
    } catch (error) {
      console.error(`Error requesting ${type} permission:`, error);
      setPermissions((prev) => ({ ...prev, [type]: false }));
      toast({
        variant: "destructive",
        title: `${type.charAt(0).toUpperCase() + type.slice(1)} Access Denied`,
        description: `Failed to obtain ${type} permission. Please ensure it's not blocked in your browser settings.`,
      });
    } finally {
      setIsLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  const allPermissionsGranted = permissions.camera && permissions.microphone; // Location optional for now

  const handleStartExam = () => {
    if (!allPermissionsGranted) {
      toast({
        variant: "destructive",
        title: "Permissions Required",
        description: "Please grant camera and microphone access to start the exam.",
      });
      return;
    }
    setIsStartingExam(true);
    toast({ title: "Starting Exam", description: "Please wait..." });
    // Simulate loading then navigate
    setTimeout(() => {
      router.push("/exam");
    }, 1500);
  };

  const PermissionButton = ({ type, Icon }: { type: keyof PermissionStatus; Icon: React.ElementType }) => (
    <Button
      onClick={() => requestPermission(type)}
      disabled={permissions[type] === true || isLoading[type]}
      variant={permissions[type] === null ? "outline" : permissions[type] ? "default" : "destructive"}
      className="w-full justify-start text-left"
    >
      {isLoading[type] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Icon className="mr-2 h-4 w-4" />}
      Grant {type.charAt(0).toUpperCase() + type.slice(1)} Access
      {permissions[type] === true && <CheckCircle className="ml-auto h-5 w-5 text-green-500" />}
      {permissions[type] === false && <XCircle className="ml-auto h-5 w-5 text-red-500" />}
    </Button>
  );

  return (
    <div className="space-y-8">
      <Alert variant="default" className="bg-primary/5 border-primary/20">
        <AlertTriangle className="h-5 w-5 text-primary" />
        <AlertTitle className="font-semibold text-primary">Important Instructions</AlertTitle>
        <AlertDescription>
          Please read the following instructions carefully before starting the exam. Ensure all required permissions are granted for a smooth exam experience.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl text-green-600">Do's</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm">
              {dosAndDonts.dos.map((item, index) => <li key={index}>{item}</li>)}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl text-red-600">Don'ts</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm">
              {dosAndDonts.donts.map((item, index) => <li key={index}>{item}</li>)}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Device Permissions</CardTitle>
          <p className="text-sm text-muted-foreground">
            We need access to your camera, microphone, and location for monitoring purposes.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <PermissionButton type="camera" Icon={Camera} />
          <PermissionButton type="microphone" Icon={Mic} />
          <PermissionButton type="location" Icon={MapPin} />
        </CardContent>
        <CardFooter>
          <Button 
            onClick={handleStartExam} 
            disabled={!allPermissionsGranted || isStartingExam} 
            className="w-full"
            size="lg"
          >
            {isStartingExam ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <PlayCircle className="mr-2 h-5 w-5" /> }
            Start Exam
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
