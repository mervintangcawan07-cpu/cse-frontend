import DatabaseLoadingIndicator from "@/components/common/DatabaseLoadingIndicator";
import PaymentConfirmationLoader from "@/components/common/PaymentConfirmationLoader";

export default function DashboardLoadingState({ verifyingPayment }: Readonly<{ verifyingPayment: boolean }>) {
  return (
    <div className="w-full space-y-4 px-4 py-4 sm:px-5 sm:py-6 md:px-6 xl:px-0">
      <PaymentConfirmationLoader isOpen={verifyingPayment} />
      <DatabaseLoadingIndicator
        title="Loading Reviewee Dashboard & Analytics..."
        subtitle="Querying real-time civil service readiness metrics, study streak, and diagnostic scores."
        skeletonCount={4}
      />
    </div>
  );
}

export function DashboardPageFallback() {
  return (
    <div className="flex w-full flex-col items-center justify-center space-y-3 py-24 text-center font-bold text-slate-400 animate-pulse">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      <p className="text-xs font-black uppercase tracking-widest text-slate-500">
        Loading student dashboard...
      </p>
    </div>
  );
}

