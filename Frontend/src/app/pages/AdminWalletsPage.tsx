import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { getAuthToken } from "../lib/auth";
import { API_BASE_URL } from "../lib/api";

interface Wallet {
  WALLET_ID: number;
  USER_ID: number;
  FULL_NAME: string;
  EMAIL: string;
  PHONE: string;
  ACCOUNT_NUMBER: string;
  BALANCE: number;
  WALLET_STATUS: string;
  CREATED_AT: string;
  LAST_ACTIVITY: string;
}

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

export function AdminWalletsPage() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("created");
  const [message, setMessage] = useState("");
  
  // Transaction search state
  const [accountNumber, setAccountNumber] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [transactionMessage, setTransactionMessage] = useState("");

  useEffect(() => {
    fetchWallets();
  }, []);

  const fetchWallets = async () => {
    try {
      setLoading(true);
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/admin/wallets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.status === "Success") {
        setWallets(data.data || []);
        setMessage(`Loaded ${data.total_wallets} wallets`);
      }
    } catch (error) {
      setMessage("Failed to load wallets");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchTransactions = async () => {
    if (!accountNumber.trim()) {
      setTransactionMessage("Please enter an account number");
      return;
    }

    try {
      setLoadingTransactions(true);
      setTransactionMessage("");
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
        setTransactionMessage(`Found ${data.total_transactions} transactions`);
      } else {
        setTransactionMessage(data.message || "Account not found");
        setCustomerInfo(null);
        setTransactions([]);
      }
    } catch (error) {
      setTransactionMessage("Failed to load transactions");
      console.error(error);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const filteredWallets = wallets
    .filter((w) =>
      w.FULL_NAME.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(w.ACCOUNT_NUMBER || "").includes(searchTerm) ||
      w.EMAIL.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === "balance") return (b.BALANCE || 0) - (a.BALANCE || 0);
      if (sortBy === "name") return a.FULL_NAME.localeCompare(b.FULL_NAME);
      return new Date(b.CREATED_AT).getTime() - new Date(a.CREATED_AT).getTime();
    });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      ACTIVE: "#10b981",
      SUSPENDED: "#ef4444",
      BLOCKED: "#8b5cf6",
      COMPLETED: "#10b981",
      PENDING: "#f59e0b",
      FAILED: "#ef4444",
    };
    return colors[status] || "#6b7280";
  };

  const totalBalance = wallets.reduce((sum, w) => sum + (w.BALANCE || 0), 0);

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
          All Wallets
        </h1>
      </motion.div>

      {/* Statistics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <motion.div
          className="rounded-[16px] p-4"
          style={{ background: "#2a2733", border: "1px solid rgba(255,255,255,0.06)" }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div style={{ color: "#b8b4d4", fontSize: "12px", marginBottom: "4px" }}>Total Wallets</div>
          <div style={{ color: "#f2f0ff", fontWeight: 700, fontSize: "24px" }}>{wallets.length}</div>
        </motion.div>

        <motion.div
          className="rounded-[16px] p-4"
          style={{ background: "#2a2733", border: "1px solid rgba(255,255,255,0.06)" }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <div style={{ color: "#b8b4d4", fontSize: "12px", marginBottom: "4px" }}>System Balance</div>
          <div style={{ color: "#f2f0ff", fontWeight: 700, fontSize: "18px" }}>
            PKR {(totalBalance || 0).toLocaleString()}
          </div>
        </motion.div>

        <motion.div
          className="rounded-[16px] p-4"
          style={{ background: "#2a2733", border: "1px solid rgba(255,255,255,0.06)" }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div style={{ color: "#b8b4d4", fontSize: "12px", marginBottom: "4px" }}>Active Wallets</div>
          <div style={{ color: "#10b981", fontWeight: 700, fontSize: "24px" }}>
            {wallets.filter((w) => w.WALLET_STATUS === "ACTIVE").length}
          </div>
        </motion.div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search by name, account, or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 rounded-[12px] px-4 py-3 bg-[#3d3a4a] text-[#f2f0ff] outline-none"
          style={{ border: "1px solid rgba(255,255,255,0.1)" }}
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="rounded-[12px] px-4 py-3 bg-[#3d3a4a] text-[#f2f0ff] outline-none min-w-[140px]"
          style={{ border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <option value="created">Sort: Recent</option>
          <option value="name">Sort: Name</option>
          <option value="balance">Sort: Balance</option>
        </select>
      </div>

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
          Loading wallets...
        </div>
      ) : filteredWallets.length === 0 ? (
        <div style={{ color: "#b8b4d4", textAlign: "center", padding: "40px" }}>
          No wallets found
        </div>
      ) : (
        <div className="space-y-3">
          {filteredWallets.map((wallet) => (
            <motion.div
              key={wallet.WALLET_ID}
              className="rounded-[16px] p-4 sm:p-6"
              style={{ background: "#2a2733", border: "1px solid rgba(255,255,255,0.06)" }}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div style={{ color: "#f2f0ff", fontWeight: 700, fontSize: "16px" }}>
                    {wallet.FULL_NAME}
                  </div>
                  <div style={{ color: "#b8b4d4", fontSize: "13px" }}>
                    Account: {wallet.ACCOUNT_NUMBER} | ID: {wallet.WALLET_ID}
                  </div>
                  <div style={{ color: "#9d99b8", fontSize: "12px" }}>
                    Email: {wallet.EMAIL} | Phone: {wallet.PHONE}
                  </div>
                  <div style={{ color: "#9d99b8", fontSize: "12px" }}>
                    Created: {new Date(wallet.CREATED_AT).toLocaleDateString()} |
                    Last Activity:{" "}
                    {wallet.LAST_ACTIVITY ? new Date(wallet.LAST_ACTIVITY).toLocaleDateString() : "N/A"}
                  </div>
                </div>

                <div className="flex flex-col items-start sm:items-end gap-2">
                  <div style={{ color: "#f2f0ff", fontWeight: 700, fontSize: "20px" }}>
                    PKR {(wallet.BALANCE || 0).toLocaleString()}
                  </div>
                  <div
                    style={{
                      background: getStatusColor(wallet.WALLET_STATUS),
                      color: "#fff",
                      padding: "6px 12px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: 600,
                      minWidth: "100px",
                      textAlign: "center",
                    }}
                  >
                    {wallet.WALLET_STATUS}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Transaction History Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.3 }}
      >
        <h2
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 700,
            fontSize: "clamp(16px, 2.5vw, 28px)",
            color: "#f2f0ff",
            marginTop: "40px",
          }}
        >
          Transaction History
        </h2>
      </motion.div>

      {/* Search Box for Transactions */}
      <motion.div
        className="rounded-[16px] p-4 sm:p-6"
        style={{ background: "#2a2733", border: "1px solid rgba(255,255,255,0.06)" }}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Enter account number..."
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSearchTransactions()}
              className="flex-1 rounded-[12px] px-4 py-3 bg-[#3d3a4a] text-[#f2f0ff] outline-none"
              style={{ border: "1px solid rgba(255,255,255,0.1)" }}
            />
            <button
              onClick={handleSearchTransactions}
              disabled={loadingTransactions}
              className="rounded-[12px] px-6 py-3 font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, #9c82d4, #6750a4)",
                color: "#f2f0ff",
              }}
            >
              {loadingTransactions ? "Searching..." : "Search"}
            </button>
          </div>
        </div>
      </motion.div>

      {transactionMessage && (
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
          {transactionMessage}
        </div>
      )}

      {/* Customer Info and Transaction Stats */}
      {customerInfo && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <motion.div
            className="rounded-[16px] p-4 sm:p-6 space-y-2"
            style={{ background: "#2a2733", border: "1px solid rgba(255,255,255,0.06)" }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
          >
            <div style={{ color: "#b8b4d4", fontSize: "12px" }}>Customer</div>
            <div style={{ color: "#f2f0ff", fontWeight: 700, fontSize: "16px" }}>
              {customerInfo.full_name}
            </div>
            <div style={{ color: "#9d99b8", fontSize: "12px" }}>
              Account: {customerInfo.account_number}
            </div>
          </motion.div>

          <motion.div
            className="rounded-[16px] p-4 sm:p-6 space-y-2"
            style={{ background: "#2a2733", border: "1px solid rgba(255,255,255,0.06)" }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.45 }}
          >
            <div style={{ color: "#b8b4d4", fontSize: "12px" }}>Total Transactions</div>
            <div style={{ color: "#f2f0ff", fontWeight: 700, fontSize: "16px" }}>
              {transactions.length}
            </div>
            <div style={{ color: "#9d99b8", fontSize: "12px" }}>
              Completed: {transactions.filter((t) => t.STATUS === "COMPLETED").length}
            </div>
          </motion.div>
        </div>
      )}

      {/* Transactions List */}
      {transactions.length > 0 && (
        <div className="space-y-3">
          {transactions.map((transaction) => (
            <motion.div
              key={transaction.TRANSFER_ID}
              className="rounded-[16px] p-4 sm:p-6"
              style={{ background: "#2a2733", border: "1px solid rgba(255,255,255,0.06)" }}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div style={{ color: "#f2f0ff", fontWeight: 700, fontSize: "14px" }}>
                    {transaction.SENDER_NAME} → {transaction.RECEIVER_NAME}
                  </div>
                  <div style={{ color: "#b8b4d4", fontSize: "12px" }}>
                    Transaction ID: {transaction.TRANSFER_ID}
                  </div>
                  <div style={{ color: "#9d99b8", fontSize: "12px" }}>
                    {new Date(transaction.TRANSFER_DATE).toLocaleString()}
                  </div>
                </div>

                <div className="flex flex-col items-start sm:items-end gap-2">
                  <div style={{ color: "#f2f0ff", fontWeight: 700, fontSize: "18px" }}>
                    PKR {(transaction.AMOUNT || 0).toLocaleString()}
                  </div>
                  <div
                    style={{
                      background: getStatusColor(transaction.STATUS),
                      color: "#fff",
                      padding: "6px 12px",
                      borderRadius: "8px",
                      fontSize: "11px",
                      fontWeight: 600,
                      minWidth: "80px",
                      textAlign: "center",
                    }}
                  >
                    {transaction.STATUS}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
