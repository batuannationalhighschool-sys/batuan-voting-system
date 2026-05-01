import { useState, useRef } from "react";
import { Settings, Users, Vote, BarChart3, Plus, Trash2, Power, UserPlus, Shield, ImagePlus, X, Pencil, KeyRound, Search } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import StatCard from "@/components/StatCard";
import ElectionScheduleForm from "@/components/ElectionScheduleForm";
import { useNavigate } from "react-router-dom";

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

  // Edit candidate state
  const [editCandidate, setEditCandidate] = useState(null);
  const [editPhotoFile, setEditPhotoFile] = useState(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState(null);
  const editFileInputRef = useRef(null);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState(null); // { id, name, type }

  // Voter management state
  const [newVoter, setNewVoter] = useState({ lrn: "", full_name: "", grade_level: "", section: "" });
  const [editVoter, setEditVoter] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [voterSearch, setVoterSearch] = useState("");

  const openEditModal = (c) => {
    setEditCandidate({ id: c.id, name: c.name, position_id: c.position_id, grade_level: c.grade_level, section: c.section, party_list: c.party_list, motto: c.motto || '' });
    setEditPhotoFile(null);
    setEditPhotoPreview(c.avatar_url ? `${import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:3001'}${c.avatar_url}` : null);
  };

  const closeEditModal = () => {
    setEditCandidate(null);
    setEditPhotoFile(null);
    setEditPhotoPreview(null);
  };

  const { data: positions } = useQuery({ queryKey: ["positions"], queryFn: () => api.get('/positions') });
  const { data: candidates } = useQuery({ queryKey: ["candidates"], queryFn: () => api.get('/candidates') });
  const { data: settings } = useQuery({ queryKey: ["election-settings"], queryFn: () => api.get('/election-settings') });
  const { data: stats } = useQuery({ queryKey: ["admin-stats"], queryFn: () => api.get('/stats') });
  const { data: voters } = useQuery({ queryKey: ["voters"], queryFn: () => api.get('/voters'), enabled: isAdmin });

  const profileCount = stats?.voterCount ?? 0;
  const votedCount = stats?.votedCount ?? 0;
  const totalVotes = stats?.totalVotes ?? 0;

  const addCandidate = useMutation({
    mutationFn: async () => {
      if (!newCandidate.name || !newCandidate.position_id || !newCandidate.grade_level || !newCandidate.section || !newCandidate.party_list) throw new Error("All fields required");
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
      setPhotoFile(null);
      setPhotoPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
    },
    onError: (err) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const deleteCandidate = useMutation({
    mutationFn: async (id) => {
      await api.delete(`/candidates/${id}`);
    },
    onSuccess: () => { toast({ title: "Candidate removed" }); queryClient.invalidateQueries({ queryKey: ["candidates"] }); },
    onError: (err) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const updateCandidate = useMutation({
    mutationFn: async () => {
      if (!editCandidate || !editCandidate.name || !editCandidate.position_id || !editCandidate.grade_level || !editCandidate.section || !editCandidate.party_list) throw new Error("All fields required");
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
    onError: (err) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const updateStatus = useMutation({
    mutationFn: async (status) => {
      if (!settings?.id) return;
      await api.put(`/election-settings/${settings.id}`, { status });
    },
    onSuccess: () => { toast({ title: "Election status updated" }); queryClient.invalidateQueries({ queryKey: ["election-settings"] }); },
    onError: (err) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const updateSettings = useMutation({
    mutationFn: async (fields) => {
      if (!settings?.id) return;
      await api.put(`/election-settings/${settings.id}`, fields);
    },
    onSuccess: () => { toast({ title: "Settings saved!", description: "Election schedule updated." }); queryClient.invalidateQueries({ queryKey: ["election-settings"] }); },
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
    mutationFn: async (id) => {
      await api.delete(`/voters/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Voter removed" });
      queryClient.invalidateQueries({ queryKey: ["voters"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (err) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const resetPassword = useMutation({
    mutationFn: async (id) => {
      await api.post(`/voters/${id}/reset-password`);
    },
    onSuccess: () => {
      toast({ title: "Password reset!", description: "Password has been reset to the voter's LRN." });
      setResetTarget(null);
      queryClient.invalidateQueries({ queryKey: ["voters"] });
    },
    onError: (err) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });



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
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "voters", label: "Voters", icon: Users },
    { id: "candidates", label: "Candidates", icon: Users },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const turnout = profileCount && profileCount > 0 ? ((votedCount) / profileCount * 100).toFixed(1) : "0";

  const filteredVoters = (voters ?? []).filter((v) => {
    if (!voterSearch) return true;
    const q = voterSearch.toLowerCase();
    return v.lrn?.toLowerCase().includes(q) || v.full_name?.toLowerCase().includes(q) || v.section?.toLowerCase().includes(q);
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
          {/* Add voter form */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-elegant">
            <h3 className="font-display font-bold text-foreground text-lg mb-4 flex items-center gap-2"><UserPlus className="w-5 h-5 text-gold" /> Add New Voter</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <input type="text" placeholder="LRN (12 digits)" value={newVoter.lrn} onChange={(e) => setNewVoter(p => ({ ...p, lrn: e.target.value.replace(/\D/g, '').slice(0, 12) }))} maxLength={12} inputMode="numeric" pattern="[0-9]{12}"
                className="px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground" />
              <input type="text" placeholder="Full Name" value={newVoter.full_name} onChange={(e) => setNewVoter(p => ({ ...p, full_name: e.target.value }))} maxLength={100}
                className="px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground" />
              <input type="text" placeholder="Grade Level" value={newVoter.grade_level} onChange={(e) => setNewVoter(p => ({ ...p, grade_level: e.target.value }))} maxLength={50}
                className="px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground" />
              <input type="text" placeholder="Section" value={newVoter.section} onChange={(e) => setNewVoter(p => ({ ...p, section: e.target.value }))} maxLength={50}
                className="px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground" />
            </div>
            <div className="flex items-center gap-4 mt-4">
              <button onClick={() => addVoter.mutate()} disabled={addVoter.isPending}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-gold text-accent-foreground font-medium text-sm shadow-gold hover:opacity-90 transition-opacity disabled:opacity-50">
                <UserPlus className="w-4 h-4" /> Add Voter
              </button>
              <p className="text-xs text-muted-foreground">Default password is the LRN. Student must change it on first login.</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="text" placeholder="Search by LRN, name, or section..." value={voterSearch} onChange={(e) => setVoterSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
          </div>

          {/* Voters table */}
          <div className="bg-card rounded-xl border border-border overflow-hidden shadow-elegant">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left p-4 font-semibold text-foreground">LRN</th>
                    <th className="text-left p-4 font-semibold text-foreground">Full Name</th>
                    <th className="text-left p-4 font-semibold text-foreground hidden sm:table-cell">Grade & Section</th>
                    <th className="text-left p-4 font-semibold text-foreground hidden md:table-cell">Status</th>
                    <th className="text-right p-4 font-semibold text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVoters.map((v) => (
                    <tr key={v.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-4 font-mono text-foreground text-xs">{v.lrn}</td>
                      <td className="p-4 font-medium text-foreground">{v.full_name}</td>
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
                            className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors" title="Delete">
                            <Trash2 className="w-4 h-4" />
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
          {/* Add form */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-elegant">
            <h3 className="font-display font-bold text-foreground text-lg mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-gold" /> Add Candidate
            </h3>
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <input type="text" placeholder="Full Name" value={newCandidate.name} onChange={(e) => setNewCandidate(p => ({ ...p, name: e.target.value }))} maxLength={100}
                    className="px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground" />
                  <select value={newCandidate.position_id} onChange={(e) => setNewCandidate(p => ({ ...p, position_id: e.target.value }))}
                    className="px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="">Select Position</option>
                    {(positions ?? []).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                  <input type="text" placeholder="Grade Level" value={newCandidate.grade_level} onChange={(e) => setNewCandidate(p => ({ ...p, grade_level: e.target.value }))} maxLength={50}
                    className="px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground" />
                  <input type="text" placeholder="Section" value={newCandidate.section}
                    onChange={(e) => setNewCandidate(p => ({ ...p, section: e.target.value }))}
                    maxLength={50}
                    className="px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground" />
                  <input type="text" placeholder="Party List" value={newCandidate.party_list} onChange={(e) => setNewCandidate(p => ({ ...p, party_list: e.target.value }))} maxLength={100}
                    className="px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground" />
                  <input type="text" placeholder="Motto (optional)" value={newCandidate.motto} onChange={(e) => setNewCandidate(p => ({ ...p, motto: e.target.value }))} maxLength={200}
                    className="px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground" />
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm cursor-pointer hover:bg-muted transition-colors">
                      <ImagePlus className="w-4 h-4 text-muted-foreground" />
                      <span>{photoFile ? 'Change Photo' : 'Upload Photo'}</span>
                      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            setPhotoFile(file);
                            setPhotoPreview(URL.createObjectURL(file));
                          }
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
                  {(candidates ?? []).map((c) => {
                    const pos = (positions ?? []).find((p) => p.id === c.position_id);
                    return (
                      <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="p-4 font-medium text-foreground">{c.name}</td>
                        <td className="p-4 text-muted-foreground">{pos?.title}</td>
                        <td className="p-4 text-muted-foreground hidden sm:table-cell">{c.party_list}</td>
                        <td className="p-4 text-muted-foreground hidden md:table-cell">{c.section}</td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEditModal(c)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => setDeleteTarget({ id: c.id, name: c.name, type: 'candidate' })} className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {(candidates ?? []).length === 0 && (
                    <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">
                      No candidates yet. Add one above.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}



      {/* Delete Confirmation Modal (for both candidates and voters) */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setDeleteTarget(null)}>
          <div className="bg-card rounded-2xl border border-border p-6 shadow-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-foreground text-lg flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-destructive" /> Delete {deleteTarget.type === 'voter' ? 'Voter' : 'Candidate'}
              </h3>
              <button onClick={() => setDeleteTarget(null)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-1">
              Are you sure you want to delete
            </p>
            <p className="font-semibold text-foreground mb-5">{deleteTarget.name}?</p>
            <p className="text-xs text-muted-foreground mb-6">
              {deleteTarget.type === 'voter'
                ? "This will permanently remove the voter account and all their votes."
                : "This action cannot be undone. The candidate will be permanently removed."}
            </p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} className="px-5 py-2.5 rounded-xl bg-muted text-foreground font-medium text-sm hover:bg-muted/80 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => {
                  if (deleteTarget.type === 'voter') {
                    deleteVoter.mutate(deleteTarget.id);
                  } else {
                    deleteCandidate.mutate(deleteTarget.id);
                  }
                  setDeleteTarget(null);
                }}
                disabled={deleteCandidate.isPending || deleteVoter.isPending}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-destructive text-destructive-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Delete
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
            <p className="font-semibold text-foreground mb-2">{resetTarget.name}</p>
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
                <input type="text" placeholder="Grade Level" value={editVoter.grade_level} onChange={(e) => setEditVoter(p => ({ ...p, grade_level: e.target.value }))} maxLength={50}
                  className="px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground" />
                <input type="text" placeholder="Section" value={editVoter.section} onChange={(e) => setEditVoter(p => ({ ...p, section: e.target.value }))} maxLength={50}
                  className="px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground" />
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
              <input type="text" placeholder="Full Name" value={editCandidate.name} onChange={(e) => setEditCandidate(p => ({ ...p, name: e.target.value }))} maxLength={100}
                className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground" />
              <select value={editCandidate.position_id} onChange={(e) => setEditCandidate(p => ({ ...p, position_id: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">Select Position</option>
                {(positions ?? []).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="Grade Level" value={editCandidate.grade_level} onChange={(e) => setEditCandidate(p => ({ ...p, grade_level: e.target.value }))} maxLength={50}
                  className="px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground" />
                <input type="text" placeholder="Section" value={editCandidate.section} onChange={(e) => setEditCandidate(p => ({ ...p, section: e.target.value }))} maxLength={50}
                  className="px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground" />
              </div>
              <input type="text" placeholder="Party List" value={editCandidate.party_list} onChange={(e) => setEditCandidate(p => ({ ...p, party_list: e.target.value }))} maxLength={100}
                className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground" />
              <input type="text" placeholder="Motto (optional)" value={editCandidate.motto} onChange={(e) => setEditCandidate(p => ({ ...p, motto: e.target.value }))} maxLength={200}
                className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground" />
              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm cursor-pointer hover:bg-muted transition-colors">
                  <ImagePlus className="w-4 h-4 text-muted-foreground" />
                  <span>{editPhotoFile ? 'Change Photo' : editPhotoPreview ? 'Replace Photo' : 'Upload Photo'}</span>
                  <input ref={editFileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        setEditPhotoFile(file);
                        setEditPhotoPreview(URL.createObjectURL(file));
                      }
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

      {activeTab === "settings" && (
        <div className="max-w-2xl space-y-6 animate-fade-in">
          {settings && (
            <>
              <div className="bg-card rounded-xl border border-border p-6 shadow-elegant">
                <h3 className="font-display font-bold text-foreground text-lg mb-4">
                  Election Control
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Current status: <span className="font-semibold text-foreground capitalize">{settings?.status ?? "unknown"}</span>
                </p>
                <div className="flex flex-wrap gap-3">
                  <button onClick={() => updateStatus.mutate("upcoming")} disabled={settings?.status === "upcoming"}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-muted text-foreground font-medium text-sm disabled:opacity-40">
                    Set Upcoming
                  </button>
                  <button onClick={() => updateStatus.mutate("ongoing")} disabled={settings?.status === "ongoing"}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-gold text-accent-foreground font-medium text-sm shadow-gold disabled:opacity-40">
                    <Power className="w-4 h-4" /> Start Election
                  </button>
                  <button onClick={() => updateStatus.mutate("completed")} disabled={settings?.status === "completed"}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-destructive text-destructive-foreground font-medium text-sm disabled:opacity-40">
                    <Power className="w-4 h-4" /> End Election
                  </button>
                </div>
              </div>

              <div className="bg-card rounded-xl border border-border p-6 shadow-elegant">
                <h3 className="font-display font-bold text-foreground text-lg mb-1">Election Schedule</h3>
                <p className="text-xs text-muted-foreground mb-5 flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-success"></span>
                  The election will <strong>automatically end</strong> when the date and end time you set is reached.
                </p>
                <ElectionScheduleForm settings={settings} onSave={(fields) => updateSettings.mutate(fields)} isSaving={updateSettings.isPending} />
              </div>

              <div className="bg-card rounded-xl border border-border p-6 shadow-elegant">
                <h3 className="font-display font-bold text-foreground text-lg mb-4">Election Info</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">School Year</span>
                    <span className="font-medium text-foreground">{settings?.school_year}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Election Date</span>
                    <span className="font-medium text-foreground">{settings?.election_date ? new Date(settings.election_date).toLocaleDateString() : 'TBA'}</span>
                  </div>
                </div>
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
