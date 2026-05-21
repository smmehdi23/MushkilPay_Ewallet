import { useEffect, useState } from "react";
import { downloadStatementPdf, getProfile, getTransactions } from "../lib/api";

const DownloadIcon = () => (
  <svg width="28" height="28" viewBox="0 0 73.75 73.75" fill="none">
    <path
      d="M71.75 48.5V64C71.75 66.0554 70.9335 68.0267 69.4801 69.4801C68.0267 70.9335 66.0554 71.75 64 71.75H9.75C7.69457 71.75 5.72333 70.9335 4.26992 69.4801C2.81652 68.0267 2 66.0554 2 64V48.5M17.5 29.125L36.875 48.5M36.875 48.5L56.25 29.125M36.875 48.5V2"
      stroke="#F2F0FF"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="4"
    />
  </svg>
);

type TransactionStatus = "Completed" | "Processing" | "Failed";

interface Transaction {
  id: string | number;
  date: string;
  rawDate?: string;
  type: string;
  reference: string;
  recipient: string;
  amount: number;
  direction: "credit" | "debit";
  status: TransactionStatus;
}

const statusColors: Record<TransactionStatus, { bg: string; text: string; dot: string }> = {
  Completed: { bg: "rgba(34,197,94,0.15)", text: "#22c55e", dot: "#22c55e" },
  Processing: { bg: "rgba(124,104,201,0.2)", text: "#b8b4d4", dot: "#7c68c9" },
  Failed: { bg: "rgba(239,68,68,0.15)", text: "#ef4444", dot: "#ef4444" },
};

