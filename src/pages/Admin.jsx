import { useState, useRef, useMemo } from "react";
import { Settings, Users, Vote, BarChart3, Plus, Trash2, Power, UserPlus, Shield, ImagePlus, X, Pencil, KeyRound, Search, Upload, FileText, AlertCircle, CheckCircle2, Archive, RotateCcw, UserX, UserCheck, History } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import StatCard from "@/components/StatCard";
import ElectionScheduleForm from "@/components/ElectionScheduleForm";
import ElectionInfoForm from "@/components/ElectionInfoForm";
import { useNavigate } from "react-router-dom";



// ─── CSV parsers ─────────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z_]/g, '_'));
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
    // Normalise column aliases
    return {
      lrn: obj.lrn ?? obj.learner_reference_number ?? '',
      full_name: obj.full_name ?? obj.name ?? obj.fullname ?? '',
      grade_level: obj.grade_level ?? obj.grade ?? '',
      section: obj.section ?? '',
    };
  });
}

function parseCandidateCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z_]/g, '_'));
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
    return {
      name: obj.name ?? obj.full_name ?? obj.fullname ?? '',
      position: obj.position ?? obj.position_title ?? obj.title ?? '',
      grade_level: obj.grade_level ?? obj.grade ?? '',
      section: obj.section ?? '',
      party_list: obj.party_list ?? obj.party ?? '',
      motto: obj.motto ?? '',
    };
  });
}

// ─── CSV template contents ───────────────────────────────────────────────────
const CSV_TEMPLATE = `lrn,full_name,grade_level,section
123456789012,Juan dela Cruz,Grade 7,Sampaguita
234567890123,Maria Santos,Grade 8,Rosal
`;

const CANDIDATE_CSV_TEMPLATE = `name,position,grade_level,section,party_list,motto
Juan Dela Cruz,President,Grade 12,ICT,Agila Party,Lead with integrity and action
Maria Santos,Vice President,Grade 11,Cookery,Siklab Party,Service for all
`;

const GRADE_SECTIONS = {
  "Grade 7": ["Gold", "Silver", "Bronze"],
  "Grade 8": ["Pearl", "Ruby", "Diamond"],
  "Grade 9": ["Wisdom", "Excellence", "Integrity"],
  "Grade 10": ["Fortitude", "Resilience", "Leadership"],
  "Grade 11": ["ICT", "Cookery", "Tourism"],
  "Grade 12": ["ICT", "Cookery", "Tourism"]
};

