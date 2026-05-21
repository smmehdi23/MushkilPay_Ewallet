import { useState } from "react";
import { motion } from "motion/react";
import { getAuthToken } from "../lib/auth";
import { API_BASE_URL } from "../lib/api";

interface Transaction {
  TRANSFER_ID: number;
  SENDER_WALLET_ID: number;
  RECEIVER_WALLET_ID: number;
  AMOUNT: number;
  TRANSFER_DATE: string;
  STATUS: string;
  SENDER_NAME: string;
  RECEIVER_NAME: string;
}

interface CustomerInfo {
  wallet_id: number;
  user_id: number;
  full_name: string;
  account_number: string;
}

export function AdminTransactionsPage() {
  const [accountNumber, setAccountNumber] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSearch = async () => {
    if (!accountNumber.trim()) {
      setMessage("Please enter an account number");
      return;
    }

    try {
      setLoading(true);
      setMessage("");
      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE_URL}/admin/transactions?account_number=${encodeURIComponent(accountNumber)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await response.json();
      if (data.status === "Success") {
        setCustomerInfo(data.customer);
        setTransactions(data.transactions || []);
        setMessage(`Found ${data.total_transactions} transactions`);
      } else {
        setMessage(data.message || "Account not found");
        setCustomerInfo(null);
        setTransactions([]);
      }
    } catch (error) {
      setMessage("Failed to load transactions");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      COMPLETED: "#10b981",
      PENDING: "#f59e0b",
      FAILED: "#ef4444",
    };
    return colors[status] || "#6b7280";
  };

  const totalAmount = transactions.reduce((sum, t) => sum + (t.AMOUNT || 0), 0);
  const completedCount = transactions.filter((t) => t.STATUS === "COMPLETED").length;

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
          Transaction History
        </h1>
      </motion.div>

      {/* Search Box */}
      <motion.div
        className="rounded-[16px] p-4 sm:p-6"
        style={{ background: "#2a2733", border: "1px solid rgba(255,255,255,0.06)" }}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <label style={{ color: "#b8b4d4", fontSize: "12px", display: "block", marginBottom: "8px" }}>
          Enter Customer Account Number
        </label>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="e.g., 1001 or account number..."
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSearch()}
            className="flex-1 rounded-[12px] px-4 py-3 bg-[#3d3a4a] text-[#f2f0ff] outline-none"
            style={{ border: "1px solid rgba(255,255,255,0.1)" }}
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="rounded-[12px] px-6 py-3 uppercase tracking-widest hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, #6750a4, #9c82d4)",
              color: "#f2f0ff",
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 700,
              fontSize: "12px",
            }}
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </div>
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

      {customerInfo && (
        <>
          {/* Customer Info */}
          <motion.div
            className="rounded-[16px] p-4 sm:p-6"
            style={{ background: "#2a2733", border: "1px solid rgba(255,255,255,0.06)" }}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div style={{ color: "#b8b4d4", fontSize: "12px", marginBottom: "4px" }}>Customer Information</div>
            <div style={{ color: "#f2f0ff", fontWeight: 700, fontSize: "18px", marginBottom: "8px" }}>
              {customerInfo.full_name}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <div style={{ color: "#9d99b8", fontSize: "11px" }}>Wallet ID</div>
                <div style={{ color: "#f2f0ff", fontWeight: 600, fontSize: "14px" }}>
                  {customerInfo.wallet_id}
                </div>
              </div>
              <div>
                <div style={{ color: "#9d99b8", fontSize: "11px" }}>Account Number</div>
                <div style={{ color: "#f2f0ff", fontWeight: 600, fontSize: "14px" }}>
                  {customerInfo.account_number}
                </div>
              </div>
              <div>
                <div style={{ color: "#9d99b8", fontSize: "11px" }}>User ID</div>
                <div style={{ color: "#f2f0ff", fontWeight: 600, fontSize: "14px" }}>
                  {customerInfo.user_id}
                </div>
              </div>
              <div>
                <div style={{ color: "#9d99b8", fontSize: "11px" }}>Total Transactions</div>
                <div style={{ color: "#f2f0ff", fontWeight: 600, fontSize: "14px" }}>
                  {transactions.length}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Statistics */}
          {transactions.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <motion.div
                className="rounded-[16px] p-4"
                style={{ background: "#2a2733", border: "1px solid rgba(255,255,255,0.06)" }}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <div style={{ color: "#b8b4d4", fontSize: "12px", marginBottom: "4px" }}>Total Amount</div>
                <div style={{ color: "#f2f0ff", fontWeight: 700, fontSize: "20px" }}>
                  PKR {totalAmount.toLocaleString()}
                </div>
              </motion.div>

              <motion.div
                className="rounded-[16px] p-4"
                style={{ background: "#2a2733", border: "1px solid rgba(255,255,255,0.06)" }}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
              >
                <div style={{ color: "#b8b4d4", fontSize: "12px", marginBottom: "4px" }}>Completed</div>
                <div style={{ color: "#10b981", fontWeight: 700, fontSize: "20px" }}>{completedCount}</div>
              </motion.div>
            </div>
          )}

          {/* Transactions List */}
          <div>
            <h2 style={{ color: "#f2f0ff", fontWeight: 700, fontSize: "16px", marginBottom: "12px" }}>
              Transactions
            </h2>
            {transactions.length === 0 ? (
              <div style={{ color: "#b8b4d4", textAlign: "center", padding: "30px" }}>
                No transactions found for this account
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.map((txn) => (
                  <motion.div
                    key={txn.TRANSFER_ID}
                    className="rounded-[16px] p-4"
                    style={{ background: "#2a2733", border: "1px solid rgba(255,255,255,0.06)" }}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex-1 space-y-2">
                        <div style={{ color: "#f2f0ff", fontWeight: 600, fontSize: "14px" }}>
                          {txn.SENDER_NAME} → {txn.RECEIVER_NAME}
                        </div>
                        <div style={{ color: "#9d99b8", fontSize: "12px" }}>
                          Transfer ID: {txn.TRANSFER_ID} | Date:{" "}
                          {new Date(txn.TRANSFER_DATE).toLocaleString()}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div style={{ color: "#f2f0ff", fontWeight: 700, fontSize: "16px", minWidth: "100px", textAlign: "right" }}>
                          PKR {(txn.AMOUNT || 0).toLocaleString()}
                        </div>
                        <div
                          style={{
                            background: getStatusColor(txn.STATUS),
                            color: "#fff",
                            padding: "6px 12px",
                            borderRadius: "8px",
                            fontSize: "12px",
                            fontWeight: 600,
                            minWidth: "90px",
                            textAlign: "center",
                          }}
                        >
                          {txn.STATUS}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
