import { UI } from "../lib/uiAssets";

interface PaymentCardProps {
  className?: string;
  style?: React.CSSProperties;
  cardNumber?: string;
  cardHolder?: string;
  expiry?: string;
  variant?: "default" | "management";
}

function maskCardNumber(cardNumber: string): string {
  const digits = (cardNumber || "").replace(/\D/g, "");
  if (digits.length >= 8) {
    return `${digits.slice(0, 4)} **** **** ${digits.slice(-4)}`;
  }
  if (cardNumber.includes("*")) {
    return cardNumber;
  }
  return "**** **** **** ****";
}

export function PaymentCard({
  className = "",
  style,
  cardNumber = "4821 **** **** 7364",
  cardHolder = "SYED MEHDI RAZA ZAIDI",
  expiry = "09 / 29",
  variant = "default",
}: PaymentCardProps) {
  const displayCardNumber = maskCardNumber(cardNumber);
  const isManagement = variant === "management";

  if (isManagement) {
    return (
      <div
        className={`relative overflow-hidden rounded-2xl ${className}`}
        style={{
          aspectRatio: "486/278",
          boxShadow: "0 20px 50px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)",
          ...style,
        }}
      >
        <img
          src={UI.cardBg}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent pointer-events-none"
          aria-hidden
        />

        {/* Card number: fixed below top brand area */}
        <div
          className="absolute left-[8%] right-[10%] top-[60%]"
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 700,
            fontSize: "clamp(20px, 2.3vw, 28px)",
            letterSpacing: "0.12em",
            color: "#ffffff",
            lineHeight: 1.15,
            textShadow: "0 2px 8px rgba(0,0,0,0.45)",
          }}
        >
          {displayCardNumber}
        </div>

        {/* Holder block */}
        <div className="absolute left-[8%] bottom-[12%]">
          <div
            className="uppercase"
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 700,
              fontSize: "clamp(20px, 2vw, 28px)",
              letterSpacing: "0.08em",
              color: "#ffffff",
              lineHeight: 1.1,
              textShadow: "0 2px 8px rgba(0,0,0,0.45)",
            }}
          >
            {cardHolder}
          </div>
        </div>

        {/* Expiry block */}
        <div className="absolute right-[16%] bottom-[12%] text-right">
          <div
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 700,
              fontSize: "clamp(20px, 2vw, 28px)",
              letterSpacing: "0.06em",
              color: "#ffffff",
              lineHeight: 1.1,
              textShadow: "0 2px 8px rgba(0,0,0,0.45)",
            }}
          >
            {expiry}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-2xl ${className}`}
      style={{
        aspectRatio: "486/278",
        boxShadow: "0 20px 50px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)",
        ...style,
      }}
    >
      <img
        src={UI.cardBg}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent pointer-events-none"
        aria-hidden
      />

      {/* Text overlay only - user name positioned extreme left and lower */}
      <div className="absolute left-[6%] bottom-[10%]">
        <div
          className="text-white uppercase"
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 700,
            fontSize: "clamp(13px, 2.8vw, 15px)",
            letterSpacing: "0.08em",
            lineHeight: "1.3",
            wordBreak: "break-word",
          }}
        >
          {cardHolder}
        </div>
      </div>
    </div>
  );
}
