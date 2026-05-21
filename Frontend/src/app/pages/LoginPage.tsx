import { useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { BrandMark } from "../components/BrandMark";
import { UI } from "../lib/uiAssets";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { loginAdmin, loginUser, signupUser } from "../lib/api";
import { saveAuth } from "../lib/auth";

export function LoginPage() {
  const [activeTab, setActiveTab] = useState<"user" | "admin">("user");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);
  const [signupData, setSignupData] = useState({
    full_name: "",
    email: "",
    password: "",
    phone: "",
    cnic: "",
    pin: "",
  });
  const [signupMessage, setSignupMessage] = useState("");
  const navigate = useNavigate();

  const handleLogin = async () => {
    setError("");
    if (!username || !password) {
      setError("Please enter both email and password");
      return;
    }
    setLoading(true);
    try {
      if (activeTab === "user") {
        const response = await loginUser(username, password);
        if (response.status !== "Success" || !response.token) {
          setError(response.message || "Login failed. Please try again.");
          setLoading(false);
          return;
        }
        saveAuth(response.token, "user", response.user_id);
      } else {
        const response = await loginAdmin(username, password);
        if (response.status !== "Success" || !response.token) {
          setError(response.message || "Login failed. Please try again.");
          setLoading(false);
          return;
        }
        saveAuth(response.token, "admin");
      }
      navigate("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Please try again.");
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    setSignupMessage("");
    if (!signupData.full_name || !signupData.email || !signupData.password || !signupData.phone || !signupData.cnic || !signupData.pin) {
      setSignupMessage("All fields are required.");
      return;
    }
    try {
      const response = await signupUser(signupData);
      if (response.status !== "Success") {
        setSignupMessage(response.message || "Signup failed.");
        return;
      }
      setSignupMessage("Account created successfully! Please log in.");
      setSignupData({ full_name: "", email: "", password: "", phone: "", cnic: "", pin: "" });
      setTimeout(() => {
        setSignupOpen(false);
      }, 2000);
    } catch (err) {
      setSignupMessage(err instanceof Error ? err.message : "Signup failed.");
    }
  };

  return (
    <div
      className="mp-bg relative flex min-h-screen w-full flex-col items-center justify-center px-4 py-10 sm:py-14"
      style={{ fontFamily: "'Montserrat', sans-serif" }}
    >
      <motion.div
        className="mb-6 w-full px-1 text-center sm:mb-8"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.08 }}
      >
        <h1
          className="text-[#f2f0ff] uppercase tracking-wide flex flex-row items-center justify-center gap-0 whitespace-nowrap"
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 800,
            fontSize: "clamp(18px, 4vw, 42px)",
            lineHeight: 1,
          }}
        >
          WELCOME TO
          <img
            src={UI.logo}
            alt="MushkilPay"
            className="h-12 sm:h-22 w-auto object-contain mt-1.5 sm:mt-4"
          />
        </h1>
      </motion.div>

      <motion.div
        className="relative w-full max-w-[28rem] rounded-[2.5rem] border border-[var(--mp-accent-line)] p-6 shadow-2xl sm:p-8"
        style={{
          background: "var(--mp-surface)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
        }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.12 }}
      >
        {/* Tab Switcher */}
        <div
          className="mb-6 flex overflow-hidden rounded-2xl sm:mb-8"
          style={{ background: "#322f3d" }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("user")}
            className="flex-1 py-3.5 uppercase tracking-widest transition-all duration-200 sm:py-4"
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 700,
              fontSize: "clamp(15px, 3.5vw, 18px)",
              background: activeTab === "user" ? "#3d3a4a" : "transparent",
              color: activeTab === "user" ? "#f2f0ff" : "#b8b4d4",
              borderRadius: activeTab === "user" ? "16px" : "0",
            }}
          >
            USER
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("admin")}
            className="flex-1 py-3.5 uppercase tracking-widest transition-all duration-200 sm:py-4"
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 700,
              fontSize: "clamp(15px, 3.5vw, 18px)",
              background: activeTab === "admin" ? "#3d3a4a" : "transparent",
              color: activeTab === "admin" ? "#f2f0ff" : "#b8b4d4",
              borderRadius: activeTab === "admin" ? "16px" : "0",
            }}
          >
            ADMIN
          </button>
        </div>

        <div className="mb-4">
          <input
            type="text"
            placeholder={activeTab === "user" ? "EMAIL" : "USERNAME"}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mp-input w-full"
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 700,
              fontSize: "15px",
              letterSpacing: "0.08em",
            }}
          />
        </div>

        <div className="mb-6 sm:mb-8">
          <div className="mp-input flex min-h-[3.25rem] items-center pr-3">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="PASSWORD"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="min-h-0 flex-1 border-0 bg-transparent py-3 pl-0 pr-2 text-[#f2f0ff] outline-none placeholder:text-[#b8b4d4]"
              style={{
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 700,
                fontSize: "15px",
                letterSpacing: "0.08em",
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="shrink-0 text-[#b8b4d4] transition-colors hover:text-[#f2f0ff]"
            >
              {showPassword ? (
                <svg width="22" height="16" viewBox="0 0 48 36" fill="none">
                  <path
                    d="M2 18C2 18 10 2 24 2C38 2 46 18 46 18C46 18 38 34 24 34C10 34 2 18 2 18Z"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="4"
                  />
                  <path
                    d="M24 24C27.3137 24 30 21.3137 30 18C30 14.6863 27.3137 12 24 12C20.6863 12 18 14.6863 18 18C18 21.3137 20.6863 24 24 24Z"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="4"
                  />
                </svg>
              ) : (
                <svg width="22" height="16" viewBox="0 0 48 36" fill="none">
                  <path
                    d="M2 18C2 18 10 2 24 2C38 2 46 18 46 18C46 18 38 34 24 34C10 34 2 18 2 18Z"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="4"
                    strokeDasharray="8 4"
                  />
                  <path
                    d="M24 24C27.3137 24 30 21.3137 30 18C30 14.6863 27.3137 12 24 12C20.6863 12 18 14.6863 18 18C18 21.3137 20.6863 24 24 24Z"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="4"
                  />
                  <line x1="4" y1="4" x2="44" y2="32" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogin}
          className="w-full rounded-[1.125rem] py-3.5 uppercase tracking-widest transition-all duration-200 hover:opacity-90 active:scale-[0.98] sm:py-4"
          style={{
            background: "linear-gradient(135deg, #6750a4, #9c82d4)",
            color: "#f2f0ff",
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 700,
            fontSize: "16px",
            letterSpacing: "0.15em",
            opacity: loading ? 0.8 : 1,
          }}
          disabled={loading}
        >
          {loading ? "PLEASE WAIT" : "LOGIN"}
        </button>

        {error && (
          <p
            className="text-center mt-3"
            style={{
              color: "#f87171",
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 500,
              fontSize: "12px",
            }}
          >
            {error}
          </p>
        )}

        {/* Forgot Password */}
        <div className="text-center mt-4 flex flex-col gap-2">
          <p
            className="cursor-pointer hover:text-[#f2f0ff] transition-colors"
            style={{
              color: "#b8b4d4",
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 500,
              fontSize: "13px",
            }}
          >
            Forgot Password?
          </p>
          {activeTab === "user" && (
            <button
              type="button"
              onClick={() => setSignupOpen(true)}
              className="uppercase tracking-widest underline-offset-4 hover:underline transition-all"
              style={{
                color: "#e8e4ff",
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 700,
                fontSize: "13px",
                letterSpacing: "0.14em",
              }}
            >
              Create account
            </button>
          )}
        </div>
      </motion.div>

      <Dialog open={signupOpen} onOpenChange={setSignupOpen}>
        <DialogContent className="border-none" style={{ background: "#232228", color: "#f2f0ff" }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Montserrat', sans-serif" }}>Create Account</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <input
              value={signupData.full_name}
              onChange={(e) => setSignupData((prev) => ({ ...prev, full_name: e.target.value }))}
              placeholder="Full Name"
              className="rounded-[14px] px-4 py-3 bg-[#3d3a4a] text-[#f2f0ff] outline-none"
            />
            <input
              value={signupData.email}
              onChange={(e) => setSignupData((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="Email"
              type="email"
              className="rounded-[14px] px-4 py-3 bg-[#3d3a4a] text-[#f2f0ff] outline-none"
            />
            <input
              value={signupData.phone}
              onChange={(e) => setSignupData((prev) => ({ ...prev, phone: e.target.value }))}
              placeholder="Phone Number"
              className="rounded-[14px] px-4 py-3 bg-[#3d3a4a] text-[#f2f0ff] outline-none"
            />
            <input
              value={signupData.cnic}
              onChange={(e) => setSignupData((prev) => ({ ...prev, cnic: e.target.value }))}
              placeholder="CNIC (e.g., 12345-6789012-1)"
              className="rounded-[14px] px-4 py-3 bg-[#3d3a4a] text-[#f2f0ff] outline-none"
            />
            <input
              value={signupData.password}
              onChange={(e) => setSignupData((prev) => ({ ...prev, password: e.target.value }))}
              placeholder="Password"
              type="password"
              className="rounded-[14px] px-4 py-3 bg-[#3d3a4a] text-[#f2f0ff] outline-none"
            />
            <input
              value={signupData.pin}
              onChange={(e) => setSignupData((prev) => ({ ...prev, pin: e.target.value }))}
              placeholder="Wallet PIN (4 digits)"
              type="password"
              className="rounded-[14px] px-4 py-3 bg-[#3d3a4a] text-[#f2f0ff] outline-none"
            />
            <button
              onClick={handleSignup}
              className="rounded-[14px] py-3 uppercase tracking-widest"
              style={{
                background: "linear-gradient(135deg, #6750a4, #9c82d4)",
                color: "#f2f0ff",
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 700,
                fontSize: "12px",
              }}
            >
              Create Account
            </button>
            {signupMessage && (
              <p
                style={{
                  color: signupMessage.includes("successfully") ? "#10b981" : "#f87171",
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 500,
                  fontSize: "12px",
                }}
              >
                {signupMessage}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