export function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [closingBalance, setClosingBalance] = useState<number | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const loadTransactions = async () => {
      try {
        const [response, profileResponse] = await Promise.all([getTransactions(), getProfile()]);
        if (response.status === "Error") {
          setErrorMessage(response.message || "Failed to load transactions");
          setTransactions([]);
          return;
        }
        setErrorMessage("");
        const data = Array.isArray(response.data) ? response.data : [];
        const rawBalance = profileResponse?.data?.balance;
        if (typeof rawBalance === "number" && Number.isFinite(rawBalance)) {
          setClosingBalance(rawBalance);
        } else if (typeof rawBalance === "string" && !Number.isNaN(Number(rawBalance))) {
          setClosingBalance(Number(rawBalance));
        } else {
          setClosingBalance(null);
        }
        setTransactions(
          data.map((item) => ({
            id: item.id as string,
            rawDate: item.date ? String(item.date) : "",
            date: item.date ? new Date(String(item.date)).toLocaleString() : "-",
            type: String(item.type || "Transaction"),
            reference: String(item.reference || "-"),
            recipient: String(item.recipient || "-"),
            amount: Number(item.amount || 0),
            direction: (item.direction as "credit" | "debit") || "debit",
            status: (() => {
              const raw = String(item.status || "Completed").toUpperCase();
              if (raw === "FAILED") return "Failed";
              if (raw === "PROCESSING") return "Processing";
              if (raw === "COMPLETED" || raw === "PROCESSED" || raw === "SUCCESS") return "Completed";
              const normalized = raw.charAt(0) + raw.slice(1).toLowerCase();
              if (normalized === "Completed" || normalized === "Processing" || normalized === "Failed") {
                return normalized;
              }
              return "Completed";
            })(),
          })),
        );
      } catch (error) {
        console.error(error);
        setErrorMessage(error instanceof Error ? error.message : "Connection error");
        setTransactions([]);
      }
    };
    loadTransactions();
  }, []);
  const handlePdf = async () => {
    setPdfLoading(true);
    try {
      const blob = await downloadStatementPdf();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "MushkilPay_statement.pdf";
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleDownload = () => {
    if (!transactions.length) {
      setErrorMessage("No transactions to export.");
      return;
    }
    const fmtMoney = (value: number) => `PKR ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const balanceAvailable = closingBalance !== null && Number.isFinite(closingBalance);
    const sorted = [...transactions].sort((a, b) => {
      const aDate = a.rawDate ? Date.parse(a.rawDate) : NaN;
      const bDate = b.rawDate ? Date.parse(b.rawDate) : NaN;
      if (!Number.isFinite(aDate) || !Number.isFinite(bDate)) return 0;
      return bDate - aDate;
    });

    let runningBalance = balanceAvailable ? (closingBalance as number) : 0;
    const rows = sorted.map((t) => {
      const debit = t.direction === "debit" ? t.amount : 0;
      const credit = t.direction === "credit" ? t.amount : 0;
      const balanceCell = balanceAvailable ? fmtMoney(runningBalance) : "";
      if (credit) runningBalance -= credit;
      if (debit) runningBalance += debit;

      const description = t.reference && t.reference !== "-"
        ? `${t.type} - ${t.reference}`
        : t.type;

      return [
        t.date,
        t.type,
        description,
        debit ? fmtMoney(debit) : "",
        credit ? fmtMoney(credit) : "",
        balanceCell,
      ];
    });

    const header = ["Date", "Type", "Description", "Debit", "Credit", "Balance"];
    const escapeCell = (value: string) => {
      const safe = String(value ?? "")
        .replace(/\r?\n/g, " ")
        .replace(/"/g, '""');
      return `"${safe}"`;
    };

    const delimiter = ",";
    const csvRows = [
      `sep=${delimiter}`,
      header.map(escapeCell).join(delimiter),
      ...rows.map((row) => row.map(escapeCell).join(delimiter)),
    ];
    const csvContent = `\ufeff${csvRows.join("\n")}`;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const encodedUri = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "MushkilPay_statement.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(encodedUri);
  };

  return (
    <div
      className="w-full"
      style={{ fontFamily: "'Montserrat', sans-serif" }}
    >
      {/* Page heading + download */}
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h1
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 700,
            fontSize: "clamp(22px, 4vw, 44px)",
            color: "#f2f0ff",
          }}
        >
          Transactions
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePdf}
            disabled={pdfLoading}
            className="rounded-xl px-4 py-2 text-xs uppercase tracking-widest hover:opacity-90 disabled:opacity-50 transition-opacity"
            style={{
              background: "#3d3a4a",
              color: "#f2f0ff",
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 700,
            }}
            title="Download PDF from server"
          >
            {pdfLoading ? "PDF…" : "PDF"}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="p-3 rounded-xl hover:opacity-80 transition-opacity active:scale-95"
            style={{ color: "#f2f0ff" }}
            title="Download CSV"
          >
            <DownloadIcon />
          </button>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div 
          className="mb-6 p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 text-sm"
          style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 500 }}
        >
          {errorMessage}
        </div>
      )}

      {/* Transactions Table */}
      <div
        className="rounded-[24px] overflow-hidden"
        style={{ background: "#232228" }}
      >
        {/* Table header */}
        <div
          className="grid grid-cols-[40px_1fr_1.5fr_1fr_1fr_1fr_1fr] gap-2 px-6 py-4 border-b"
          style={{ borderColor: "rgba(255,255,255,0.08)" }}
        >
          {["#", "Date", "Transaction Type", "Recipient / Payee", "Reference", "Amount", "Status"].map((col) => (
            <span
              key={col}
              style={{
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 600,
                fontSize: "12px",
                color: "#b8b4d4",
                letterSpacing: "0.05em",
              }}
            >
              {col}
            </span>
          ))}
        </div>

        {/* Empty state */}
        {transactions.length === 0 && (
          <div
            className="flex flex-col items-center justify-center py-16"
            style={{ color: "#6b6880" }}
          >
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-4 opacity-50">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <path d="M2 10h20" />
            </svg>
            <p style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: "14px" }}>
              No transactions yet
            </p>
            <p style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 500, fontSize: "12px", marginTop: "4px" }}>
              Your transaction history will appear here
            </p>
          </div>
        )}

        {/* Table rows */}
        {transactions.map((txn, idx) => {
          const sc = statusColors[txn.status];
          const isPositive = txn.direction === "credit";
          return (
            <div
              key={txn.id}
              className="grid grid-cols-[40px_1fr_1.5fr_1fr_1fr_1fr_1fr] gap-2 px-6 py-4 items-center border-b hover:bg-white/5 transition-colors"
              style={{
                borderColor: "rgba(255,255,255,0.05)",
                borderBottom: idx === transactions.length - 1 ? "none" : undefined,
              }}
            >
              {/* # with dot */}
              <div className="flex items-center gap-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: isPositive ? "#22c55e" : "#7c68c9" }}
                />
              </div>

              {/* Date */}
              <div>
                <div
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 500,
                    fontSize: "12px",
                    color: "#b8b4d4",
                  }}
                >
                  {txn.date}
                </div>
              </div>

              {/* Type + Ref */}
              <div>
                <div
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 700,
                    fontSize: "13px",
                    color: "#f2f0ff",
                  }}
                >
                  {txn.type}
                </div>
                <div
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 500,
                    fontSize: "10px",
                    color: "#6b6880",
                  }}
                >
                  {String(txn.id)}
                </div>
              </div>

              {/* Recipient */}
              <div
                style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 500,
                  fontSize: "12px",
                  color: "#b8b4d4",
                }}
              >
                {txn.recipient}
              </div>

              {/* Reference */}
              <div
                style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 500,
                  fontSize: "12px",
                  color: "#6b6880",
                }}
              >
                {txn.reference}
              </div>

              {/* Amount */}
              <div
                style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 700,
                  fontSize: "13px",
                  color: isPositive ? "#22c55e" : "#f87171",
                }}
              >
                {`${isPositive ? "+" : "-"}PKR ${Math.abs(txn.amount).toLocaleString()}`}
              </div>

              {/* Status badge */}
              <div>
                <span
                  className="px-3 py-1 rounded-full inline-flex items-center gap-1.5"
                  style={{
                    background: sc.bg,
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 600,
                    fontSize: "11px",
                    color: sc.text,
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: sc.dot }}
                  />
                  {txn.status}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
