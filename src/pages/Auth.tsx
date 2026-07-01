import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Helmet } from "react-helmet-async";

const emailSchema = z.string().trim().email().max(255);
const pwSchema = z.string().min(6).max(72);

const Auth = () => {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const validate = () => {
    const e = emailSchema.safeParse(email);
    if (!e.success) return "Enter a valid email address";
    const p = pwSchema.safeParse(password);
    if (!p.success) return "Password must be 6–72 characters";
    return null;
  };

  const handleSignIn = async () => {
    const err = validate();
    if (err) return toast.error(err);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Signed in");
    nav("/");
  };

  const handleSignUp = async () => {
    const err = validate();
    if (err) return toast.error(err);
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Check your email to confirm your account");
  };

  const handleGoogle = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    setBusy(false);
    if (result.error) return toast.error("Google sign-in failed");
    if (!result.redirected) nav("/");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Helmet>
        <title>Sign in — Stockly.ai</title>
        <meta name="description" content="Sign in or create a Stockly.ai account to save custom stock watchlists." />
      </Helmet>
      <div className="w-full max-w-sm border border-border rounded-md bg-card p-6 shadow-lg">
        <h1 className="font-serif text-xl mb-1 text-foreground">Welcome to Stockly.ai</h1>
        <p className="text-xs text-muted-foreground mb-5">Sign in to save watchlists across devices.</p>

        <Tabs defaultValue="signin">
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw" className="text-xs">Password</Label>
              <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </div>
          </div>

          <TabsContent value="signin" className="mt-4">
            <Button className="w-full" onClick={handleSignIn} disabled={busy}>Sign In</Button>
          </TabsContent>
          <TabsContent value="signup" className="mt-4">
            <Button className="w-full" onClick={handleSignUp} disabled={busy}>Create Account</Button>
          </TabsContent>
        </Tabs>

        <div className="flex items-center gap-2 my-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[10px] font-mono text-muted-foreground uppercase">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={busy}>
          Continue with Google
        </Button>

        <div className="mt-4 text-center">
          <Link to="/" className="text-xs text-muted-foreground hover:text-primary underline underline-offset-2">
            Continue as guest
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Auth;
