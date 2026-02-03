import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Loader2, User, Mail, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import DobSelect from "@/components/DobSelect";

interface Profile {
  id: string;
  username: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  created_at: string;
}

const MyAccount = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dobDay, setDobDay] = useState("");
  const [dobMonth, setDobMonth] = useState("");
  const [dobYear, setDobYear] = useState("");

  useEffect(() => {
    checkAuthAndFetch();
  }, []);

  const checkAuthAndFetch = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      navigate("/auth");
      return;
    }

    await fetchProfile(user.id);
  };

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (data && !error) {
      setProfile(data);
      setUsername(data.username || "");
      setFirstName(data.first_name || "");
      setLastName(data.last_name || "");
      if (data.date_of_birth) {
        const dob = new Date(data.date_of_birth);
        setDobDay(String(dob.getDate()).padStart(2, "0"));
        setDobMonth(String(dob.getMonth() + 1).padStart(2, "0"));
        setDobYear(String(dob.getFullYear()));
      }
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!profile) return;

    setSaving(true);
    
    const dateOfBirth = dobYear && dobMonth && dobDay 
      ? `${dobYear}-${dobMonth}-${dobDay}` 
      : null;

    const updates: any = {
      username: username.trim() || profile.username,
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
      date_of_birth: dateOfBirth,
    };

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", profile.id);

    setSaving(false);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Profile updated",
      description: "Your profile has been updated successfully.",
    });

    setProfile({ ...profile, ...updates });
  };

  const hasChanges = () => {
    if (!profile) return false;
    
    const currentDob = dobYear && dobMonth && dobDay 
      ? `${dobYear}-${dobMonth}-${dobDay}` 
      : null;
    
    return (
      username !== (profile.username || "") ||
      firstName !== (profile.first_name || "") ||
      lastName !== (profile.last_name || "") ||
      currentDob !== profile.date_of_birth
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-16 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 pt-24 pb-16 max-w-2xl">
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">Profile not found.</p>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-24 pb-16 max-w-2xl">
        <h1 className="text-3xl md:text-4xl font-bold mb-8">
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            My Account
          </span>
        </h1>

        <Card className="p-6">
          {/* Profile Header */}
          <div className="flex items-center gap-4 mb-6">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                {username?.charAt(0).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-bold">{username}</h2>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
            </div>
          </div>

          <Separator className="mb-6" />

          {/* Profile Form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Username
              </Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                maxLength={50}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Enter your first name"
                  maxLength={50}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Enter your last name"
                  maxLength={50}
                />
              </div>
            </div>

            <DobSelect
              day={dobDay}
              month={dobMonth}
              year={dobYear}
              onDayChange={setDobDay}
              onMonthChange={setDobMonth}
              onYearChange={setDobYear}
            />

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                Email
              </Label>
              <Input
                value={profile.email}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">Member since</Label>
              <Input
                value={new Date(profile.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
                disabled
                className="bg-muted"
              />
            </div>
          </div>

          <Separator className="my-6" />

          <div className="flex justify-end">
            <Button 
              onClick={handleSave} 
              disabled={saving || !hasChanges()}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
};

export default MyAccount;
