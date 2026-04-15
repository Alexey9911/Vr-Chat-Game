"use client";
import { useState } from "react";

export default function ChangeAdressConsole({ text }) {
  const [mensaje, setMensaje] = useState("");

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(mensaje);
      alert("Contract address copied to clipboard");
    } catch (err) {
      // console.error("Failed to copy:", err);
      alert("Failed to copy contract address");
    }
  };

  return (
    <div className="text-xl  text-center mt-4 ">
      <div className="inline-flex items-center gap-[20px]  justify-center">
        <span className="whitespace-nowrap">{mensaje}</span>
        <button
          onClick={copyToClipboard}
          className="hover:opacity-70 transition "
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-copy align-middle"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>
      </div>
    </div>
  );
}
