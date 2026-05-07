"use client";

import { useState } from "react";
import { type CallLogEntry } from "@/lib/admin-data";
import { formatTimeInBusinessZone, formatWeekdayTimeInBusinessZone, isTodayInBusinessZone } from "@/lib/timezone";

export function CallLogRow({ call }: { call: CallLogEntry }) {
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [loadingRecording, setLoadingRecording] = useState(false);

  const timeLabel = isTodayInBusinessZone(call.callStartedAt)
    ? formatTimeInBusinessZone(call.callStartedAt)
    : formatWeekdayTimeInBusinessZone(call.callStartedAt);

  const durationMinutes = call.durationSeconds ? Math.floor(call.durationSeconds / 60) : null;
  const durationLabel = durationMinutes ? `${durationMinutes}m` : "−";

  const outcomeColors = {
    booked: "bg-[#56b989]",
    completed: "bg-[#6398cc]",
    abandoned: "bg-[#d3b149]",
    error: "bg-[#ff6464]",
  };

  const loadRecording = async () => {
    if (recordingUrl) {
      setRecordingUrl(null);
      return;
    }
    setLoadingRecording(true);
    try {
      const response = await fetch(`/api/admin/call-logs/${call.callId}/recording`, {
        headers: { "x-admin-api-key": process.env.NEXT_PUBLIC_ADMIN_API_KEY || "" },
      });
      if (response.ok) {
        const data = await response.json();
        setRecordingUrl(data.url);
      }
    } catch (error) {
      console.error("Failed to load recording:", error);
    } finally {
      setLoadingRecording(false);
    }
  };

  return (
    <details className="border-b border-[rgba(255,255,255,0.06)] last:border-b-0">
      <summary className="grid cursor-pointer list-none grid-cols-[150px_1fr_120px_120px_150px] items-center gap-4 px-5 py-6">
        <span className="font-mono text-[16px] tracking-[0.16em] text-[#d8b960]">{timeLabel}</span>
        <div className="grid gap-1 truncate">
          <span className="text-[14px] font-semibold text-[#f5f0e8] truncate">{call.callerName || "Unknown"}</span>
          <span className="text-[13px] text-[#b6ab97] font-mono truncate">{call.callerPhone || "No phone"}</span>
        </div>
        <span className="text-[14px] text-[#b9b09f]">{durationLabel}</span>
        <span className={`rounded-[6px] px-3 py-2 text-center text-[13px] capitalize text-[#f5f0e8] font-semibold ${outcomeColors[call.outcome]}`}>
          {call.outcome}
        </span>
        <span className="text-[13px] text-[#b6ab97] truncate">{call.shortSummary ? call.shortSummary.substring(0, 40) + (call.shortSummary.length > 40 ? "..." : "") : "No summary"}</span>
      </summary>
      <div className="grid gap-4 bg-[#1f1e25] px-5 pb-5 pt-3 md:grid-cols-2">
        <div className="grid gap-2 text-[14px] leading-7 text-[#bdb19e]">
          <p><span className="text-[#f5f0e8]">Call ID:</span> <span className="font-mono text-[12px]">{call.callId}</span></p>
          <p><span className="text-[#f5f0e8]">Caller:</span> {call.callerName || "Unknown"} • {call.callerPhone || "Unknown"}</p>
          <p><span className="text-[#f5f0e8]">Duration:</span> {call.durationSeconds ? `${Math.floor(call.durationSeconds / 60)}m ${call.durationSeconds % 60}s` : "Unknown"}</p>
          <p><span className="text-[#f5f0e8]">Outcome:</span> <span className="capitalize">{call.outcome}</span> {call.bookingId ? `(Booking: ${call.bookingId})` : ""}</p>
          {call.summary ? <p><span className="text-[#f5f0e8]">Summary:</span> {call.summary}</p> : null}
        </div>
        <div className="grid gap-3">
          {call.hasRecording ? (
            <>
              <button
                onClick={loadRecording}
                disabled={loadingRecording}
                className="action-button justify-center disabled:opacity-50"
              >
                {loadingRecording ? "Loading..." : recordingUrl ? "Hide Recording" : "Play Recording"}
              </button>
              {recordingUrl ? (
                <audio
                  controls
                  src={recordingUrl}
                  className="w-full"
                  style={{
                    background: "#3a3832",
                    borderRadius: "6px",
                  }}
                />
              ) : null}
            </>
          ) : (
            <div className="rounded-[6px] bg-[rgba(255,255,255,0.06)] p-3 text-center text-[13px] text-[#857c6e]">
              No recording available
            </div>
          )}
        </div>
      </div>
    </details>
  );
}
