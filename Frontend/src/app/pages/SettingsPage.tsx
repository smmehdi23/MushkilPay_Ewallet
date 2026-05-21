import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Switch } from "../components/ui/switch";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogAction } from "../components/ui/alert-dialog";

export function SettingsPage() {
  const [transferAlerts, setTransferAlerts] = useState(true);
  const [requirePinOnTransfer, setRequirePinOnTransfer] = useState(true);
  const [biometricLogin, setBiometricLogin] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState("1 Hour");
  const [twoFactorMessage, setTwoFactorMessage] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem("appSettings");
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        setTransferAlerts(settings.transferAlerts !== false);
        setRequirePinOnTransfer(settings.requirePinOnTransfer !== false);
        setBiometricLogin(settings.biometricLogin || false);
        setTwoFactorEnabled(settings.twoFactorEnabled || false);
        setSessionTimeout(settings.sessionTimeout || "1 Hour");
      } catch (error) {
        console.error("Failed to load settings", error);
      }
    }
  }, []);

  // Save settings to localStorage whenever they change
  const saveSettings = (updates: Record<string, unknown>) => {
    const currentSettings = localStorage.getItem("appSettings")
      ? JSON.parse(localStorage.getItem("appSettings") || "{}")
      : {};
    const newSettings = { ...currentSettings, ...updates };
    localStorage.setItem("appSettings", JSON.stringify(newSettings));
  };

  const handleTransferAlertsChange = (checked: boolean) => {
    setTransferAlerts(checked);
    saveSettings({ transferAlerts: checked });
  };

  const handleRequirePinChange = (checked: boolean) => {
    setRequirePinOnTransfer(checked);
    saveSettings({ requirePinOnTransfer: checked });
  };

  const handleBiometricChange = (checked: boolean) => {
    setBiometricLogin(checked);
    saveSettings({ biometricLogin: checked });
  };

  const handleTwoFactorChange = (checked: boolean) => {
    if (checked) {
      setTwoFactorMessage(true);
    } else {
      setTwoFactorEnabled(false);
      saveSettings({ twoFactorEnabled: false });
    }
  };

  const handleSessionTimeoutChange = (timeout: string) => {
    setSessionTimeout(timeout);
    saveSettings({ sessionTimeout: timeout });
  };

  return (
    <div className="w-full pb-20" style={{ fontFamily: "'Montserrat', sans-serif" }}>
      <motion.h1
        className="mb-8"
        style={{
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 700,
          fontSize: "clamp(22px, 4vw, 44px)",
          color: "#f2f0ff",
        }}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        App Settings
      </motion.h1>

      <motion.div
        className="rounded-[32px] px-6 sm:px-8 py-8 max-w-2xl mx-auto space-y-6"
        style={{
          background: "#2a2733",
          boxShadow: "0px 4px 35.8px 31px rgba(12,12,13,0.26)",
        }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.05 }}
      >
        {/* Transfer Alerts Setting */}
        <div
          className="flex items-center justify-between py-4 border-b"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <div className="flex-1">
            <h3
              style={{
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 700,
                fontSize: "16px",
                color: "#f2f0ff",
              }}
            >
              Transfer Alerts
            </h3>
            <p
              style={{
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 500,
                fontSize: "13px",
                color: "#b8b4d4",
                marginTop: "4px",
              }}
            >
              Notify on every transaction
            </p>
          </div>
          <Switch checked={transferAlerts} onCheckedChange={handleTransferAlertsChange} />
        </div>

        {/* Require PIN on Transfer Setting */}
        <div
          className="flex items-center justify-between py-4 border-b"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <div className="flex-1">
            <h3
              style={{
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 700,
                fontSize: "16px",
                color: "#f2f0ff",
              }}
            >
              Require PIN on Transfer
            </h3>
            <p
              style={{
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 500,
                fontSize: "13px",
                color: "#b8b4d4",
                marginTop: "4px",
              }}
            >
              Wallet PIN validated via DB trigger
            </p>
          </div>
          <Switch checked={requirePinOnTransfer} onCheckedChange={handleRequirePinChange} />
        </div>

        {/* Session Timeout Setting */}
        <div
          className="flex items-center justify-between py-4 border-b"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <div className="flex-1">
            <h3
              style={{
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 700,
                fontSize: "16px",
                color: "#f2f0ff",
              }}
            >
              Session Timeout
            </h3>
            <p
              style={{
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 500,
                fontSize: "13px",
                color: "#b8b4d4",
                marginTop: "4px",
              }}
            >
              JWT token auto-expiry (HS256)
            </p>
          </div>
          <select
            value={sessionTimeout}
            onChange={(e) => handleSessionTimeoutChange(e.target.value)}
            className="rounded-[12px] px-3 py-2 outline-none"
            style={{
              background: "#3d3a4a",
              color: "#f59e0b",
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 600,
              fontSize: "13px",
              border: "1px solid rgba(245,158,11,0.3)",
            }}
          >
            <option value="30 min">30 min</option>
            <option value="1 Hour">1 Hour</option>
            <option value="4 Hours">4 Hours</option>
            <option value="8 Hours">8 Hours</option>
          </select>
        </div>

        {/* Biometric Login Setting */}
        <div
          className="flex items-center justify-between py-4 border-b"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <div className="flex-1">
            <h3
              style={{
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 700,
                fontSize: "16px",
                color: "#f2f0ff",
              }}
            >
              Biometric Login
            </h3>
            <p
              style={{
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 500,
                fontSize: "13px",
                color: "#b8b4d4",
                marginTop: "4px",
              }}
            >
              Face ID or fingerprint authentication
            </p>
          </div>
          <Switch checked={biometricLogin} onCheckedChange={handleBiometricChange} />
        </div>

        {/* Two-Factor Authentication Setting */}
        <div className="flex items-center justify-between py-4">
          <div className="flex-1">
            <h3
              style={{
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 700,
                fontSize: "16px",
                color: "#f2f0ff",
              }}
            >
              Two-Factor Authentication
            </h3>
            <p
              style={{
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 500,
                fontSize: "13px",
                color: "#b8b4d4",
                marginTop: "4px",
              }}
            >
              Enhanced security for account access
            </p>
          </div>
          <Switch checked={twoFactorEnabled} onCheckedChange={handleTwoFactorChange} />
        </div>
      </motion.div>

      {/* Help Section */}
      <motion.div
        className="rounded-[32px] px-6 sm:px-8 py-8 max-w-2xl mx-auto mt-6"
        style={{
          background: "#2a2733",
          boxShadow: "0px 4px 35.8px 31px rgba(12,12,13,0.26)",
        }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.1 }}
      >
        <div
          className="rounded-[20px] px-5 py-4"
          style={{ background: "#232228", border: "1px solid rgba(242,240,255,0.06)" }}
        >
          <div
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 700,
              fontSize: "12px",
              color: "#f2f0ff",
              letterSpacing: "0.08em",
            }}
          >
            NEED HELP?
          </div>
          <p
            className="mt-2"
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 500,
              fontSize: "13px",
              color: "#b8b4d4",
            }}
          >
            support@mushkilpay.example · Mon–Sat, 9am–6pm PKT
          </p>
        </div>

        <div
          className="mt-6 text-center"
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 500,
            fontSize: "11px",
            color: "#6b6880",
          }}
        >
          <p>MushkilPay © 2026. All rights reserved.</p>
          <p className="mt-2">Version 1.0.0 · Last updated: May 3, 2026</p>
        </div>
      </motion.div>

      {/* Two-Factor Message Dialog */}
      <AlertDialog open={twoFactorMessage} onOpenChange={setTwoFactorMessage}>
        <AlertDialogContent style={{ background: "#232228", color: "#f2f0ff", border: "1px solid rgba(255,255,255,0.06)" }}>
          <AlertDialogHeader>
            <AlertDialogTitle style={{ fontFamily: "'Montserrat', sans-serif" }}>Two-Factor Authentication</AlertDialogTitle>
            <AlertDialogDescription style={{ fontFamily: "'Montserrat', sans-serif", color: "#b8b4d4", marginTop: "12px" }}>
              This feature will be available soon. We're working to bring enhanced security to your MushkilPay account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogAction
            onClick={() => {
              setTwoFactorMessage(false);
              setTwoFactorEnabled(false);
            }}
            style={{
              background: "linear-gradient(135deg, #6750a4, #9c82d4)",
              color: "#f2f0ff",
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 700,
            }}
          >
            OK
          </AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

