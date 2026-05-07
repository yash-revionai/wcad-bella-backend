"use client";

import { ArrowRight, Check, X } from "lucide-react";
import Link from "next/link";

export interface AccountSummary {
  id: string;
  name: string;
  todayBookingsCount: number;
  weekRevenueCents: number;
  callCountThisWeek: number;
  googleConnected: boolean;
  isYourAccount?: boolean;
}

export function UserCard({ account }: { account: AccountSummary }) {
  return (
    <div className="panel p-5 grid gap-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-semibold text-[16px] text-[#f5f0e8]">{account.name}</h3>
          {account.isYourAccount && (
            <span className="text-[12px] text-[#d3b149]">Your Account</span>
          )}
        </div>
        {account.googleConnected && (
          <Check className="h-4 w-4 text-[#56b989]" />
        )}
        {!account.googleConnected && (
          <X className="h-4 w-4 text-[#ff6464]" />
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 text-[13px]">
        <div className="rounded bg-[rgba(255,255,255,0.04)] p-2">
          <p className="text-[#857c6e]">Today</p>
          <p className="font-semibold text-[#f5f0e8]">{account.todayBookingsCount}</p>
        </div>
        <div className="rounded bg-[rgba(255,255,255,0.04)] p-2">
          <p className="text-[#857c6e]">Week $</p>
          <p className="font-semibold text-[#f5f0e8]">${(account.weekRevenueCents / 100).toFixed(0)}</p>
        </div>
        <div className="rounded bg-[rgba(255,255,255,0.04)] p-2">
          <p className="text-[#857c6e]">Calls</p>
          <p className="font-semibold text-[#f5f0e8]">{account.callCountThisWeek}</p>
        </div>
      </div>

      <Link href={`/dashboard/users/${account.id}`} className="ghost-button flex items-center justify-center gap-2 text-[#f5f0e8] text-[14px]">
        View Dashboard
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
