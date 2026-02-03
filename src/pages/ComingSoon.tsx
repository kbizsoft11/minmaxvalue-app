import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Ticket, Users, Shield, Zap, Gift, Trophy, ChevronRight, ChevronLeft, Check, X, Instagram } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

const GIVEAWAY_STORAGE_KEY = "mmv_giveaway_entry";

const surveyQuestions = [
  {
    id: 1,
    question: "If you couldn't attend a tournament you already have a ticket for, would you try to sell it at a discount?",
    options: ["Yes", "Maybe", "No"]
  },
  {
    id: 2,
    question: "Would you buy a verified resale tournament ticket if it was 20% cheaper than the starting price?",
    options: ["Yes", "Maybe", "No"]
  },
  {
    id: 3,
    question: "What minimum discount would make you consider buying a resale ticket?",
    options: ["5–10%", "10–20%", "20–30%", "30%+", "I wouldn't buy resale tickets"]
  },
  {
    id: 4,
    question: "Have you or someone you know ever tried to sell a tournament ticket they couldn't play?",
    options: ["Yes", "No", "Not Sure"]
  },
  {
    id: 5,
    question: "Would a discounted ticket be a reason to attend a tournament you wouldn't normally play?",
    options: ["Yes", "Maybe", "No"]
  }
];

