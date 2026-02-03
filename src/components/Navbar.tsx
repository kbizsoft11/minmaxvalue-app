import { Link, useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import { Ticket, LogOut, Heart, Menu, User as UserIcon, Wallet, History, Shield, Globe, Search, Building2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const Navbar = () => {
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isCasinoUser, setIsCasinoUser] = useState<boolean>(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'cs' : 'en';
    i18n.changeLanguage(newLang);
  };

  const currentLanguage = i18n.language || 'en';
  const languageFlag = currentLanguage === 'en' ? '🇬🇧' : '🇨🇿';
  const languageName = currentLanguage === 'en' ? 'English' : 'Čeština';

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchUsername(session.user.id);
        } else {
          setUsername("");
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUsername(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUsername = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .single();

    if (data && !error) {
      setUsername(data.username);
    }

    // Check admin status
    const { data: adminRoleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    setIsAdmin(!!adminRoleData);

    // Check casino_user status
    const { data: casinoRoleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "casino_user")
      .maybeSingle();

    setIsCasinoUser(!!casinoRoleData);
  };

  const clearAuthStorage = () => {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (!key) continue;
        // Supabase stores the session under keys like: sb-<project-ref>-auth-token
        if (key.startsWith("sb-") && key.includes("-auth-token")) {
          localStorage.removeItem(key);
        }
      }
    } catch {
      // ignore
    }
  };

  const handleSignOut = async () => {
    // Clear local state immediately for instant UI feedback
    setUser(null);
    setUsername("");
    setIsAdmin(false);
    setIsCasinoUser(false);

    // Attempt server sign-out, but ALWAYS clear local tokens
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    } finally {
      clearAuthStorage();
    }

    toast.success("Signed out successfully");
    // Force a full reload so we re-bootstrap from a truly empty auth storage
    window.location.assign("/");
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg">
      <div className="container mx-auto flex items-center justify-between px-4 py-4">
        <Link to="/" className="flex items-center gap-2 text-xl font-bold">
          <Ticket className="h-6 w-6 text-primary" />
          <span className="text-foreground">MinMaxValue</span>
        </Link>
        
        <div className="flex items-center gap-4">
          <Link to="/browse">
            <Button variant="ghost" className="w-32 justify-start">
              <Search className="h-4 w-4 mr-2" />
              {t('nav.browse')}
            </Button>
          </Link>
          
          {user ? (
            <div className="flex items-center gap-1">
              <Link to="/list-ticket">
                <Button variant="ghost" className="w-32 justify-start">
                  <Ticket className="h-4 w-4 mr-2" />
                  {t('nav.listTicket')}
                </Button>
              </Link>
              
              <DropdownMenu open={langDropdownOpen} onOpenChange={setLangDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-10 w-10 flex items-center justify-center" title="Change Language">
                    <span className="text-lg leading-none">{languageFlag}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40 bg-background z-50">
                  <DropdownMenuItem 
                    onClick={() => {
                      i18n.changeLanguage('en');
                      setLangDropdownOpen(false);
                    }}
                    className="cursor-pointer flex items-center gap-2"
                  >
                    <span className="text-xl">🇬🇧</span>
                    <span>English</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => {
                      i18n.changeLanguage('cs');
                      setLangDropdownOpen(false);
                    }}
                    className="cursor-pointer flex items-center gap-2"
                  >
                    <span className="text-xl">🇨🇿</span>
                    <span>Čeština</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 px-3">
                    <Menu className="h-4 w-4" />
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        {username ? username.charAt(0).toUpperCase() : "U"}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem asChild>
                    <Link to="/account" className="flex items-center cursor-pointer">
                      <UserIcon className="h-4 w-4 mr-2" />
                      My Profile
                    </Link>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem asChild>
                    <Link to="/watchlist" className="flex items-center cursor-pointer">
                      <Heart className="h-4 w-4 mr-2" />
                      {t('nav.watchlist')}
                    </Link>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem asChild>
                    <Link to="/my-listings" className="flex items-center cursor-pointer">
                      <Ticket className="h-4 w-4 mr-2" />
                      {t('nav.myListings')}
                    </Link>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem asChild>
                    <Link to="/seller-dashboard" className="flex items-center cursor-pointer">
                      <Wallet className="h-4 w-4 mr-2" />
                      {t('nav.sellerDashboard')}
                    </Link>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem asChild>
                    <Link to="/ticket-history" className="flex items-center cursor-pointer">
                      <History className="h-4 w-4 mr-2" />
                      {t('nav.ticketHistory')}
                    </Link>
                  </DropdownMenuItem>
                  
                  {isCasinoUser && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link to="/casino" className="flex items-center cursor-pointer text-primary">
                          <Building2 className="h-4 w-4 mr-2" />
                          Casino Dashboard
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}

                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link to="/admin" className="flex items-center cursor-pointer text-accent">
                          <Shield className="h-4 w-4 mr-2" />
                          {t('nav.adminDashboard')}
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={handleSignOut}
                    className="cursor-pointer"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    {t('nav.signOut')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <>
              <DropdownMenu open={langDropdownOpen} onOpenChange={setLangDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-10 w-10 flex items-center justify-center" title="Change Language">
                    <span className="text-lg leading-none">{languageFlag}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40 bg-background z-50">
                  <DropdownMenuItem 
                    onClick={() => {
                      i18n.changeLanguage('en');
                      setLangDropdownOpen(false);
                    }}
                    className="cursor-pointer flex items-center gap-2"
                  >
                    <span className="text-xl">🇬🇧</span>
                    <span>English</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => {
                      i18n.changeLanguage('cs');
                      setLangDropdownOpen(false);
                    }}
                    className="cursor-pointer flex items-center gap-2"
                  >
                    <span className="text-xl">🇨🇿</span>
                    <span>Čeština</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Link to="/auth">
                <Button>{t('nav.signIn')}</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
