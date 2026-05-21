import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import { changePassword, deleteAccount, getProfile, updateProfile } from "../lib/api";
import { clearAuth } from "../lib/auth";

interface ProfileFieldProps {
  label: string;
  value: string;
  isHighlighted?: boolean;
  highlightColor?: string;
}

function ProfileField({ label, value, isHighlighted, highlightColor }: ProfileFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <span
        style={{
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 600,
          fontSize: "10px",
          color: "#6b6880",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <div
        className="px-4 py-3 rounded-[12px]"
        style={{ background: "#1a1a24" }}
      >
        <span
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 600,
            fontSize: "clamp(12px, 1.5vw, 15px)",
            color: isHighlighted ? highlightColor || "#22c55e" : "#f2f0ff",
          }}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

export function ProfilePage() {
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [editForm, setEditForm] = useState({ full_name: "", phone: "", email: "", cnic: "" });
  const [passwordForm, setPasswordForm] = useState({ old_password: "", new_password: "" });
  const [message, setMessage] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await getProfile();
        setProfile(response.data || null);
      } catch (error) {
        console.error(error);
      }
    };
    loadProfile();
  }, []);

  const handleEditSave = async () => {
    setMessage("");
    const payload: Record<string, string> = {};
    const fn = editForm.full_name.trim();
    const ph = editForm.phone.trim();
    const em = editForm.email.trim();
    const cn = editForm.cnic.trim();
    if (fn) payload.full_name = fn;
    if (ph) payload.phone = ph;
    if (em) payload.email = em;
    if (cn) payload.cnic = cn;

    if (Object.keys(payload).length === 0) {
      setMessage("Update at least one field.");
      return;
    }

    try {
      const response = await updateProfile(payload);
      if (response.status !== "Success") {
        setMessage(response.message || "Update failed.");
        return;
      }
      setMessage(response.message || "Profile updated.");
      const refreshed = await getProfile();
      setProfile(refreshed.data || null);
      setEditOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Update failed.");
    }
  };

  const handlePasswordSave = async () => {
    setMessage("");
    try {
      const response = await changePassword(passwordForm);
      if (response.status !== "Success") {
        setMessage(response.message || "Password update failed.");
        return;
      }
      setMessage(response.message || "Password updated.");
      setPasswordForm({ old_password: "", new_password: "" });
      setPasswordOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Password update failed.");
    }
  };

  const handleDeleteAccount = async () => {
    setMessage("");
    try {
      const response = await deleteAccount();
      if (response.status !== "Success") {
        setMessage(response.message || "Delete failed.");
        return;
      }
      clearAuth();
      window.location.href = "/";
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Delete failed.");
    }
  };

  const accountNumberRaw =
    profile?.account_number !== undefined ? profile?.account_number : profile?.wallet_id;
  const accountNumber = accountNumberRaw ? String(accountNumberRaw) : "";
  const cardNumber = (profile?.card as { card_number?: string })?.card_number || "";
  const cardExpiry = (profile?.card as { expiry?: string })?.expiry || "";

  return (
    <div
      className="w-full"
      style={{ fontFamily: "'Montserrat', sans-serif" }}
    >
      {/* Page heading */}
      <h1
        className="mb-6"
        style={{
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 700,
          fontSize: "clamp(22px, 4vw, 44px)",
          color: "#f2f0ff",
        }}
      >
        Account Profile
      </h1>

      {/* Profile Card */}
      <div
        className="rounded-[40px] p-8"
        style={{ background: "#2a2733" }}
      >
        {/* Row 1 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-5">
          <ProfileField label="FULL NAME" value={String(profile?.full_name || "-")} />
          <ProfileField label="PHONE" value={String(profile?.phone || "-")} />
          <ProfileField label="EMAIL" value={String(profile?.email || "-")} />
        </div>

        {/* Row 2 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-5">
          <ProfileField label="CNIC" value={String(profile?.cnic || "-")} />
          <ProfileField label="MEMBER SINCE" value={String(profile?.member_since || "-")} />
          <ProfileField
            label="WALLET STATUS"
            value={String(profile?.wallet_status || "-")}
            isHighlighted
            highlightColor="#22c55e"
          />
        </div>

        {/* Row 3 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <ProfileField label="CARD NUMBER" value={cardNumber || "-"} />
          <ProfileField label="CARD EXPIRY" value={cardExpiry || "-"} />
          <ProfileField label="ACCOUNT NUMBER" value={accountNumber || "-"} />
        </div>

        {/* Edit Profile Button */}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            disabled={!profile}
            onClick={() => {
              if (!profile) return;
              setEditForm({
                full_name: String(profile.full_name || ""),
                phone: String(profile.phone || ""),
                email: String(profile.email || ""),
                cnic: String(profile.cnic || ""),
              });
              setEditOpen(true);
            }}
            className="px-8 py-3 rounded-[14px] uppercase tracking-widest transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
            style={{
              background: "linear-gradient(135deg, #6750a4, #9c82d4)",
              color: "#f2f0ff",
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 700,
              fontSize: "13px",
              letterSpacing: "0.12em",
              opacity: profile ? 1 : 0.45,
            }}
          >
            Edit Profile
          </button>
          <button
            onClick={() => setPasswordOpen(true)}
            className="px-8 py-3 rounded-[14px] uppercase tracking-widest transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
            style={{
              background: "#3d3a4a",
              color: "#f2f0ff",
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 700,
              fontSize: "13px",
              letterSpacing: "0.12em",
            }}
          >
            Change Password
          </button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                className="px-8 py-3 rounded-[14px] uppercase tracking-widest transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
                style={{
                  background: "rgba(239,68,68,0.15)",
                  color: "#f87171",
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 700,
                  fontSize: "13px",
                  letterSpacing: "0.12em",
                }}
              >
                Delete Account
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="border-none" style={{ background: "#232228", color: "#f2f0ff" }}>
              <AlertDialogHeader>
                <AlertDialogTitle style={{ fontFamily: "'Montserrat', sans-serif" }}>
                  Delete Account
                </AlertDialogTitle>
                <AlertDialogDescription style={{ color: "#b8b4d4" }}>
                  This permanently removes your wallet, cards, and transaction history.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAccount}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        {message && (
          <p
            className="text-center mt-4"
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 500,
              fontSize: "12px",
              color: "#b8b4d4",
            }}
          >
            {message}
          </p>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="border-none" style={{ background: "#232228", color: "#f2f0ff" }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Montserrat', sans-serif" }}>Edit Profile</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <input
              value={editForm.full_name}
              onChange={(e) => setEditForm((prev) => ({ ...prev, full_name: e.target.value }))}
              placeholder="Full Name"
              className="rounded-[14px] px-4 py-3 bg-[#3d3a4a] text-[#f2f0ff] outline-none"
            />
            <input
              value={editForm.phone}
              onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
              placeholder="Phone"
              className="rounded-[14px] px-4 py-3 bg-[#3d3a4a] text-[#f2f0ff] outline-none"
            />
            <input
              value={editForm.email}
              onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="Email"
              className="rounded-[14px] px-4 py-3 bg-[#3d3a4a] text-[#f2f0ff] outline-none"
            />
            <input
              value={editForm.cnic}
              onChange={(e) => setEditForm((prev) => ({ ...prev, cnic: e.target.value }))}
              placeholder="CNIC"
              className="rounded-[14px] px-4 py-3 bg-[#3d3a4a] text-[#f2f0ff] outline-none"
            />
            <button
              onClick={handleEditSave}
              className="rounded-[14px] py-3 uppercase tracking-widest"
              style={{
                background: "linear-gradient(135deg, #6750a4, #9c82d4)",
                color: "#f2f0ff",
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 700,
                fontSize: "12px",
              }}
            >
              Save Changes
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent className="border-none" style={{ background: "#232228", color: "#f2f0ff" }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Montserrat', sans-serif" }}>Change Password</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <input
              value={passwordForm.old_password}
              onChange={(e) => setPasswordForm((prev) => ({ ...prev, old_password: e.target.value }))}
              placeholder="Current Password"
              type="password"
              className="rounded-[14px] px-4 py-3 bg-[#3d3a4a] text-[#f2f0ff] outline-none"
            />
            <input
              value={passwordForm.new_password}
              onChange={(e) => setPasswordForm((prev) => ({ ...prev, new_password: e.target.value }))}
              placeholder="New Password"
              type="password"
              className="rounded-[14px] px-4 py-3 bg-[#3d3a4a] text-[#f2f0ff] outline-none"
            />
            <button
              onClick={handlePasswordSave}
              className="rounded-[14px] py-3 uppercase tracking-widest"
              style={{
                background: "linear-gradient(135deg, #6750a4, #9c82d4)",
                color: "#f2f0ff",
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 700,
                fontSize: "12px",
              }}
            >
              Update Password
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
