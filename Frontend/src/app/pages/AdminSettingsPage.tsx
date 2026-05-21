import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { getAuthToken } from "../lib/auth";
import { API_BASE_URL } from "../lib/api";

interface AdminSettings {
  username: string;
  session_timeout: number;
  two_fa_enabled: boolean;
  notification_emails: boolean;
  system_limits: {
    max_topup_per_transaction: number;
    max_topup_per_day: number;
    withdrawal_limit: number;
  };
  audit_logs_retention_days: number;
}

export function AdminSettingsPage() {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<Partial<AdminSettings>>({});

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/admin/settings`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        setMessage(`Server error: ${response.status} ${response.statusText}`);
        setLoading(false);
        return;
      }

      const data = await response.json();
      if (data.status === "Success" && data.settings) {
        setSettings(data.settings);
        setFormData(data.settings);
        setMessage("");
      } else {
        setMessage(data.message || "Invalid settings response");
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      setMessage(`Connection error: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/admin/settings`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      if (data.status === "Success") {
        setSettings(data.settings || formData as AdminSettings);
        setMessage("Settings updated successfully");
        setEditMode(false);
      } else {
        setMessage(data.message || "Update failed");
      }
    } catch (error) {
      setMessage("Failed to update settings");
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div style={{ color: "#b8b4d4", textAlign: "center", padding: "40px" }}>
        Loading settings...
      </div>
    );
  }

  if (!settings) {
    return (
      <div style={{ color: "#b8b4d4", textAlign: "center", padding: "40px" }}>
        Failed to load settings
      </div>
    );
  }

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
          Admin Settings
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

      {/* Account Settings */}
      <motion.div
        className="rounded-[16px] p-4 sm:p-6 space-y-4"
        style={{ background: "#2a2733", border: "1px solid rgba(255,255,255,0.06)" }}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2 style={{ color: "#f2f0ff", fontWeight: 700, fontSize: "16px" }}>Account Settings</h2>
        <div className="space-y-3">
          <div>
            <label style={{ color: "#b8b4d4", fontSize: "12px", display: "block", marginBottom: "6px" }}>
              Username
            </label>
            <div
              style={{
                background: "#3d3a4a",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "12px",
                padding: "10px 16px",
                color: "#b8b4d4",
                fontSize: "14px",
              }}
            >
              {settings.username}
            </div>
          </div>

          <div>
            <label style={{ color: "#b8b4d4", fontSize: "12px", display: "block", marginBottom: "6px" }}>
              Session Timeout
            </label>
            <div
              style={{
                background: "#3d3a4a",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "12px",
                padding: "10px 16px",
                color: "#b8b4d4",
                fontSize: "14px",
              }}
            >
              {settings.session_timeout / 60} minutes
            </div>
          </div>
        </div>
      </motion.div>

      {/* Security Settings */}
      <motion.div
        className="rounded-[16px] p-4 sm:p-6 space-y-4"
        style={{ background: "#2a2733", border: "1px solid rgba(255,255,255,0.06)" }}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h2 style={{ color: "#f2f0ff", fontWeight: 700, fontSize: "16px" }}>Security Settings</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-[12px]" style={{ background: "rgba(0,0,0,0.2)" }}>
            <label style={{ color: "#b8b4d4", fontSize: "14px" }}>Two-Factor Authentication</label>
            <div
              style={{
                background: settings.two_fa_enabled ? "#10b981" : "#ef4444",
                color: "#fff",
                padding: "6px 12px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              {settings.two_fa_enabled ? "Enabled" : "Disabled"}
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-[12px]" style={{ background: "rgba(0,0,0,0.2)" }}>
            <label style={{ color: "#b8b4d4", fontSize: "14px" }}>Email Notifications</label>
            <div
              style={{
                background: settings.notification_emails ? "#10b981" : "#ef4444",
                color: "#fff",
                padding: "6px 12px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              {settings.notification_emails ? "Enabled" : "Disabled"}
            </div>
          </div>

          <button
            className="w-full rounded-[12px] py-3 uppercase tracking-widest hover:opacity-90 active:scale-[0.98] transition-all"
            style={{
              background: "linear-gradient(135deg, #9c82d4, #6750a4)",
              color: "#f2f0ff",
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 700,
              fontSize: "12px",
            }}
          >
            Manage Security
          </button>
        </div>
      </motion.div>

      {/* System Preferences */}
      <motion.div
        className="rounded-[16px] p-4 sm:p-6 space-y-4"
        style={{ background: "#2a2733", border: "1px solid rgba(255,255,255,0.06)" }}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h2 style={{ color: "#f2f0ff", fontWeight: 700, fontSize: "16px" }}>System Preferences</h2>
        <div className="space-y-3">
          <div>
            <label style={{ color: "#b8b4d4", fontSize: "12px", display: "block", marginBottom: "6px" }}>
              Audit Logs Retention
            </label>
            <div
              style={{
                background: "#3d3a4a",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "12px",
                padding: "10px 16px",
                color: "#b8b4d4",
                fontSize: "14px",
              }}
            >
              {settings.audit_logs_retention_days} days
            </div>
          </div>
        </div>
      </motion.div>

      {/* Admin Actions */}
      <motion.div
        className="rounded-[16px] p-4 sm:p-6 space-y-4"
        style={{ background: "#2a2733", border: "1px solid rgba(255,255,255,0.06)" }}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div>
          <h2 style={{ color: "#f2f0ff", fontWeight: 700, fontSize: "16px", marginBottom: "4px" }}>
            Account Management
          </h2>
          <p style={{ color: "#9d99b8", fontSize: "12px", marginBottom: "16px" }}>
            Manage your admin account security and session settings
          </p>
        </div>
        <div className="space-y-3">
          <button
            className="w-full rounded-[12px] py-3 font-semibold transition-all hover:opacity-80 active:scale-[0.98]"
            style={{
              background: "linear-gradient(135deg, #9c82d4, #6750a4)",
              color: "#f2f0ff",
              fontFamily: "'Montserrat', sans-serif",
              fontSize: "13px",
            }}
          >
            Change Admin Password
          </button>
          <button
            className="w-full rounded-[12px] py-3 font-semibold transition-all hover:opacity-80 active:scale-[0.98]"
            style={{
              background: "rgba(167, 139, 250, 0.1)",
              color: "#a78bfa",
              border: "1px solid rgba(167, 139, 250, 0.3)",
              fontFamily: "'Montserrat', sans-serif",
              fontSize: "13px",
            }}
          >
            Terminate All Sessions
          </button>
        </div>
      </motion.div>
    </div>
  );
}
