import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { getAuthToken } from "../lib/auth";
import { API_BASE_URL } from "../lib/api";

interface CardRequest {
  REQUEST_ID: number;
  USER_ID: number;
  FULL_NAME: string;
  EMAIL: string;
  REQUEST_TYPE: string;
  REASON: string;
  DELIVERY_ADDRESS: string;
  STATUS: string;
  CHARGE_AMOUNT: number;
  CREATED_AT: string;
}

export function AdminCardManagementPage() {
  const [cardRequests, setCardRequests] = useState<CardRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<CardRequest | null>(null);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchCardRequests();
  }, []);

  const fetchCardRequests = async () => {
    try {
      setLoading(true);
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/admin/card-requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.status === "Success") {
        setCardRequests(data.data || []);
      }
    } catch (error) {
      setMessage("Failed to load card requests");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedRequest || !newStatus) return;
    try {
      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE_URL}/admin/card-request/${selectedRequest.REQUEST_ID}?new_status=${encodeURIComponent(newStatus)}`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await response.json();
      if (data.status === "Success") {
        setMessage("Status updated successfully");
        setUpdateDialogOpen(false);
        setNewStatus("");
        fetchCardRequests();
      } else {
        setMessage(data.message || "Update failed");
      }
    } catch (error) {
      setMessage("Failed to update status");
      console.error(error);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: "#f59e0b",
      APPROVED: "#10b981",
      REJECTED: "#ef4444",
      DISPATCHED: "#3b82f6",
      DELIVERED: "#8b5cf6",
    };
    return colors[status] || "#6b7280";
  };

  return (
    <div className="w-full space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <h1
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 700,
            fontSize: "clamp(18px, 3vw, 36px)",
            color: "#f2f0ff",
          }}
        >
          Card Requests Management
        </h1>
      </motion.div>

      {message && (
        <div
          style={{
            background: "#2a2733",
            border: "1px solid #454259",
            borderRadius: "12px",
            padding: "12px 16px",
            color: "#e8e4f0",
            fontSize: "14px",
          }}
        >
          {message}
        </div>
      )}

      {loading ? (
        <div style={{ color: "#b8b4d4", textAlign: "center", padding: "40px" }}>
          Loading card requests...
        </div>
      ) : cardRequests.length === 0 ? (
        <div style={{ color: "#b8b4d4", textAlign: "center", padding: "40px" }}>
          No card requests found
        </div>
      ) : (
        <div className="space-y-3">
          {cardRequests.map((request) => (
            <motion.div
              key={request.REQUEST_ID}
              className="rounded-[16px] p-4 sm:p-6"
              style={{ background: "#2a2733", border: "1px solid rgba(255,255,255,0.06)" }}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div style={{ color: "#f2f0ff", fontWeight: 700, fontSize: "16px" }}>
                    {request.FULL_NAME}
                  </div>
                  <div style={{ color: "#b8b4d4", fontSize: "13px" }}>
                    {request.REQUEST_TYPE} Card • {request.REASON}
                  </div>
                  <div style={{ color: "#9d99b8", fontSize: "12px" }}>
                    Account: {request.EMAIL} | Charge: PKR {request.CHARGE_AMOUNT}
                  </div>
                  <div style={{ color: "#9d99b8", fontSize: "12px" }}>
                    Address: {request.DELIVERY_ADDRESS}
                  </div>
                  <div style={{ color: "#9d99b8", fontSize: "12px" }}>
                    Requested: {new Date(request.CREATED_AT).toLocaleDateString()}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div
                    style={{
                      background: getStatusColor(request.STATUS),
                      color: "#fff",
                      padding: "6px 12px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: 600,
                      minWidth: "100px",
                      textAlign: "center",
                    }}
                  >
                    {request.STATUS}
                  </div>
                  <button
                    onClick={() => {
                      setSelectedRequest(request);
                      setUpdateDialogOpen(true);
                    }}
                    className="rounded-[10px] px-4 py-2 uppercase tracking-widest hover:opacity-90 active:scale-[0.98] transition-all"
                    style={{
                      background: "linear-gradient(135deg, #6750a4, #9c82d4)",
                      color: "#f2f0ff",
                      fontFamily: "'Montserrat', sans-serif",
                      fontWeight: 700,
                      fontSize: "11px",
                    }}
                  >
                    Update
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ color: "#f2f0ff" }}>Update Card Request Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label style={{ color: "#b8b4d4", fontSize: "12px", display: "block", marginBottom: "8px" }}>
                Status
              </label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full rounded-[12px] px-4 py-2 bg-[#3d3a4a] text-[#f2f0ff] outline-none"
                style={{ border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <option value="">Select Status</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="DISPATCHED">Dispatched</option>
                <option value="DELIVERED">Delivered</option>
              </select>
            </div>
            <button
              onClick={handleUpdateStatus}
              className="w-full rounded-[12px] py-3 uppercase tracking-widest hover:opacity-90 active:scale-[0.98] transition-all"
              style={{
                background: "linear-gradient(135deg, #6750a4, #9c82d4)",
                color: "#f2f0ff",
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 700,
                fontSize: "12px",
              }}
            >
              Update Status
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
