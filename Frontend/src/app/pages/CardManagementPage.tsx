import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { PaymentCard } from "../components/PaymentCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import {
  activateCard,
  changeCardPin,
  getCard,
  getAllCards,
  getProfile,
  getWithdrawalLimit,
  requestNewCard,
  setWithdrawalLimit,
} from "../lib/api";

const InfoIcon = () => (
  <svg width="20" height="20" viewBox="0 0 44 44" fill="none">
    <path
      d="M22 30V22M22 14H22.02M42 22C42 33.0457 33.0457 42 22 42C10.9543 42 2 33.0457 2 22C2 10.9543 10.9543 2 22 2C33.0457 2 42 10.9543 42 22Z"
      stroke="#F2F0FF"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="4"
    />
  </svg>
);

export function CardManagementPage() {
  const [card, setCard] = useState<Record<string, unknown> | null>(null);
  const [allCards, setAllCards] = useState<Array<Record<string, unknown>>>([]);
  const [selectedCardIndex, setSelectedCardIndex] = useState(0);
  const [cardTypeFilter, setCardTypeFilter] = useState<"ALL" | "DEBIT" | "CREDIT" | "VIRTUAL">("ALL");
  const [limitAmount, setLimitAmount] = useState("");
  const [limitMessage, setLimitMessage] = useState("");
  const [activationOpen, setActivationOpen] = useState(false);
  const [activationForm, setActivationForm] = useState({ card_number: "", cvv: "" });
  const [activationMessage, setActivationMessage] = useState("");
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestForm, setRequestForm] = useState({ reason: "LOST", delivery_address: "" });
  const [requestMessage, setRequestMessage] = useState("");
  const [pinOpen, setPinOpen] = useState(false);
  const [pinForm, setPinForm] = useState({ card_last4: "", old_pin: "", new_pin: "" });
  const [pinMessage, setPinMessage] = useState("");
  const [policyOpen, setPolicyOpen] = useState(false);
  const [virtualCreditOpen, setVirtualCreditOpen] = useState(false);
  const [selectedCardType, setSelectedCardType] = useState<"VIRTUAL" | "CREDIT" | null>(null);
  const [holderName, setHolderName] = useState("WALLET USER");

  useEffect(() => {
    const loadData = async () => {
      try {
        const [cardResponse, allCardsResponse, profileResponse, limitResponse] = await Promise.all([
          getCard(),
          getAllCards(),
          getProfile(),
          getWithdrawalLimit(),
        ]);
        setCard(cardResponse.data || null);
        setAllCards(Array.isArray(allCardsResponse.data) ? allCardsResponse.data : []);
        const fullName = profileResponse.data?.full_name || profileResponse.data?.username || profileResponse.data?.email || "WALLET USER";
        setHolderName(String(fullName).toUpperCase());
        if (limitResponse.data?.limit_amount !== null && limitResponse.data?.limit_amount !== undefined) {
          setLimitAmount(String(limitResponse.data.limit_amount));
        }
      } catch (error) {
        console.error(error);
      }
    };
    loadData();
  }, []);

  const handleLimitSave = async () => {
    setLimitMessage("");
    try {
      const response = await setWithdrawalLimit(Number(limitAmount));
      if (response.status !== "Success") {
        setLimitMessage(response.message || "Update failed.");
        return;
      }
      setLimitMessage(response.message || "Limit updated.");
    } catch (error) {
      setLimitMessage(error instanceof Error ? error.message : "Update failed.");
    }
  };

  const reloadCardAndLimits = async () => {
    try {
      const [cardResponse, limitResponse] = await Promise.all([getCard(), getWithdrawalLimit()]);
      setCard(cardResponse.data || null);
      if (limitResponse.data?.limit_amount !== null && limitResponse.data?.limit_amount !== undefined) {
        setLimitAmount(String(limitResponse.data.limit_amount));
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleActivate = async () => {
    setActivationMessage("");
    try {
      const response = await activateCard(activationForm);
      if (response.status !== "Success") {
        setActivationMessage(response.message || "Activation failed.");
        return;
      }
      setActivationForm({ card_number: "", cvv: "" });
      await reloadCardAndLimits();
      setActivationOpen(false);
    } catch (error) {
      setActivationMessage(error instanceof Error ? error.message : "Activation failed.");
    }
  };

  const handleRequestCard = async () => {
    setRequestMessage("");
    try {
      const response = await requestNewCard({
        reason: requestForm.reason,
        delivery_address: requestForm.delivery_address,
        request_type: "REPLACE",
      });
      if (response.status !== "Success") {
        setRequestMessage(response.message || "Request failed.");
        return;
      }
      setRequestForm({ reason: "LOST", delivery_address: "" });
      await reloadCardAndLimits();
      setRequestOpen(false);
    } catch (error) {
      setRequestMessage(error instanceof Error ? error.message : "Request failed.");
    }
  };

  const handlePinChange = async () => {
    setPinMessage("");
    try {
      const response = await changeCardPin(pinForm);
      if (response.status !== "Success") {
        setPinMessage(response.message || "PIN update failed.");
        return;
      }
      setPinForm({ card_last4: "", old_pin: "", new_pin: "" });
      setPinOpen(false);
    } catch (error) {
      setPinMessage(error instanceof Error ? error.message : "PIN update failed.");
    }
  };

  return (
    <div
      className="w-full"
      style={{ fontFamily: "'Montserrat', sans-serif" }}
    >
      {/* Page heading + info icon */}
      <div className="flex items-center gap-4 mb-8">
        <h1
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 700,
            fontSize: "clamp(22px, 4vw, 44px)",
            color: "#f2f0ff",
          }}
        >
          Card Management
        </h1>
        <div className="mt-1">
          <InfoIcon />
        </div>
      </div>

      {/* Card Type Filter */}
      {allCards.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {(["ALL", "DEBIT", "CREDIT", "VIRTUAL"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setCardTypeFilter(type)}
              className="rounded-[14px] px-4 py-2 uppercase tracking-widest transition-all text-sm"
              style={{
                background: cardTypeFilter === type ? "#6750a4" : "#3d3a4a",
                color: "#f2f0ff",
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 700,
                fontSize: "11px",
                opacity: cardTypeFilter === type ? 1 : 0.6,
              }}
            >
              {type}
            </button>
          ))}
        </div>
      )}

      {/* Card Carousel/Selector */}
      {allCards.length > 1 && (
        <div className="mb-6 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setSelectedCardIndex(Math.max(0, selectedCardIndex - 1))}
            disabled={selectedCardIndex === 0}
            className="rounded-lg px-3 py-2 disabled:opacity-40"
            style={{ background: "#3d3a4a", color: "#f2f0ff" }}
          >
            ← Prev
          </button>
          <span
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 600,
              fontSize: "12px",
              color: "#b8b4d4",
            }}
          >
            Card {selectedCardIndex + 1} of {allCards.length}
          </span>
          <button
            type="button"
            onClick={() => setSelectedCardIndex(Math.min(allCards.length - 1, selectedCardIndex + 1))}
            disabled={selectedCardIndex === allCards.length - 1}
            className="rounded-lg px-3 py-2 disabled:opacity-40"
            style={{ background: "#3d3a4a", color: "#f2f0ff" }}
          >
            Next →
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6">
        <div className="flex flex-col gap-5">
          <PaymentCard
            cardNumber={allCards.length > 0 ? (allCards[selectedCardIndex]?.card_number as string) : (card?.card_number as string) || "4821 **** **** 7364"}
            cardHolder={holderName}
            expiry={allCards.length > 0 ? (allCards[selectedCardIndex]?.expiry as string) : (card?.expiry as string) || "09 / 29"}
            variant="management"
          />
          <div
            className="rounded-[24px] p-6"
            style={{ background: "#2a2733", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div
              style={{
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 700,
                fontSize: "14px",
                color: "#f2f0ff",
              }}
            >
              Card Status
            </div>
            <div
              className="mt-2 inline-flex rounded-full px-3 py-1"
              style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}
            >
              {allCards.length > 0 ? (allCards[selectedCardIndex]?.status as string) : (card?.status as string) || "ACTIVE"}
            </div>
            {(allCards.length > 0 ? allCards[selectedCardIndex]?.type : card?.type) && (
              <div
                className="mt-2 inline-flex rounded-full px-3 py-1 ml-2"
                style={{ background: "rgba(139,92,246,0.15)", color: "#d8b4fe" }}
              >
                {(allCards.length > 0 ? (allCards[selectedCardIndex]?.type as string) : (card?.type as string)) || "DEBIT"}
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={() => setActivationOpen(true)}
                className="rounded-[14px] px-4 py-2 uppercase tracking-widest"
                style={{
                  background: "#3d3a4a",
                  color: "#f2f0ff",
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 700,
                  fontSize: "11px",
                }}
              >
                Activate Card
              </button>
              <button
                onClick={() => setPolicyOpen(true)}
                className="rounded-[14px] px-4 py-2 uppercase tracking-widest"
                style={{
                  background: "#3d3a4a",
                  color: "#f2f0ff",
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 700,
                  fontSize: "11px",
                }}
              >
                Request New Card
              </button>
              <button
                onClick={() => setPinOpen(true)}
                className="rounded-[14px] px-4 py-2 uppercase tracking-widest"
                style={{
                  background: "#3d3a4a",
                  color: "#f2f0ff",
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 700,
                  fontSize: "11px",
                }}
              >
                Change PIN
              </button>
              <button
                onClick={() => setVirtualCreditOpen(true)}
                className="rounded-[14px] px-4 py-2 uppercase tracking-widest"
                style={{
                  background: "#3d3a4a",
                  color: "#f2f0ff",
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 700,
                  fontSize: "11px",
                }}
              >
                Apply for Card
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div
            className="rounded-[24px] p-6"
            style={{ background: "#2a2733", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <h2
              style={{
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 700,
                fontSize: "18px",
                color: "#f2f0ff",
              }}
            >
              Daily Withdrawal Limit
            </h2>
            <div className="mt-4 rounded-[14px] px-5 py-4" style={{ background: "#3d3a4a" }}>
              <div
                style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 500,
                  fontSize: "12px",
                  color: "#b8b4d4",
                  marginBottom: "8px",
                }}
              >
                Currently Set Limit
              </div>
              <div
                style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 700,
                  fontSize: "22px",
                  color: "#22c55e",
                }}
              >
                {limitAmount ? `PKR ${Number(limitAmount).toLocaleString()}` : "Not Set"}
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <input
                value={limitAmount}
                onChange={(e) => setLimitAmount(e.target.value)}
                placeholder="Enter new limit in PKR"
                className="flex-1 rounded-[14px] px-4 py-3 bg-[#232228] text-[#f2f0ff] outline-none"
                style={{ border: "1px solid rgba(255,255,255,0.06)" }}
              />
              <button
                onClick={handleLimitSave}
                className="rounded-[14px] px-4 uppercase tracking-widest"
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
            {limitMessage && (
              <p
                className="mt-3"
                style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 500,
                  fontSize: "12px",
                  color: limitMessage.includes("Error") ? "#ef4444" : "#22c55e",
                }}
              >
                {limitMessage}
              </p>
            )}
          </div>
        </div>
      </div>

      <Dialog open={policyOpen} onOpenChange={setPolicyOpen}>
        <DialogContent className="border-none max-w-md" style={{ background: "#232228", color: "#f2f0ff" }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "18px" }}>
              Replacement Card Policy
            </DialogTitle>
          </DialogHeader>
          <div style={{ fontFamily: "'Montserrat', sans-serif" }}>
            <p
              style={{
                fontWeight: 600,
                fontSize: "14px",
                color: "#f2f0ff",
                marginBottom: "12px",
              }}
            >
              Terms & Conditions
            </p>
            <ul
              style={{
                fontWeight: 500,
                fontSize: "13px",
                color: "#b8b4d4",
                lineHeight: "1.8",
                listStyle: "none",
                paddingLeft: "0",
              }}
            >
              <li>✓ New cards issued for lost or expired cards only</li>
              <li>✓ PKR 2,000 fee applies immediately</li>
              <li>✓ Card delivery takes 3-5 business days</li>
              <li>✓ Admin fulfillment task created on request</li>
            </ul>
            <button
              onClick={() => {
                setPolicyOpen(false);
                setRequestOpen(true);
              }}
              className="mt-6 w-full rounded-[14px] py-3 uppercase tracking-widest"
              style={{
                background: "linear-gradient(135deg, #6750a4, #9c82d4)",
                color: "#f2f0ff",
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 700,
                fontSize: "12px",
              }}
            >
              Proceed with Request
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={activationOpen} onOpenChange={setActivationOpen}>
        <DialogContent className="border-none max-w-md" style={{ background: "#232228", color: "#f2f0ff" }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Montserrat', sans-serif" }}>Activate physical card</DialogTitle>
          </DialogHeader>
          <p
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 500,
              fontSize: "12px",
              color: "#b8b4d4",
              marginBottom: "12px",
            }}
          >
            Enter the full card number and CVV printed on the envelope we mailed you. This verifies possession before
            the card status moves to active.
          </p>
          <div className="grid gap-3">
            <input
              value={activationForm.card_number}
              onChange={(e) =>
                setActivationForm((prev) => ({ ...prev, card_number: e.target.value }))
              }
              placeholder="Card Number"
              className="rounded-[14px] px-4 py-3 bg-[#3d3a4a] text-[#f2f0ff] outline-none"
            />
            <input
              value={activationForm.cvv}
              onChange={(e) => setActivationForm((prev) => ({ ...prev, cvv: e.target.value }))}
              placeholder="CVV"
              type="password"
              className="rounded-[14px] px-4 py-3 bg-[#3d3a4a] text-[#f2f0ff] outline-none"
            />
            <button
              onClick={handleActivate}
              className="rounded-[14px] py-3 uppercase tracking-widest"
              style={{
                background: "linear-gradient(135deg, #6750a4, #9c82d4)",
                color: "#f2f0ff",
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 700,
                fontSize: "12px",
              }}
            >
              Activate
            </button>
            {activationMessage && (
              <p
                style={{
                  color: "#b8b4d4",
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 500,
                  fontSize: "12px",
                }}
              >
                {activationMessage}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="border-none max-w-md" style={{ background: "#232228", color: "#f2f0ff" }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Montserrat', sans-serif" }}>Request replacement card</DialogTitle>
          </DialogHeader>
          <p
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 500,
              fontSize: "12px",
              color: "#b8b4d4",
              marginBottom: "12px",
            }}
          >
            Available only if your card is lost or expired. PKR 2,000 is debited immediately and an admin fulfilment task
            is created for delivery to the address below.
          </p>
          <div className="grid gap-3">
            <select
              value={requestForm.reason}
              onChange={(e) => setRequestForm((prev) => ({ ...prev, reason: e.target.value }))}
              className="rounded-[14px] px-4 py-3 bg-[#3d3a4a] text-[#f2f0ff] outline-none"
            >
              <option value="LOST">Lost Card</option>
              <option value="EXPIRED">Expired Card</option>
            </select>
            <textarea
              value={requestForm.delivery_address}
              onChange={(e) =>
                setRequestForm((prev) => ({ ...prev, delivery_address: e.target.value }))
              }
              placeholder="Delivery Address"
              className="rounded-[14px] px-4 py-3 bg-[#3d3a4a] text-[#f2f0ff] outline-none min-h-[100px]"
            />
            <button
              onClick={handleRequestCard}
              className="rounded-[14px] py-3 uppercase tracking-widest"
              style={{
                background: "linear-gradient(135deg, #6750a4, #9c82d4)",
                color: "#f2f0ff",
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 700,
                fontSize: "12px",
              }}
            >
              Submit Request
            </button>
            {requestMessage && (
              <p
                style={{
                  color: "#b8b4d4",
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 500,
                  fontSize: "12px",
                }}
              >
                {requestMessage}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={pinOpen} onOpenChange={setPinOpen}>
        <DialogContent className="border-none" style={{ background: "#232228", color: "#f2f0ff" }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Montserrat', sans-serif" }}>Change Card PIN</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <input
              value={pinForm.card_last4}
              onChange={(e) => setPinForm((prev) => ({ ...prev, card_last4: e.target.value }))}
              placeholder="Card Last 4 Digits"
              className="rounded-[14px] px-4 py-3 bg-[#3d3a4a] text-[#f2f0ff] outline-none"
            />
            <input
              value={pinForm.old_pin}
              onChange={(e) => setPinForm((prev) => ({ ...prev, old_pin: e.target.value }))}
              placeholder="Current PIN"
              type="password"
              className="rounded-[14px] px-4 py-3 bg-[#3d3a4a] text-[#f2f0ff] outline-none"
            />
            <input
              value={pinForm.new_pin}
              onChange={(e) => setPinForm((prev) => ({ ...prev, new_pin: e.target.value }))}
              placeholder="New PIN"
              type="password"
              className="rounded-[14px] px-4 py-3 bg-[#3d3a4a] text-[#f2f0ff] outline-none"
            />
            <button
              onClick={handlePinChange}
              className="rounded-[14px] py-3 uppercase tracking-widest"
              style={{
                background: "linear-gradient(135deg, #6750a4, #9c82d4)",
                color: "#f2f0ff",
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 700,
                fontSize: "12px",
              }}
            >
              Update PIN
            </button>
            {pinMessage && (
              <p
                style={{
                  color: "#b8b4d4",
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 500,
                  fontSize: "12px",
                }}
              >
                {pinMessage}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={virtualCreditOpen} onOpenChange={setVirtualCreditOpen}>
        <DialogContent className="border-none max-w-md" style={{ background: "#232228", color: "#f2f0ff" }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Montserrat', sans-serif" }}>Apply for Card Type</DialogTitle>
          </DialogHeader>
          <p
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 500,
              fontSize: "12px",
              color: "#b8b4d4",
              marginBottom: "16px",
            }}
          >
            Select a card type to apply. These options will be fully functional in upcoming updates.
          </p>
          <div className="grid gap-3">
            <button
              type="button"
              onClick={() => {
                setSelectedCardType("VIRTUAL");
              }}
              className="text-left rounded-[14px] px-4 py-4 ring-1 transition-all"
              style={{
                background: selectedCardType === "VIRTUAL" ? "#6750a4" : "#3d3a4a",
                color: "#f2f0ff",
                borderColor: selectedCardType === "VIRTUAL" ? "#9c82d4" : "rgba(255,255,255,0.1)",
              }}
            >
              <div
                style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 700,
                  fontSize: "13px",
                }}
              >
                Virtual Card
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
                Digital card for online purchases & subscriptions
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedCardType("CREDIT");
              }}
              className="text-left rounded-[14px] px-4 py-4 ring-1 transition-all"
              style={{
                background: selectedCardType === "CREDIT" ? "#6750a4" : "#3d3a4a",
                color: "#f2f0ff",
                borderColor: selectedCardType === "CREDIT" ? "#9c82d4" : "rgba(255,255,255,0.1)",
              }}
            >
              <div
                style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 700,
                  fontSize: "13px",
                }}
              >
                Credit Card
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
                Build credit history with flexible spending
              </div>
            </button>
          </div>
          <motion.div
            className="rounded-[14px] px-4 py-3 text-center ring-1 ring-amber-400/30"
            style={{ background: "rgba(217,119,6,0.15)", color: "#fbbf24" }}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span
              style={{
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 700,
                fontSize: "12px",
              }}
            >
              Coming Soon
            </span>
            <p
              style={{
                fontFamily: "'Montserrat', sans-serif",
                fontSize: "11px",
                marginTop: "6px",
                opacity: 0.9,
              }}
            >
              Full application process will be available in the next release.
            </p>
          </motion.div>
          <button
            type="button"
            onClick={() => {
              setVirtualCreditOpen(false);
              setSelectedCardType(null);
            }}
            className="rounded-[14px] py-3 uppercase tracking-widest"
            style={{
              background: "#3d3a4a",
              color: "#f2f0ff",
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 700,
              fontSize: "12px",
            }}
          >
            Close
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