const ComingSoon = () => {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<"email" | "survey" | "complete" | "already_entered">("email");
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [giveawayEntryId, setGiveawayEntryId] = useState<string | null>(null);
  const [savedEmail, setSavedEmail] = useState<string | null>(null);
  const { toast } = useToast();

  // Check localStorage on mount for returning users
  useEffect(() => {
    const stored = localStorage.getItem(GIVEAWAY_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.email && parsed.completed) {
          setSavedEmail(parsed.email);
          setStep("already_entered");
        }
      } catch {
        // Invalid storage, ignore
      }
    }
  }, []);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes("@")) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Use database function to handle both waitlist and giveaway entry
      const { data, error } = await supabase.rpc('create_giveaway_entry', { p_email: email });

      if (error) {
        throw error;
      }
      
      if (data) {
        const result = data as { id: string; is_new: boolean };
        
        // Check if this email was already registered
        if (result.is_new === false) {
          setSavedEmail(email);
          setStep("already_entered");
          toast({
            title: "Already entered!",
            description: "This email is already registered for the giveaway.",
          });
          return;
        }
        
        setGiveawayEntryId(result.id);
      }
      
      setStep("survey");
    } catch (error) {
      console.error("Error joining giveaway:", error);
      toast({
        title: "Oops!",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAnswerSelect = (answer: string) => {
    setAnswers(prev => ({ ...prev, [currentQuestion]: answer }));
  };

  const handleNext = async () => {
    if (!answers[currentQuestion]) {
      toast({
        title: "Please select an answer",
        description: "Choose one option before continuing",
        variant: "destructive",
      });
      return;
    }

    if (currentQuestion < surveyQuestions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      // Survey complete - save all responses
      if (giveawayEntryId) {
        try {
          // Save survey responses
          const responses = Object.entries(answers).map(([questionIndex, answer]) => ({
            giveaway_entry_id: giveawayEntryId,
            question_number: parseInt(questionIndex) + 1,
            question_text: surveyQuestions[parseInt(questionIndex)].question,
            answer: answer,
          }));
          
          await supabase.from("survey_responses").insert(responses);
          
          // Mark survey as completed
          await supabase
            .from("giveaway_entries")
            .update({ survey_completed: true })
            .eq("id", giveawayEntryId);
            
        } catch (error) {
          console.error("Error saving survey:", error);
        }
      }
      
      // Save to localStorage for returning users
      localStorage.setItem(GIVEAWAY_STORAGE_KEY, JSON.stringify({ email, completed: true }));
      
      setStep("complete");
      toast({
        title: "You're in! 🎉",
        description: "You've been entered into the King of Kings giveaway!",
      });
    }
  };

  const handleInstagramFollow = () => {
    if (giveawayEntryId) {
      supabase
        .from("giveaway_entries")
        .update({ instagram_followed: true })
        .eq("id", giveawayEntryId);
    }
  };

  const progress = ((currentQuestion + 1) / surveyQuestions.length) * 100;

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated background effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-card" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: "1s" }} />
      
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-12">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          {/* Logo/Icon */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/30 rounded-full blur-xl" />
              <Ticket className="w-16 h-16 text-primary relative" />
            </div>
          </div>

          {/* Main heading */}
          <div className="space-y-4">
            <h1 className="text-5xl md:text-7xl font-bold leading-tight">
              <span className="bg-gradient-to-r from-primary via-accent to-yellow-400 bg-clip-text text-transparent">
                MinMaxValue
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-foreground font-medium">
              Coming Soon
            </p>
          </div>

          {/* Giveaway Banner */}
          <div className="bg-gradient-to-r from-primary/20 via-accent/20 to-yellow-400/20 border border-primary/30 rounded-xl p-6 max-w-2xl mx-auto">
            <div className="flex items-center justify-center gap-3 mb-3">
              <Trophy className="w-8 h-8 text-yellow-400" />
              <h2 className="text-2xl md:text-3xl font-bold text-foreground uppercase tracking-wide">Join the Giveaway</h2>
              <Gift className="w-8 h-8 text-primary" />
            </div>
            <p className="text-lg text-foreground font-semibold mb-2">
              King of Kings Highroller
            </p>
            <div className="flex items-center justify-center gap-4 text-muted-foreground">
              <span className="bg-primary/20 px-3 py-1 rounded-full text-sm font-medium text-primary">$500 Buy-in</span>
              <span className="bg-accent/20 px-3 py-1 rounded-full text-sm font-medium text-accent">$50,000 GTD</span>
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              Join the waitlist & complete the survey to enter!
            </p>
          </div>

          {/* Step Content */}
          {step === "email" && (
            <div className="max-w-md mx-auto space-y-6">
              <div className="space-y-1 text-center">
                <p className="text-base text-foreground"><span className="text-primary font-semibold">Step 1:</span> Enter your email to get started</p>
                <p className="text-base text-foreground"><span className="text-primary font-semibold">Step 2:</span> Quick 30 second survey to help us help you</p>
              </div>
              <form onSubmit={handleEmailSubmit} className="flex flex-col sm:flex-row gap-3">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 h-12 text-base bg-card border-border"
                  disabled={isSubmitting}
                />
                <Button 
                  type="submit" 
                  size="lg" 
                  className="h-12 px-8"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Joining..." : "Continue"}
                </Button>
              </form>
            </div>
          )}

          {step === "survey" && (
            <div className="max-w-lg mx-auto space-y-6">
              {/* Progress bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Question {currentQuestion + 1} of {surveyQuestions.length}</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Question */}
              <div className="bg-card border border-border rounded-xl p-6 space-y-6 relative">
                {/* Close button */}
                <button
                  onClick={() => {
                    setStep("email");
                    setCurrentQuestion(0);
                    setAnswers({});
                  }}
                  className="absolute top-3 right-3 p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-muted"
                  aria-label="Cancel survey"
                >
                  <X className="w-4 h-4" />
                </button>
                
                <h3 className="text-lg font-semibold text-foreground pr-8">
                  {surveyQuestions[currentQuestion].question}
                </h3>
                
                <RadioGroup
                  value={answers[currentQuestion] || ""}
                  onValueChange={handleAnswerSelect}
                  className="space-y-3"
                >
                  {surveyQuestions[currentQuestion].options.map((option, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center space-x-3 p-3 rounded-lg border transition-all cursor-pointer ${
                        answers[currentQuestion] === option
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-muted-foreground"
                      }`}
                      onClick={() => handleAnswerSelect(option)}
                    >
                      <RadioGroupItem value={option} id={`option-${idx}`} />
                      <Label htmlFor={`option-${idx}`} className="flex-1 cursor-pointer text-foreground">
                        {option}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>

                <div className="flex gap-3">
                  {currentQuestion > 0 && (
                    <Button 
                      variant="outline"
                      onClick={() => setCurrentQuestion(prev => prev - 1)}
                      className="h-12 px-4"
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" /> Back
                    </Button>
                  )}
                  <Button 
                    onClick={handleNext}
                    className="flex-1 h-12"
                    disabled={!answers[currentQuestion]}
                  >
                    {currentQuestion < surveyQuestions.length - 1 ? (
                      <>
                        Next <ChevronRight className="w-4 h-4 ml-1" />
                      </>
                    ) : (
                      <>
                        Complete & Enter Giveaway <Gift className="w-4 h-4 ml-1" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === "complete" && (
            <div className="max-w-lg mx-auto space-y-6">
              <div className="bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30 rounded-xl p-8 space-y-4">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
                  <Check className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-2xl font-bold text-foreground">Good luck with the giveaway!</h3>
                <p className="text-muted-foreground">
                  You've been entered into the <span className="text-foreground font-semibold">King of Kings Highroller</span> giveaway & our waitlist.
                </p>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <span className="bg-primary/20 px-3 py-1 rounded-full text-sm font-medium text-primary">$500 Buy-in</span>
                  <span className="bg-accent/20 px-3 py-1 rounded-full text-sm font-medium text-accent">$50,000 GTD</span>
                </div>
                <p className="text-sm text-muted-foreground pt-4">
                  We'll notify you at <span className="text-foreground">{email}</span> 1 week before the event.
                </p>
              </div>

              {/* Bonus Entry */}
              <div className="bg-card border border-border rounded-xl p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center">
                    <Instagram className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-semibold text-foreground">Want a bonus entry?</h4>
                    <p className="text-sm text-muted-foreground">Follow us on Instagram for an extra chance to win</p>
                  </div>
                </div>
                <a
                  href="https://www.instagram.com/minmaxvalue/"
                  target="_blank"
                  rel="noreferrer"
                  onClick={handleInstagramFollow}
                  className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-lg bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white font-medium hover:opacity-90 transition-opacity"
                >
                  <Instagram className="w-5 h-5" />
                  Follow @minmaxvalue
                </a>
              </div>
            </div>
          )}

          {step === "already_entered" && (
            <div className="max-w-lg mx-auto space-y-6">
              <div className="bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30 rounded-xl p-8 space-y-4">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
                  <Check className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-2xl font-bold text-foreground">You're already in!</h3>
                <p className="text-muted-foreground">
                  You've already entered the <span className="text-foreground font-semibold">King of Kings Highroller</span> giveaway.
                </p>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <span className="bg-primary/20 px-3 py-1 rounded-full text-sm font-medium text-primary">$500 Buy-in</span>
                  <span className="bg-accent/20 px-3 py-1 rounded-full text-sm font-medium text-accent">$50,000 GTD</span>
                </div>
                <p className="text-sm text-muted-foreground pt-4">
                  We'll notify you at <span className="text-foreground">{savedEmail}</span> 1 week before the event.
                </p>
              </div>

              {/* Instagram reminder */}
              <div className="bg-card border border-border rounded-xl p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center">
                    <Instagram className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-semibold text-foreground">Don't forget to follow us!</h4>
                    <p className="text-sm text-muted-foreground">Follow on Instagram for updates & bonus entry</p>
                  </div>
                </div>
                <a
                  href="https://www.instagram.com/minmaxvalue/"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-lg bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white font-medium hover:opacity-90 transition-opacity"
                >
                  <Instagram className="w-5 h-5" />
                  Follow @minmaxvalue
                </a>
              </div>
            </div>
          )}

          {/* Features grid - show only on email step, complete, or already_entered */}
          {(step === "email" || step === "complete" || step === "already_entered") && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8">
              <div className="bg-card/50 backdrop-blur border border-border rounded-lg p-6 space-y-3 flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">Connect Players</h3>
                <p className="text-sm text-muted-foreground">
                  Find buyers for your tickets or grab a seat at your dream tournament
                </p>
              </div>

              <div className="bg-card/50 backdrop-blur border border-border rounded-lg p-6 space-y-3 flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">Secure Trading</h3>
                <p className="text-sm text-muted-foreground">
                  Safe and verified transactions with built-in buyer protection
                </p>
              </div>

              <div className="bg-card/50 backdrop-blur border border-border rounded-lg p-6 space-y-3 flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">Lightning Fast</h3>
                <p className="text-sm text-muted-foreground">
                  List your ticket in seconds and find buyers instantly
                </p>
              </div>
            </div>
          )}

          {/* Social proof */}
          <div className="pt-8 space-y-4">
            <p className="text-sm text-muted-foreground">
              Follow us for updates
            </p>
            <div className="flex justify-center gap-4">
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </a>
              <a
                href="https://tiktok.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                </svg>
              </a>
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComingSoon;
