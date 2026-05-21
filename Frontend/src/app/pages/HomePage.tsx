import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { PaymentCard } from "../components/PaymentCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { adminTopup, donateCharity, getProfile, lookupAccount, transferMoney } from "../lib/api";
import { getAuthRole } from "../lib/auth";
import { UI } from "../lib/uiAssets";

const services = [
  { key: "tax", label: "Tax Payment", src: UI.iconTax, available: false },
  { key: "transfer", label: "Money Transfer", src: UI.iconTransfer, available: true },
  { key: "intl", label: "International Wallet", src: UI.iconIntl, available: false },
  { key: "bill", label: "Bill Payment", src: UI.iconBill, available: false },
  { key: "prepaid", label: "Prepaid Load", src: UI.iconPrepaid, available: false },
  { key: "charity", label: "Charity", src: UI.iconCharity, available: true },
  { key: "mobile", label: "Mobile Packages", src: UI.iconMobile, available: false },
  { key: "qr", label: "QR Scan To Pay", src: UI.iconQr, available: false },
] as const;

// Charity section removed - simplified layout per design

type ReceiverInfo = {
  full_name?: string;
  wallet_id?: number;
  email?: string;
  phone?: string;
};

export function HomePage() {
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [activeService, setActiveService] = useState<(typeof services)[number] | null>(null);
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [receiverAccount, setReceiverAccount] = useState("");
  const [receiverInfo, setReceiverInfo] = useState<ReceiverInfo | null>(null);
  const [transferAmount, setTransferAmount] = useState("");
  const [transferPin, setTransferPin] = useState("");
  const [transferError, setTransferError] = useState("");
  const [transferReceipt, setTransferReceipt] = useState<Record<string, unknown> | null>(null);
  const [comingSoon, setComingSoon] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [adminTopupForm, setAdminTopupForm] = useState({
    account_number: "",
    amount: "",
    method: "CASH",
    reference: "",
  });
  const [adminTopupMessage, setAdminTopupMessage] = useState("");

  const role = getAuthRole();
  const isAdmin = role === "admin";

  const refreshProfile = async () => {
    if (isAdmin) return;
    try {
      const response = await getProfile();
      setProfile(response.data || null);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    refreshProfile();
  }, [isAdmin]);

  useEffect(() => {
    if (!serviceDialogOpen) {
      setReceiverInfo(null);
      setReceiverAccount("");
      setTransferAmount("");
      setTransferPin("");
      setCharityPin("");
      setTransferError("");
      setTransferReceipt(null);
      setComingSoon(false);
      setLookupLoading(false);
    }
  }, [serviceDialogOpen]);

  const displayName = useMemo(() => {
    if (isAdmin) return "ADMIN";
    if (typeof profile?.full_name === "string" && profile.full_name.trim()) return profile.full_name;
    if (typeof profile?.username === "string" && profile.username.trim()) return profile.username;
    if (typeof profile?.email === "string" && profile.email.trim()) return profile.email;
    return "WALLET USER";
  }, [isAdmin, profile]);

  const balance = useMemo(() => {
    const rawBalance = profile?.balance;
    if (typeof rawBalance === "number" && Number.isFinite(rawBalance)) return rawBalance;
    if (typeof rawBalance === "string") {
      const parsedBalance = Number(rawBalance);
      if (Number.isFinite(parsedBalance)) return parsedBalance;
    }
    return 0;
  }, [profile]);

  const accountNumberRaw = profile?.account_number !== undefined ? profile?.account_number : profile?.wallet_id;
  const accountNumber = accountNumberRaw ? String(accountNumberRaw) : "";
  const cardNumber = (profile?.card as { card_number?: string })?.card_number || "";
  const cardExpiry = (profile?.card as { expiry?: string })?.expiry || "";

  const handleAdminTopup = async () => {
    setAdminTopupMessage("");
    try {
      const response = await adminTopup({
        account_number: adminTopupForm.account_number.trim(),
        amount: Number(adminTopupForm.amount),
        method: adminTopupForm.method,
        reference: adminTopupForm.reference.trim() || undefined,
      });
      if (response.status !== "Success") {
        setAdminTopupMessage(response.message || "Top up failed.");
        return;
      }
      setAdminTopupMessage(response.message || "Top up completed.");
      setAdminTopupForm((prev) => ({ ...prev, account_number: "", amount: "", reference: "" }));
    } catch (error) {
      setAdminTopupMessage(error instanceof Error ? error.message : "Top up failed.");
    }
  };

  const [charityTrust, setCharityTrust] = useState<string | null>(null);
  const [charityAmount, setCharityAmount] = useState("");
  const [charityPin, setCharityPin] = useState("");
  const [charityMessage, setCharityMessage] = useState("");
  const [charityProcessed, setCharityProcessed] = useState(false);
  const [charityLoading, setCharityLoading] = useState(false);

  const pakistaniTrusts = [
    { id: "edhi", name: "Edhi Foundation", description: "Welfare & relief organization" },
    { id: "shaukat", name: "Shaukat Khanum Memorial Cancer Hospital", description: "Cancer treatment & research" },
    { id: "sja", name: "Saylani Welfare Trust", description: "Food, education & healthcare" },
    { id: "imf", name: "Islamic Relief Pakistan", description: "Emergency relief & development" },
    { id: "tcf", name: "The Citizens Foundation", description: "Education for underprivileged" },
    { id: "hrw", name: "Human Rights Watch Pakistan", description: "Human rights advocacy" },
  ];

  const handleCharityDonate = async () => {
    if (!charityTrust || !charityAmount || !charityPin) {
      setCharityMessage("Please select a trust, enter an amount and your PIN");
      return;
    }
    setCharityMessage("");
    setCharityLoading(true);
    try {
      const trust = pakistaniTrusts.find((t) => t.id === charityTrust);
      const response = await donateCharity({
        trust_name: trust?.name || charityTrust,
        amount: Number(charityAmount),
        pin: charityPin,
      });
      if (response.status !== "Success") {
        setCharityMessage(response.message || "Donation failed");
        return;
      }
      setCharityProcessed(true);
      setCharityMessage(response.message || `PKR ${Number(charityAmount).toLocaleString()} donation successful.`);
      await refreshProfile();
    } catch (error) {
      setCharityMessage(error instanceof Error ? error.message : "Donation failed");
    } finally {
      setCharityLoading(false);
    }
  };

  const handleServiceOpen = (service: (typeof services)[number]) => {
    setActiveService(service);
    setServiceDialogOpen(true);
  };

  const handleLookup = async () => {
    setTransferError("");
    const account = receiverAccount.trim();
    if (!account) {
      setTransferError("Please enter an account number");
      return;
    }
    try {
      setLookupLoading(true);
      const response = await lookupAccount(account);
      if (response.status !== "Success") {
        setTransferError(response.message || "Account not found");
        setReceiverInfo(null);
        return;
      }
      setReceiverInfo(response.data as ReceiverInfo);
      setTransferError("");
    } catch (error) {
      setTransferError(error instanceof Error ? error.message : "Lookup failed");
      setReceiverInfo(null);
    } finally {
      setLookupLoading(false);
    }
  };

  const handleTransfer = async () => {
    setTransferError("");
    if (!receiverInfo) {
      setTransferError("Please look up a recipient first");
      return;
    }
    if (!transferAmount || Number(transferAmount) <= 0) {
      setTransferError("Please enter a valid amount");
      return;
    }
    if (!transferPin) {
      setTransferError("Please enter your wallet PIN");
      return;
    }
    try {
      const response = await transferMoney({
        receiver_account: receiverAccount.trim(),
        amount: Number(transferAmount),
        pin: transferPin,
      });
      if (response.status !== "Success") {
        setTransferError(response.message || "Transfer failed");
        return;
      }
      setTransferReceipt((response.receipt as Record<string, unknown>) || { amount: transferAmount });
      await refreshProfile();
    } catch (error) {
      setTransferError(error instanceof Error ? error.message : "Transfer failed");
    }
  };

  return (
    <div className="w-full space-y-6 sm:space-y-8 overflow-hidden" style={{ fontFamily: "'Montserrat', sans-serif" }}>
      <motion.div
        className="mb-6 sm:mb-8"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <h1
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 700,
            fontSize: "clamp(18px, 3vw, 36px)",
            color: "#b8b4d4",
          }}
        >
          WELCOME BACK <span style={{ color: "#f2f0ff" }}>{displayName}</span>,
        </h1>
      </motion.div>

      <div className="flex flex-col items-stretch gap-6 lg:flex-row lg:gap-8">
        <div className="flex w-full flex-col gap-5 lg:max-w-[26rem] lg:flex-shrink-0 xl:max-w-[28rem]">
          {!isAdmin && (
            <motion.div
              className="rounded-[24px] p-6 relative overflow-hidden fade-in-up"
              style={{
                background: "#3d3a4a",
                boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
              }}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.05 }}
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <p
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 700,
                    fontSize: "clamp(14px, 2vw, 18px)",
                    color: "#b8b4d4",
                    letterSpacing: "0.12em",
                  }}
                >
                  BALANCE
                </p>
                <div className="flex items-center gap-2">
                  <span
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontWeight: 700,
                      fontSize: "clamp(18px, 3vw, 28px)",
                      color: "#f2f0ff",
                    }}
                  >
                    {balanceVisible ? `PKR ${balance.toLocaleString()}` : "••••••••"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setBalanceVisible(!balanceVisible)}
                    className="text-[#b8b4d4] hover:text-[#f2f0ff] transition-colors"
                    aria-label={balanceVisible ? "Hide balance" : "Show balance"}
                  >
                    {balanceVisible ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {accountNumber && (
                <div
                  className="rounded-[12px] px-3 py-2 mb-4"
                  style={{ background: "rgba(0,0,0,0.2)" }}
                >
                  <span
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontWeight: 600,
                      fontSize: "10px",
                      color: "#9d99b8",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                    }}
                  >
                    Your account number (use for transfers)
                  </span>
                  <div
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontWeight: 700,
                      fontSize: "14px",
                      color: "#f2f0ff",
                      marginTop: "4px",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {accountNumber}
                  </div>
                </div>
              )}


            </motion.div>
          )}

          {isAdmin && (
            <motion.div
              className="rounded-[24px] p-6"
              style={{ background: "#2a2733", border: "1px solid rgba(255,255,255,0.06)" }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h2
                style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 700,
                  fontSize: "18px",
                  color: "#f2f0ff",
                }}
              >
                Admin top up
              </h2>
              <p
                style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 500,
                  fontSize: "12px",
                  color: "#b8b4d4",
                  marginTop: "6px",
                }}
              >
                Credit a customer wallet after receiving cash or cheque in branch.
              </p>
              <div className="mt-4 grid gap-3">
                <input
                  value={adminTopupForm.account_number}
                  onChange={(e) =>
                    setAdminTopupForm((prev) => ({ ...prev, account_number: e.target.value }))
                  }
                  placeholder="Customer account number"
                  className="rounded-[14px] px-4 py-3 bg-[#3d3a4a] text-[#f2f0ff] outline-none ring-1 ring-white/5 focus:ring-violet-400/40"
                />
                <input
                  value={adminTopupForm.amount}
                  onChange={(e) =>
                    setAdminTopupForm((prev) => ({ ...prev, amount: e.target.value }))
                  }
                  placeholder="Amount (PKR)"
                  className="rounded-[14px] px-4 py-3 bg-[#3d3a4a] text-[#f2f0ff] outline-none ring-1 ring-white/5 focus:ring-violet-400/40"
                />
                <button
                  type="button"
                  onClick={handleAdminTopup}
                  className="rounded-[14px] py-3 uppercase tracking-widest hover:opacity-95 active:scale-[0.99] transition-all"
                  style={{
                    background: "linear-gradient(135deg, #6750a4, #9c82d4)",
                    color: "#f2f0ff",
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 700,
                    fontSize: "12px",
                  }}
                >
                  Process top up
                </button>
                {adminTopupMessage && (
                  <p
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontWeight: 500,
                      fontSize: "12px",
                      color: "#b8b4d4",
                    }}
                  >
                    {adminTopupMessage}
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {!isAdmin && (
            <motion.div
              className="flex justify-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <div
                style={{
                  perspective: "1200px",
                  position: "relative",
                  width: "340px",
                  height: "220px",
                }}
              >
                {[0, 1, 2].map((idx) => (
                  <div
                    key={idx}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${idx * 16}px) translateX(${idx * 12}px) rotateZ(${idx * 3}deg) rotateX(${idx * 2}deg)`,
                      zIndex: 3 - idx,
                      transition: "transform 0.4s cubic-bezier(0.23, 1, 0.320, 1)",
                      filter: idx > 0 ? `brightness(${0.85 + idx * 0.05})` : "brightness(1)",
                    }}
                  >
                    <PaymentCard cardNumber={cardNumber} cardHolder={displayName} expiry={cardExpiry} />
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* Quick Services Grid - Users Only */}
        {!isAdmin && (
          <motion.div
            className="w-full"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            <h2
              style={{
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 700,
                fontSize: "clamp(16px, 2.5vw, 20px)",
                color: "#f2f0ff",
                marginBottom: "16px",
                letterSpacing: "0.08em",
              }}
            >
              QUICK SERVICES
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {services.map((service) => (
                <motion.button
                  key={service.key}
                  onClick={() => handleServiceOpen(service)}
                  disabled={!service.available}
                  className={`relative rounded-[16px] p-4 flex flex-col items-center gap-2 transition-all ${
                    service.available
                      ? "hover:scale-105 active:scale-95 cursor-pointer"
                      : "opacity-50 cursor-not-allowed"
                  }`}
                  style={{
                    background: service.available
                      ? "linear-gradient(135deg, rgba(103, 80, 164, 0.2), rgba(156, 130, 212, 0.1))"
                      : "rgba(61, 58, 74, 0.5)",
                    border: service.available
                      ? "1px solid rgba(167, 139, 250, 0.3)"
                      : "1px solid rgba(184, 180, 212, 0.1)",
                  }}
                  whileHover={service.available ? { scale: 1.05 } : {}}
                  whileTap={service.available ? { scale: 0.95 } : {}}
                >
                  <img
                    src={service.src}
                    alt={service.label}
                    className="w-8 h-8 sm:w-10 sm:h-10"
                  />
                  <span
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontWeight: 600,
                      fontSize: "clamp(10px, 1.5vw, 12px)",
                      color: service.available ? "#f2f0ff" : "#b8b4d4",
                      textAlign: "center",
                      lineHeight: 1.2,
                    }}
                  >
                    {service.label}
                  </span>
                  {!service.available && (
                    <span
                      style={{
                        fontFamily: "'Montserrat', sans-serif",
                        fontWeight: 500,
                        fontSize: "9px",
                        color: "#9d99b8",
                        marginTop: "2px",
                      }}
                    >
                      Coming Soon
                    </span>
                  )}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      <Dialog open={serviceDialogOpen} onOpenChange={setServiceDialogOpen}>
        <DialogContent
          className="border-none max-h-[90vh] overflow-y-auto"
          style={{ background: "#232228", color: "#f2f0ff" }}
        >
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Montserrat', sans-serif" }}>
              {activeService?.label}
            </DialogTitle>
          </DialogHeader>

          {activeService?.key === "transfer" && !isAdmin ? (
            <div className="grid gap-4 pt-2">
              <div className="grid gap-2">
                <label
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 600,
                    fontSize: "11px",
                    color: "#b8b4d4",
                    letterSpacing: "0.12em",
                  }}
                >
                  Receiver account number
                </label>
                <div className="flex gap-2 flex-wrap">
                  <input
                    value={receiverAccount}
                    onChange={(e) => setReceiverAccount(e.target.value)}
                    onBlur={() => {
                      if (receiverAccount.trim().length >= 3) void handleLookup();
                    }}
                    className="flex-1 min-w-[180px] rounded-[14px] px-4 py-3 bg-[#3d3a4a] text-[#f2f0ff] outline-none ring-1 ring-white/5"
                    placeholder="Enter recipient account number"
                  />
                  <button
                    type="button"
                    onClick={handleLookup}
                    disabled={lookupLoading}
                    className="rounded-[14px] px-5 py-3 disabled:opacity-60 transition-opacity"
                    style={{
                      background: "#3d3a4a",
                      color: "#f2f0ff",
                      fontFamily: "'Montserrat', sans-serif",
                      fontWeight: 700,
                      fontSize: "12px",
                    }}
                  >
                    {lookupLoading ? "…" : "Find"}
                  </button>
                </div>
              </div>

              {receiverInfo && (
                <motion.div
                  className="rounded-[14px] p-3 ring-1 ring-emerald-500/25"
                  style={{ background: "#2a2733" }}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontWeight: 700,
                      fontSize: "13px",
                      color: "#f2f0ff",
                    }}
                  >
                    {receiverInfo.full_name}
                  </div>
                  <div
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontWeight: 500,
                      fontSize: "11px",
                      color: "#b8b4d4",
                      marginTop: "4px",
                    }}
                  >
                    Wallet #{receiverInfo.wallet_id}
                    {receiverInfo.phone ? ` · ${receiverInfo.phone}` : ""}
                  </div>
                  {receiverInfo.email && (
                    <div
                      style={{
                        fontFamily: "'Montserrat', sans-serif",
                        fontWeight: 500,
                        fontSize: "11px",
                        color: "#9d99b8",
                        marginTop: "2px",
                      }}
                    >
                      {receiverInfo.email}
                    </div>
                  )}
                </motion.div>
              )}

              <div className="grid gap-2">
                <label
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 600,
                    fontSize: "11px",
                    color: "#b8b4d4",
                    letterSpacing: "0.12em",
                  }}
                >
                  Amount (PKR)
                </label>
                <input
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className="rounded-[14px] px-4 py-3 bg-[#3d3a4a] text-[#f2f0ff] outline-none ring-1 ring-white/5"
                  placeholder="0"
                  inputMode="decimal"
                />
              </div>

              <div className="grid gap-2">
                <label
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 600,
                    fontSize: "11px",
                    color: "#b8b4d4",
                    letterSpacing: "0.12em",
                  }}
                >
                  Wallet PIN
                </label>
                <input
                  value={transferPin}
                  onChange={(e) => setTransferPin(e.target.value)}
                  type="password"
                  autoComplete="off"
                  className="rounded-[14px] px-4 py-3 bg-[#3d3a4a] text-[#f2f0ff] outline-none ring-1 ring-white/5"
                  placeholder="••••"
                />
              </div>

              {transferError && (
                <div
                  className="rounded-[12px] px-3 py-2"
                  style={{ background: "rgba(239,68,68,0.15)", color: "#f87171" }}
                >
                  {transferError}
                </div>
              )}

              {transferReceipt ? (
                <motion.div
                  className="rounded-[18px] p-4 ring-1 ring-violet-400/30"
                  style={{ background: "#2a2733" }}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <div
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontWeight: 700,
                      fontSize: "13px",
                      color: "#f2f0ff",
                    }}
                  >
                    Transfer receipt
                  </div>
                  <div
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontWeight: 500,
                      fontSize: "12px",
                      color: "#b8b4d4",
                      marginTop: "6px",
                    }}
                  >
                    Transfer #{String(transferReceipt.transfer_id ?? "-")}
                  </div>
                  <div
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontWeight: 500,
                      fontSize: "12px",
                      color: "#b8b4d4",
                    }}
                  >
                    Status: {String(transferReceipt.status ?? "-")}
                  </div>
                  <div
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontWeight: 500,
                      fontSize: "12px",
                      color: "#b8b4d4",
                    }}
                  >
                    Receiver: {String(transferReceipt.receiver_name ?? "-")}
                  </div>
                  <div
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontWeight: 700,
                      fontSize: "15px",
                      color: "#22c55e",
                      marginTop: "8px",
                    }}
                  >
                    PKR {String(transferReceipt.amount ?? "0")}
                  </div>
                  <p
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontSize: "11px",
                      color: "#9d99b8",
                      marginTop: "10px",
                    }}
                  >
                    Your transaction history has been updated.
                  </p>
                </motion.div>
              ) : (
                <button
                  type="button"
                  onClick={handleTransfer}
                  className="rounded-[14px] py-3 uppercase tracking-widest hover:opacity-95 active:scale-[0.99] transition-all"
                  style={{
                    background: "linear-gradient(135deg, #6750a4, #9c82d4)",
                    color: "#f2f0ff",
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 700,
                    fontSize: "12px",
                  }}
                >
                  Send money
                </button>
              )}
            </div>
          ) : activeService?.key === "transfer" && isAdmin ? (
            <p style={{ color: "#b8b4d4", fontFamily: "'Montserrat', sans-serif", fontSize: "13px" }}>
              Money transfer is available for customer wallets. Please sign in as a user to send funds.
            </p>
          ) : activeService?.key === "charity" && !isAdmin ? (
            <div className="grid gap-4 pt-2 max-h-[60vh] overflow-y-auto">
              <div className="rounded-[16px] p-4 ring-1 ring-white/8" style={{ background: "#2a2733" }}>
                <div
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 600,
                    fontSize: "12px",
                    color: "#f2f0ff",
                  }}
                >
                  Select a Pakistani Welfare Trust
                </div>
                <div className="mt-3 grid gap-2">
                  {pakistaniTrusts.map((trust) => (
                    <button
                      key={trust.id}
                      type="button"
                      onClick={() => {
                        setCharityTrust(trust.id);
                        setCharityMessage("");
                      }}
                      className="text-left rounded-[12px] px-4 py-3 ring-1 transition-all"
                      style={{
                        background: charityTrust === trust.id ? "#6750a4" : "#3d3a4a",
                        color: "#f2f0ff",
                        ringColor: charityTrust === trust.id ? "#9c82d4" : "rgba(255,255,255,0.1)",
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "'Montserrat', sans-serif",
                          fontWeight: 700,
                          fontSize: "12px",
                        }}
                      >
                        {trust.name}
                      </div>
                      <div
                        style={{
                          fontFamily: "'Montserrat', sans-serif",
                          fontWeight: 500,
                          fontSize: "10px",
                          color: "#b8b4d4",
                          marginTop: "2px",
                        }}
                      >
                        {trust.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[16px] p-4 ring-1 ring-white/8" style={{ background: "#2a2733" }}>
                <label
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 600,
                    fontSize: "11px",
                    color: "#b8b4d4",
                    letterSpacing: "0.12em",
                  }}
                >
                  Donation Amount (PKR)
                </label>
                <input
                  value={charityAmount}
                  onChange={(e) => setCharityAmount(e.target.value)}
                  type="number"
                  placeholder="Enter amount"
                  className="mt-2 w-full rounded-[12px] px-4 py-3 bg-[#3d3a4a] text-[#f2f0ff] outline-none ring-1 ring-white/5"
                />
              </div>

              <div className="rounded-[16px] p-4 ring-1 ring-white/8" style={{ background: "#2a2733" }}>
                <label
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 600,
                    fontSize: "11px",
                    color: "#b8b4d4",
                    letterSpacing: "0.12em",
                  }}
                >
                  Wallet PIN
                </label>
                <input
                  value={charityPin}
                  onChange={(e) => setCharityPin(e.target.value)}
                  type="password"
                  placeholder="••••"
                  className="mt-2 w-full rounded-[12px] px-4 py-3 bg-[#3d3a4a] text-[#f2f0ff] outline-none ring-1 ring-white/5"
                />
              </div>

              {charityMessage && (
                <motion.div
                  className={`rounded-[12px] px-4 py-3 ${charityProcessed ? "ring-1 ring-green-400/30" : ""}`}
                  style={{
                    background: charityProcessed ? "rgba(34,197,94,0.15)" : "rgba(59,130,246,0.15)",
                    color: charityProcessed ? "#22c55e" : "#60a5fa",
                  }}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <span
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontWeight: 600,
                      fontSize: "12px",
                    }}
                  >
                    {charityMessage}
                  </span>
                </motion.div>
              )}

              {!charityProcessed ? (
                <button
                  type="button"
                  onClick={handleCharityDonate}
                  className="rounded-[14px] py-3 uppercase tracking-widest hover:opacity-95 active:scale-[0.99] transition-all"
                  style={{
                    background: "linear-gradient(135deg, #6750a4, #9c82d4)",
                    color: "#f2f0ff",
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 700,
                    fontSize: "12px",
                  }}
                >
                  Proceed with Donation
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setCharityTrust(null);
                    setCharityAmount("");
                    setCharityMessage("");
                    setCharityProcessed(false);
                  }}
                  className="rounded-[14px] py-3 uppercase tracking-widest hover:opacity-95 active:scale-[0.99] transition-all"
                  style={{
                    background: "#3d3a4a",
                    color: "#f2f0ff",
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 700,
                    fontSize: "12px",
                  }}
                >
                  New Donation
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 pt-2">
              <div className="rounded-[16px] p-4 ring-1 ring-white/8" style={{ background: "#2a2733" }}>
                <div
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 600,
                    fontSize: "12px",
                    color: "#f2f0ff",
                  }}
                >
                  {activeService?.label}
                </div>
                <p
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 500,
                    fontSize: "11px",
                    color: "#b8b4d4",
                    marginTop: "8px",
                  }}
                >
                  Review the details below. When you continue, the payment rails for this service will connect to your
                  wallet — database hooks are ready on our side.
                </p>
                <div className="mt-3 grid gap-2">
                  <input
                    placeholder="Reference / consumer ID"
                    className="rounded-[12px] px-4 py-3 bg-[#3d3a4a] text-[#f2f0ff] outline-none ring-1 ring-white/5"
                  />
                  <input
                    placeholder="Amount (PKR)"
                    className="rounded-[12px] px-4 py-3 bg-[#3d3a4a] text-[#f2f0ff] outline-none ring-1 ring-white/5"
                  />
                </div>
              </div>
              {comingSoon ? (
                <motion.div
                  className="rounded-[14px] px-4 py-4 text-center ring-1 ring-violet-400/35"
                  style={{ background: "rgba(124,104,201,0.15)", color: "#e8e4ff" }}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "14px" }}>
                    Feature coming soon
                  </span>
                  <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "12px", marginTop: "8px", opacity: 0.85 }}>
                    We are finalising provider integrations; your balances and history stay in sync when this goes live.
                  </p>
                </motion.div>
              ) : (
                <button
                  type="button"
                  onClick={() => setComingSoon(true)}
                  className="rounded-[14px] py-3 uppercase tracking-widest hover:opacity-95 active:scale-[0.99] transition-all"
                  style={{
                    background: "linear-gradient(135deg, #6750a4, #9c82d4)",
                    color: "#f2f0ff",
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 700,
                    fontSize: "12px",
                  }}
                >
                  Proceed
                </button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
