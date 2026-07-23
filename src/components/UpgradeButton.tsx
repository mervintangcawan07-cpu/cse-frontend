"use client";

import { useState } from "react";

interface UpgradeButtonProps {
  userId: string;
  email: string;
}

export default function UpgradeButton({ userId, email }: UpgradeButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, email }),
      });

      const data = await response.json();

      if (data.checkoutUrl) {
        // Redirect user to PayMongo checkout (GCash, Maya, QR Ph, Card)
        window.location.href = data.checkoutUrl;
      } else {
        alert(data.error || "Failed to initiate payment.");
      }
    } catch (err) {
      console.error("Checkout Error:", err);
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleCheckout}
      disabled={loading}
      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? "Redirecting to Payment..." : "Upgrade to Premium (₱499)"}
    </button>
  );
}