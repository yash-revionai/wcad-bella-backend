import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { getCallLogsData, type CallLogEntry } from "@/lib/admin-data";
import { CallsSkeleton } from "@/components/skeletons/calls-skeleton";
import { CallLogRow } from "./call-log-row";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function CallsContent(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const searchParams = await props.searchParams;
  const cursor = typeof searchParams.cursor === "string" ? searchParams.cursor : undefined;
  const data = await getCallLogsData({ cursor, pageSize: 20 });

  return (
    <div className="min-h-screen">
      <PageHeader title="Call Logs" />
      <div className="px-8 py-7">
        <div className="mb-5">
          <p className="font-mono text-[14px] uppercase tracking-[0.22em] text-[#8f8577]">All incoming calls</p>
        </div>

        {data.error ? (
          <div className="panel mb-5 bg-[rgba(255,100,100,0.1)] p-4 text-[#ff6464]">
            <p>Error loading call logs: {data.error}</p>
          </div>
        ) : null}

        <div className="panel overflow-hidden">
          <div className="grid grid-cols-[150px_1fr_120px_120px_150px] border-b border-[rgba(255,255,255,0.06)] bg-[#24232b] px-5 py-4 font-mono text-[11px] uppercase tracking-[0.22em] text-[#857c6e]">
            <span>Date / Time</span>
            <span>Caller</span>
            <span>Duration</span>
            <span>Outcome</span>
            <span>Summary</span>
          </div>

          {data.calls.length > 0 ? (
            data.calls.map((call: CallLogEntry) => (
              <CallLogRow key={call.callId} call={call} />
            ))
          ) : (
            <div className="px-5 py-6 text-center text-[#b6ab97]">
              No call logs found
            </div>
          )}
        </div>

        {data.next ? (
          <div className="mt-5 flex justify-center">
            <a href={`?cursor=${encodeURIComponent(data.next)}`} className="ghost-button text-[#f5f0e8]">
              Load more
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}
export default function CallsPage(props: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<CallsSkeleton />}>
      <CallsContent searchParams={props.searchParams} />
    </Suspense>
  );
}
