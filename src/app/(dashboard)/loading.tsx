export default function DashboardLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6 animate-pulse px-2 py-2">
      {/* Page Title Skeleton */}
      <div className="flex flex-col gap-2 mb-2">
        <div className="h-8 w-48 bg-slate-200/60 rounded-md"></div>
        <div className="h-4 w-72 bg-slate-100 rounded-md"></div>
      </div>

      {/* Primary Cards Skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="h-32 bg-white rounded-xl border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"></div>
        <div className="h-32 bg-white rounded-xl border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"></div>
        <div className="h-32 bg-white rounded-xl border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hidden md:block"></div>
        <div className="h-32 bg-white rounded-xl border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hidden lg:block"></div>
      </div>

      {/* Main Content Area Skeleton */}
      <div className="flex-1 mt-4">
        <div className="h-12 w-full bg-slate-100/50 rounded-t-xl border-t border-x border-slate-100"></div>
        <div className="h-[400px] w-full bg-white rounded-b-xl border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"></div>
      </div>
    </div>
  )
}
