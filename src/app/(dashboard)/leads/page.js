"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Users, Search, Loader2, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import StatusBadge from "@/components/app/StatusBadge";

function getInitials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function timeAgo(dateString) {
  if (!dateString) return "";
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "qualifying", label: "Qualifying" },
  { value: "interested", label: "Interested" },
  { value: "booked", label: "Booked" },
  { value: "not_a_fit", label: "Not a Fit" },
];

function LeadsTableSkeleton() {
  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="flex gap-4 mb-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="flex gap-1.5 mb-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-7 w-20 rounded-full" />
        ))}
      </div>
      <div className="bg-white rounded-3xl border border-stone-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-stone-100">
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-5 py-3 border-b border-stone-50"
          >
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-20 rounded-lg" />
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-16 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

function LeadsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [leads, setLeads] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  useEffect(() => {
    async function init() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        router.push("/login");
        return;
      }

      setUser(authUser);

      const { data: convos } = await supabase
        .from("conversations")
        .select("*, messages(content, created_at)")
        .eq("user_id", authUser.id)
        .order("updated_at", { ascending: false });

      const mapped = (convos || []).map((convo) => {
        const sorted = (convo.messages || []).sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );
        return {
          ...convo,
          last_message: sorted[0]?.content || null,
          messages: undefined,
        };
      });

      setLeads(mapped);
      setLoading(false);
    }
    init();
  }, []);

  const handleStatusChange = async (leadId, newStatus) => {
    const previousLeads = leads;

    setLeads((prev) =>
      prev.map((lead) =>
        lead.id === leadId ? { ...lead, status: newStatus } : lead
      )
    );

    const { error } = await supabase
      .from("conversations")
      .update({ status: newStatus })
      .eq("id", leadId);

    if (error) {
      console.error("Failed to update status:", error);
      setLeads(previousLeads);
    }
  };

  const filteredLeads = leads
    .filter((lead) => {
      if (statusFilter !== "all" && lead.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!lead.sender_name?.toLowerCase().includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "newest")
        return new Date(b.updated_at) - new Date(a.updated_at);
      if (sortBy === "oldest")
        return new Date(a.updated_at) - new Date(b.updated_at);
      if (sortBy === "name_asc")
        return (a.sender_name || "").localeCompare(b.sender_name || "");
      return 0;
    });

  if (loading) return <LeadsTableSkeleton />;

  return (
    <div className="h-full flex flex-col">
      {/* Header + Toolbar */}
      <div className="p-6 pb-0">
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-2xl font-extrabold">Leads</h1>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-stone-100 text-stone-600">
            {filteredLeads.length}{" "}
            {filteredLeads.length === 1 ? "lead" : "leads"}
          </span>
        </div>

        {/* Search + Sort */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <Input
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-stone-50 border-stone-200 focus-visible:border-[#ff7e67] h-9"
            />
          </div>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="h-9 text-xs w-auto border-stone-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
              <SelectItem value="name_asc">Name A–Z</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-4 scrollbar-none">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                statusFilter === tab.value
                  ? "bg-[#ff7e67] text-white shadow-sm shadow-[#ff7e67]/25"
                  : "bg-stone-100 text-stone-500 hover:bg-stone-200 hover:text-stone-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table or Empty State */}
      {filteredLeads.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-24 text-stone-400">
          <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mb-5">
            <Users className="h-7 w-7 text-stone-400/50" />
          </div>
          <h3 className="text-lg font-medium mb-1.5 text-stone-600">
            {searchQuery || statusFilter !== "all"
              ? "No leads found"
              : "No leads yet"}
          </h3>
          <p className="text-sm text-stone-400">
            {searchQuery || statusFilter !== "all"
              ? "Try adjusting your search or filters"
              : "Leads will appear here once Instagram DMs start coming in"}
          </p>
        </div>
      ) : (
        <div className="px-6 pb-6 overflow-x-auto flex-1">
          <div className="bg-white rounded-3xl border border-stone-100 soft-shadow overflow-hidden">
            <table className="w-full">
              <thead className="sticky top-0 bg-white z-10 border-b border-stone-100">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-bold text-stone-400 uppercase tracking-wide">
                    Lead
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-stone-400 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-stone-400 uppercase tracking-wide hidden md:table-cell">
                    Last Message
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-stone-400 uppercase tracking-wide">
                    AI
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-stone-400 uppercase tracking-wide hidden sm:table-cell">
                    Last Active
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-bold text-stone-400 uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    onClick={() =>
                      router.push(`/conversations?thread=${lead.id}`)
                    }
                    className="group border-b border-stone-50 last:border-0 hover:bg-stone-50 cursor-pointer transition-colors"
                  >
                    {/* Lead */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarFallback className="text-xs bg-stone-100 text-stone-600">
                            {getInitials(lead.sender_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-stone-900 truncate">
                            {lead.sender_name || "Unknown"}
                          </p>
                          {lead.instagram_sender_id && (
                            <p className="text-xs text-stone-400 truncate">
                              Instagram DM
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3">
                      <StatusBadge status={lead.status} />
                    </td>

                    {/* Last Message */}
                    <td className="px-5 py-3 hidden md:table-cell">
                      <p className="text-xs text-stone-400 truncate max-w-[240px]">
                        {lead.last_message
                          ? lead.last_message.length > 60
                            ? lead.last_message.slice(0, 60) + "..."
                            : lead.last_message
                          : "No messages yet"}
                      </p>
                    </td>

                    {/* AI */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            lead.ai_paused ? "bg-stone-300" : "bg-green-500"
                          }`}
                        />
                        <span
                          className={`text-xs font-medium ${
                            lead.ai_paused
                              ? "text-stone-400"
                              : "text-green-600"
                          }`}
                        >
                          {lead.ai_paused ? "Paused" : "Active"}
                        </span>
                      </div>
                    </td>

                    {/* Last Active */}
                    <td className="px-5 py-3 hidden sm:table-cell">
                      <span className="text-xs text-stone-500">
                        {timeAgo(lead.updated_at)}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3 text-right">
                      <div
                        className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <a
                          href={`/conversations?thread=${lead.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#ff7e67] hover:bg-[#fff5f2] rounded-lg transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View Chat
                        </a>
                        <Select
                          value={lead.status || "qualifying"}
                          onValueChange={(newStatus) =>
                            handleStatusChange(lead.id, newStatus)
                          }
                        >
                          <SelectTrigger className="h-7 text-[11px] w-auto border-stone-200 px-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="qualifying">
                              Qualifying
                            </SelectItem>
                            <SelectItem value="interested">
                              Interested
                            </SelectItem>
                            <SelectItem value="booked">Booked</SelectItem>
                            <SelectItem value="not_a_fit">
                              Not a Fit
                            </SelectItem>
                            <SelectItem value="manual">
                              Human Takeover
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LeadsPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
        </div>
      }
    >
      <LeadsPage />
    </Suspense>
  );
}
