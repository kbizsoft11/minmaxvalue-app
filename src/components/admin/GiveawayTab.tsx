import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Gift, Instagram, CheckCircle, Users, FileText, Trash2, CalendarIcon, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
interface GiveawayEntry {
  id: string;
  email: string;
  giveaway_name: string;
  survey_completed: boolean;
  instagram_followed: boolean;
  created_at: string;
}

interface SurveyResponse {
  id: string;
  giveaway_entry_id: string;
  question_number: number;
  question_text: string;
  answer: string;
}

interface GiveawayStats {
  totalEntries: number;
  surveyCompleted: number;
  instagramFollowed: number;
  last24Hours: number;
  last7Days: number;
}

const GiveawayTab = () => {
  const { toast } = useToast();
  const [entries, setEntries] = useState<GiveawayEntry[]>([]);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [stats, setStats] = useState<GiveawayStats>({
    totalEntries: 0,
    surveyCompleted: 0,
    instagramFollowed: 0,
    last24Hours: 0,
    last7Days: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<GiveawayEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  useEffect(() => {
    fetchGiveawayData();
  }, [dateFrom, dateTo]);

  const fetchGiveawayData = async () => {
    setLoading(true);
    
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Build query with optional date filters
    let query = supabase
      .from("giveaway_entries")
      .select("*")
      .order("created_at", { ascending: false });

    if (dateFrom) {
      query = query.gte("created_at", dateFrom.toISOString());
    }
    if (dateTo) {
      // Add 1 day to include the entire end date
      const endDate = new Date(dateTo);
      endDate.setDate(endDate.getDate() + 1);
      query = query.lt("created_at", endDate.toISOString());
    }

    const { data: entriesData } = await query;

    // Fetch survey responses
    const { data: responsesData } = await supabase
      .from("survey_responses")
      .select("*")
      .order("question_number", { ascending: true });

    if (entriesData) {
      setEntries(entriesData);
      
      const surveyCompleted = entriesData.filter(e => e.survey_completed).length;
      const instagramFollowed = entriesData.filter(e => e.instagram_followed).length;
      const last24Hours = entriesData.filter(e => e.created_at >= oneDayAgo).length;
      const last7Days = entriesData.filter(e => e.created_at >= oneWeekAgo).length;

      setStats({
        totalEntries: entriesData.length,
        surveyCompleted,
        instagramFollowed,
        last24Hours,
        last7Days,
      });
    }

    if (responsesData) {
      setResponses(responsesData);
    }

    setLoading(false);
  };

  const getEntryResponses = (entryId: string) => {
    return responses.filter(r => r.giveaway_entry_id === entryId);
  };

  const handleDeleteEntry = async () => {
    if (!deleteEntry) return;
    
    setDeleting(true);
    
    // Delete survey responses first (foreign key constraint)
    await supabase
      .from("survey_responses")
      .delete()
      .eq("giveaway_entry_id", deleteEntry.id);
    
    // Delete giveaway entry
    const { error } = await supabase
      .from("giveaway_entries")
      .delete()
      .eq("id", deleteEntry.id);
    
    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete entry.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Deleted",
        description: `Entry for ${deleteEntry.email} has been removed.`,
      });
      fetchGiveawayData();
    }
    
    setDeleting(false);
    setDeleteEntry(null);
  };

  const exportToCSV = () => {
    // Create CSV content
    const headers = ["Email", "Giveaway", "Survey Completed", "Instagram Followed", "Joined At", "Q1 Answer", "Q2 Answer", "Q3 Answer", "Q4 Answer", "Q5 Answer"];
    
    const rows = entries.map(entry => {
      const entryResponses = getEntryResponses(entry.id);
      const answers = [1, 2, 3, 4, 5].map(qNum => {
        const response = entryResponses.find(r => r.question_number === qNum);
        return response?.answer || "";
      });
      
      return [
        entry.email,
        entry.giveaway_name,
        entry.survey_completed ? "Yes" : "No",
        entry.instagram_followed ? "Yes" : "No",
        new Date(entry.created_at).toLocaleDateString(),
        ...answers,
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    // Download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `giveaway_entries_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();

    toast({
      title: "Export Complete",
      description: `Exported ${entries.length} entries to CSV.`,
    });
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading giveaway data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Gift className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalEntries}</p>
              <p className="text-xs text-muted-foreground">Total Entries</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.surveyCompleted}</p>
              <p className="text-xs text-muted-foreground">Survey Done</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-pink-500/10">
              <Instagram className="h-5 w-5 text-pink-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.instagramFollowed}</p>
              <p className="text-xs text-muted-foreground">IG Followed</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Users className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.last24Hours}</p>
              <p className="text-xs text-muted-foreground">Last 24h</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10">
              <FileText className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.last7Days}</p>
              <p className="text-xs text-muted-foreground">Last 7 Days</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters and Export */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFrom ? format(dateFrom, "MMM d, yyyy") : "From"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateFrom}
                onSelect={setDateFrom}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          
          <span className="text-muted-foreground">—</span>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateTo ? format(dateTo, "MMM d, yyyy") : "To"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateTo}
                onSelect={setDateTo}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          
          {(dateFrom || dateTo) && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                setDateFrom(undefined);
                setDateTo(undefined);
              }}
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
        
        <Button onClick={exportToCSV} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Entries Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Giveaway</TableHead>
              <TableHead>Survey</TableHead>
              <TableHead>Instagram</TableHead>
              <TableHead>Entries</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Responses</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => {
              const entryResponses = getEntryResponses(entry.id);
              const entryCount = 1 + (entry.instagram_followed ? 1 : 0);
              
              return (
                <>
                  <TableRow key={entry.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedEntry(selectedEntry === entry.id ? null : entry.id)}>
                    <TableCell className="font-medium">{entry.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {entry.giveaway_name.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {entry.survey_completed ? (
                        <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Done
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {entry.instagram_followed ? (
                        <Badge className="bg-pink-500/10 text-pink-500 border-pink-500/20">
                          <Instagram className="h-3 w-3 mr-1" />
                          Yes
                        </Badge>
                      ) : (
                        <Badge variant="secondary">No</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{entryCount}x</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(entry.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">
                        {selectedEntry === entry.id ? "Hide" : "View"}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteEntry(entry);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  
                  {selectedEntry === entry.id && entryResponses.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="bg-muted/30 p-4">
                        <div className="space-y-2">
                          <p className="font-medium text-sm mb-3">Survey Responses:</p>
                          {entryResponses.map((response) => (
                            <div key={response.id} className="text-sm">
                              <span className="text-muted-foreground">Q{response.question_number}:</span>{" "}
                              <span className="text-foreground">{response.answer}</span>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
            {entries.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No giveaway entries yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteEntry} onOpenChange={() => setDeleteEntry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Giveaway Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the entry for <strong>{deleteEntry?.email}</strong>? 
              This will permanently remove the entry and all associated survey responses.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEntry}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default GiveawayTab;
