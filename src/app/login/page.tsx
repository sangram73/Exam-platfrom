import { LoginForm } from '@/components/auth/LoginForm';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { CurrentYear } from '@/components/utility/CurrentYear';
import { Building2 } from 'lucide-react'; // Using an icon to represent the platform/company

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Building2 size={32} />
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight">CybExam Platform</CardTitle>
          <CardDescription className="text-md">Student Login</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
      <footer className="mt-8 text-center text-sm text-muted-foreground">
        <p>&copy; <CurrentYear /> Cybknow. All rights reserved.</p>
        <p>Secure and Monitored Examination Environment</p>
      </footer>
    </main>
  );
}