export default function Admin() {
  const [activeTab, setActiveTab] = useState("overview");
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Add candidate form state
  const [newCandidate, setNewCandidate] = useState({ name: "", position_id: "", grade_level: "", section: "", party_list: "", motto: "" });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const fileInputRef = useRef(null);
  const [formErrors, setFormErrors] = useState({});
  const [editFormErrors, setEditFormErrors] = useState({});

  // Edit candidate state
  const [editCandidate, setEditCandidate] = useState(null);
  const [editPhotoFile, setEditPhotoFile] = useState(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState(null);
  const editFileInputRef = useRef(null);
  const [candidateSearch, setCandidateSearch] = useState("");

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [archiveSearch, setArchiveSearch] = useState("");
  const [archiveCandidateSearch, setArchiveCandidateSearch] = useState("");
  const [archiveSubTab, setArchiveSubTab] = useState("voters");

  // Archive election results state
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

  // Voter management state
  const [newVoter, setNewVoter] = useState({ lrn: "", full_name: "", grade_level: "", section: "" });
  const [editVoter, setEditVoter] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [voterSearch, setVoterSearch] = useState("");

  // Bulk upload state
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkPreview, setBulkPreview] = useState(null); // parsed rows
  const [bulkResult, setBulkResult] = useState(null);   // server response
  const bulkFileInputRef = useRef(null);

  // Bulk upload candidates state
  const [bulkCandidateFile, setBulkCandidateFile] = useState(null);
  const [bulkCandidatePreview, setBulkCandidatePreview] = useState(null);
  const [bulkCandidateResult, setBulkCandidateResult] = useState(null);
  const bulkCandidateFileInputRef = useRef(null);

  const openEditModal = (c) => {
    setEditCandidate({ id: c.id, name: c.name, position_id: c.position_id, grade_level: c.grade_level, section: c.section, party_list: c.party_list, motto: c.motto || '' });
    setEditPhotoFile(null);
    setEditPhotoPreview(c.avatar_url ? c.avatar_url : null);
  };

  const closeEditModal = () => {
    setEditCandidate(null);
    setEditPhotoFile(null);
    setEditPhotoPreview(null);
    setEditFormErrors({});
  };

  const { data: positions } = useQuery({ queryKey: ["positions"], queryFn: () => api.get('/positions') });
  const { data: candidates } = useQuery({ queryKey: ["candidates"], queryFn: () => api.get('/candidates') });
  const { data: settings } = useQuery({ queryKey: ["election-settings"], queryFn: () => api.get('/election-settings'), refetchInterval: 10000 });
  const { data: stats } = useQuery({ queryKey: ["admin-stats"], queryFn: () => api.get('/stats') });
  const { data: voters } = useQuery({ queryKey: ["voters"], queryFn: () => api.get('/voters'), enabled: isAdmin });

  const profileCount = stats?.voterCount ?? 0;
  const votedCount = stats?.votedCount ?? 0;

  const validateAddForm = () => {
    const errors = {};
    if (!newCandidate.name.trim()) errors.name = "Full name is required.";
    if (!newCandidate.position_id) errors.position_id = "Please select a position.";
    if (!newCandidate.grade_level) errors.grade_level = "Please select a grade level.";
    if (!newCandidate.section) errors.section = "Please select a section.";
    if (!newCandidate.party_list.trim()) errors.party_list = "Party list is required.";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const addCandidate = useMutation({
    mutationFn: async () => {
      if (!validateAddForm()) throw new Error("Please fill in all required fields.");
      const formData = new FormData();
      formData.append('name', newCandidate.name);
      formData.append('position_id', newCandidate.position_id);
      formData.append('grade_level', newCandidate.grade_level);
      formData.append('section', newCandidate.section);
      formData.append('party_list', newCandidate.party_list);
      formData.append('motto', newCandidate.motto);
      if (photoFile) formData.append('photo', photoFile);
      await api.upload('/candidates', formData);
    },
    onSuccess: () => {
      toast({ title: "Candidate added!" });
      setNewCandidate({ name: "", position_id: "", grade_level: "", section: "", party_list: "", motto: "" });
      setFormErrors({});
      setPhotoFile(null);
      setPhotoPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
    },
    onError: (err) => { if (err.message !== "Please fill in all required fields.") toast({ title: "Failed", description: err.message, variant: "destructive" }); },
  });


  const archiveCandidate = useMutation({
    mutationFn: async (id) => { await api.patch(`/candidates/${id}/archive`); },
    onSuccess: () => {
      toast({ title: "Candidate archived", description: "The candidate has been moved to the archive." });
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      queryClient.invalidateQueries({ queryKey: ["archived-candidates"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (err) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });


  const validateEditForm = () => {
    const errors = {};
    if (!editCandidate?.name?.trim()) errors.name = "Full name is required.";
    if (!editCandidate?.position_id) errors.position_id = "Please select a position.";
    if (!editCandidate?.grade_level) errors.grade_level = "Please select a grade level.";
    if (!editCandidate?.section) errors.section = "Please select a section.";
    if (!editCandidate?.party_list?.trim()) errors.party_list = "Party list is required.";
    setEditFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const updateCandidate = useMutation({
    mutationFn: async () => {
      if (!validateEditForm()) throw new Error("Please fill in all required fields.");
      const formData = new FormData();
      formData.append('name', editCandidate.name);
      formData.append('position_id', editCandidate.position_id);
      formData.append('grade_level', editCandidate.grade_level);
      formData.append('section', editCandidate.section);
      formData.append('party_list', editCandidate.party_list);
      formData.append('motto', editCandidate.motto);
      if (editPhotoFile) formData.append('photo', editPhotoFile);
      await api.uploadPut(`/candidates/${editCandidate.id}`, formData);
    },
    onSuccess: () => {
      toast({ title: "Candidate updated!" });
      closeEditModal();
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
    },
    onError: (err) => { if (err.message !== "Please fill in all required fields.") toast({ title: "Failed", description: err.message, variant: "destructive" }); },
  });

  const [showEarlyStartConfirm, setShowEarlyStartConfirm] = useState(false);

  const updateStatus = useMutation({
    mutationFn: async (status) => {
      if (!settings?.id) return;
      await api.put(`/election-settings/${settings.id}`, { status });
    },
    onSuccess: (data, variables) => {
      if (variables === "ongoing") {
        toast({
          title: "Election Started!",
          description: "Voting is now active. All voters can now cast their votes for the new election.",
        });
      } else {
        toast({ title: "Election status updated" });
      }
      queryClient.invalidateQueries({ queryKey: ["election-settings"] });
      queryClient.invalidateQueries({ queryKey: ["voters"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      queryClient.invalidateQueries({ queryKey: ["vote-counts"] });
      queryClient.invalidateQueries({ queryKey: ["vote-counts-home"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["election-history"] });
      queryClient.invalidateQueries({ queryKey: ["archived-results"] });
      queryClient.invalidateQueries({ queryKey: ["auth-me"] });
    },
    onError: (err) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const [showExpiredEndConfirm, setShowExpiredEndConfirm] = useState(false);

  const handleStartElection = () => {
    if (!settings) return;

    const dateStr = settings.election_date instanceof Date
      ? settings.election_date.toISOString().slice(0, 10)
      : String(settings.election_date || '').slice(0, 10);

    if (dateStr && settings.voting_end) {
      const [year, month, day] = dateStr.split('-').map(Number);
      const [endH, endM, endS = 0] = String(settings.voting_end).split(':').map(Number);
      const endDateTime = new Date(year, month - 1, day, endH, endM, endS);
      const now = new Date();

      // Trapping: Prompt to extend end time & start if configured end time has already passed
      if (now >= endDateTime) {
        setShowExpiredEndConfirm(true);
        return;
      }

      // Trapping: Prompt confirmation if voting start time has not arrived yet
      if (settings.voting_start) {
        const [startH, startM, startS = 0] = String(settings.voting_start).split(':').map(Number);
        const startDateTime = new Date(year, month - 1, day, startH, startM, startS);
        if (now < startDateTime) {
          setShowEarlyStartConfirm(true);
          return;
        }
      }
    }

    updateStatus.mutate("ongoing");
  };

  const handleExtendAndStart = () => {
    const todayStr = new Date().toLocaleDateString('sv-SE');
    updateSchedule.mutate({
      name: settings?.name || "SSLG Election 2026",
      election_date: todayStr,
      voting_start: settings?.voting_start || "08:00:00",
      voting_end: "23:59:00",
      auto_end_enabled: settings?.auto_end_enabled ?? true,
    });
    updateStatus.mutate("ongoing");
    setShowExpiredEndConfirm(false);
  };

  const updateSchedule = useMutation({
    mutationFn: async (fields) => {
      if (!settings?.id) return;
      await api.put(`/election-settings/${settings.id}`, fields);
    },
    onSuccess: () => { toast({ title: "Schedule saved!", description: "Election schedule updated." }); queryClient.invalidateQueries({ queryKey: ["election-settings"] }); },
    onError: (err) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  // Archive election results to history
  const archiveResults = useMutation({
    mutationFn: async () => {
      await api.post('/election-history/archive');
    },
    onSuccess: (data) => {
      toast({ title: "Results archived!", description: "Election results have been saved to history. Students can view them under Past Elections." });
      setShowArchiveConfirm(false);
      queryClient.invalidateQueries({ queryKey: ["election-history"] });
    },
    onError: (err) => {
      toast({ title: "Failed to archive", description: err.message, variant: "destructive" });
      setShowArchiveConfirm(false);
    },
  });

  const deleteHistory = useMutation({
    mutationFn: async (schoolYear) => {
      await api.delete(`/election-history/${encodeURIComponent(schoolYear)}`);
    },
    onSuccess: () => {
      toast({ title: "Election history deleted" });
      queryClient.invalidateQueries({ queryKey: ["election-history"] });
      queryClient.invalidateQueries({ queryKey: ["archived-results"] });
    },
    onError: (err) => toast({ title: "Failed to delete", description: err.message, variant: "destructive" }),
  });

  const { data: electionHistory } = useQuery({
    queryKey: ["election-history"],
    queryFn: () => api.get('/election-history'),
  });

  const updateInfo = useMutation({
    mutationFn: async (fields) => {
      if (!settings?.id) return;
      await api.put(`/election-settings/${settings.id}`, fields);
    },
    onSuccess: () => { toast({ title: "Info saved!", description: "Election info and footer school name updated." }); queryClient.invalidateQueries({ queryKey: ["election-settings"] }); },
    onError: (err) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  // Voter mutations
  const addVoter = useMutation({
    mutationFn: async () => {
      if (!newVoter.lrn || !newVoter.full_name) throw new Error("LRN and full name are required");
      await api.post('/voters', newVoter);
    },
    onSuccess: () => {
      toast({ title: "Voter added!", description: "Default password is the LRN." });
      setNewVoter({ lrn: "", full_name: "", grade_level: "", section: "" });
      queryClient.invalidateQueries({ queryKey: ["voters"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (err) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const updateVoter = useMutation({
    mutationFn: async () => {
      if (!editVoter || !editVoter.lrn || !editVoter.full_name) throw new Error("LRN and full name are required");
      await api.put(`/voters/${editVoter.id}`, editVoter);
    },
    onSuccess: () => {
      toast({ title: "Voter updated!" });
      setEditVoter(null);
      queryClient.invalidateQueries({ queryKey: ["voters"] });
    },
    onError: (err) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const deleteVoter = useMutation({
    mutationFn: async (id) => { await api.delete(`/voters/${id}`); },
    onSuccess: () => {
      toast({ title: "Voter archived", description: "The voter has been moved to the Archive tab." });
      queryClient.invalidateQueries({ queryKey: ["voters"] });
      queryClient.invalidateQueries({ queryKey: ["archived-voters"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (err) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const { data: archivedVoters, isLoading: archivedLoading } = useQuery({
    queryKey: ["archived-voters"],
    queryFn: () => api.get('/voters/archived'),
    enabled: isAdmin,
  });

  const { data: archivedCandidates, isLoading: archivedCandidatesLoading } = useQuery({
    queryKey: ["archived-candidates"],
    queryFn: () => api.get('/candidates/archived'),
    enabled: isAdmin,
  });

  const restoreVoter = useMutation({
    mutationFn: async (id) => { await api.post(`/voters/${id}/restore`); },
    onSuccess: () => {
      toast({ title: "Voter restored", description: "The voter has been moved back to the active voters list." });
      queryClient.invalidateQueries({ queryKey: ["archived-voters"] });
      queryClient.invalidateQueries({ queryKey: ["voters"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (err) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const permanentDeleteVoter = useMutation({
    mutationFn: async (id) => { await api.delete(`/voters/${id}/permanent`); },
    onSuccess: () => {
      toast({ title: "Voter permanently deleted", description: "The voter has been permanently removed from the system." });
      queryClient.invalidateQueries({ queryKey: ["archived-voters"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (err) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const restoreCandidate = useMutation({
    mutationFn: async (id) => { await api.post(`/candidates/${id}/restore`); },
    onSuccess: () => {
      toast({ title: "Candidate restored", description: "The candidate has been moved back to the active candidates list." });
      queryClient.invalidateQueries({ queryKey: ["archived-candidates"] });
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (err) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const permanentDeleteCandidate = useMutation({
    mutationFn: async (id) => { await api.delete(`/candidates/${id}/permanent`); },
    onSuccess: () => {
      toast({ title: "Candidate permanently deleted", description: "The candidate has been permanently removed from the system." });
      queryClient.invalidateQueries({ queryKey: ["archived-candidates"] });
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (err) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const resetPassword = useMutation({
    mutationFn: async (id) => { await api.post(`/voters/${id}/reset-password`); },
    onSuccess: () => {
      toast({ title: "Password reset!", description: "Password has been reset to the voter's LRN." });
      setResetTarget(null);
      queryClient.invalidateQueries({ queryKey: ["voters"] });
    },
    onError: (err) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const [showResetAllVotedConfirm, setShowResetAllVotedConfirm] = useState(false);

  const resetAllVoted = useMutation({
    mutationFn: async () => {
      await api.post('/voters/reset-all-voted');
    },
    onSuccess: () => {
      toast({
        title: "All voting statuses reset!",
        description: "All voters can now cast a vote, and vote counts have been reset to 0.",
      });
      queryClient.invalidateQueries({ queryKey: ["voters"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      queryClient.invalidateQueries({ queryKey: ["vote-counts"] });
      queryClient.invalidateQueries({ queryKey: ["vote-counts-home"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["election-history"] });
      queryClient.invalidateQueries({ queryKey: ["archived-results"] });
      setShowResetAllVotedConfirm(false);
    },
    onError: (err) => toast({ title: "Reset failed", description: err.message, variant: "destructive" }),
  });

  // Bulk upload mutation
  const bulkUpload = useMutation({
    mutationFn: async (rows) => {
      return await api.post('/voters/bulk', { voters: rows });
    },
    onSuccess: (data) => {
      setBulkResult(data);
      setBulkPreview(null);
      setBulkFile(null);
      if (bulkFileInputRef.current) bulkFileInputRef.current.value = '';
      queryClient.invalidateQueries({ queryKey: ["voters"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast({
        title: `Bulk upload complete`,
        description: `${data.inserted} inserted, ${data.skipped} skipped, ${data.errors} errors`,
      });
    },
    onError: (err) => toast({ title: "Bulk upload failed", description: err.message, variant: "destructive" }),
  });

  const handleBulkFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setBulkFile(file);
    setBulkResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCSV(ev.target.result);
      setBulkPreview(rows);
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'voters_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Bulk upload candidates mutation
  const bulkUploadCandidates = useMutation({
    mutationFn: async (rows) => {
      return await api.post('/candidates/bulk', { candidates: rows });
    },
    onSuccess: (data) => {
      setBulkCandidateResult(data);
      setBulkCandidatePreview(null);
      setBulkCandidateFile(null);
      if (bulkCandidateFileInputRef.current) bulkCandidateFileInputRef.current.value = '';
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast({
        title: `Bulk upload complete`,
        description: `${data.inserted} inserted, ${data.skipped} skipped, ${data.errors} errors`,
      });
    },
    onError: (err) => toast({ title: "Bulk upload failed", description: err.message, variant: "destructive" }),
  });

  const handleBulkCandidateFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setBulkCandidateFile(file);
    setBulkCandidateResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCandidateCSV(ev.target.result);
      setBulkCandidatePreview(rows);
    };
    reader.readAsText(file);
  };

  const downloadCandidateTemplate = () => {
    const blob = new Blob([CANDIDATE_CSV_TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'candidates_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isAdmin) {
    return (
      <div className="container py-16 text-center animate-fade-in">
        <Shield className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-display font-bold text-foreground mb-2">Admin Access Required</h1>
        <p className="text-muted-foreground mb-6">You need admin privileges to access this page.</p>
        <button onClick={() => navigate("/")} className="px-6 py-3 rounded-xl gradient-navy text-primary-foreground font-semibold">Back to Dashboard</button>
      </div>
    );
  }

  const tabs = [
    { id: "overview",    label: "Overview",    icon: BarChart3 },
    { id: "voters",      label: "Voters",      icon: Users },
    { id: "candidates",  label: "Candidates",  icon: Users },
    { id: "archive",     label: "Archive",     icon: Archive },
    { id: "settings",    label: "Settings",    icon: Settings },
  ];

  const turnout = profileCount && profileCount > 0 ? ((votedCount) / profileCount * 100).toFixed(1) : "0";

  const filteredVoters = (voters ?? []).filter((v) => {
    if (!voterSearch) return true;
    const q = voterSearch.toLowerCase();
    return v.lrn?.toLowerCase().includes(q) || v.full_name?.toLowerCase().includes(q) || v.section?.toLowerCase().includes(q);
  });

  const filteredCandidates = (candidates ?? []).filter((c) => {
    if (!candidateSearch) return true;
    const q = candidateSearch.toLowerCase();
    const pos = (positions ?? []).find((p) => p.id === c.position_id);
    return c.name?.toLowerCase().includes(q) ||
           pos?.title?.toLowerCase().includes(q) ||
           c.party_list?.toLowerCase().includes(q) ||
           c.section?.toLowerCase().includes(q);
  });

  const filteredArchived = (archivedVoters ?? []).filter((v) => {
    if (!archiveSearch) return true;
    const q = archiveSearch.toLowerCase();
    return v.lrn?.toLowerCase().includes(q) || v.full_name?.toLowerCase().includes(q) || v.section?.toLowerCase().includes(q);
  });

  const filteredArchivedCandidates = (archivedCandidates ?? []).filter((c) => {
    if (!archiveCandidateSearch) return true;
    const q = archiveCandidateSearch.toLowerCase();
    return c.name?.toLowerCase().includes(q) || c.position_title?.toLowerCase().includes(q) || c.party_list?.toLowerCase().includes(q);
  });

  return (
    <div className="container py-8 md:py-12">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground flex items-center gap-3">
          <Settings className="w-8 h-8 text-gold" /> Admin Panel
        </h1>
        <p className="text-muted-foreground mt-1">Manage voters, candidates, election settings, and monitor results</p>
      </div>

      <div className="flex gap-1 p-1 bg-muted rounded-xl mb-8 overflow-x-auto">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="space-y-8 animate-fade-in">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <StatCard icon={Users} label="Registered" value={profileCount?.toLocaleString() ?? "0"} />
            <StatCard icon={Vote} label="Voted" value={votedCount?.toLocaleString() ?? "0"} variant="gold" delay={100} />
            <StatCard icon={BarChart3} label="Turnout" value={`${turnout}%`} delay={200} />
            <StatCard icon={Users} label="Candidates" value={(candidates ?? []).length} variant="navy" delay={300} />
          </div>
        </div>
      )}

      {/* ── Voters Tab ── */}
      {activeTab === "voters" && (
        <div className="animate-fade-in space-y-6">

          {/* ── Bulk Upload Section ── */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-elegant">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h3 className="font-display font-bold text-foreground text-lg flex items-center gap-2">
                <Upload className="w-5 h-5 text-gold" /> Bulk Upload Voters
              </h3>
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted text-foreground text-xs font-medium hover:bg-muted/80 transition-colors"
              >
                <FileText className="w-3.5 h-3.5" /> Download CSV Template
              </button>
            </div>

            <p className="text-xs text-muted-foreground mb-4">
              Upload a CSV file with columns: <span className="font-mono text-foreground">lrn, full_name, grade_level, section</span>. Existing LRNs are automatically skipped. Default password is the LRN.
            </p>

            <label className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-border hover:border-ring cursor-pointer transition-colors bg-background">
              <Upload className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <span className="text-sm text-muted-foreground">{bulkFile ? bulkFile.name : 'Click to select a CSV file…'}</span>
              <input
                ref={bulkFileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleBulkFileChange}
              />
            </label>

            {/* Preview table */}
            {bulkPreview && bulkPreview.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                  Preview — {bulkPreview.length} row{bulkPreview.length !== 1 ? 's' : ''} detected
                </p>
                <div className="max-h-52 overflow-y-auto rounded-xl border border-border">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted/90 backdrop-blur-sm">
                      <tr>
                        <th className="text-left p-2.5 font-semibold text-foreground">#</th>
                        <th className="text-left p-2.5 font-semibold text-foreground">LRN</th>
                        <th className="text-left p-2.5 font-semibold text-foreground">Full Name</th>
                        <th className="text-left p-2.5 font-semibold text-foreground hidden sm:table-cell">Grade</th>
                        <th className="text-left p-2.5 font-semibold text-foreground hidden sm:table-cell">Section</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkPreview.map((row, i) => {
                        const hasError = !row.lrn || !row.full_name || !/^\d{12}$/.test(row.lrn.replace(/\D/g, ''));
                        return (
                          <tr key={i} className={`border-t border-border ${hasError ? 'bg-destructive/5' : ''}`}>
                            <td className="p-2.5 text-muted-foreground">{i + 1}</td>
                            <td className={`p-2.5 font-mono ${hasError ? 'text-destructive' : 'text-foreground'}`}>{row.lrn || <span className="italic text-destructive">missing</span>}</td>
                            <td className={`p-2.5 uppercase ${!row.full_name ? 'text-destructive italic' : 'text-foreground'}`}>{row.full_name || 'missing'}</td>
                            <td className="p-2.5 text-muted-foreground hidden sm:table-cell">{row.grade_level || '—'}</td>
                            <td className="p-2.5 text-muted-foreground hidden sm:table-cell">{row.section || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center gap-3 mt-4">
                  <button
                    onClick={() => bulkUpload.mutate(bulkPreview)}
                    disabled={bulkUpload.isPending}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-gold text-accent-foreground font-medium text-sm shadow-gold hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {bulkUpload.isPending
                      ? <div className="w-4 h-4 border-2 border-accent-foreground/30 border-t-accent-foreground rounded-full animate-spin" />
                      : <Upload className="w-4 h-4" />}
                    Upload {bulkPreview.length} Voters
                  </button>
                  <button
                    onClick={() => { setBulkPreview(null); setBulkFile(null); if (bulkFileInputRef.current) bulkFileInputRef.current.value = ''; }}
                    className="px-4 py-2.5 rounded-xl bg-muted text-foreground text-sm font-medium hover:bg-muted/80 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            {/* Upload result summary */}
            {bulkResult && (
              <div className="mt-4 rounded-xl border border-border bg-muted/30 p-4 space-y-2">
                <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success" /> Upload Summary
                </p>
                <div className="flex gap-4 text-xs flex-wrap">
                  <span className="flex items-center gap-1.5 text-success font-medium"><CheckCircle2 className="w-3.5 h-3.5" /> {bulkResult.inserted} inserted</span>
                  <span className="flex items-center gap-1.5 text-muted-foreground font-medium"><AlertCircle className="w-3.5 h-3.5" /> {bulkResult.skipped} skipped (duplicate LRN)</span>
                  {bulkResult.errors > 0 && (
                    <span className="flex items-center gap-1.5 text-destructive font-medium"><X className="w-3.5 h-3.5" /> {bulkResult.errors} errors</span>
                  )}
                </div>
                {bulkResult.errorList?.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {bulkResult.errorList.map((e, i) => (
                      <p key={i} className="text-xs text-destructive">{e.row}{e.lrn ? ` (${e.lrn})` : ''}: {e.reason}</p>
                    ))}
                  </div>
                )}
                <button onClick={() => setBulkResult(null)} className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-1">Dismiss</button>
              </div>
            )}
          </div>

          {/* Add single voter form */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-elegant">
            <h3 className="font-display font-bold text-foreground text-lg mb-4 flex items-center gap-2"><UserPlus className="w-5 h-5 text-gold" /> Add New Voter</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <input type="text" placeholder="LRN (12 digits)" value={newVoter.lrn} onChange={(e) => setNewVoter(p => ({ ...p, lrn: e.target.value.replace(/\D/g, '').slice(0, 12) }))} maxLength={12} inputMode="numeric" pattern="[0-9]{12}"
                className="px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground" />
              <input type="text" placeholder="Full Name" value={newVoter.full_name} onChange={(e) => setNewVoter(p => ({ ...p, full_name: e.target.value }))} maxLength={100}
                className="px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground" />
              <select
                value={newVoter.grade_level}
                onChange={(e) => setNewVoter(p => ({ ...p, grade_level: e.target.value, section: "" }))}
                className="px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select Grade Level</option>
                {Object.keys(GRADE_SECTIONS).map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <select
                value={newVoter.section}
                onChange={(e) => setNewVoter(p => ({ ...p, section: e.target.value }))}
                disabled={!newVoter.grade_level}
                className="px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              >
                <option value="">Select Section</option>
                {newVoter.grade_level && GRADE_SECTIONS[newVoter.grade_level]?.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-4 mt-4">
              <button onClick={() => addVoter.mutate()} disabled={addVoter.isPending}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-gold text-accent-foreground font-medium text-sm shadow-gold hover:opacity-90 transition-opacity disabled:opacity-50">
                <UserPlus className="w-4 h-4" /> Add Voter
              </button>
              <p className="text-xs text-muted-foreground">Default password is the LRN. Student must change it on first login.</p>
            </div>
          </div>

          {/* Search & Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type="text" placeholder="Search by LRN, name, or section..." value={voterSearch} onChange={(e) => setVoterSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
            </div>

            <button
              onClick={() => setShowResetAllVotedConfirm(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-muted text-foreground text-xs font-semibold hover:bg-muted/80 transition-colors border border-border shrink-0 justify-center"
              title="Reset voting status for all registered voters"
            >
              <RotateCcw className="w-4 h-4 text-gold" />
              Reset All Voting Statuses
            </button>
          </div>

          {/* Voters table */}
          <div className="bg-card rounded-xl border border-border overflow-hidden shadow-elegant">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left p-4 font-semibold text-foreground">LRN</th>
                    <th className="text-left p-4 font-semibold text-foreground">Full Name</th>
                    <th className="text-left p-4 font-semibold text-foreground hidden sm:table-cell">Grade &amp; Section</th>
                    <th className="text-left p-4 font-semibold text-foreground hidden md:table-cell">Status</th>
                    <th className="text-right p-4 font-semibold text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVoters.map((v) => (
                    <tr key={v.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-4 font-mono text-foreground text-xs">{v.lrn}</td>
                      <td className="p-4 font-medium text-foreground uppercase">{v.full_name}</td>
                      <td className="p-4 text-muted-foreground hidden sm:table-cell">{v.grade_level && v.section ? `${v.grade_level} — ${v.section}` : <span className="text-xs italic">Not set</span>}</td>
                      <td className="p-4 hidden md:table-cell">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {v.has_voted ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-success/15 text-success">Voted ✓</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">Not voted</span>
                          )}
                          {v.must_change_password ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gold/15 text-gold">New</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setEditVoter({ id: v.id, lrn: v.lrn, full_name: v.full_name, grade_level: v.grade_level || '', section: v.section || '' })}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Edit">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => setResetTarget({ id: v.id, name: v.full_name, lrn: v.lrn })}
                            className="p-1.5 rounded-lg text-gold hover:bg-gold/10 transition-colors" title="Reset Password">
                            <KeyRound className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDeleteTarget({ id: v.id, name: v.full_name, type: 'voter' })}
                            className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-500/10 transition-colors" title="Archive">
                            <Archive className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredVoters.length === 0 && (
                    <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">{voterSearch ? "No voters match your search." : "No voters yet. Add one above."}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {(voters ?? []).length > 0 && (
              <div className="px-4 py-3 border-t border-border bg-muted/30 text-xs text-muted-foreground">
                Showing {filteredVoters.length} of {(voters ?? []).length} voters
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "candidates" && (
        <div className="animate-fade-in space-y-6">

          {/* ── Bulk Upload Candidates Section ── */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-elegant">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h3 className="font-display font-bold text-foreground text-lg flex items-center gap-2">
                <Upload className="w-5 h-5 text-gold" /> Bulk Upload Candidates
              </h3>
              <button
                onClick={downloadCandidateTemplate}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted text-foreground text-xs font-medium hover:bg-muted/80 transition-colors"
              >
                <FileText className="w-3.5 h-3.5" /> Download CSV Template
              </button>
            </div>

            <p className="text-xs text-muted-foreground mb-4">
              Upload a CSV file with columns: <span className="font-mono text-foreground">name, position, grade_level, section, party_list, motto</span>. Existing candidate entries are automatically skipped. Position names must match available positions.
            </p>

            <label className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-border hover:border-ring cursor-pointer transition-colors bg-background">
              <Upload className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <span className="text-sm text-muted-foreground">{bulkCandidateFile ? bulkCandidateFile.name : 'Click to select a CSV file…'}</span>
              <input
                ref={bulkCandidateFileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleBulkCandidateFileChange}
              />
            </label>

            {/* Preview table */}
            {bulkCandidatePreview && bulkCandidatePreview.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                  Preview — {bulkCandidatePreview.length} row{bulkCandidatePreview.length !== 1 ? 's' : ''} detected
                </p>
                <div className="max-h-52 overflow-y-auto rounded-xl border border-border">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted/90 backdrop-blur-sm">
                      <tr>
                        <th className="text-left p-2.5 font-semibold text-foreground">#</th>
                        <th className="text-left p-2.5 font-semibold text-foreground">Name</th>
                        <th className="text-left p-2.5 font-semibold text-foreground">Position</th>
                        <th className="text-left p-2.5 font-semibold text-foreground hidden sm:table-cell">Grade</th>
                        <th className="text-left p-2.5 font-semibold text-foreground hidden sm:table-cell">Section</th>
                        <th className="text-left p-2.5 font-semibold text-foreground">Party List</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkCandidatePreview.map((row, i) => {
                        const validPosTitles = (positions ?? []).map(p => p.title.toLowerCase());
                        const posValid = row.position && validPosTitles.includes(row.position.trim().toLowerCase());
                        const hasError = !row.name || !row.position || !posValid || !row.grade_level || !row.section || !row.party_list;
                        return (
                          <tr key={i} className={`border-t border-border ${hasError ? 'bg-destructive/5' : ''}`}>
                            <td className="p-2.5 text-muted-foreground">{i + 1}</td>
                            <td className={`p-2.5 uppercase ${!row.name ? 'text-destructive italic' : 'text-foreground font-medium'}`}>{row.name || 'missing'}</td>
                            <td className={`p-2.5 ${!posValid ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                              {row.position ? row.position : <span className="italic text-destructive">missing</span>}
                              {row.position && !posValid && <span className="text-[10px] block text-destructive">(invalid position)</span>}
                            </td>
                            <td className="p-2.5 text-muted-foreground hidden sm:table-cell">{row.grade_level || '—'}</td>
                            <td className="p-2.5 text-muted-foreground hidden sm:table-cell">{row.section || '—'}</td>
                            <td className="p-2.5 text-muted-foreground">{row.party_list || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center gap-3 mt-4">
                  <button
                    onClick={() => bulkUploadCandidates.mutate(bulkCandidatePreview)}
                    disabled={bulkUploadCandidates.isPending}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-gold text-accent-foreground font-medium text-sm shadow-gold hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {bulkUploadCandidates.isPending
                      ? <div className="w-4 h-4 border-2 border-accent-foreground/30 border-t-accent-foreground rounded-full animate-spin" />
                      : <Upload className="w-4 h-4" />}
                    Upload {bulkCandidatePreview.length} Candidates
                  </button>
                  <button
                    onClick={() => { setBulkCandidatePreview(null); setBulkCandidateFile(null); if (bulkCandidateFileInputRef.current) bulkCandidateFileInputRef.current.value = ''; }}
                    className="px-4 py-2.5 rounded-xl bg-muted text-foreground text-sm font-medium hover:bg-muted/80 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            {/* Upload result summary */}
            {bulkCandidateResult && (
              <div className="mt-4 rounded-xl border border-border bg-muted/30 p-4 space-y-2">
                <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success" /> Upload Summary
                </p>
                <div className="flex gap-4 text-xs flex-wrap">
                  <span className="flex items-center gap-1.5 text-success font-medium"><CheckCircle2 className="w-3.5 h-3.5" /> {bulkCandidateResult.inserted} inserted</span>
                  <span className="flex items-center gap-1.5 text-muted-foreground font-medium"><AlertCircle className="w-3.5 h-3.5" /> {bulkCandidateResult.skipped} skipped (duplicate)</span>
                  {bulkCandidateResult.errors > 0 && (
                    <span className="flex items-center gap-1.5 text-destructive font-medium"><X className="w-3.5 h-3.5" /> {bulkCandidateResult.errors} errors</span>
                  )}
                </div>
                {bulkCandidateResult.errorList?.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {bulkCandidateResult.errorList.map((e, i) => (
                      <p key={i} className="text-xs text-destructive">{e.row}{e.name ? ` (${e.name})` : ''}: {e.reason}</p>
                    ))}
                  </div>
                )}
                <button onClick={() => setBulkCandidateResult(null)} className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-1">Dismiss</button>
              </div>
            )}
          </div>
          {/* Add form */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-elegant">
            <h3 className="font-display font-bold text-foreground text-lg mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-gold" /> Add Candidate
            </h3>
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {/* Full Name */}
                  <div>
                    <input type="text" placeholder="Full Name" value={newCandidate.name}
                      onChange={(e) => { setNewCandidate(p => ({ ...p, name: e.target.value })); if (formErrors.name) setFormErrors(p => ({ ...p, name: undefined })); }} maxLength={100}
                      className={`w-full px-4 py-2.5 rounded-xl bg-background border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground ${formErrors.name ? 'border-red-500 focus:ring-red-500/40' : 'border-border'}`} />
                    {formErrors.name && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{formErrors.name}</p>}
                  </div>
                  {/* Position */}
                  <div>
                    <select value={newCandidate.position_id}
                      onChange={(e) => { setNewCandidate(p => ({ ...p, position_id: e.target.value })); if (formErrors.position_id) setFormErrors(p => ({ ...p, position_id: undefined })); }}
                      className={`w-full px-4 py-2.5 rounded-xl bg-background border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring ${formErrors.position_id ? 'border-red-500 focus:ring-red-500/40' : 'border-border'}`}>
                      <option value="">Select Position</option>
                      {(positions ?? []).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </select>
                    {formErrors.position_id && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{formErrors.position_id}</p>}
                  </div>
                  {/* Grade Level */}
                  <div>
                    <select
                      value={newCandidate.grade_level}
                      onChange={(e) => { setNewCandidate(p => ({ ...p, grade_level: e.target.value, section: "" })); if (formErrors.grade_level) setFormErrors(p => ({ ...p, grade_level: undefined })); }}
                      className={`w-full px-4 py-2.5 rounded-xl bg-background border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring ${formErrors.grade_level ? 'border-red-500 focus:ring-red-500/40' : 'border-border'}`}
                    >
                      <option value="">Select Grade Level</option>
                      {Object.keys(GRADE_SECTIONS).map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                    {formErrors.grade_level && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{formErrors.grade_level}</p>}
                  </div>
                  {/* Section */}
                  <div>
                    <select
                      value={newCandidate.section}
                      onChange={(e) => { setNewCandidate(p => ({ ...p, section: e.target.value })); if (formErrors.section) setFormErrors(p => ({ ...p, section: undefined })); }}
                      disabled={!newCandidate.grade_level}
                      className={`w-full px-4 py-2.5 rounded-xl bg-background border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 ${formErrors.section ? 'border-red-500 focus:ring-red-500/40' : 'border-border'}`}
                    >
                      <option value="">Select Section</option>
                      {newCandidate.grade_level && GRADE_SECTIONS[newCandidate.grade_level]?.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    {formErrors.section && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{formErrors.section}</p>}
                  </div>
                  {/* Party List */}
                  <div>
                    <input type="text" placeholder="Party List" value={newCandidate.party_list}
                      onChange={(e) => { setNewCandidate(p => ({ ...p, party_list: e.target.value })); if (formErrors.party_list) setFormErrors(p => ({ ...p, party_list: undefined })); }} maxLength={100}
                      className={`w-full px-4 py-2.5 rounded-xl bg-background border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground ${formErrors.party_list ? 'border-red-500 focus:ring-red-500/40' : 'border-border'}`} />
                    {formErrors.party_list && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{formErrors.party_list}</p>}
                  </div>
                  {/* Motto */}
                  <div>
                    <input type="text" placeholder="Motto (optional)" value={newCandidate.motto} onChange={(e) => setNewCandidate(p => ({ ...p, motto: e.target.value }))} maxLength={200}
                      className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground" />
                  </div>
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm cursor-pointer hover:bg-muted transition-colors">
                      <ImagePlus className="w-4 h-4 text-muted-foreground" />
                      <span>{photoFile ? 'Change Photo' : 'Upload Photo'}</span>
                      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) { setPhotoFile(file); setPhotoPreview(URL.createObjectURL(file)); }
                        }} />
                    </label>
                    {photoPreview && (
                      <div className="relative">
                        <img src={photoPreview} alt="Preview" className="w-12 h-12 rounded-full object-cover border-2 border-border" />
                        <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    {!photoPreview && <span className="text-xs text-muted-foreground">Optional — default avatar will be used if no photo is uploaded</span>}
                  </div>
                </div>
                <button onClick={() => addCandidate.mutate()} disabled={addCandidate.isPending}
                  className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-gold text-accent-foreground font-medium text-sm shadow-gold hover:opacity-90 transition-opacity disabled:opacity-50">
                  <UserPlus className="w-4 h-4" /> Add Candidate
                </button>
              </>
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="text" placeholder="Search by name, position, party, or section..." value={candidateSearch} onChange={(e) => setCandidateSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
          </div>

          {/* Table */}
          <div className="bg-card rounded-xl border border-border overflow-hidden shadow-elegant">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left p-4 font-semibold text-foreground">Name</th>
                    <th className="text-left p-4 font-semibold text-foreground">Position</th>
                    <th className="text-left p-4 font-semibold text-foreground hidden sm:table-cell">Party</th>
                    <th className="text-left p-4 font-semibold text-foreground hidden md:table-cell">Section</th>
                    <th className="text-right p-4 font-semibold text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCandidates.map((c) => {
                    const pos = (positions ?? []).find((p) => p.id === c.position_id);
                    return (
                      <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="p-4 font-medium text-foreground uppercase">{c.name}</td>
                        <td className="p-4 text-muted-foreground">{pos?.title}</td>
                        <td className="p-4 text-muted-foreground hidden sm:table-cell">{c.party_list}</td>
                        <td className="p-4 text-muted-foreground hidden md:table-cell">{c.section}</td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEditModal(c)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => setDeleteTarget({ id: c.id, name: c.name, type: 'candidate' })} className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-500/10 transition-colors" title="Archive candidate">
                              <Archive className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredCandidates.length === 0 && (
                    <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">{candidateSearch ? "No candidates match your search." : "No candidates yet. Add one above."}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (for candidates, voters, and archived items) */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setDeleteTarget(null)}>
          <div className="bg-card rounded-2xl border border-border p-6 shadow-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-foreground text-lg flex items-center gap-2">
                {deleteTarget.type === 'candidate'
                  ? <><Archive className="w-5 h-5 text-amber-500" /> Archive Candidate</>
                  : deleteTarget.type === 'voter'
                  ? <><Archive className="w-5 h-5 text-amber-500" /> Archive Voter</>
                  : <><Trash2 className="w-5 h-5 text-destructive" /> Permanently Delete</>}
              </h3>
              <button onClick={() => setDeleteTarget(null)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-1">
              {(deleteTarget.type === 'candidate' || deleteTarget.type === 'voter') ? 'Are you sure you want to archive' : 'Are you sure you want to permanently delete'}
            </p>
            <p className="font-semibold text-foreground mb-5 uppercase">{deleteTarget.name}?</p>
            <p className="text-xs text-muted-foreground mb-6">
              {deleteTarget.type === 'candidate'
                ? "This candidate will be archived and removed from the ballot. You can restore them from the Archive tab."
                : deleteTarget.type === 'voter'
                ? "This voter will be moved to the Archive tab. You can restore them later."
                : "This action cannot be undone. All data will be permanently removed from the system."}
            </p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} className="px-5 py-2.5 rounded-xl bg-muted text-foreground font-medium text-sm hover:bg-muted/80 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => {
                  if (deleteTarget.type === 'voter') { deleteVoter.mutate(deleteTarget.id); }
                  else if (deleteTarget.type === 'archived') { permanentDeleteVoter.mutate(deleteTarget.id); }
                  else if (deleteTarget.type === 'archived-candidate') { permanentDeleteCandidate.mutate(deleteTarget.id); }
                  else { archiveCandidate.mutate(deleteTarget.id); }
                  setDeleteTarget(null);
                }}
                disabled={archiveCandidate.isPending || deleteVoter.isPending || permanentDeleteVoter.isPending || permanentDeleteCandidate.isPending}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-opacity disabled:opacity-50 ${
                  (deleteTarget.type === 'candidate' || deleteTarget.type === 'voter')
                    ? 'bg-amber-500 text-white hover:opacity-90'
                    : 'bg-destructive text-destructive-foreground hover:opacity-90'
                }`}
              >
                {(deleteTarget.type === 'candidate' || deleteTarget.type === 'voter')
                  ? <><Archive className="w-4 h-4" /> Archive</>
                  : <><Trash2 className="w-4 h-4" /> Delete Permanently</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Confirmation Modal */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setResetTarget(null)}>
          <div className="bg-card rounded-2xl border border-border p-6 shadow-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-foreground text-lg flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-gold" /> Reset Password
              </h3>
              <button onClick={() => setResetTarget(null)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-1">Reset password for</p>
            <p className="font-semibold text-foreground mb-2 uppercase">{resetTarget.name}</p>
            <p className="text-sm text-muted-foreground mb-5">
              The password will be reset to their LRN: <span className="font-mono font-medium text-foreground">{resetTarget.lrn}</span>
            </p>
            <p className="text-xs text-muted-foreground mb-6">The voter will be required to change their password on next login.</p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setResetTarget(null)} className="px-5 py-2.5 rounded-xl bg-muted text-foreground font-medium text-sm hover:bg-muted/80 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => resetPassword.mutate(resetTarget.id)}
                disabled={resetPassword.isPending}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-gold text-accent-foreground font-medium text-sm shadow-gold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {resetPassword.isPending
                  ? <div className="w-4 h-4 border-2 border-accent-foreground/30 border-t-accent-foreground rounded-full animate-spin" />
                  : <KeyRound className="w-4 h-4" />}
                Reset Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Voter Modal */}
      {editVoter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setEditVoter(null)}>
          <div className="bg-card rounded-2xl border border-border p-6 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-bold text-foreground text-lg flex items-center gap-2"><Pencil className="w-5 h-5 text-gold" /> Edit Voter</h3>
              <button onClick={() => setEditVoter(null)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <input type="text" placeholder="LRN (12 digits)" value={editVoter.lrn} onChange={(e) => setEditVoter(p => ({ ...p, lrn: e.target.value.replace(/\D/g, '').slice(0, 12) }))} maxLength={12} inputMode="numeric" pattern="[0-9]{12}"
                className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground" />
              <input type="text" placeholder="Full Name" value={editVoter.full_name} onChange={(e) => setEditVoter(p => ({ ...p, full_name: e.target.value }))} maxLength={100}
                className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground" />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={editVoter.grade_level}
                  onChange={(e) => setEditVoter(p => ({ ...p, grade_level: e.target.value, section: "" }))}
                  className="px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Grade Level</option>
                  {Object.keys(GRADE_SECTIONS).map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <select
                  value={editVoter.section}
                  onChange={(e) => setEditVoter(p => ({ ...p, section: e.target.value }))}
                  disabled={!editVoter.grade_level}
                  className="px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                >
                  <option value="">Section</option>
                  {editVoter.grade_level && GRADE_SECTIONS[editVoter.grade_level]?.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-border">
              <button onClick={() => setEditVoter(null)} className="px-5 py-2.5 rounded-xl bg-muted text-foreground font-medium text-sm hover:bg-muted/80 transition-colors">
                Cancel
              </button>
              <button onClick={() => updateVoter.mutate()} disabled={updateVoter.isPending}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-gold text-accent-foreground font-medium text-sm shadow-gold hover:opacity-90 transition-opacity disabled:opacity-50">
                {updateVoter.isPending ? <div className="w-4 h-4 border-2 border-accent-foreground/30 border-t-accent-foreground rounded-full animate-spin" /> : <Pencil className="w-4 h-4" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Candidate Modal */}
      {editCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={closeEditModal}>
          <div className="bg-card rounded-2xl border border-border p-6 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-bold text-foreground text-lg flex items-center gap-2"><Pencil className="w-5 h-5 text-gold" /> Edit Candidate</h3>
              <button onClick={closeEditModal} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              {/* Edit: Full Name */}
              <div>
                <input type="text" placeholder="Full Name" value={editCandidate.name}
                  onChange={(e) => { setEditCandidate(p => ({ ...p, name: e.target.value })); if (editFormErrors.name) setEditFormErrors(p => ({ ...p, name: undefined })); }} maxLength={100}
                  className={`w-full px-4 py-2.5 rounded-xl bg-background border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground ${editFormErrors.name ? 'border-red-500 focus:ring-red-500/40' : 'border-border'}`} />
                {editFormErrors.name && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{editFormErrors.name}</p>}
              </div>
              {/* Edit: Position */}
              <div>
                <select value={editCandidate.position_id}
                  onChange={(e) => { setEditCandidate(p => ({ ...p, position_id: e.target.value })); if (editFormErrors.position_id) setEditFormErrors(p => ({ ...p, position_id: undefined })); }}
                  className={`w-full px-4 py-2.5 rounded-xl bg-background border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring ${editFormErrors.position_id ? 'border-red-500 focus:ring-red-500/40' : 'border-border'}`}>
                  <option value="">Select Position</option>
                  {(positions ?? []).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
                {editFormErrors.position_id && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{editFormErrors.position_id}</p>}
              </div>
              {/* Edit: Grade Level & Section */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <select
                    value={editCandidate.grade_level}
                    onChange={(e) => { setEditCandidate(p => ({ ...p, grade_level: e.target.value, section: "" })); if (editFormErrors.grade_level) setEditFormErrors(p => ({ ...p, grade_level: undefined })); }}
                    className={`w-full px-4 py-2.5 rounded-xl bg-background border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring ${editFormErrors.grade_level ? 'border-red-500 focus:ring-red-500/40' : 'border-border'}`}
                  >
                    <option value="">Grade Level</option>
                    {Object.keys(GRADE_SECTIONS).map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  {editFormErrors.grade_level && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{editFormErrors.grade_level}</p>}
                </div>
                <div>
                  <select
                    value={editCandidate.section}
                    onChange={(e) => { setEditCandidate(p => ({ ...p, section: e.target.value })); if (editFormErrors.section) setEditFormErrors(p => ({ ...p, section: undefined })); }}
                    disabled={!editCandidate.grade_level}
                    className={`w-full px-4 py-2.5 rounded-xl bg-background border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 ${editFormErrors.section ? 'border-red-500 focus:ring-red-500/40' : 'border-border'}`}
                  >
                    <option value="">Section</option>
                    {editCandidate.grade_level && GRADE_SECTIONS[editCandidate.grade_level]?.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  {editFormErrors.section && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{editFormErrors.section}</p>}
                </div>
              </div>
              {/* Edit: Party List */}
              <div>
                <input type="text" placeholder="Party List" value={editCandidate.party_list}
                  onChange={(e) => { setEditCandidate(p => ({ ...p, party_list: e.target.value })); if (editFormErrors.party_list) setEditFormErrors(p => ({ ...p, party_list: undefined })); }} maxLength={100}
                  className={`w-full px-4 py-2.5 rounded-xl bg-background border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground ${editFormErrors.party_list ? 'border-red-500 focus:ring-red-500/40' : 'border-border'}`} />
                {editFormErrors.party_list && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{editFormErrors.party_list}</p>}
              </div>
              {/* Edit: Motto */}
              <input type="text" placeholder="Motto (optional)" value={editCandidate.motto} onChange={(e) => setEditCandidate(p => ({ ...p, motto: e.target.value }))} maxLength={200}
                className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground" />
              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm cursor-pointer hover:bg-muted transition-colors">
                  <ImagePlus className="w-4 h-4 text-muted-foreground" />
                  <span>{editPhotoFile ? 'Change Photo' : editPhotoPreview ? 'Replace Photo' : 'Upload Photo'}</span>
                  <input ref={editFileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) { setEditPhotoFile(file); setEditPhotoPreview(URL.createObjectURL(file)); }
                    }} />
                </label>
                {editPhotoPreview && (
                  <div className="relative">
                    <img src={editPhotoPreview} alt="Preview" className="w-12 h-12 rounded-full object-cover border-2 border-border" />
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-border">
              <button onClick={closeEditModal} className="px-5 py-2.5 rounded-xl bg-muted text-foreground font-medium text-sm hover:bg-muted/80 transition-colors">
                Cancel
              </button>
              <button onClick={() => updateCandidate.mutate()} disabled={updateCandidate.isPending}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-gold text-accent-foreground font-medium text-sm shadow-gold hover:opacity-90 transition-opacity disabled:opacity-50">
                {updateCandidate.isPending ? <div className="w-4 h-4 border-2 border-accent-foreground/30 border-t-accent-foreground rounded-full animate-spin" /> : <Pencil className="w-4 h-4" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Early Start Confirmation Modal */}
      {showEarlyStartConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setShowEarlyStartConfirm(false)}>
          <div className="bg-card rounded-2xl border border-border p-6 shadow-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-foreground text-lg flex items-center gap-2">
                <Power className="w-5 h-5 text-gold" /> Start Election Early?
              </h3>
              <button onClick={() => setShowEarlyStartConfirm(false)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              The scheduled voting start time (<span className="font-semibold text-foreground">{settings?.voting_start?.slice(0,5)}</span>) has not arrived yet.
            </p>
            <p className="text-xs text-muted-foreground mb-6">
              Are you sure you want to trigger the election to start right now?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setShowEarlyStartConfirm(false)} className="px-5 py-2.5 rounded-xl bg-muted text-foreground font-medium text-sm hover:bg-muted/80 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => {
                  updateStatus.mutate("ongoing");
                  setShowEarlyStartConfirm(false);
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-gold text-accent-foreground font-medium text-sm shadow-gold hover:opacity-90 transition-opacity"
              >
                <Power className="w-4 h-4" /> Yes, Start Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset All Voted Confirmation Modal */}
      {showResetAllVotedConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setShowResetAllVotedConfirm(false)}>
          <div className="bg-card rounded-2xl border border-border p-6 shadow-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-foreground text-lg flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-gold" /> Reset All Voting Statuses?
              </h3>
              <button onClick={() => setShowResetAllVotedConfirm(false)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              This will set <span className="font-semibold text-foreground">has_voted = false</span> for all voters and clear current live vote tallies for the new election.
            </p>
            <p className="text-xs text-muted-foreground mb-6">
              All registered voters will be able to cast their vote again. (If you want to save the previous results to history, click <strong>Save Results to History</strong> first).
            </p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setShowResetAllVotedConfirm(false)} className="px-5 py-2.5 rounded-xl bg-muted text-foreground font-medium text-sm hover:bg-muted/80 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => resetAllVoted.mutate()}
                disabled={resetAllVoted.isPending}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-gold text-accent-foreground font-semibold text-sm shadow-gold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {resetAllVoted.isPending ? <div className="w-4 h-4 border-2 border-accent-foreground/30 border-t-accent-foreground rounded-full animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                Yes, Reset All Statuses
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expired End Time Confirmation Modal */}
      {showExpiredEndConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setShowExpiredEndConfirm(false)}>
          <div className="bg-card rounded-2xl border border-border p-6 shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-foreground text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-gold" /> Voting End Time Expired
              </h3>
              <button onClick={() => setShowExpiredEndConfirm(false)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              The configured voting end time (<span className="font-semibold text-foreground">{settings?.voting_end?.slice(0,5)}</span>) has already passed for today.
            </p>
            <p className="text-xs text-muted-foreground mb-6">
              Would you like to automatically extend the end time to <strong className="text-foreground">11:59 PM</strong> today and start voting now?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setShowExpiredEndConfirm(false)} className="px-4 py-2.5 rounded-xl bg-muted text-foreground font-medium text-xs hover:bg-muted/80 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleExtendAndStart}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-gold text-accent-foreground font-semibold text-xs shadow-gold hover:opacity-90 transition-opacity"
              >
                <Power className="w-4 h-4" /> Extend End Time & Start Election
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "archive" && (
        <div className="animate-fade-in space-y-4">
          {/* Archive Sub-tabs */}
          <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
            <button
              onClick={() => setArchiveSubTab("voters")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                archiveSubTab === "voters" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <UserX className="w-4 h-4" />
              Archived Voters
              {(archivedVoters ?? []).length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 text-xs font-semibold">
                  {(archivedVoters ?? []).length}
                </span>
              )}
            </button>
            <button
              onClick={() => setArchiveSubTab("candidates")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                archiveSubTab === "candidates" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Archive className="w-4 h-4" />
              Archived Candidates
              {(archivedCandidates ?? []).length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 text-xs font-semibold">
                  {(archivedCandidates ?? []).length}
                </span>
              )}
            </button>
          </div>

          {/* ── Archived Voters Sub-panel ── */}
          {archiveSubTab === "voters" && (
            <div className="bg-card rounded-xl border border-border p-6 shadow-elegant">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="font-display font-bold text-foreground text-lg flex items-center gap-2">
                    <UserX className="w-5 h-5 text-gold" /> Archived Voters
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(archivedVoters ?? []).length} archived voter{(archivedVoters ?? []).length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={archiveSearch}
                    onChange={(e) => setArchiveSearch(e.target.value)}
                    placeholder="Search archived voters..."
                    className="w-full pl-9 pr-4 py-2 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold/50"
                  />
                </div>
              </div>

              {archivedLoading ? (
                <div className="flex items-center justify-center py-12 gap-3 text-muted-foreground">
                  <div className="w-5 h-5 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                  Loading archived voters...
                </div>
              ) : filteredArchived.length === 0 ? (
                <div className="text-center py-16">
                  <UserX className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground font-medium">
                    {archiveSearch ? "No archived voters match your search" : "No archived voters"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {archiveSearch ? "Try a different search term" : "Voters you archive will appear here"}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">LRN</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Full Name</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Grade & Section</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Archived On</th>
                        <th className="text-right py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredArchived.map((v) => (
                        <tr key={v.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-3 font-mono text-xs text-muted-foreground">{v.lrn}</td>
                          <td className="py-3 px-3 font-medium text-foreground uppercase">{v.full_name}</td>
                          <td className="py-3 px-3 text-muted-foreground hidden sm:table-cell">
                            {v.grade_level && v.section ? `${v.grade_level} — ${v.section}` : <span className="italic text-xs">Not set</span>}
                          </td>
                          <td className="py-3 px-3 text-xs text-muted-foreground">
                            {v.archived_at ? new Date(v.archived_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => restoreVoter.mutate(v.id)}
                                disabled={restoreVoter.isPending}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-success/10 text-success hover:bg-success/20 transition-colors disabled:opacity-50"
                                title="Restore voter"
                              >
                                <RotateCcw className="w-3.5 h-3.5" /> Restore
                              </button>
                              <button
                                onClick={() => setDeleteTarget({ id: v.id, name: v.full_name, type: 'archived' })}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                                title="Delete permanently"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Archived Candidates Sub-panel ── */}
          {archiveSubTab === "candidates" && (
            <div className="bg-card rounded-xl border border-border p-6 shadow-elegant">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="font-display font-bold text-foreground text-lg flex items-center gap-2">
                    <Archive className="w-5 h-5 text-gold" /> Archived Candidates
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(archivedCandidates ?? []).length} archived candidate{(archivedCandidates ?? []).length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={archiveCandidateSearch}
                    onChange={(e) => setArchiveCandidateSearch(e.target.value)}
                    placeholder="Search archived candidates..."
                    className="w-full pl-9 pr-4 py-2 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold/50"
                  />
                </div>
              </div>

              {archivedCandidatesLoading ? (
                <div className="flex items-center justify-center py-12 gap-3 text-muted-foreground">
                  <div className="w-5 h-5 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                  Loading archived candidates...
                </div>
              ) : filteredArchivedCandidates.length === 0 ? (
                <div className="text-center py-16">
                  <Archive className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground font-medium">
                    {archiveCandidateSearch ? "No archived candidates match your search" : "No archived candidates"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {archiveCandidateSearch ? "Try a different search term" : "Candidates you archive will appear here"}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Photo</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Position</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Party</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Archived On</th>
                        <th className="text-right py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredArchivedCandidates.map((c) => (
                        <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-3">
                            {c.avatar_url ? (
                              <img src={c.avatar_url} alt={c.name} className="w-8 h-8 rounded-full object-cover border border-border opacity-60" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                                {c.name?.charAt(0)}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 font-medium text-foreground uppercase">{c.name}</td>
                          <td className="py-3 px-3 text-muted-foreground hidden sm:table-cell">{c.position_title || '—'}</td>
                          <td className="py-3 px-3 text-muted-foreground hidden md:table-cell">{c.party_list || '—'}</td>
                          <td className="py-3 px-3 text-xs text-muted-foreground">
                            {c.archived_at ? new Date(c.archived_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => restoreCandidate.mutate(c.id)}
                                disabled={restoreCandidate.isPending}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-success/10 text-success hover:bg-success/20 transition-colors disabled:opacity-50"
                                title="Restore candidate"
                              >
                                <RotateCcw className="w-3.5 h-3.5" /> Restore
                              </button>
                              <button
                                onClick={() => setDeleteTarget({ id: c.id, name: c.name, type: 'archived-candidate' })}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                                title="Delete permanently"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === "settings" && (
        <div className="max-w-2xl space-y-6 animate-fade-in">
          {settings && (
            <>
              <div className="bg-card rounded-xl border border-border p-6 shadow-elegant">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <h3 className="font-display font-bold text-foreground text-lg">Election Control</h3>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                      settings?.status === "ongoing"
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                        : settings?.status === "completed"
                        ? "bg-destructive/15 text-destructive border border-destructive/30"
                        : "bg-muted text-muted-foreground border border-border"
                    }`}>
                      {settings?.status === "ongoing" && <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse mr-1.5" />}
                      {settings?.status ?? "unknown"}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mb-4">
                  {settings?.status === "ongoing" ? (
                    settings?.auto_end_enabled ? (
                      <span className="text-gold font-medium">⏰ Auto-End Enabled: Election will automatically end when voting schedule expires.</span>
                    ) : (
                      <span className="text-muted-foreground font-medium">🔒 Manual Mode: Auto-end is disabled. You control when to end the election.</span>
                    )
                  ) : (
                    <span>Controls voting access for all students across the platform.</span>
                  )}
                </p>

                <div className="flex flex-wrap gap-3">
                  <button onClick={() => updateStatus.mutate("upcoming")} disabled={settings?.status === "upcoming"}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-muted text-foreground font-medium text-sm disabled:opacity-40 hover:bg-muted/80 transition-colors">
                    Set Upcoming
                  </button>
                  <button onClick={handleStartElection} disabled={settings?.status === "ongoing" || updateStatus.isPending}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-gold text-accent-foreground font-medium text-sm shadow-gold disabled:opacity-40 hover:opacity-90 transition-opacity">
                    <Power className="w-4 h-4" /> Start Election
                  </button>
                  <button onClick={() => updateStatus.mutate("completed")} disabled={settings?.status === "completed" || updateStatus.isPending}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-destructive text-destructive-foreground font-medium text-sm disabled:opacity-40 hover:opacity-90 transition-opacity">
                    <Power className="w-4 h-4" /> End Election
                  </button>
                  <button onClick={() => setShowResetAllVotedConfirm(true)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gold/15 text-gold border border-gold/30 font-medium text-sm hover:bg-gold/20 transition-colors ml-auto">
                    <RotateCcw className="w-4 h-4" /> Reset Voters for New Election
                  </button>
                </div>
              </div>

              {/* Save Results to History */}
              <div className="bg-card rounded-xl border border-border p-6 shadow-elegant">
                <h3 className="font-display font-bold text-foreground text-lg mb-1 flex items-center gap-2">
                  <History className="w-5 h-5 text-gold" /> Election History
                </h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Save the current election results to history so students and staff can view past election winners. Results for the same school year will be replaced if archived again.
                </p>

                {!showArchiveConfirm ? (
                  <button
                    onClick={() => setShowArchiveConfirm(true)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-gold text-accent-foreground font-medium text-sm shadow-gold hover:opacity-90 transition-opacity"
                  >
                    <Archive className="w-4 h-4" /> Save Results to History
                  </button>
                ) : (
                  <div className="bg-muted/50 rounded-xl p-4 border border-border">
                    <p className="text-sm text-foreground font-medium mb-1">Archive current results?</p>
                    <p className="text-xs text-muted-foreground mb-4">
                      This will save a snapshot of <strong>{settings?.name || "the current election"}</strong> (S.Y. {settings?.school_year || "—"}) to history.
                      {" "}If results for this school year already exist, they will be replaced.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => archiveResults.mutate()}
                        disabled={archiveResults.isPending}
                        className="flex items-center gap-2 px-5 py-2 rounded-xl gradient-gold text-accent-foreground font-medium text-sm shadow-gold hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        {archiveResults.isPending
                          ? <div className="w-4 h-4 border-2 border-accent-foreground/30 border-t-accent-foreground rounded-full animate-spin" />
                          : <Archive className="w-4 h-4" />}
                        {archiveResults.isPending ? "Archiving…" : "Yes, Archive Now"}
                      </button>
                      <button
                        onClick={() => setShowArchiveConfirm(false)}
                        className="px-5 py-2 rounded-xl bg-muted text-foreground font-medium text-sm hover:bg-muted/80 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {(electionHistory ?? []).length > 0 && (
                  <div className="mt-6 pt-5 border-t border-border">
                    <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Archived Past Elections</p>
                    <div className="space-y-2">
                      {(electionHistory ?? []).map((h) => (
                        <div key={h.school_year} className="flex items-center justify-between p-3 bg-muted/40 rounded-xl border border-border">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{h.election_name}</p>
                            <p className="text-xs text-muted-foreground">S.Y. {h.school_year} {h.election_date ? `· ${h.election_date}` : ''}</p>
                          </div>
                          <button
                            onClick={() => {
                              if (confirm(`Delete archived election history for S.Y. ${h.school_year}?`)) {
                                deleteHistory.mutate(h.school_year);
                              }
                            }}
                            disabled={deleteHistory.isPending}
                            className="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                            title="Delete this history record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-card rounded-xl border border-border p-6 shadow-elegant">
                <h3 className="font-display font-bold text-foreground text-lg mb-1">Election Schedule</h3>
                <p className="text-xs text-muted-foreground mb-5 flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-success"></span>
                  The election will <strong>automatically end</strong> when the date and end time you set is reached.
                </p>
                <ElectionScheduleForm settings={settings} onSave={(fields) => updateSchedule.mutate(fields)} isSaving={updateSchedule.isPending} />
              </div>

              <div className="bg-card rounded-xl border border-border p-6 shadow-elegant">
                <h3 className="font-display font-bold text-foreground text-lg mb-4">Election Info</h3>
                <ElectionInfoForm settings={settings} onSave={(fields) => updateInfo.mutate(fields)} isSaving={updateInfo.isPending} />
              </div>
            </>
          )}
          {!settings && (
            <div className="bg-card rounded-xl border border-border p-6 shadow-elegant text-center">
              <p className="text-muted-foreground">No election settings found.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
